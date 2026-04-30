/**
 * scripts/latchly-leads/finders/index.js
 *
 * Verified-source finder orchestrator. Replaces the deleted pattern-guess
 * fallback with a chain of free, public, real-data sources:
 *
 *   1. BBB profile pages          — owner + email
 *   2. OpenCorporates US registry — owner (no email; state filings)
 *   3. WHOIS                      — email + sometimes name
 *   4. Yelp profile               — owner first name + sometimes email
 *
 * The chain stops at the first hit whose confidence >= floor (default 0.7).
 * If no source returns ok, the orchestrator returns { ok: false, reason:
 * 'not_available' } — the runtime is expected to set the lead's
 * email_status='not_available' rather than emit a guess.
 *
 * NOTHING in this module ever generates a pattern-guessed email. If we
 * can't verify it, we don't ship it.
 */

const { find: findBbb } = require('./bbb');
const { find: findOpenCorp } = require('./opencorporates');
const { find: findWhois } = require('./whois');
const { find: findYelp } = require('./yelp');
const { deriveBusinessDomain } = require('../email-utils');

const DEFAULT_CONFIDENCE_FLOOR = 0.7;

function deriveDomain(websiteOrDomain) {
  if (!websiteOrDomain) return '';
  return deriveBusinessDomain(String(websiteOrDomain));
}

/**
 * Find the owner from any verified source. Stops at first hit ≥ floor.
 *
 * @param {Object} args
 * @param {string} args.businessName
 * @param {string} [args.city]
 * @param {string} [args.state]
 * @param {string} [args.website]
 * @param {string} [args.domain]
 * @param {number} [args.minConfidence=0.7]
 * @returns {Promise<{ ok: boolean, ownerName?: string, ownerTitle?: string, source?: string, confidence?: number, attempted: string[], reason?: string, evidence?: object }>}
 */
async function findOwnerFromVerifiedSources(args = {}) {
  const { businessName, city, state, website, domain } = args;
  const floor = typeof args.minConfidence === 'number' ? args.minConfidence : DEFAULT_CONFIDENCE_FLOOR;
  const resolvedDomain = (domain || deriveDomain(website) || '').toLowerCase();
  const attempted = [];
  const notes = [];

  if (!businessName) {
    return { ok: false, reason: 'no_business_name', attempted, notes };
  }

  // 1. BBB
  attempted.push('bbb');
  try {
    const bbb = await findBbb({ businessName, city, state, domain: resolvedDomain });
    if (bbb.ok && bbb.ownerName && bbb.confidence >= floor) {
      return { ...bbb, attempted, notes };
    }
    if (bbb.reason) notes.push(`bbb:${bbb.reason}`);
  } catch (err) {
    notes.push(`bbb_error:${err?.message || err}`);
  }

  // 2. OpenCorporates
  attempted.push('opencorporates');
  try {
    const oc = await findOpenCorp({ businessName, state });
    if (oc.ok && oc.ownerName && oc.confidence >= floor) {
      return { ...oc, attempted, notes };
    }
    if (oc.reason) notes.push(`opencorporates:${oc.reason}`);
  } catch (err) {
    notes.push(`opencorporates_error:${err?.message || err}`);
  }

  // 3. Yelp
  attempted.push('yelp');
  try {
    const yp = await findYelp({ businessName, city, state, domain: resolvedDomain });
    if (yp.ok && yp.ownerName && yp.confidence >= floor) {
      return { ...yp, attempted, notes };
    }
    if (yp.reason) notes.push(`yelp:${yp.reason}`);
  } catch (err) {
    notes.push(`yelp_error:${err?.message || err}`);
  }

  // 4. WHOIS — fallback for owner only when registrant is a person
  if (resolvedDomain) {
    attempted.push('whois');
    try {
      const w = await findWhois({ domain: resolvedDomain });
      if (w.ok && w.ownerName && w.confidence >= floor) {
        return { ...w, attempted, notes };
      }
      if (w.reason) notes.push(`whois:${w.reason}`);
    } catch (err) {
      notes.push(`whois_error:${err?.message || err}`);
    }
  }

  return { ok: false, reason: 'not_available', attempted, notes };
}

/**
 * Find an email from any verified source. Stops at first hit.
 *
 * @param {Object} args
 * @param {string} args.businessName
 * @param {string} [args.city]
 * @param {string} [args.state]
 * @param {string} [args.website]
 * @param {string} [args.domain]
 * @param {string} [args.ownerName] — used only as evidence for prioritizing on-domain emails; never to generate a guess
 * @param {number} [args.minConfidence=0.7]
 * @returns {Promise<{ ok: boolean, email?: string, source?: string, confidence?: number, attempted: string[], reason?: string, ownerName?: string, evidence?: object }>}
 */
async function findEmailFromVerifiedSources(args = {}) {
  const { businessName, city, state, website, domain } = args;
  const floor = typeof args.minConfidence === 'number' ? args.minConfidence : DEFAULT_CONFIDENCE_FLOOR;
  const resolvedDomain = (domain || deriveDomain(website) || '').toLowerCase();
  const attempted = [];
  const notes = [];

  if (!businessName && !resolvedDomain) {
    return { ok: false, reason: 'no_business_name_or_domain', attempted, notes };
  }

  // 1. BBB profile (often has mailto:)
  if (businessName) {
    attempted.push('bbb');
    try {
      const bbb = await findBbb({ businessName, city, state, domain: resolvedDomain });
      if (bbb.ok && bbb.email && bbb.confidence >= floor) {
        return { ...bbb, attempted, notes };
      }
      if (bbb.reason) notes.push(`bbb:${bbb.reason}`);
    } catch (err) {
      notes.push(`bbb_error:${err?.message || err}`);
    }
  }

  // 2. WHOIS registrant email (when not redacted)
  if (resolvedDomain) {
    attempted.push('whois');
    try {
      const w = await findWhois({ domain: resolvedDomain });
      if (w.ok && w.email && w.confidence >= floor) {
        return { ...w, attempted, notes };
      }
      if (w.reason) notes.push(`whois:${w.reason}`);
    } catch (err) {
      notes.push(`whois_error:${err?.message || err}`);
    }
  }

  // 3. Yelp profile occasionally surfaces a direct email
  if (businessName) {
    attempted.push('yelp');
    try {
      const yp = await findYelp({ businessName, city, state, domain: resolvedDomain });
      if (yp.ok && yp.email && yp.confidence >= floor) {
        return { ...yp, attempted, notes };
      }
      if (yp.reason) notes.push(`yelp:${yp.reason}`);
    } catch (err) {
      notes.push(`yelp_error:${err?.message || err}`);
    }
  }

  return { ok: false, reason: 'not_available', attempted, notes };
}

/**
 * Convenience: run both finders and return whatever each surfaces. Used by
 * the bulk-enrich endpoint when target='both'.
 */
async function findOwnerAndEmail(args = {}) {
  const [owner, email] = await Promise.all([
    findOwnerFromVerifiedSources(args),
    findEmailFromVerifiedSources(args),
  ]);
  return { owner, email };
}

module.exports = {
  findOwnerFromVerifiedSources,
  findEmailFromVerifiedSources,
  findOwnerAndEmail,
  DEFAULT_CONFIDENCE_FLOOR,
};
