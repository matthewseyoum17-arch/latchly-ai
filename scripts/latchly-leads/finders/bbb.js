/**
 * scripts/latchly-leads/finders/bbb.js
 *
 * Free verified-source finder #1: scrape Better Business Bureau profile pages.
 *
 * BBB profiles publicly expose a "Business Management" / "Principal Contacts"
 * block with the owner / president / GM names, and the contact tab usually
 * has a `mailto:` link to the business's actual mailbox. Both are real
 * verified data — no guessing.
 *
 * Flow:
 *   1. Search BBB for the business by name + city/state.
 *   2. Pick the first profile result whose business name matches.
 *   3. Fetch the profile page; extract owner via "Business Management" block.
 *   4. Fetch the /contact tab; extract any mailto: emails.
 *
 * Failures return { ok: false, reason }. Never throws — caller treats null
 * results as "BBB had nothing on this business" and falls through.
 */

const TIMEOUT_MS = 9000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const SEARCH_URL = 'https://www.bbb.org/search';

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
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function strip(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ');
}

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|company|the)\b/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NON_PERSON_TOKENS = new Set([
  'service', 'department', 'team', 'office', 'reception', 'admin', 'customer',
  'support', 'sales', 'billing', 'corporate', 'unknown', 'none', 'tbd', 'na',
]);

function isPersonShaped(name) {
  if (!name) return false;
  const cleaned = String(name).replace(/[^A-Za-z' \-.]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return false;
  const lowered = cleaned.toLowerCase();
  if (/\b(llc|inc|corp|company|holdings|partners?|associates?|group|enterprises?)\b/i.test(cleaned)) return false;
  for (const tok of NON_PERSON_TOKENS) {
    if (lowered === tok || lowered.startsWith(`${tok} `) || lowered.endsWith(` ${tok}`)) return false;
  }
  const tokens = cleaned.split(/\s+/).filter(t => t.length >= 2 && /^[A-Za-z]/.test(t));
  return tokens.length >= 2;
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
    const local = email.split('@')[0];
    if (ROLE_LOCALS.has(local)) continue;
    out.push(email);
  }
  return out;
}

// Parse "Business Management" block. BBB renders it as:
//   <h3>Business Management</h3>
//   <ul><li>Mr. Jane Smith, Owner</li>
//       <li>John Doe, President</li>...</ul>
function extractBusinessManagement(html) {
  const block = html.match(
    /Business\s+Management[\s\S]{0,200}?<(?:ul|div)[^>]*>([\s\S]*?)<\/(?:ul|div)>/i,
  );
  if (!block) return [];
  const items = block[1].match(/<li[^>]*>[\s\S]*?<\/li>/gi) || [];
  const people = [];
  for (const li of items) {
    const text = decode(strip(li));
    if (!text) continue;
    // "Mr. Jane Smith, Owner" / "Jane Smith - Owner" / "Owner: Jane Smith"
    const m = text.match(
      /^(?:(?:mr|mrs|ms|dr|prof)\.?\s+)?([A-Z][A-Za-z'\-.]+(?:\s+[A-Z][A-Za-z'\-.]+){1,3})\s*[,\-:–—]?\s*(Owner|Founder|President|CEO|CFO|COO|Manager|Managing\s+Member|Principal|Operator|General\s+Manager|GM)/i,
    );
    if (m && isPersonShaped(m[1])) {
      people.push({ name: m[1].trim(), title: m[2].trim() });
    }
  }
  // Fallback: list-of-strings extraction.
  if (!people.length) {
    const flat = decode(strip(block[1]));
    const fallback = flat.match(
      /([A-Z][A-Za-z'\-.]+(?:\s+[A-Z][A-Za-z'\-.]+){1,3})\s*[,\-:–—]\s*(Owner|Founder|President|CEO|Principal|General\s+Manager|GM)/g,
    );
    if (fallback) {
      for (const seg of fallback) {
        const sm = seg.match(/(.+?)\s*[,\-:–—]\s*(.+)/);
        if (sm && isPersonShaped(sm[1])) {
          people.push({ name: sm[1].trim(), title: sm[2].trim() });
        }
      }
    }
  }
  return people;
}

