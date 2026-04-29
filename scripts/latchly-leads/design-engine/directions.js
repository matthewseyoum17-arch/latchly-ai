/**
 * design-engine/directions.js
 *
 * Maps a (niche + signals) to a curated design direction. v1 ships
 * `craft-editorial` end-to-end; other directions fall back to it gracefully.
 */

const DIRECTION_KEYS = [
  'craft-editorial',
  'premium-minimal',
  'trust-warm',
  'emergency-bold',
  'regional-authority',
  'modern-techy',
];

function pickDirection(lead = {}, enrichment = {}) {
  const niche = String(lead.niche || '').toLowerCase();
  const services = (enrichment.servicesVerified || []).map(s => String(s).toLowerCase());
  const ratingHigh = (enrichment.averageRating || 0) >= 4.7 && (enrichment.reviewCount || 0) >= 100;
  const yearsLong = (enrichment.yearsInBusiness || 0) >= 15;

  if (services.some(s => /emergency|24\/7|24-7|same.day/.test(s)) || /emergency/.test(niche)) {
    return 'emergency-bold';
  }
  if (yearsLong || enrichment.bbbAccreditation?.accredited) {
    return 'regional-authority';
  }
  if (ratingHigh) {
    return 'trust-warm';
  }
  return 'craft-editorial';
}

module.exports = {
  DIRECTION_KEYS,
  pickDirection,
};
