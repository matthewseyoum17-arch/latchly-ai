/**
 * scripts/latchly-leads/finders/manta.js
 *
 * Verified-source finder: manta.com.
 *
 * Manta republishes state filings + a "Key Principal" / "Officer" block on
 * free-tier business profile pages. Layout has shifted multiple times so
 * we extract from any of three known patterns plus a JSON-LD block.
 *
 * Flow:
 *   1. Search manta for "[name] [city] [state]".
 *   2. Pick first profile result that name-matches.
 *   3. Pull "Key Principal" / "Owner" / "Officer" from the profile.
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
    .replace(/\b([a-z])/g, c => c.toUpperCase());
}

function buildSearchUrl({ businessName, city, state }) {
  const params = new URLSearchParams({ search: businessName, search_what: 'biz' });
  const loc = [city, state].filter(Boolean).join(' ');
  if (loc) params.set('search_location', loc);
  return `https://www.manta.com/search?${params.toString()}`;
}

// Manta profile URLs are `/c/<id>/<slug>` (lowercase id is alphanumeric).
function extractProfileLinks(html) {
  const re = /href="(\/c\/[A-Za-z0-9_\-]+\/[A-Za-z0-9._\-]+)"/gi;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (seen.has(href)) continue;
    seen.add(href);
    out.push(`https://www.manta.com${href}`);
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

// Manta surfaces ownership in three places, in rough order of reliability:
//   1. JSON-LD `founder` / `member` schema block
//   2. "Key Principal: Jane Doe" inline label-pair
//   3. "Owner / President / Manager: Jane Doe" textual block
const OWNER_LABELS = ['Key Principal', 'Principal', 'Owner', 'Founder', 'President', 'CEO', 'Manager', 'Officer'];

function extractFromJsonLd(html) {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    const inner = block.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/, '').trim();
    let parsed;
    try { parsed = JSON.parse(inner); } catch { continue; }
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of list) {
      if (!node || typeof node !== 'object') continue;
      const candidates = [
        node.founder, node.founders,
        node.member, node.members,
        node.employee, node.employees,
      ].flat().filter(Boolean);
      for (const c of candidates) {
        const name = typeof c === 'string' ? c : c?.name;
        if (isPersonName(name)) {
          return { name: titleCase(name), title: c?.jobTitle || 'Founder' };
        }
      }
    }
  }
  return null;
}

function extractFromLabels(html) {
  for (const label of OWNER_LABELS) {
    const escaped = label.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    // "Label: Jane Doe" — accepts colon, dash, or close-tag boundary
    const re = new RegExp(
      `(?:${escaped})\\s*[:\\-—]\\s*([A-Z][A-Za-z'\\-.]+(?:\\s+[A-Z][A-Za-z'\\-.]+){1,3})`,
      'gi',
    );
    let m;
    while ((m = re.exec(html))) {
      const name = decode(m[1]);
      if (isPersonName(name)) return { name: titleCase(name), title: label };
    }
  }
  return null;
}

/**
 * Find owner via Manta.
 */
async function find({ businessName, city, state } = {}) {
  if (!businessName) return { ok: false, reason: 'no_business_name', source: 'manta' };

  const searchHtml = await fetchHtml(buildSearchUrl({ businessName, city, state }));
  if (!searchHtml) return { ok: false, reason: 'search_failed', source: 'manta' };

  const profileUrls = extractProfileLinks(searchHtml);
  if (!profileUrls.length) return { ok: false, reason: 'no_profile_results', source: 'manta' };

  for (const url of profileUrls.slice(0, 3)) {
    const html = await fetchHtml(url);
    if (!html) continue;
    if (!profileNameMatches(html, businessName)) continue;
    // Strip HTML tags from a plain-text view first; label scan works better
    // against decoded text than raw HTML for Manta's nested span layout.
    const flat = decode(strip(html));
    const fromJsonLd = extractFromJsonLd(html);
    const fromLabels = fromJsonLd || extractFromLabels(flat) || extractFromLabels(html);
    if (!fromLabels) continue;
    return {
      ok: true,
      ownerName: fromLabels.name,
      ownerTitle: fromLabels.title,
      source: 'manta',
      confidence: 0.84,
      evidence: { profileUrl: url, via: fromJsonLd ? 'json_ld' : 'label_pair' },
    };
  }

  return { ok: false, reason: 'no_owner_in_profile', source: 'manta' };
}

module.exports = { find };
