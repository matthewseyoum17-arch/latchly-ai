/**
 * scripts/latchly-leads/finders/whois.js
 *
 * Free verified-source finder #3: domain WHOIS registrant email.
 *
 * Older small businesses frequently registered domains before the GDPR
 * mass-redaction wave and never paid for privacy. WHOIS for those domains
 * still exposes a real registrant email, often the owner's personal or
 * business address. Real verified data — no guessing.
 *
 * We invoke the system `whois` command (present in most Linux/Vercel
 * runtimes; if missing, this finder fails gracefully and the orchestrator
 * falls through). Output is parsed line-by-line.
 *
 * We aggressively reject privacy-service replies (Domains By Proxy,
 * Whois Privacy Corp, RedactedForPrivacy, Withheld for Privacy, etc.) so
 * we never surface those as the owner's email.
 */

const { spawn } = require('child_process');

const TIMEOUT_MS = 8000;

const PRIVACY_DOMAINS = [
  'domainsbyproxy.com',
  'whoisprivacy',
  'whoisguard',
  'privacyguardian.org',
  'withheldforprivacy.com',
  'contactprivacy.com',
  'privacyprotect.org',
  'redactedforprivacy',
  'protectedbywhois',
  'tieredaccess.com',
  'data-protected.net',
];

const PRIVACY_TEXT = [
  'redacted for privacy',
  'gdpr masked',
  'masked by',
  'whois privacy',
  'privacy service',
  'data privacy',
  'private registration',
  'registration private',
];

function isPrivacyEmail(email) {
  if (!email) return false;
  const lowered = String(email).toLowerCase();
  // Normalize hyphens/underscores/dots to spaces so phrase matches catch
  // both "redacted for privacy" (in plain text) and "redacted-for-privacy@..."
  // (when the privacy service used the phrase as the local-part).
  const normalized = lowered.replace(/[._\-]+/g, ' ');
  return PRIVACY_DOMAINS.some(d => lowered.includes(d))
    || PRIVACY_TEXT.some(t => normalized.includes(t) || lowered.includes(t));
}

function runWhois(domain, timeoutMs = TIMEOUT_MS) {
  return new Promise(resolve => {
    let proc;
    try {
      proc = spawn('whois', [domain], { timeout: timeoutMs });
    } catch {
      return resolve({ ok: false, reason: 'spawn_failed' });
    }
    let out = '';
    let err = '';
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      try { proc.kill('SIGKILL'); } catch {}
      resolve(value);
    };
    proc.stdout?.on('data', d => { out += d.toString(); });
    proc.stderr?.on('data', d => { err += d.toString(); });
    proc.on('error', e => settle({ ok: false, reason: `whois_error:${e?.code || e?.message || 'unknown'}` }));
    proc.on('close', code => {
      if (code !== 0 && !out.trim()) return settle({ ok: false, reason: `whois_exit_${code}`, stderr: err.slice(0, 200) });
      settle({ ok: true, text: out });
    });
    setTimeout(() => settle({ ok: false, reason: 'whois_timeout' }), timeoutMs + 500);
  });
}

const EMAIL_RE = /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i;

const REGISTRANT_FIELD_RE = /^\s*(registrant\s+email|registrant\s+contact\s+email|registrant\s+e[\s-]?mail|admin\s+email|admin\s+contact\s+email|tech\s+email)\s*:\s*(.+)\s*$/i;
const REGISTRANT_NAME_RE = /^\s*(registrant\s+name|registrant\s+contact\s+name|registrant\s+organization)\s*:\s*(.+)\s*$/i;

function parseWhois(text) {
  const lines = String(text || '').split(/\r?\n/);
  let registrantEmail = null;
  let adminEmail = null;
  let registrantName = null;
  let registrantOrg = null;

  for (const line of lines) {
    const fieldMatch = line.match(REGISTRANT_FIELD_RE);
    if (fieldMatch) {
      const fieldName = fieldMatch[1].toLowerCase();
      const valueMatch = fieldMatch[2].match(EMAIL_RE);
      if (!valueMatch) continue;
      const email = valueMatch[0].toLowerCase();
      if (isPrivacyEmail(email)) continue;
      if (fieldName.startsWith('registrant')) {
        registrantEmail = registrantEmail || email;
      } else if (fieldName.startsWith('admin')) {
        adminEmail = adminEmail || email;
      }
      continue;
    }
    const nameMatch = line.match(REGISTRANT_NAME_RE);
    if (nameMatch) {
      const value = nameMatch[2].trim();
      if (/^(redacted|masked|withheld|private|n\/a)/i.test(value)) continue;
      if (nameMatch[1].toLowerCase().includes('organization')) {
        if (!registrantOrg) registrantOrg = value;
      } else if (!registrantName) {
        registrantName = value;
      }
    }
  }

  return { registrantEmail, adminEmail, registrantName, registrantOrg };
}

const ENTITY_KEYWORDS = /\b(LLC|INC|CORP|CO|COMPANY|HOLDINGS|GROUP|ENTERPRISES?|PARTNERS?|ASSOCIATES?|LLP|LP|PA|PLLC|PLC|FOUNDATION|TRUST)\b/i;

function isPersonShapedName(name) {
  if (!name) return false;
  const cleaned = String(name).trim();
  if (!cleaned) return false;
  if (ENTITY_KEYWORDS.test(cleaned)) return false;
  const tokens = cleaned.split(/\s+/).filter(t => /^[A-Za-z][A-Za-z'\-.]+$/.test(t) && t.length >= 2);
  return tokens.length >= 2;
}

/**
 * @param {Object} args
 * @param {string} args.domain — required; e.g. "acme-plumbing.com"
 * @returns {Promise<{ ok, reason?, email?, ownerName?, source, confidence, evidence? }>}
 */
async function find({ domain } = {}) {
  if (!domain) return { ok: false, reason: 'no_domain', source: 'whois' };
  const cleanDomain = String(domain).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (!cleanDomain || !cleanDomain.includes('.')) {
    return { ok: false, reason: 'invalid_domain', source: 'whois' };
  }

  const result = await runWhois(cleanDomain);
  if (!result.ok) return { ok: false, reason: result.reason, source: 'whois' };

  const parsed = parseWhois(result.text);
  const email = parsed.registrantEmail || parsed.adminEmail || null;
  const ownerName = isPersonShapedName(parsed.registrantName) ? parsed.registrantName : null;

  if (!email && !ownerName) {
    return { ok: false, reason: 'redacted_or_empty', source: 'whois' };
  }

  return {
    ok: true,
    email,
    ownerName,
    source: 'whois',
    // WHOIS data is real but stale — registrants rarely update. Confidence
    // 0.8 for email (the registrant is paying for the domain), 0.65 for name
    // (often abbreviated or organization rather than person).
    confidence: email ? 0.8 : 0.65,
    evidence: {
      domain: cleanDomain,
      registrantOrg: parsed.registrantOrg || null,
      hadRegistrantEmail: Boolean(parsed.registrantEmail),
      hadAdminEmail: Boolean(parsed.adminEmail),
    },
  };
}

module.exports = { find, _internals: { parseWhois, isPrivacyEmail, isPersonShapedName } };
