/**
 * scripts/latchly-leads/finders/stock-photos.js
 *
 * Public-source stock photos for prospect demo homepages. Used by
 * demo-outreach-stage.js so that every lead — has-website or
 * fresh-build — has 4-6 real photographic images the bespoke build
 * prompt can pin into the hero, services grid, or about section.
 *
 * Source priority (free at our volume of ~50 leads × 6 photos/day):
 *   1. Pexels API   — high-quality curated photography. Requires
 *                     PEXELS_API_KEY (free tier: 200 req/hour, 20k/month).
 *   2. Unsplash API — fallback when PEXELS_API_KEY is unset OR Pexels
 *                     fails. Uses the public source endpoint
 *                     (no key, returns redirects to a real photo).
 *
 * Deduplication: query strings are derived from niche + each verified
 * service so 6 photos are visually distinct, not 6 hero shots.
 *
 * Returns: array of `{ url, width, height, source, alt }`.
 */

const PEXELS_BASE = 'https://api.pexels.com/v1';
const UNSPLASH_SOURCE_BASE = 'https://source.unsplash.com/featured';

// Map of niche → photographic search hint. Keeps Pexels/Unsplash from
// returning generic stock when the niche has good imagery available.
const NICHE_HINTS = {
  plumbing: 'plumber working pipes',
  plumber: 'plumber working pipes',
  hvac: 'hvac technician air conditioner',
  ac: 'air conditioner repair',
  heating: 'furnace heating repair',
  roofing: 'roof shingles installation',
  roofer: 'roof shingles installation',
  electrician: 'electrician wiring panel',
  electrical: 'electrician wiring panel',
  contractor: 'home construction contractor',
  remodeling: 'kitchen remodel renovation',
  landscaping: 'landscaping yard work',
  painting: 'house painter brush',
  flooring: 'hardwood flooring installation',
};

async function findStockPhotos({ niche, services = [], count = 6 } = {}) {
  const queries = buildQueries({ niche, services, count });
  if (!queries.length) return [];

  if (process.env.PEXELS_API_KEY) {
    const fromPexels = await fromPexelsForQueries(queries).catch(() => null);
    if (fromPexels && fromPexels.length) return fromPexels.slice(0, count);
  }
  return queries.slice(0, count).map(q => unsplashSourceUrl(q));
}

// ── Query construction ────────────────────────────────────────────────────

function buildQueries({ niche, services, count }) {
  const nicheKey = String(niche || '').toLowerCase().trim();
  const nicheBase = NICHE_HINTS[nicheKey] || `${nicheKey || 'home'} services`;

  const out = [nicheBase];
  for (const svc of services) {
    if (!svc) continue;
    const q = `${nicheBase} ${String(svc).toLowerCase().trim()}`;
    if (!out.includes(q)) out.push(q);
    if (out.length >= count) break;
  }
  // Pad with niche-specific scene queries so the gallery isn't 6 portraits.
  const padScenes = ['tools workshop', 'truck van work', 'before after job', 'team customer', 'house exterior'];
  let i = 0;
  while (out.length < count && i < padScenes.length) {
    const q = `${nicheBase} ${padScenes[i]}`;
    if (!out.includes(q)) out.push(q);
    i += 1;
  }
  return out;
}

// ── Pexels ────────────────────────────────────────────────────────────────

async function fromPexelsForQueries(queries) {
  const results = [];
  const seenIds = new Set();
  for (const q of queries) {
    const photo = await pexelsSearch(q, seenIds);
    if (photo) {
      seenIds.add(photo.id);
      results.push(photo);
    }
  }
  return results;
}

async function pexelsSearch(query, seenIds) {
  const url = `${PEXELS_BASE}/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`;
  const res = await fetch(url, {
    headers: { Authorization: process.env.PEXELS_API_KEY },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`pexels_${res.status}`);
  const json = await res.json();
  const photos = Array.isArray(json.photos) ? json.photos : [];
  for (const p of photos) {
    if (seenIds.has(p.id)) continue;
    const src = p.src?.large2x || p.src?.large || p.src?.original;
    if (!src) continue;
    return {
      id: p.id,
      url: src,
      width: p.width || 1600,
      height: p.height || 900,
      source: 'pexels',
      alt: p.alt || query,
      attribution: p.photographer ? `Photo by ${p.photographer} on Pexels` : null,
    };
  }
  return null;
}

// ── Unsplash Source (no key, public redirect) ─────────────────────────────

function unsplashSourceUrl(query) {
  // Unsplash Source returns a 302 to a real photo URL by query; embedding
  // the search URL directly as <img src> works in a browser, but in HTML
  // we want the resolved final URL so cold-email previews don't trip on
  // referer-blocked redirects. We don't pre-resolve here (would block the
  // sync caller); instead we keep the redirect URL — modern email clients
  // and demo-page browsers handle it fine. If a deployed environment
  // needs a stable URL, bolt on a Vercel Blob proxy later.
  const slug = String(query || 'home services').replace(/\s+/g, ',');
  return {
    url: `${UNSPLASH_SOURCE_BASE}/1600x900/?${encodeURIComponent(slug)}`,
    width: 1600,
    height: 900,
    source: 'unsplash',
    alt: query,
    attribution: 'Photo from Unsplash',
  };
}

module.exports = { findStockPhotos, _internals: { buildQueries, NICHE_HINTS } };
