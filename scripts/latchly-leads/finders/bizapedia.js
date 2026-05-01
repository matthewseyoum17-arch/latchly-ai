/**
 * scripts/latchly-leads/finders/bizapedia.js
 *
 * Verified-source finder: bizapedia.com.
 *
 * Bizapedia republishes Secretary-of-State filings as one-page profiles —
 * structured data, no auth required, all 50 states. More reliable than
 * scraping individual SOS portals because the URL pattern is uniform.
 *
 * Flow:
 *   1. Search bizapedia for the business name (+ state if known).
 *   2. Pick the first profile result whose business name fuzzy-matches.
 *   3. Scrape "Authorized Person(s)" / "Registered Agent" / "Officer" rows.
 *
 * Failures return { ok: false, reason }. Never throws.
 */

const TIMEOUT_MS = 9000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function decode(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/\s+/g, ' ')
    .trim();
}

function strip(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ');
}

function normalize(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|company|the|ltd)\b/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NON_PERSON = /\b(llc|inc|corp|company|holdings|partners?|associates?|group|enterprises?|services|solutions)\b/i;

function isPersonName(s) {
  if (!s) return false;
  const cleaned = String(s).replace(/[^A-Za-z'\-. ]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return false;
  if (NON_PERSON.test(cleaned)) return false;
  const tokens = cleaned.split(/\s+/).filter(t => t.length >= 2 && /^[A-Za-z]/.test(t));
  return tokens.length >= 2 && tokens.length <= 5;
}

function titleCase(s) {
  return String(s)
    .toLowerCase()
    .replace(/\b([a-z])/g, c => c.toUpperCase())
    .replace(/'([A-Z])/g, "'$1".toLowerCase());
}

function buildSearchUrl({ businessName, state }) {
  const q = encodeURIComponent(businessName);
  const base = 'https://www.bizapedia.com/searchresults.aspx';
  return state
    ? `${base}?Q=${q}&State=${encodeURIComponent(state)}`
    : `${base}?Q=${q}`;
}

// Bizapedia search results render profile links as `/<state>/<biz-slug>.html`
// or `/<state>/<biz-slug>` (variant pages drop the .html).
function extractProfileLinks(html) {
  const re = /href="(\/[a-z]{2}\/[A-Za-z0-9._\-]+(?:\.html?)?)"/gi;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    // Skip nav/category pages — profiles always have a hyphen-laden slug.
    if (!/[A-Za-z]-/.test(href)) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    out.push(`https://www.bizapedia.com${href}`);
    if (out.length >= 5) break;
  }
  return out;
}

function profileNameMatches(html, businessName) {
  const target = normalize(businessName);
  if (!target) return false;
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return false;
  const profileNorm = normalize(decode(strip(m[1])));
  if (!profileNorm) return false;
  if (profileNorm.includes(target) || target.includes(profileNorm)) return true;
  const t = new Set(target.split(' ').filter(x => x.length >= 3));
  if (!t.size) return false;
  const p = profileNorm.split(' ').filter(x => x.length >= 3);
  let hits = 0;
  for (const w of p) if (t.has(w)) hits += 1;
  return hits / Math.max(t.size, p.length || 1) >= 0.6;
}

// Match "Label" → "Name" pairs. Bizapedia uses both <th>/<td> tables and
// definition-list <dt>/<dd> pairs across page versions, so accept both.
const OWNER_LABELS = [
  'Authorized Person',
  'Registered Agent',
  'Manager',
  'Managing Member',
  'Officer',
  'President',
  'CEO',
  'Owner',
  'Member',
  'Principal',
];

function extractOwners(html) {
  const out = [];
  for (const label of OWNER_LABELS) {
    const escaped = label.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    // <th|dt|strong|b>Label[s?]:?</...> [whitespace + tags] Name [< or end]
    const re = new RegExp(
      `<(?:th|dt|strong|b|span)[^>]*>\\s*${escaped}s?\\s*\\(?s?\\)?\\s*[:.]?\\s*</(?:th|dt|strong|b|span)>` +
      `[\\s\\S]{0,80}?` +
      `(?:<(?:td|dd|span|p|li|a)[^>]*>)\\s*([^<]{4,80})`,
      'gi',
    );
    let m;
    while ((m = re.exec(html))) {
      const name = decode(m[1]);
      if (isPersonName(name)) {
        out.push({ name: titleCase(name), title: label });
        if (out.length >= 3) break;
      }
    }
    if (out.length) break;
  }
  return out;
}

/**
 * Find owner via Bizapedia.
 * @returns {Promise<{ ok: boolean, ownerName?: string, ownerTitle?: string, source: string, confidence?: number, evidence?: object, reason?: string }>}
 */
async function find({ businessName, state } = {}) {
  if (!businessName) return { ok: false, reason: 'no_business_name', source: 'bizapedia' };

  const searchHtml = await fetchHtml(buildSearchUrl({ businessName, state }));
  if (!searchHtml) return { ok: false, reason: 'search_failed', source: 'bizapedia' };

  const profileUrls = extractProfileLinks(searchHtml);
  if (!profileUrls.length) return { ok: false, reason: 'no_profile_results', source: 'bizapedia' };

  for (const url of profileUrls.slice(0, 3)) {
    const html = await fetchHtml(url);
    if (!html) continue;
    if (!profileNameMatches(html, businessName)) continue;
    const owners = extractOwners(html);
    if (!owners.length) continue;
    return {
      ok: true,
      ownerName: owners[0].name,
      ownerTitle: owners[0].title,
      source: 'bizapedia',
      confidence: 0.86,
      evidence: { profileUrl: url, ownerCount: owners.length },
    };
  }

  return { ok: false, reason: 'no_owner_in_profile', source: 'bizapedia' };
}

module.exports = { find };