function buildSearchUrl({ businessName, city, state }) {
  const params = new URLSearchParams({
    find_country: 'USA',
    find_text: businessName,
  });
  const loc = [city, state].filter(Boolean).join(', ');
  if (loc) params.set('find_loc', loc);
  return `${SEARCH_URL}?${params.toString()}`;
}

// Scrape the search-results page for profile URLs. BBB results pages render
// each match as `<a href="/us/<state>/<city>/profile/<slug>" class="...">`.
function extractProfileLinks(html) {
  const re = /href="(\/us\/[a-z]{2}\/[^"]*?\/profile\/[^"]+?)"/gi;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (seen.has(href)) continue;
    seen.add(href);
    out.push(`https://www.bbb.org${href}`);
    if (out.length >= 5) break;
  }
  return out;
}

function profileMatchesBusiness(profileHtml, businessName) {
  const targetNorm = normalizeName(businessName);
  if (!targetNorm) return false;
  const titleMatch = profileHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    || profileHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch) return false;
  const profileNameNorm = normalizeName(decode(strip(titleMatch[1])));
  if (!profileNameNorm) return false;
  // Match if either name is contained in the other (handles "ACME LLC" vs "ACME Plumbing LLC")
  if (profileNameNorm.includes(targetNorm) || targetNorm.includes(profileNameNorm)) return true;
  // Token overlap >= 60%
  const targetTokens = new Set(targetNorm.split(' ').filter(t => t.length >= 3));
  if (!targetTokens.size) return false;
  const profileTokens = profileNameNorm.split(' ').filter(t => t.length >= 3);
  let hits = 0;
  for (const t of profileTokens) if (targetTokens.has(t)) hits += 1;
  return hits / Math.max(targetTokens.size, profileTokens.length || 1) >= 0.6;
}

/**
 * Find owner + email via BBB.
 * @param {Object} args
 * @param {string} args.businessName
 * @param {string} [args.city]
 * @param {string} [args.state] — 2-letter US state
 * @param {string} [args.domain] — for email-source matching
 * @returns {Promise<{ ok: boolean, reason?: string, ownerName?: string, ownerTitle?: string, email?: string, source: string, confidence: number, evidence?: object }>}
 */
async function find({ businessName, city, state, domain } = {}) {
  if (!businessName) return { ok: false, reason: 'no_business_name', source: 'bbb' };

  const searchHtml = await fetchHtml(buildSearchUrl({ businessName, city, state }));
  if (!searchHtml) return { ok: false, reason: 'search_failed', source: 'bbb' };

  const profileUrls = extractProfileLinks(searchHtml);
  if (!profileUrls.length) return { ok: false, reason: 'no_profile_results', source: 'bbb' };

  for (const profileUrl of profileUrls.slice(0, 3)) {
    const profileHtml = await fetchHtml(profileUrl);
    if (!profileHtml) continue;
    if (!profileMatchesBusiness(profileHtml, businessName)) continue;

    const people = extractBusinessManagement(profileHtml);
    const owner = people[0] || null;

    // Try the contact tab for a mailto: — most BBB profiles expose the
    // business's real address in the contact section.
    const contactHtml = await fetchHtml(`${profileUrl.replace(/\/$/, '')}/contact-information`)
      || await fetchHtml(`${profileUrl.replace(/\/$/, '')}#contact-information`);
    const contactSourceHtml = contactHtml || profileHtml;
    const allEmails = extractEmails(contactSourceHtml);
    let chosenEmail = null;
    if (domain) {
      // Prefer an email on the business domain when present.
      const onDomain = allEmails.find(e => e.endsWith(`@${String(domain).toLowerCase()}`));
      if (onDomain) chosenEmail = onDomain;
    }
    if (!chosenEmail && allEmails.length) chosenEmail = allEmails[0];

    if (owner || chosenEmail) {
      return {
        ok: true,
        ownerName: owner?.name || null,
        ownerTitle: owner?.title || null,
        email: chosenEmail || null,
        source: 'bbb',
        confidence: owner ? 0.88 : 0.75,
        evidence: { profileUrl, peopleFound: people.length, emailsFound: allEmails.length },
      };
    }
  }

  return { ok: false, reason: 'no_owner_or_email_in_profile', source: 'bbb' };
}

module.exports = { find };
