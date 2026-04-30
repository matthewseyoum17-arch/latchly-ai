/**
 * scripts/latchly-leads/finders/opencorporates.js
 *
 * Free verified-source finder #2: OpenCorporates US-wide registry.
 *
 * OpenCorporates is a free public-data company registry covering all 50
 * states. Search returns matched companies with optional `officers` arrays
 * — these are real registered officers (President, Manager, Member, etc.)
 * pulled from state filings. Real verified data — no guessing.
 *
 * Free tier: rate-limited, no key required, ~50 calls/hour anonymous. The
 * orchestrator handles backoff at the top level. We make at most 2 HTTP
 * requests per lookup (search → company detail) so a typical CRM bulk run
 * stays under cap.
 *
 * Failures return { ok: false, reason }. Never throws.
 */

const TIMEOUT_MS = 9000;
const USER_AGENT =
  'leadpilot-ai/1.0 (+https://latchlyai.com; contact: matt@latchlyai.com)';

const API_BASE = 'https://api.opencorporates.com/v0.4';

async function fetchJson(url, timeoutMs = TIMEOUT_MS) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, json: await res.json() };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|company|the|ltd|lp|llp|pa|pllc|plc)\b/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ENTITY_KEYWORDS = /\b(LLC|INC|CORP|CORPORATION|COMPANY|HOLDINGS|TRUST|GROUP|ENTERPRISES?|PARTNERS?|ASSOCIATES?|LLP|LP|PA|PLLC|PLC|FOUNDATION|BANK)\b/i;

function isPersonShaped(name) {
  if (!name) return false;
  const cleaned = String(name).replace(/\s+/g, ' ').trim();
  if (!cleaned) return false;
  if (ENTITY_KEYWORDS.test(cleaned)) return false;
  // Strip particles and middle initials.
  const parts = cleaned
    .split(/\s+/)
    .map(p => p.replace(/[^A-Za-z]/g, ''))
    .filter(p => p.length >= 2 && !['jr', 'sr', 'ii', 'iii', 'iv'].includes(p.toLowerCase()));
  return parts.length >= 2;
}

function titleCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/(^|[\s'\-])(\w)/g, (_, sep, ch) => sep + ch.toUpperCase());
}

// "Last, First Middle" → "First Last"
function rotateLastFirst(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed.includes(',')) return trimmed;
  const [last, first] = trimmed.split(',').map(s => s.trim());
  if (!first || !last) return trimmed;
  const firstToken = first.split(/\s+/)[0];
  return `${firstToken} ${last}`;
}

// Officers worth surfacing as "owner" — order = priority.
const OWNER_TITLE_ORDER = [
  /^(?:president|ceo|chief\s+executive)/i,
  /^(?:owner|sole\s+proprietor|founder)/i,
  /^(?:managing\s+member|managing\s+partner|manager)/i,
  /^(?:authorized\s+(?:member|person)|amber|ambr)/i,
  /^(?:member|partner|principal)/i,
  /^(?:director|chairman)/i,
];

function rankOfficers(officers) {
  return [...officers].sort((a, b) => {
    const ai = officerRank(a.position);
    const bi = officerRank(b.position);
    return ai - bi;
  });
}

function officerRank(position) {
  if (!position) return 99;
  for (let i = 0; i < OWNER_TITLE_ORDER.length; i += 1) {
    if (OWNER_TITLE_ORDER[i].test(position)) return i;
  }
  return 90; // unknown title — keep but de-prioritize
}

/**
 * Look up the business by name + state and return the best officer match.
 * @param {Object} args
 * @param {string} args.businessName
 * @param {string} [args.state] — 2-letter US state code
 * @returns {Promise<{ ok, reason?, ownerName?, ownerTitle?, source, confidence, evidence? }>}
 */
async function find({ businessName, state } = {}) {
  if (!businessName) return { ok: false, reason: 'no_business_name', source: 'opencorporates' };

  const searchParams = new URLSearchParams({
    q: businessName,
    inactive: 'false',
    per_page: '5',
  });
  if (state) searchParams.set('jurisdiction_code', `us_${String(state).toLowerCase()}`);

  const search = await fetchJson(`${API_BASE}/companies/search?${searchParams.toString()}`);
  if (!search.ok) {
    return { ok: false, reason: search.status === 429 ? 'rate_limited' : `search_failed_${search.status || search.error}`, source: 'opencorporates' };
  }
  const companies = search.json?.results?.companies || [];
  if (!companies.length) return { ok: false, reason: 'no_companies', source: 'opencorporates' };

  const targetNorm = normalizeName(businessName);
  // Prefer exact normalized match; otherwise first active result.
  let match = companies.find(c => normalizeName(c.company?.name) === targetNorm);
  if (!match) match = companies.find(c => c.company?.current_status?.toLowerCase().includes('active'));
  if (!match) match = companies[0];

  const company = match.company;
  if (!company) return { ok: false, reason: 'no_company_in_match', source: 'opencorporates' };

  // The search listing usually doesn't include officers; fetch the detail.
  const detailUrl = `${API_BASE}/companies/${company.jurisdiction_code}/${company.company_number}`;
  const detail = await fetchJson(detailUrl);
  if (!detail.ok) {
    return { ok: false, reason: `detail_failed_${detail.status || detail.error}`, source: 'opencorporates' };
  }
  const officers = (detail.json?.results?.company?.officers || [])
    .map(o => o.officer)
    .filter(Boolean);
  if (!officers.length) {
    return { ok: false, reason: 'no_officers', source: 'opencorporates', evidence: { detailUrl } };
  }

  // Surface the highest-priority person-shaped officer that's still active.
  const ranked = rankOfficers(officers);
  const candidate = ranked.find(o => {
    if (o.end_date) return false; // skip departed officers
    const name = rotateLastFirst(o.name);
    return isPersonShaped(name);
  });
  if (!candidate) {
    return { ok: false, reason: 'no_person_shaped_officer', source: 'opencorporates', evidence: { detailUrl, officerCount: officers.length } };
  }

  const finalName = titleCase(rotateLastFirst(candidate.name));
  // Confidence: exact-name match → 0.9, partial → 0.78. Penalize stale records.
  const exactMatch = normalizeName(company.name) === targetNorm;
  let confidence = exactMatch ? 0.9 : 0.78;
  if (candidate.position && officerRank(candidate.position) >= 90) confidence -= 0.1;
  return {
    ok: true,
    ownerName: finalName,
    ownerTitle: titleCase(candidate.position || 'Officer'),
    source: 'opencorporates',
    confidence,
    evidence: {
      jurisdiction: company.jurisdiction_code,
      companyNumber: company.company_number,
      detailUrl,
      currentStatus: company.current_status,
    },
  };
}

module.exports = { find };
