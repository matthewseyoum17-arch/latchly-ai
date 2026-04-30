/**
 * scripts/latchly-leads/finders/yelp.js
 *
 * Free verified-source finder #4: Yelp profile owner-replies.
 *
 * Yelp shows a "Response from the business" block under reviews, signed by
 * a verified business representative — this exposes the owner / GM's first
 * name (sometimes full name + title). Yelp profiles also occasionally
 * surface a contact email in the "From the business" block. Real verified
 * data — no guessing.
 *
 * Yelp's bot detection has gotten aggressive; we hit only 1 search + 1
 * profile page per lookup and abort fast on cloudflare/captcha pages.
 *
 * Failures return { ok: false, reason }. Never throws.
 */

const TIMEOUT_MS = 9000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function fetchHtml(url, timeoutMs = TIMEOUT_MS) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Cloudflare / captcha pages — bail fast
    if (/captcha|verify you are human|enable javascript and cookies/i.test(text)) return null;
    return text;
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
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function strip(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ');
}

function buildSearchUrl({ businessName, city, state }) {
  const params = new URLSearchParams();
  params.set('find_desc', businessName);
  const loc = [city, state].filter(Boolean).join(', ');
  if (loc) params.set('find_loc', loc);
  return `https://www.yelp.com/search?${params.toString()}`;
}

function extractBizSlug(searchHtml) {
  // Yelp business links are `/biz/<slug>?...`. First match wins.
  const m = searchHtml.match(/href="(\/biz\/[a-z0-9\-]+(?:\?[^"]*)?)"/i);
  if (!m) return null;
  return m[1].split('?')[0];
}

const ROLE_LOCALS = new Set(['noreply', 'no-reply', 'donotreply', 'webmaster', 'postmaster']);

function extractEmails(html) {
  const re = /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi;
  const matches = html.match(re) || [];
  const seen = new Set();
  const out = [];
  for (const raw of matches) {
    const email = raw.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    if (ROLE_LOCALS.has(email.split('@')[0])) continue;
    out.push(email);
  }
  return out;
}

const ENTITY_KEYWORDS = /\b(LLC|INC|CORP|COMPANY|HOLDINGS|GROUP|TEAM|MANAGEMENT)\b/i;

function isPersonShaped(name) {
  if (!name) return false;
  if (ENTITY_KEYWORDS.test(name)) return false;
  const tokens = String(name).split(/\s+/).filter(t => /^[A-Z][a-z]+$/.test(t));
  return tokens.length >= 1; // accept first-name only — common in owner replies
}

// Yelp owner-reply blocks render as:
//   <p>Response from the business owner</p>
//   <p>{Name}, Owner</p>
//   <p>...</p>
// Or sometimes: <span>Comment from {Name} M.</span>
function extractOwnerFromYelpProfile(html) {
  // Strategy 1: structured blocks near "from the business"
  const block = html.match(/(?:Comment|Response)\s+from\s+(?:the\s+)?business[\s\S]{0,400}?<\/(?:section|article|div)>/i);
  if (block) {
    const text = decode(strip(block[0]));
    const m = text.match(
      /([A-Z][a-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+)?)\s*[,\-:]\s*(Owner|Founder|Manager|GM|General\s+Manager|President|CEO|Operator|Proprietor)/,
    );
    if (m && isPersonShaped(m[1])) {
      return { name: m[1].trim(), title: m[2].trim() };
    }
  }
  // Strategy 2: look for "From the business" section — usually has "Meet the Manager" or "Meet the Business Owner"
  const meet = html.match(/Meet\s+the\s+(?:Business\s+)?(?:Manager|Owner|Founder)\b[\s\S]{0,500}/i);
  if (meet) {
    const text = decode(strip(meet[0]));
    const m = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/);
    if (m && isPersonShaped(m[1])) {
      return { name: m[1].trim(), title: 'Owner' };
    }
  }
  return null;
}

function extractFromBusinessSection(html) {
  // "Specialties" / "History" / "About the Business" can include owner introduction:
  // "ACME was founded in 2003 by John Smith..."
  const block = html.match(/About\s+the\s+Business[\s\S]{0,1500}|Specialties[\s\S]{0,1200}|History[\s\S]{0,1200}/i);
  if (!block) return null;
  const text = decode(strip(block[0]));
  const m = text.match(
    /(?:founded|started|established|opened|run|operated|owned)\s+(?:in\s+\d{4}\s+)?by\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+){0,2})/i,
  );
  if (m && isPersonShaped(m[1])) {
    return { name: m[1].trim(), title: 'Owner' };
  }
  return null;
}

/**
 * @param {Object} args
 * @param {string} args.businessName
 * @param {string} [args.city]
 * @param {string} [args.state]
 * @param {string} [args.domain] — for email-source matching
 * @returns {Promise<{ ok, reason?, ownerName?, ownerTitle?, email?, source, confidence, evidence? }>}
 */
async function find({ businessName, city, state, domain } = {}) {
  if (!businessName) return { ok: false, reason: 'no_business_name', source: 'yelp' };

  const searchHtml = await fetchHtml(buildSearchUrl({ businessName, city, state }));
  if (!searchHtml) return { ok: false, reason: 'search_blocked_or_failed', source: 'yelp' };

  const bizPath = extractBizSlug(searchHtml);
  if (!bizPath) return { ok: false, reason: 'no_biz_match', source: 'yelp' };

  const profileUrl = `https://www.yelp.com${bizPath}`;
  const profileHtml = await fetchHtml(profileUrl);
  if (!profileHtml) return { ok: false, reason: 'profile_blocked_or_failed', source: 'yelp' };

  const owner = extractOwnerFromYelpProfile(profileHtml) || extractFromBusinessSection(profileHtml);
  const allEmails = extractEmails(profileHtml);
  let chosenEmail = null;
  if (domain) {
    chosenEmail = allEmails.find(e => e.endsWith(`@${String(domain).toLowerCase()}`)) || null;
  }
  if (!chosenEmail && allEmails.length) chosenEmail = allEmails[0];

  if (!owner && !chosenEmail) {
    return { ok: false, reason: 'no_owner_or_email_on_profile', source: 'yelp' };
  }

  return {
    ok: true,
    ownerName: owner?.name || null,
    ownerTitle: owner?.title || null,
    email: chosenEmail || null,
    source: 'yelp',
    // Yelp owner-replies are real but often only first-name; lower confidence
    // than BBB or OpenCorporates.
    confidence: owner ? 0.72 : 0.6,
    evidence: { profileUrl, hadOwner: Boolean(owner), emailsFound: allEmails.length },
  };
}

module.exports = { find };
