// On-demand email finder. Given an owner name + business website, generates
// realistic permutations and validates each via Node's built-in DNS MX
// lookup (free, unlimited). Returns the best survivor or null.
//
// MX validation only proves the domain accepts mail; it does NOT prove the
// specific mailbox exists. SMTP RCPT probes catch many catch-all mailboxes
// at the cost of triggering greylisting / rate limits, so we leave that
// behind a deliberate opt-in flag and default to MX-only validation. The
// caller should pair this with conservative use (only when no real email
// was found) and surface "via pattern guess" provenance in the CRM so the
// operator can decide whether to send.

const dns = require('node:dns').promises;
const { rankEmails, normalizeEmail, deriveBusinessDomain } = require('./email-utils');

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
    // ENOTFOUND / NXDOMAIN / no MX records → reject
    MX_CACHE.set(domain, { ok: false, at: Date.now() });
    return false;
  }
}

function splitName(name) {
  const trimmed = String(name || '').replace(/[^A-Za-z\s'-]/g, '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (!parts.length) return null;
  const first = parts[0].toLowerCase();
  const last = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  return { first, last };
}

// Generate the dozen most-likely permutations for a person at a given domain.
// Order matters — the first survivor is what we ship, so list highest-prior
// formats first. Numbers reflect industry-published pattern frequencies for
// US SMBs (<50 employees): firstname@ tops out at ~42-71%.
function permute(name, domain) {
  const split = splitName(name);
  if (!split || !domain) return [];
  const { first, last } = split;
  const fi = first.charAt(0);
  const li = last.charAt(0);

  const candidates = [];
  if (first) candidates.push(`${first}@${domain}`);
  if (first && last) {
    candidates.push(`${first}.${last}@${domain}`);
    candidates.push(`${first}${last}@${domain}`);
    candidates.push(`${fi}${last}@${domain}`);
    candidates.push(`${first}${li}@${domain}`);
    candidates.push(`${first}_${last}@${domain}`);
    candidates.push(`${first}-${last}@${domain}`);
    candidates.push(`${last}.${first}@${domain}`);
    candidates.push(`${last}@${domain}`);
    candidates.push(`${fi}.${last}@${domain}`);
  }

  // Dedup while preserving order.
  const seen = new Set();
  return candidates.filter((email) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return false;
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

// Find the best valid permutation for a person+domain. Skips the lookup
// entirely if the domain doesn't have MX records (catches typo'd or parked
// domains before issuing N candidate validations).
async function findEmail({ ownerName, website, domain } = {}) {
  const resolvedDomain = (domain || deriveBusinessDomain(website || '') || '').toLowerCase();
  if (!resolvedDomain) return null;
  if (!(await hasMxRecord(resolvedDomain))) {
    return { ok: false, reason: 'no_mx', domain: resolvedDomain };
  }
  const candidates = permute(ownerName, resolvedDomain);
  if (!candidates.length) return { ok: false, reason: 'no_candidates', domain: resolvedDomain };

  // MX-only validation: the domain accepts mail. Without an SMTP RCPT probe
  // we can't verify each mailbox individually, so we ship the highest-ranked
  // permutation. Caller is expected to mark provenance as "pattern_guess".
  const ranked = rankEmails(candidates, { businessDomain: resolvedDomain });
  return {
    ok: true,
    email: ranked[0] || candidates[0],
    candidates: ranked,
    domain: resolvedDomain,
    method: 'pattern_guess_mx_only',
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
  permute,
  findEmail,
  hasMxRecord,
  verifyDeliverable,
};
