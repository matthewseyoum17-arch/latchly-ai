/**
 * scripts/latchly-leads/enrichment.js
 *
 * Per-lead enrichment for v1 demo + cold-email pipeline.
 * Pulls real per-business data from public sources so demos and emails
 * reference actual reviews, services, owner names, photos.
 *
 * Sources (each isolated; one failure does not abort the rest):
 *   - Google Places API: reviews, photos, services, hours, website confirm
 *   - Existing site scrape: brand colors, logo, services, testimonials, about copy
 *   - BBB profile (already parsed at discovery): owner-level signals
 *
 * Skipped in v1 (gated behind env flags or deferred):
 *   - Yelp (LATCHLY_ENABLE_YELP=1)
 *   - Florida DBPR licensing detail (already in source_payload from discovery)
 */

const { scrapeSiteContent } = require('../openclaw-demo-builder');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.LATCHLY_ENRICH_TIMEOUT_MS || '15000', 10);
const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';
const PLACES_FIELDS = [
  'place_id',
  'name',
  'formatted_address',
  'formatted_phone_number',
  'international_phone_number',
  'website',
  'url',
  'rating',
  'user_ratings_total',
  'reviews',
  'opening_hours',
  'photos',
  'business_status',
  'types',
  'geometry/location',
].join(',');

async function enrichLead(lead, opts = {}) {
  const result = {
    placeId: null,
    ownerName: null,
    ownerFirstName: null,
    ownerTitle: null,
    yearsInBusiness: null,
    servicesVerified: [],
    reviews: [],
    reviewCount: 0,
    averageRating: null,
    photos: [],
    hours: null,
    serviceArea: [],
    licenses: [],
    bbbAccreditation: null,
    brandColors: null,
    brandLogo: null,
    brandTagline: null,
    existingCopy: null,
    enrichmentErrors: [],
    enrichedAt: new Date().toISOString(),
  };

  // 1) Google Places — phone-first lookup, then text query fallback
  const places = await safeRun('places', () => fetchPlaces(lead, opts), result.enrichmentErrors);
  if (places) {
    result.placeId = places.placeId || null;
    result.reviews = places.reviews || [];
    result.reviewCount = places.reviewCount || 0;
    result.averageRating = places.averageRating;
    result.photos = places.photos || [];
    result.hours = places.hours || null;
    result.formattedAddress = places.formattedAddress || null;
    result.coordinates = places.coordinates || null;
    result.googleMapsUrl = places.googleMapsUrl || null;
    result.servicesVerified.push(...(places.servicesVerified || []));
  }

  // 2) Existing site scrape (only if lead has a website)
  if (lead.website) {
    const cloned = await safeRun('site_clone', () => scrapeWithTimeout(lead.website, opts.timeoutMs || DEFAULT_TIMEOUT_MS), result.enrichmentErrors);
    if (cloned) {
      result.existingCopy = {
        hero: cloned.tagline || null,
        about: cloned.aboutText || null,
        services: cloned.services || [],
        testimonials: cloned.testimonials || [],
      };
      if (cloned.logoUrl) result.brandLogo = { url: cloned.logoUrl, dominantColor: cloned.colors?.[0] || null };
      if (cloned.colors && cloned.colors.length) {
        result.brandColors = {
          primary: cloned.colors[0] || null,
          secondary: cloned.colors[1] || null,
        };
      }
      result.brandTagline = cloned.tagline || null;
      if (Array.isArray(cloned.services) && cloned.services.length) {
        for (const svc of cloned.services) {
          if (svc && !result.servicesVerified.includes(svc)) result.servicesVerified.push(svc);
        }
      }
      if (cloned.yearsInBusiness && Number.isFinite(cloned.yearsInBusiness)) {
        result.yearsInBusiness = cloned.yearsInBusiness;
      }
      if (Array.isArray(cloned.certifications) && cloned.certifications.length && !result.licenses.length) {
        for (const cert of cloned.certifications) {
          result.licenses.push({ type: 'certification', label: cert, source: 'site' });
        }
      }
    }
  }

  // 3) BBB profile signals already in source_payload from discovery
  applyBbbSignals(lead, result);

  // 4) Owner + email inference. Highest-trust source is the CRM scrape's
  //    audit_payload.verifiedSignals.contactTruth (Playwright-verified),
  //    then falls back to lead-level fields. Same data path the CRM uses.
  applyAuditTruth(lead, result);
  applyOwner(lead, result);

  // 5) Service area = nearby cities from source payload (best-effort)
  if (lead.city) result.serviceArea = [lead.city];

  result.servicesVerified = dedupeStrings(result.servicesVerified).slice(0, 12);
  return result;
}

