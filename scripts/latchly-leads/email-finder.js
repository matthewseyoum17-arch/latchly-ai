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

// Words that look name-shaped but actually denote a department/role/place.
// Pattern-guessing on these produces junk like service.department@domain
// that would torch the warmup. Match against either name part.
const NON_PERSON_TOKENS = new Set([
  'service', 'services', 'department', 'departments', 'team', 'teams',
  'office', 'reception', 'front', 'desk', 'main', 'general', 'admin',
  'administration', 'customer', 'care', 'support', 'help', 'inquiry',
  'inquiries', 'sales', 'billing', 'accounts', 'accounting', 'hr',
  'careers', 'jobs', 'info', 'information', 'contact', 'corporate',
  'group', 'company', 'co', 'inc', 'llc', 'corp', 'enterprises',
  'holdings', 'partners', 'associates', 'unknown', 'tbd', 'na',
]);

const NAME_PARTICLES = new Set([
  'jr', 'sr', 'ii', 'iii', 'iv', 'v',
]);

// Returns true if the name looks like a real human first+last (not a role,
// not a department, not a single token). Pattern-guess gates on this — the
// cost of a wrong guess is a hard bounce + warmup damage.
function isPersonName(name) {
  const trimmed = String(name || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return false;
  // Strip particles (Jr, Sr, II, III, ...) and middle initials (single
  // letters) — those don't disqualify the rest of the name. The remaining
  // tokens must form a credible first + last.
  const parts = trimmed.split(/\s+/)
    .map(part => ({ raw: part, word: part.replace(/[^A-Za-z]/g, '').toLowerCase() }))
    .filter(({ word }) => word.length > 0)
    .filter(({ word }) => !NAME_PARTICLES.has(word))
    .filter(({ word }) => word.length >= 2);
  if (parts.length < 2) return false;
  for (const { word } of parts) {
    if (NON_PERSON_TOKENS.has(word)) return false;
  }
  return true;
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

// Default minimum confidence required for the input owner name. Audit-derived
// names land at 0.6+; BBB / JSON-LD at 0.85-0.9; LLM-only at 0.7. Heuristic
// fallbacks (business name → "John") sit at 0.5. We refuse anything below
// 0.6 by default so weak candidates don't ship guessed emails.
const DEFAULT_MIN_CONFIDENCE = Number(process.env.LATCHLY_EMAIL_GUESS_MIN_CONF || 0.6);

// Find the best valid permutation for a person+domain. Refuses to guess
// when the input ownerName fails the personhood check (department / role /
// single token) or sits below the confidence floor — both produce junk
// emails that hard-bounce and damage warmup. Caller can override via
// `minConfidence` for paths that already validated upstream.
async function findEmail({ ownerName, website, domain, ownerConfidence, minConfidence } = {}) {
  const floor = typeof minConfidence === 'number' ? minConfidence : DEFAULT_MIN_CONFIDENCE;
  const conf = typeof ownerConfidence === 'number' ? ownerConfidence : null;
  if (conf != null && conf < floor) {
    return { ok: false, reason: `owner_confidence_below_floor:${conf.toFixed(2)}<${floor}`, ownerName, ownerConfidence: conf };
  }
  if (!isPersonName(ownerName)) {
    return { ok: false, reason: 'owner_name_not_person_shaped', ownerName };
  }
  const resolvedDomain = (domain || deriveBusinessDomain(website || '') || '').toLowerCase();
  if (!resolvedDomain) return { ok: false, reason: 'no_domain' };
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
    ownerConfidence: conf,
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
  isPersonName,
  splitName,
};
