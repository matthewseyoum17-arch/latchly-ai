const { fetchText, normalizeKey, normalizePhone, normalizeWebsite, stripHtml } = require('./utils');

const DEFAULT_TIMEOUT_MS = Math.max(3000, parseInt(process.env.LATCHLY_WEBSITE_RESOLVER_TIMEOUT_MS || '9000', 10));
const GOOGLE_PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

function hasWebsiteResolverConfigured() {
  if (process.env.LATCHLY_DISABLE_WEBSITE_RESOLVER === '1') return false;
  return Boolean(
    process.env.SERPAPI_API_KEY
      || process.env.GOOGLE_MAPS_API_KEY
      || process.env.GOOGLE_PLACES_API_KEY,
  );
}

async function resolveMissingWebsite(lead = {}, options = {}) {
  const existing = normalizeWebsite(lead.website);
  if (existing) {
    return {
      website: existing,
      attempted: false,
      source: 'existing',
      confidence: 1,
      evidence: [evidence('existing', existing, 'Lead already has a normalized website URL', 1)],
    };
  }

  const rawCandidate = sourceWebsiteCandidates(lead)[0];
  if (rawCandidate) {
    const verified = await verifyWebsiteCandidate(rawCandidate, lead, {
      ...options,
      source: 'source_payload',
      identityScore: 0.75,
    });
    if (verified.ok) return verifiedResult(verified, 'source_payload');
  }

  if (process.env.LATCHLY_DISABLE_WEBSITE_RESOLVER === '1') {
    return {
      website: '',
      attempted: false,
      reason: 'resolver_disabled',
      evidence: [evidence('website_resolver', '', 'Website resolver disabled by environment', 0.2)],
    };
  }

  const fetcher = options.fetcher || fetchText;
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const candidates = [];
  const notes = [];
  let attempted = false;

  const googleKey = options.googleApiKey || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (googleKey) {
    attempted = true;
    try {
      candidates.push(...await googlePlacesCandidates(lead, googleKey, { fetcher, timeoutMs }));
    } catch (err) {
      notes.push(evidence('google_places', '', `Google Places lookup failed: ${err.message || err}`, 0.35));
    }
  }

  const serpKey = options.serpApiKey || process.env.SERPAPI_API_KEY;
  if (serpKey) {
    attempted = true;
    try {
      candidates.push(...await serpApiCandidates(lead, serpKey, { fetcher, timeoutMs }));
    } catch (err) {
      notes.push(evidence('serpapi_google_maps', '', `SerpAPI Google Maps lookup failed: ${err.message || err}`, 0.35));
    }
  }

  const ordered = dedupeCandidateWebsites(candidates)
    .filter(candidate => candidate.website)
    .sort((a, b) => Number(b.identityScore || 0) - Number(a.identityScore || 0));

  for (const candidate of ordered) {
    const verified = await verifyWebsiteCandidate(candidate.website, lead, {
      ...options,
      source: candidate.source,
      fetcher,
      timeoutMs,
      identityScore: candidate.identityScore,
      providerEvidence: candidate.evidence,
    });
    if (verified.ok) return verifiedResult(verified, candidate.source);
    notes.push(...verified.evidence);
  }

  if (process.env.LATCHLY_DISABLE_PUBLIC_DIRECTORY_RESOLVER !== '1') {
    try {
      const directory = await publicDirectoryResolution(lead, { ...options, fetcher, timeoutMs });
      attempted = attempted || directory.attempted;
      if (directory.website || directory.verifiedNoWebsite) return directory;
      notes.push(...(directory.evidence || []));
    } catch (err) {
      attempted = true;
      notes.push(evidence('public_directory_resolver', '', `Public directory resolver failed: ${err.message || err}`, 0.35));
    }
  }

  return {
    website: '',
    attempted,
    reason: attempted ? 'website_not_found' : 'no_resolver_configured',
    evidence: [
      ...notes.slice(-8),
      evidence(
        attempted ? 'website_resolver' : 'website_resolver_config',
        '',
        attempted
          ? 'No resolver candidate produced a verified business website'
          : 'No Google Places or SerpAPI key configured for missing-website verification',
        attempted ? 0.45 : 0.2,
      ),
    ],
  };
}