async function fetchPlaces(lead, opts = {}) {
  const apiKey = opts.googleApiKey || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('no_google_api_key');

  const placeId = await findPlaceId(lead, apiKey, opts.timeoutMs || DEFAULT_TIMEOUT_MS);
  if (!placeId) return null;

  const url = `${PLACES_BASE}/details/json?place_id=${encodeURIComponent(placeId)}&fields=${PLACES_FIELDS}&key=${apiKey}`;
  const resp = await fetchWithTimeout(url, opts.timeoutMs || DEFAULT_TIMEOUT_MS);
  if (!resp.ok) throw new Error(`places_details_${resp.status}`);
  const json = await resp.json();
  if (json.status !== 'OK') throw new Error(`places_status_${json.status}`);
  const data = json.result || {};

  const reviews = Array.isArray(data.reviews)
    ? data.reviews
        .filter(r => r && (r.text || r.author_name))
        .slice(0, 5)
        .map(r => ({
          author: r.author_name || null,
          rating: r.rating || null,
          text: cleanReviewText(r.text || ''),
          date: r.relative_time_description || null,
          source: 'google',
        }))
        .filter(r => r.text && r.text.length > 20)
    : [];

  const photos = Array.isArray(data.photos)
    ? data.photos.slice(0, 6).map(p => ({
        url: `${PLACES_BASE}/photo?maxwidth=1600&photo_reference=${p.photo_reference}&key=${apiKey}`,
        width: p.width,
        height: p.height,
        attribution: (p.html_attributions || [])[0] || null,
        source: 'google',
        license: 'gbp',
      }))
    : [];

  let hours = null;
  if (data.opening_hours && Array.isArray(data.opening_hours.weekday_text)) {
    hours = {};
    for (const line of data.opening_hours.weekday_text) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (m) hours[m[1].toLowerCase().slice(0, 3)] = m[2];
    }
  }

  return {
    placeId,
    averageRating: typeof data.rating === 'number' ? data.rating : null,
    reviewCount: typeof data.user_ratings_total === 'number' ? data.user_ratings_total : reviews.length,
    reviews,
    photos,
    hours,
    formattedAddress: data.formatted_address || null,
    coordinates: data.geometry?.location?.lat != null && data.geometry?.location?.lng != null
      ? { lat: Number(data.geometry.location.lat), lng: Number(data.geometry.location.lng) }
      : null,
    googleMapsUrl: data.url || null,
    servicesVerified: Array.isArray(data.types)
      ? data.types
          .filter(t => !['point_of_interest', 'establishment'].includes(t))
          .map(t => t.replace(/_/g, ' '))
      : [],
  };
}

async function findPlaceId(lead, apiKey, timeoutMs) {
  if (lead.placeId) return lead.placeId;

  const queryParts = [lead.businessName, lead.city, lead.state].filter(Boolean);
  if (!queryParts.length) return null;
  const query = queryParts.join(' ');

  const url = `${PLACES_BASE}/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${apiKey}`;
  const resp = await fetchWithTimeout(url, timeoutMs);
  if (!resp.ok) return null;
  const json = await resp.json();
  return (json.candidates || [])[0]?.place_id || null;
}

async function scrapeWithTimeout(url, timeoutMs) {
  const promise = scrapeSiteContent(url);
  const guard = new Promise((_, reject) => setTimeout(() => reject(new Error('site_clone_timeout')), timeoutMs));
  return Promise.race([promise, guard]);
}

function applyBbbSignals(lead, result) {
  const raw = lead.rawPayload || lead.sourcePayload?.rawPayload || {};
  if (raw.bbbMember || raw.bbbRating) {
    result.bbbAccreditation = {
      accredited: Boolean(raw.bbbMember),
      rating: raw.bbbRating || null,
      since: raw.bbbAccreditedSince || null,
    };
  }
  if (raw.yearsInBusiness && !result.yearsInBusiness) {
    const n = Number(raw.yearsInBusiness);
    if (Number.isFinite(n) && n > 0 && n < 200) result.yearsInBusiness = n;
  }
}

