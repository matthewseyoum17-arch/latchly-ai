/**
 * Shared utilities for the variation engine.
 */

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pick(arr, seed) {
  return arr[seed % arr.length];
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s/&-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectNiche(niche) {
  const n = normalizeText(niche).replace(/[^a-z]/g, '');
  if (/plumb/.test(n)) return 'plumbing';
  if (/roof/.test(n)) return 'roofing';
  return 'hvac';
}

function makeSlug(businessName, city, state) {
  return [businessName, city, state]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function buildCoverageZones(city) {
  const safeCity = String(city || 'Your City').trim() || 'Your City';
  return [
    `${safeCity} proper`,
    `Downtown ${safeCity}`,
    `North ${safeCity}`,
    `South ${safeCity}`,
    `East ${safeCity}`,
    `West ${safeCity}`,
    `Central ${safeCity}`,
    `Nearby suburbs`,
    `Surrounding communities`,
    `Emergency calls across the metro`,
  ];
}

function extractBusinessSignals(lead = {}) {
  const niche = detectNiche(lead.niche);
  const haystack = normalizeText([
    lead.business_name,
    lead.category,
    lead.categories,
    lead.description,
    lead.notes,
    niche,
  ].filter(Boolean).join(' '));

  const tests = {
    emergencyHeavy: /emergency|24\/?7|after hours|rescue|rapid|same day|urgent|flood|storm|damage|drain|rooter|sewer|water damage/.test(haystack),
    trustHeavy: /family|family owned|father|mother|son|sons|brothers|neighborhood|local|honest|trusted|since 19|since 20/.test(haystack),
    authorityHeavy: /regional|metro|county|statewide|restoration|contracting|group|company|services|solutions|commercial/.test(haystack),
    premiumHeavy: /elite|signature|luxury|premier|legacy|estate|concierge|white glove|bespoke/.test(haystack),
    craftHeavy: /master|craft|artisan|custom|design build|detail|detailing|hand built|precision/.test(haystack),
    modernHeavy: /smart|precision|energy|efficient|comfort|air|digital|online|modern|proflow|eco/.test(haystack),
  };

  return { niche, haystack, ...tests };
}

module.exports = {
  escHtml,
  hashStr,
  pick,
  normalizeText,
  detectNiche,
  makeSlug,
  buildCoverageZones,
  extractBusinessSignals,
};
