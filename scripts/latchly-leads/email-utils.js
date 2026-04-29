// Shared email-quality helpers. The pipeline used to call two near-identical
// firstContactEmail() copies (pipeline.js + storage.js) that picked the FIRST
// syntactically-valid email and shipped it — so a generic info@ scraped from
// a page footer beat a real person@ on the contact page if it appeared first.
// Classify-and-sort here so both call sites pick the best candidate, not just
// the earliest one.

const VALID_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Local-parts that almost always belong to a generic inbox, not the owner.
// We don't drop these outright — a one-person business may have only info@ —
// but we sort them last so a personal mailbox wins when present.
const ROLE_LOCAL_PARTS = new Set([
  'info', 'noreply', 'no-reply', 'donotreply', 'do-not-reply',
  'contact', 'sales', 'hello', 'hi', 'support', 'admin', 'help',
  'enquiries', 'enquiry', 'inquiry', 'inquiries', 'office', 'reception',
  'team', 'mail', 'email', 'webmaster', 'postmaster', 'service', 'services',
  'jobs', 'careers', 'hr', 'billing', 'accounts', 'accounting',
]);

// Free-mail domains we shouldn't mistake for a business mailbox even when the
// local-part looks personal. These signal a personal account, not a business
// contact, and tend to bounce on B2B outreach.
const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'live.com', 'outlook.com', 'msn.com', 'aol.com',
  'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me',
  'zoho.com', 'gmx.com', 'fastmail.com',
]);

function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().toLowerCase();
  return VALID_EMAIL_RE.test(trimmed) ? trimmed : '';
}

function localPart(email) {
  const at = email.indexOf('@');
  return at === -1 ? email : email.slice(0, at);
}

function domainPart(email) {
  const at = email.indexOf('@');
  return at === -1 ? '' : email.slice(at + 1);
}

function isRoleEmail(email) {
  return ROLE_LOCAL_PARTS.has(localPart(email));
}

function isFreeMailDomain(email) {
  return FREE_MAIL_DOMAINS.has(domainPart(email));
}

// Person-shaped local parts: first.last, first_last, flast, first-last,
// first only (>=3 chars; rules out "hi"/"info"). Heuristic — used to
// score, not to gate.
function isPersonShapedLocal(local) {
  if (!local || local.length < 3) return false;
  if (ROLE_LOCAL_PARTS.has(local)) return false;
  if (/^[a-z]+[._-][a-z]+$/.test(local)) return true;          // first.last
  if (/^[a-z]\.?[a-z]{2,}$/.test(local)) return true;          // flast / f.last
  if (/^[a-z]{3,}$/.test(local) && !ROLE_LOCAL_PARTS.has(local)) return true; // first
  return false;
}

// Higher score = better candidate.
function scoreEmail(email, { businessDomain } = {}) {
  if (!email) return -1;
  const local = localPart(email);
  const domain = domainPart(email);
  let score = 0;
  if (isPersonShapedLocal(local)) score += 10;
  if (!isRoleEmail(email)) score += 4;
  if (businessDomain && domain === businessDomain.toLowerCase()) score += 6;
  if (!isFreeMailDomain(email)) score += 2;
  // Penalize very long random-looking local parts (often hashed addresses)
  if (local.length > 24) score -= 2;
  return score;
}

// Pick the best email from a list of candidates. Filters out invalid format,
// then sorts by score, returns the top one or '' if none valid. Keeps role
// emails in the pool so single-mailbox businesses don't end up with nothing.
function pickBestEmail(candidates, { businessDomain } = {}) {
  if (!Array.isArray(candidates)) candidates = [candidates];
  const seen = new Set();
  const valid = [];
  for (const raw of candidates) {
    const email = normalizeEmail(raw);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    valid.push(email);
  }
  if (!valid.length) return '';
  valid.sort((a, b) => scoreEmail(b, { businessDomain }) - scoreEmail(a, { businessDomain }));
  return valid[0];
}

// Sort an email list best-first without dropping any.
function rankEmails(emails, { businessDomain } = {}) {
  const valid = (Array.isArray(emails) ? emails : [])
    .map(normalizeEmail)
    .filter(Boolean);
  const unique = [...new Set(valid)];
  unique.sort((a, b) => scoreEmail(b, { businessDomain }) - scoreEmail(a, { businessDomain }));
  return unique;
}

function deriveBusinessDomain(websiteOrEmail) {
  if (!websiteOrEmail) return '';
  if (websiteOrEmail.includes('@')) return domainPart(normalizeEmail(websiteOrEmail));
  try {
    const url = websiteOrEmail.startsWith('http') ? websiteOrEmail : `https://${websiteOrEmail}`;
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

module.exports = {
  VALID_EMAIL_RE,
  ROLE_LOCAL_PARTS,
  FREE_MAIL_DOMAINS,
  normalizeEmail,
  localPart,
  domainPart,
  isRoleEmail,
  isFreeMailDomain,
  isPersonShapedLocal,
  scoreEmail,
  pickBestEmail,
  rankEmails,
  deriveBusinessDomain,
};
