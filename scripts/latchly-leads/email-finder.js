/**
 * scripts/latchly-leads/email-finder.js
 *
 * Verified-only email finder. The previous version pattern-guessed
 * `firstname@domain` permutations and validated each against the domain's
 * MX records — that produced `pattern_guess_mx_only` provenance which
 * shipped guessed addresses that hard-bounced and damaged Resend warmup.
 *
 * This module no longer guesses. It delegates to the verified-source
 * finder chain (BBB → WHOIS → Yelp → on-page scrape) via
 * ./finders/index.js, and returns a real source-tagged email or
 * `{ ok: false, reason: 'not_available' }`.
 *
 * The legacy `findEmail` export still exists so existing callers don't
 * break; it now returns a verified hit (or null) rather than a guess.
 *
 * MX validation is preserved as a sanity check for emails surfaced from
 * scraping (e.g. a typo'd `mailto:` on the contact page).
 */

const dns = require('node:dns').promises;
const { normalizeEmail, deriveBusinessDomain } = require('./email-utils');
const {
  findEmailFromVerifiedSources,
} = require('./finders');

const MX_CACHE = new Map();
const MX_CACHE_MS = 30 * 60 * 1000;

async function hasMxRecord(domain) {
  if (!domain) return false;
  const cached = MX_CACHE.get(domain);
  if (cached && Date.now() - cached.at < MX_CACHE_MS) return cached.ok;
  try {
    const records = await dns.resolveMx(domain);
    const ok = Array.isArray(records) && records.length > 0;
    MX_CACHE.set(domain, { ok, at: Date.now() });
    return ok;
  } catch {
    MX_CACHE.set(domain, { ok: false, at: Date.now() });
    return false;
  }
}

/**
 * Find a real, verified email for a business. Calls the finder chain;
 * returns the best verified hit or { ok: false, reason: 'not_available' }.
 *
 * Older callers passed `{ ownerName, website, domain, ownerConfidence }`
 * for the pattern-guess path. We accept the same shape for backwards
 * compat but ownerName/ownerConfidence are now informational only — they
 * never produce a guess. If the chain returns nothing, we return `not_available`.
 *
 * @param {Object} args
 * @param {string} [args.businessName]
 * @param {string} [args.city]
 * @param {string} [args.state]
 * @param {string} [args.website]
 * @param {string} [args.domain]
 * @param {string} [args.ownerName]
 * @returns {Promise<{ ok, email?, source?, confidence?, method?, attempted, reason?, ownerName? }>}
 */
async function findEmail(args = {}) {
  const result = await findEmailFromVerifiedSources(args);
  if (!result.ok) return result;
  return {
    ...result,
    // Map source tag to the legacy `method` field for callers that read it.
    method: `verified:${result.source}`,
  };
}

// Verify a known email address by checking the domain's MX records. Used at
// write-time to drop syntactically-valid but undeliverable candidates.
async function verifyDeliverable(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, reason: 'invalid_format' };
  const domain = normalized.split('@')[1];
  const ok = await hasMxRecord(domain);
  return { ok, reason: ok ? 'mx_present' : 'no_mx', email: normalized, domain };
}

module.exports = {
  findEmail,
  hasMxRecord,
  verifyDeliverable,
  // Re-export so callers that want to bypass the legacy shape can use the
  // structured chain directly.
  findEmailFromVerifiedSources,
};