async function publicDirectoryResolution(lead = {}, options = {}) {
  const fetcher = options.fetcher || fetchText;
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const evidenceItems = [];
  const websiteCandidates = [];
  let attempted = false;

  for (const target of publicDirectoryTargets(lead)) {
    attempted = true;
    let res;
    try {
      res = await fetcher(target.url, timeoutMs);
    } catch (err) {
      evidenceItems.push(evidence(target.source, target.url, `Directory lookup failed: ${err.message || err}`, 0.3));
      continue;
    }
    if (!res?.ok || !res.text) {
      evidenceItems.push(evidence(target.source, target.url, `Directory lookup returned no usable HTML (status ${res?.status || 'unknown'})`, 0.3));
      continue;
    }

    const checked = target.source === 'yellowpages_search'
      ? analyzeYellowPagesSearch(res.text, lead, res.url || target.url)
      : analyzeDirectoryPage(res.text, lead, res.url || target.url, target.source);

    if (!checked.identityConfirmed) {
      evidenceItems.push(...checked.evidence);
      continue;
    }
    websiteCandidates.push(...checked.websiteCandidates);
    evidenceItems.push(...checked.evidence);

    for (const followUrl of checked.followUrls || []) {
      let profileRes;
      try {
        profileRes = await fetcher(followUrl, timeoutMs);
      } catch (err) {
        evidenceItems.push(evidence('yellowpages_profile', followUrl, `Directory profile lookup failed: ${err.message || err}`, 0.3));
        continue;
      }
      if (!profileRes?.ok || !profileRes.text) continue;
      const profile = analyzeDirectoryPage(profileRes.text, lead, profileRes.url || followUrl, 'yellowpages_profile');
      if (!profile.identityConfirmed) {
        evidenceItems.push(...profile.evidence);
        continue;
      }
      websiteCandidates.push(...profile.websiteCandidates);
      evidenceItems.push(...profile.evidence);
    }
  }

  const ownedWebsiteCandidates = dedupeCandidateWebsites(websiteCandidates);
  for (const candidate of ownedWebsiteCandidates) {
    const verified = await verifyWebsiteCandidate(candidate.website, lead, {
      ...options,
      source: candidate.source,
      fetcher,
      timeoutMs,
      identityScore: candidate.identityScore,
      providerEvidence: candidate.evidence,
    });
    if (verified.ok) return verifiedResult(verified, candidate.source);
    evidenceItems.push(...verified.evidence);
  }

  const noSiteEvidence = evidenceItems.filter(item => Number(item.confidence || 0) >= 0.8);
  if (!ownedWebsiteCandidates.length && noSiteEvidence.length) {
    return {
      website: '',
      attempted: true,
      verifiedNoWebsite: true,
      source: 'public_directory_resolver',
      reason: 'directory_verified_no_site',
      confidence: Math.max(...noSiteEvidence.map(item => Number(item.confidence || 0))),
      evidence: noSiteEvidence.slice(0, 6),
    };
  }

  return {
    website: '',
    attempted,
    reason: attempted ? 'directory_not_confirmed' : 'no_directory_context',
    evidence: evidenceItems.slice(-6),
  };
}

function publicDirectoryTargets(lead = {}) {
  const raw = lead.rawPayload || lead.sourcePayload?.rawPayload || lead.sourcePayload || {};
  const sourceName = String(lead.sourceName || '').toLowerCase();
  const targets = [];
  const add = (source, url) => {
    const normalized = normalizeWebsite(url);
    if (!normalized || !isDirectoryOrSocialHost(normalized)) return;
    if (targets.some(target => target.url === normalized)) return;
    targets.push({ source, url: normalized });
  };

  if (/yellowpages/.test(sourceName)) {
    add('yellowpages_profile', raw.profileUrl || raw.profile_url || '');
    add('yellowpages_search', raw.url || raw.searchUrl || '');
  }
  if (/bbb/.test(sourceName)) {
    add('bbb_profile', absoluteBbbProfileUrl(raw.profileUrl || raw.profile_url || raw.reportUrl || ''));
  }

  return targets.slice(0, 3);
}