function applyAuditTruth(lead, result) {
  // Audit data may live on lead.audit (from in-memory pipeline run) or
  // lead.auditPayload (from DB row). Either way, it's the same shape.
  const audit = lead.audit || lead.auditPayload || lead.audit_payload || null;
  if (!audit || typeof audit !== 'object') return;

  const verified = audit.verifiedSignals || audit.verified_signals;
  if (!verified || typeof verified !== 'object') return;

  const contact = verified.contactTruth || verified.contact_truth || {};

  // Owner / contact name (Playwright-verified, confidence-tagged)
  const candidate = contact.contactName || contact.contact_name;
  if (candidate && (candidate.confidence ?? 0) >= 0.6 && typeof candidate.value === 'string') {
    const name = candidate.value.replace(/\s+/g, ' ').trim();
    if (name && !/^[\[{]/.test(name)) {
      result.ownerName = result.ownerName || name;
      result.ownerFirstName = result.ownerFirstName || name.split(/\s+/)[0] || null;
      result.ownerTitle = result.ownerTitle || candidate.title || null;
    }
  }

  // Verified emails (from Playwright crawl) outrank discovery emails.
  const emails = Array.isArray(contact.emails) ? contact.emails : [];
  const verifiedEmails = emails
    .filter(e => e && (typeof e === 'string' || e.value))
    .map(e => (typeof e === 'string' ? e : e.value))
    .filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  if (verifiedEmails.length) {
    result.verifiedEmails = verifiedEmails.slice(0, 3);
  }

  // Niche refinement from businessTruth (overrides discovery niche only when
  // confidence is high — discovery may have been generic).
  const niche = (verified.businessTruth || verified.business_truth || {}).niche;
  if (niche && (niche.confidence ?? 0) >= 0.7 && typeof niche.value === 'string') {
    result.nicheVerified = niche.value;
  }

  // Negative signals from playwright website-quality audit. Useful in the
  // demo+email so we can tell the lead WHY their site needs work — but only
  // surface the labels, never as the email's hook (CAN-SPAM-friendly tone).
  const quality = verified.websiteQuality || verified.website_quality || {};
  if (Array.isArray(quality.negativeSignals)) {
    result.siteIssues = quality.negativeSignals
      .filter(s => s && (s.confidence ?? 0) >= 0.7)
      .slice(0, 6)
      .map(s => ({ key: s.key, reason: s.reason, weight: s.weight, confidence: s.confidence }));
  }
}

function applyOwner(lead, result) {
  const candidate =
    lead.decisionMaker?.name ||
    lead.decisionMakerName ||
    lead.ownerName ||
    lead.contactName ||
    null;
  if (!candidate) return;
  const name = String(candidate).replace(/\s+/g, ' ').trim();
  if (!name || /^[\[{]/.test(name)) return;
  result.ownerName = name;
  result.ownerFirstName = name.split(/\s+/)[0] || null;
  result.ownerTitle =
    lead.decisionMaker?.title || lead.decisionMakerTitle || lead.ownerTitle || lead.contactTitle || null;
}

async function fetchWithTimeout(url, timeoutMs) {
  return fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
}

async function safeRun(label, fn, errors) {
  try {
    return await fn();
  } catch (err) {
    errors.push({ source: label, error: err?.message || String(err) });
    return null;
  }
}

function cleanReviewText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);
}

function dedupeStrings(arr) {
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const norm = String(v || '').trim().toLowerCase();
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(String(v).trim());
  }
  return out;
}

async function enrichLeads(leads, opts = {}) {
  const concurrency = Math.max(1, Number(opts.concurrency) || 3);
  const results = {};
  const queue = leads.slice();
  async function worker() {
    while (queue.length) {
      const lead = queue.shift();
      const key = lead.businessKey || `${lead.businessName}|${lead.city}|${lead.state}`;
      try {
        results[key] = await enrichLead(lead, opts);
      } catch (err) {
        results[key] = {
          enrichmentErrors: [{ source: 'enrich', error: err?.message || String(err) }],
        };
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

module.exports = {
  enrichLead,
  enrichLeads,
};