function analyzeYellowPagesSearch(html, lead, url) {
  const chunks = String(html || '')
    .split(/<div[^>]+class=["'](?:result(?:\s[^"']*)?|search-results-organic[^"']*)["'][^>]*>/i)
    .slice(1, 25);
  const leadPhone = normalizePhone(lead.phone).replace(/\D/g, '');
  const leadName = normalizeKey(lead.businessName);

  for (const chunk of chunks) {
    const text = stripHtml(chunk);
    const chunkPhone = normalizePhone(text).replace(/\D/g, '');
    const chunkName = normalizeKey(text);
    if (leadPhone && chunkPhone !== leadPhone && !text.replace(/\D/g, '').includes(leadPhone)) continue;
    if (leadName && !chunkName.includes(leadName) && !leadName.includes(chunkName.slice(0, leadName.length))) continue;

    const profilePath = extractHref(chunk, /class=["'][^"']*business-name[^"']*["']/i);
    const profileUrl = profilePath
      ? new URL(decodeEntities(profilePath), 'https://www.yellowpages.com').href
      : '';
    const identity = scoreProviderIdentity({
      name: lead.businessName,
      formatted_phone_number: lead.phone,
      formatted_address: [lead.city, lead.state].filter(Boolean).join(', '),
    }, lead);
    const websites = officialWebsiteLinks(chunk);
    const noSite = websites.length
      ? []
      : [evidence('yellowpages_search', url, 'YellowPages search listing matched lead identity and exposed no business-owned Website link', 0.82)];
    return {
      identityConfirmed: identity.score >= 0.75,
      websiteCandidates: websites.map(website => ({
        source: 'yellowpages_search',
        website,
        identityScore: Math.max(0.82, identity.score),
        evidence: identity.evidence.concat([evidence('yellowpages_search', url, 'YellowPages listing exposed an official Website link', 0.82)]),
      })),
      followUrls: profileUrl ? [profileUrl] : [],
      evidence: identity.score >= 0.75
        ? noSite
        : [evidence('yellowpages_search', url, 'YellowPages listing did not match lead identity strongly enough', 0.35)],
    };
  }

  return {
    identityConfirmed: false,
    websiteCandidates: [],
    followUrls: [],
    evidence: [evidence('yellowpages_search', url, 'No matching YellowPages listing found for lead identity', 0.35)],
  };
}

function analyzeDirectoryPage(html, lead, url, source) {
  const text = stripHtml(html);
  const title = stripHtml(String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '')
    || stripHtml(String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
    || lead.businessName;
  const phoneMatch = text.match(/\(?\b\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/);
  const identity = scoreProviderIdentity({
    name: title,
    formatted_phone_number: phoneMatch?.[0] || '',
    formatted_address: text.slice(0, 5000),
  }, lead);
  const content = scoreWebsiteContent(html, lead);
  const identityScore = Math.max(identity.score, content.score);
  const websites = officialWebsiteLinks(html);
  const identityConfirmed = identityScore >= 0.65;

  if (!identityConfirmed) {
    return {
      identityConfirmed: false,
      websiteCandidates: [],
      followUrls: [],
      evidence: [evidence(source, url, 'Directory page did not match lead identity strongly enough', 0.35)],
    };
  }

  return {
    identityConfirmed: true,
    websiteCandidates: websites.map(website => ({
      source,
      website,
      identityScore: Math.max(0.82, identityScore),
      evidence: identity.evidence.concat(content.evidence).concat([
        evidence(source, url, 'Directory profile exposed an official Website link', 0.82),
      ]),
    })),
    followUrls: [],
    evidence: websites.length
      ? []
      : [evidence(source, url, 'Directory profile matched lead identity and exposed no business-owned Website link', 0.84)],
  };
}

async function googlePlacesCandidates(lead, apiKey, options = {}) {
  const fetcher = options.fetcher || fetchText;
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const query = searchQuery(lead);
  if (!query) return [];

  const findUrl = `${GOOGLE_PLACES_BASE}/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address&key=${encodeURIComponent(apiKey)}`;
  const findRes = await fetchJson(findUrl, fetcher, timeoutMs);
  const placeIds = (findRes.candidates || [])
    .map(candidate => candidate.place_id)
    .filter(Boolean)
    .slice(0, 3);

  const out = [];
  for (const placeId of placeIds) {
    const detailsUrl = `${GOOGLE_PLACES_BASE}/details/json?place_id=${encodeURIComponent(placeId)}&fields=place_id,name,formatted_address,formatted_phone_number,website,url,business_status,types&key=${encodeURIComponent(apiKey)}`;
    const details = await fetchJson(detailsUrl, fetcher, timeoutMs);
    if (details.status && details.status !== 'OK') continue;
    const result = details.result || {};
    const identity = scoreProviderIdentity(result, lead);
    out.push({
      source: 'google_places',
      website: normalizeWebsite(result.website || ''),
      identityScore: identity.score,
      evidence: identity.evidence.concat([
        evidence('google_places', result.url || '', `Matched Google place: ${result.name || 'unknown'}`, identity.score),
      ]),
    });
  }
  return out;
}

async function serpApiCandidates(lead, apiKey, options = {}) {
  const fetcher = options.fetcher || fetchText;
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_maps');
  url.searchParams.set('q', searchQuery(lead));
  url.searchParams.set('hl', 'en');
  url.searchParams.set('api_key', apiKey);

  const payload = await fetchJson(url.href, fetcher, timeoutMs);
  const rows = payload.local_results || (payload.place_results ? [payload.place_results] : []);
  return rows.slice(0, 5).map(result => {
    const identity = scoreProviderIdentity({
      name: result.title,
      formatted_address: result.address,
      formatted_phone_number: result.phone,
      url: result.place_id || result.data_id || '',
    }, lead);
    return {
      source: 'serpapi_google_maps',
      website: normalizeWebsite(result.website || ''),
      identityScore: identity.score,
      evidence: identity.evidence.concat([
        evidence('serpapi_google_maps', '', `Matched Google Maps result: ${result.title || 'unknown'}`, identity.score),
      ]),
    };
  });
}

async function verifyWebsiteCandidate(rawWebsite, lead, options = {}) {
  const website = normalizeWebsite(rawWebsite);
  if (!website) {
    return { ok: false, website: '', confidence: 0, evidence: [evidence(options.source || 'website_resolver', '', 'Candidate website URL failed normalization', 0.2)] };
  }
  if (isDirectoryOrSocialHost(website)) {
    return { ok: false, website, confidence: 0.2, evidence: [evidence(options.source || 'website_resolver', website, 'Candidate is a directory/social/profile URL, not a business-owned website', 0.2)] };
  }

  const fetcher = options.fetcher || fetchText;
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const identityScore = Number(options.identityScore || 0);
  const providerEvidence = Array.isArray(options.providerEvidence) ? options.providerEvidence : [];

  let response = null;
  try {
    response = await fetcher(website, timeoutMs);
  } catch (err) {
    if (identityScore >= 0.85) {
      return {
        ok: true,
        website,
        confidence: 0.72,
        evidence: providerEvidence.concat([
          evidence(options.source || 'website_resolver', website, `Provider matched business, but website fetch failed: ${err.message || err}`, 0.72),
        ]),
      };
    }
    return {
      ok: false,
      website,
      confidence: 0.3,
      evidence: providerEvidence.concat([
        evidence(options.source || 'website_resolver', website, `Website fetch failed before identity confirmation: ${err.message || err}`, 0.3),
      ]),
    };
  }

  if (!response?.ok || !response.text) {
    return {
      ok: false,
      website,
      confidence: 0.35,
      evidence: providerEvidence.concat([
        evidence(options.source || 'website_resolver', response?.url || website, `Website returned no usable HTML (status ${response?.status || 'unknown'})`, 0.35),
      ]),
    };
  }

  const finalUrl = normalizeWebsite(response.url || website);
  if (isDirectoryOrSocialHost(finalUrl)) {
    return {
      ok: false,
      website: finalUrl,
      confidence: 0.25,
      evidence: providerEvidence.concat([
        evidence(options.source || 'website_resolver', finalUrl, 'Resolved website is a directory/social/profile URL', 0.25),
      ]),
    };
  }

  const content = scoreWebsiteContent(response.text, lead);
  const confidence = Math.min(0.98, Math.max(identityScore, content.score));
  const accepted = content.score >= 0.65 || (identityScore >= 0.75 && content.score >= 0.35);
  return {
    ok: accepted,
    website: finalUrl || website,
    confidence: accepted ? confidence : Math.min(0.55, confidence),
    evidence: providerEvidence.concat(content.evidence.length
      ? content.evidence
      : [evidence(options.source || 'website_resolver', finalUrl || website, 'Website did not contain enough business-identity evidence', Math.min(0.55, confidence))]),
  };
}

function scoreProviderIdentity(result = {}, lead = {}) {
  const evidenceItems = [];
  let score = 0;

  const leadName = normalizeKey(lead.businessName);
  const resultName = normalizeKey(result.name || result.title);
  if (leadName && resultName) {
    if (leadName === resultName) {
      score += 0.65;
      evidenceItems.push(evidence('provider_identity', '', 'Provider business name exactly matched lead name', 0.65));
    } else if (leadName.includes(resultName) || resultName.includes(leadName)) {
      score += 0.55;
      evidenceItems.push(evidence('provider_identity', '', 'Provider business name substantially matched lead name', 0.55));
    } else {
      const overlap = tokenOverlap(distinctiveNameTokens(lead.businessName), distinctiveNameTokens(result.name || result.title));
      if (overlap >= 0.6) {
        score += 0.45;
        evidenceItems.push(evidence('provider_identity', '', 'Provider business name shared distinctive tokens with lead name', 0.45));
      }
    }
  }

  const leadPhone = normalizePhone(lead.phone).replace(/\D/g, '');
  const resultPhone = normalizePhone(result.formatted_phone_number || result.phone).replace(/\D/g, '');
  if (leadPhone && resultPhone && leadPhone === resultPhone) {
    score += 0.35;
    evidenceItems.push(evidence('provider_identity', '', 'Provider phone matched lead phone', 0.35));
  }

  const address = String(result.formatted_address || result.address || '').toLowerCase();
  if (lead.city && address.includes(String(lead.city).toLowerCase())) score += 0.1;
  if (lead.state && address.includes(String(lead.state).toLowerCase())) score += 0.05;

  return { score: Math.min(1, score), evidence: evidenceItems };
}

function scoreWebsiteContent(html, lead = {}) {
  const text = stripHtml(html).replace(/\s+/g, ' ').slice(0, 30000);
  const textKey = normalizeKey(text);
  const evidenceItems = [];
  let score = 0;

  const leadPhone = normalizePhone(lead.phone).replace(/\D/g, '');
  if (leadPhone && text.replace(/\D/g, '').includes(leadPhone)) {
    score += 0.45;
    evidenceItems.push(evidence('resolved_website', '', 'Website content contains the lead phone number', 0.9));
  }

  const tokens = distinctiveNameTokens(lead.businessName);
  const matched = tokens.filter(token => textKey.includes(token));
  if (tokens.length && matched.length) {
    const ratio = matched.length / tokens.length;
    score += ratio >= 0.67 ? 0.55 : 0.35;
    evidenceItems.push(evidence('resolved_website', '', `Website content matched business-name token(s): ${matched.join(', ')}`, ratio >= 0.67 ? 0.85 : 0.7));
  }

  if (lead.city && textKey.includes(normalizeKey(lead.city))) {
    score += 0.12;
    evidenceItems.push(evidence('resolved_website', '', 'Website content mentions lead city', 0.65));
  }

  return { score: Math.min(1, score), evidence: evidenceItems };
}

function sourceWebsiteCandidates(lead = {}) {
  const raw = lead.rawPayload || lead.sourcePayload?.rawPayload || lead.sourcePayload || {};
  const keys = [
    'website', 'Website', 'Company Website', 'url', 'URL', 'primaryUrl', 'primary_url',
    'business_url', 'businessUrl', 'websiteUrl', 'website_url',
  ];
  const out = [];
  for (const key of keys) {
    const value = raw?.[key];
    if (typeof value === 'string' && value.trim()) out.push(normalizeWebsite(value));
  }
  return [...new Set(out.filter(Boolean))];
}

function officialWebsiteLinks(html) {
  const out = [];
  const linkRe = /<a\b([^>]*\bhref=["'](https?:\/\/[^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRe.exec(String(html || '')))) {
    const attrs = match[1] || '';
    const href = decodeEntities(match[2] || '');
    const label = stripHtml(match[3] || '');
    if (!/website|visit\s+website|business\s+website|official\s+site|track-visit-website/i.test(`${attrs} ${label}`)) continue;
    const website = normalizeWebsite(href);
    if (!website || isDirectoryOrSocialHost(website)) continue;
    out.push(website);
  }
  return [...new Set(out)];
}

function extractHref(html, nearbyPattern) {
  const linkRe = /<a\b([^>]*\bhref=["']([^"']+)["'][^>]*)>/gi;
  let match;
  while ((match = linkRe.exec(String(html || '')))) {
    if (nearbyPattern.test(match[1] || '')) return match[2] || '';
  }
  return '';
}

function absoluteBbbProfileUrl(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://www.bbb.org${url.startsWith('/') ? '' : '/'}${url}`;
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function searchQuery(lead = {}) {
  return [lead.businessName, lead.city, lead.state].filter(Boolean).join(' ').trim();
}

function distinctiveNameTokens(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 4)
    .filter(token => !COMMON_NAME_TOKENS.has(token))
    .map(normalizeKey)
    .filter(Boolean);
}

function tokenOverlap(expected = [], actual = []) {
  if (!expected.length || !actual.length) return 0;
  const actualSet = new Set(actual);
  const matched = expected.filter(token => actualSet.has(token)).length;
  return matched / expected.length;
}

function dedupeCandidateWebsites(candidates = []) {
  const seen = new Set();
  const out = [];
  for (const candidate of candidates) {
    const website = normalizeWebsite(candidate.website);
    if (!website) continue;
    const key = website.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...candidate, website });
  }
  return out;
}

async function fetchJson(url, fetcher, timeoutMs) {
  const res = await fetcher(url, timeoutMs);
  if (!res?.ok || !res.text) throw new Error(`fetch_${res?.status || 'failed'}`);
  return JSON.parse(res.text);
}

function verifiedResult(verified, source) {
  return {
    website: verified.website,
    attempted: true,
    source,
    confidence: verified.confidence,
    evidence: verified.evidence,
  };
}

function isDirectoryOrSocialHost(rawUrl) {
  try {
    const host = new URL(normalizeWebsite(rawUrl)).hostname.toLowerCase();
    return /(^|\.)facebook\.com$|(^|\.)instagram\.com$|(^|\.)linkedin\.com$|(^|\.)yelp\.com$|(^|\.)yellowpages\.com$|(^|\.)bbb\.org$|(^|\.)angi\.com$|(^|\.)thumbtack\.com$|(^|\.)sites\.google\.com$/.test(host);
  } catch {
    return true;
  }
}

function evidence(source, url, detail, confidence) {
  return { source, url, detail, confidence };
}

const COMMON_NAME_TOKENS = new Set([
  'llc', 'inc', 'corp', 'co', 'company', 'contractor', 'contractors', 'construction',
  'service', 'services', 'plumbing', 'plumber', 'roofing', 'roofer', 'electrical',
  'electric', 'electrician', 'hvac', 'heating', 'cooling', 'air', 'mechanical',
  'remodeling', 'remodel', 'renovation', 'repair', 'repairs', 'solutions',
  'home', 'homes', 'custom', 'the', 'and',
]);

module.exports = {
  resolveMissingWebsite,
  hasWebsiteResolverConfigured,
  verifyWebsiteCandidate,
  scoreProviderIdentity,
  scoreWebsiteContent,
};
