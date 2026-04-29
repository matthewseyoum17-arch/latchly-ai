// On-demand owner-name discovery via search.sunbiz.org. Florida's Division
// of Corporations exposes a public-records search of every registered
// entity (~3.95M active) with registered agent + officer names. We hit the
// search results page, follow the first match's detail link, and parse out
// the people. Single GET per lookup keeps us inside reasonable-use bounds;
// bulk imports should use the SFTP feed instead (deferred per the plan).
//
// Failure modes are silent: if the entity isn't found, the response shape
// is unchanged, or the request times out, we return null. The pipeline
// keeps moving with whatever it had.

const SEARCH_URL =
  'https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?inquirytype=EntityName&searchNameOrder=';
const DETAIL_BASE = 'https://search.sunbiz.org';

const DEFAULT_TIMEOUT_MS = 8000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function normalizeBusinessName(name) {
  return String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchText(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`sunbiz_http_${res.status}`);
  return res.text();
}

function decodeHtml(value) {
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

function stripTags(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ');
}

function parseSearchResults(html) {
  // Result rows look like:
  // <td class="large-width"><a href="/Inquiry/...?aggregateId=...">ACME PLUMBING LLC</a></td>
  const rows = [];
  const linkRe = /<a[^>]+href="([^"]*Inquiry\/CorporationSearch\/SearchResultDetail[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRe.exec(html))) {
    const href = match[1];
    const name = decodeHtml(stripTags(match[2]));
    if (!name || !href.includes('aggregateId=')) continue;
    rows.push({
      name,
      detailUrl: href.startsWith('http') ? href : `${DETAIL_BASE}${href}`,
    });
    if (rows.length >= 8) break;
  }
  return rows;
}

function parseEntityDetail(html) {
  // Detail page sections are labeled in <span class="dataLabel"> with the
  // fields nested in <div class="detailSection"> blocks. Layout is brittle
  // but stable; if Sunbiz revamps, re-derive from the live HTML.
  const result = {
    entityName: '',
    documentNumber: '',
    feiEin: '',
    status: '',
    principalAddress: '',
    registeredAgent: { name: '', address: '' },
    officers: [],
    rawSections: 0,
  };

  // Entity name from the "Detail by Entity Name" header.
  const nameMatch = html.match(/<span[^>]*class="entityName"[^>]*>([\s\S]*?)<\/span>/i)
    || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (nameMatch) result.entityName = decodeHtml(stripTags(nameMatch[1]));

  // Document number / FEI.
  const docMatch = html.match(/Document Number[^<]*<\/[^>]+>\s*<span[^>]*>([^<]+)/i);
  if (docMatch) result.documentNumber = decodeHtml(docMatch[1]);
  const feiMatch = html.match(/FEI\/EIN Number[^<]*<\/[^>]+>\s*<span[^>]*>([^<]+)/i);
  if (feiMatch) result.feiEin = decodeHtml(feiMatch[1]);

  // Status (ACTIVE / INACTIVE).
  const statusMatch = html.match(/Status[^<]*<\/[^>]+>\s*<span[^>]*>([^<]+)/i);
  if (statusMatch) result.status = decodeHtml(statusMatch[1]).toUpperCase();

  // Section blocks (Principal Address, Mailing Address, Registered Agent,
  // Officer/Director Detail). Pull each labeled section into a normalized
  // text block and parse the contents.
  const sectionRe = /<div\s+class="detailSection[^"]*">([\s\S]*?)<\/div>/gi;
  let secMatch;
  while ((secMatch = sectionRe.exec(html))) {
    const block = secMatch[1];
    const rawLabel = (block.match(/<span\s+class="detailLabel[^"]*">([\s\S]*?)<\/span>/i)
      || block.match(/<span[^>]*>([\s\S]*?)<\/span>/i));
    const label = rawLabel ? decodeHtml(stripTags(rawLabel[1])).toUpperCase() : '';
    const inner = block.replace(/<span\s+class="detailLabel[^"]*">[\s\S]*?<\/span>/i, '');
    const text = decodeHtml(stripTags(inner));
    result.rawSections += 1;

    if (/PRINCIPAL ADDRESS/.test(label)) {
      result.principalAddress = text;
      continue;
    }
    if (/REGISTERED AGENT/.test(label)) {
      const lines = text.split(/\s{2,}|,\s*/).map(s => s.trim()).filter(Boolean);
      result.registeredAgent.name = lines[0] || '';
      result.registeredAgent.address = lines.slice(1).join(', ');
      continue;
    }
    if (/OFFICER\/DIRECTOR DETAIL/.test(label) || /AUTHORIZED PERSON/.test(label)) {
      // Officers come in name+title pairs separated by lots of whitespace.
      const peopleRe = /Title\s+([A-Z]{1,8})\s+([A-Z][A-Z'\-\.\s]+?)(?=Title\s+[A-Z]{1,8}|$)/g;
      let pm;
      const officers = [];
      while ((pm = peopleRe.exec(text))) {
        const title = pm[1].trim();
        const name = pm[2].replace(/\s+\d.*$/, '').trim();
        if (name) officers.push({ title, name });
      }
      // Fallback: simple "Title PRES Smith, John" extraction.
      if (!officers.length) {
        const lineRe = /([A-Z]{1,5})\s+([A-Z][A-Z' .-]+?,\s*[A-Z][A-Z' .-]+)/g;
        let lm;
        while ((lm = lineRe.exec(text))) {
          officers.push({ title: lm[1], name: lm[2] });
        }
      }
      result.officers = officers.slice(0, 8);
    }
  }

  return result;
}

function pickPersonName(rawName) {
  if (!rawName) return '';
  const cleaned = String(rawName)
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  // Skip non-person rows (entities can name themselves as registered agent).
  if (/\b(LLC|INC|CORP|LLP|COMPANY|TRUST|LP|HOLDINGS)\b/i.test(cleaned)) return '';
  // "Last, First Middle" → "First Last"
  if (cleaned.includes(',')) {
    const [last, first] = cleaned.split(',').map(s => s.trim());
    if (first && last) return titleCase(`${first.split(/\s+/)[0]} ${last}`);
  }
  return titleCase(cleaned);
}

function titleCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/(^|[\s'-])(\w)/g, (_, sep, ch) => sep + ch.toUpperCase());
}

// Main entry: searches Sunbiz for the given business name and returns the
// best-confidence owner-shaped record found, or null. Confidence floor 0.85
// when we matched the entity name exactly; 0.7 for partial matches.
async function searchOwner(businessName, opts = {}) {
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const target = normalizeBusinessName(businessName);
  if (!target) return null;

  let searchHtml;
  try {
    searchHtml = await fetchText(`${SEARCH_URL}${encodeURIComponent(target)}`, timeoutMs);
  } catch (err) {
    return { ok: false, reason: `search_failed:${err.message || err}` };
  }
  const rows = parseSearchResults(searchHtml);
  if (!rows.length) return { ok: false, reason: 'no_results' };

  // Prefer an exact normalized-name match; otherwise take the first row.
  const exact = rows.find(r => normalizeBusinessName(r.name) === target);
  const top = exact || rows[0];

  let detailHtml;
  try {
    detailHtml = await fetchText(top.detailUrl, timeoutMs);
  } catch (err) {
    return { ok: false, reason: `detail_failed:${err.message || err}` };
  }
  const detail = parseEntityDetail(detailHtml);

  const exactMatch = exact != null;
  const officerName = detail.officers
    .map(o => pickPersonName(o.name))
    .find(Boolean);
  const officerTitle = detail.officers
    .map(o => o.title)
    .find(t => t && t.length <= 5);
  const agentName = pickPersonName(detail.registeredAgent.name);

  // Officer beats registered agent for "owner" purposes — the agent is often
  // a corporate-services LLC. Officers are real people.
  const ownerName = officerName || agentName;
  if (!ownerName) return { ok: false, reason: 'no_owner_in_detail', detail };
  const baseConfidence = exactMatch ? 0.9 : 0.7;
  const confidence = officerName ? baseConfidence : Math.max(0.6, baseConfidence - 0.15);

  return {
    ok: true,
    ownerName,
    ownerTitle: officerName ? expandTitle(officerTitle) : 'Registered Agent',
    confidence,
    source: officerName ? 'sunbiz_officer' : 'sunbiz_agent',
    detail,
    matchedName: top.name,
    exactMatch,
  };
}

const TITLE_EXPANSIONS = {
  P: 'President',
  PRES: 'President',
  VP: 'Vice President',
  TR: 'Treasurer',
  TRES: 'Treasurer',
  S: 'Secretary',
  SECY: 'Secretary',
  D: 'Director',
  DIR: 'Director',
  M: 'Manager',
  MGR: 'Manager',
  MGRM: 'Managing Member',
  AMBR: 'Authorized Member',
  CEO: 'CEO',
  COO: 'COO',
  CFO: 'CFO',
};

function expandTitle(title) {
  if (!title) return 'Officer';
  const upper = String(title).toUpperCase();
  return TITLE_EXPANSIONS[upper] || titleCase(upper);
}

module.exports = {
  searchOwner,
  parseSearchResults,
  parseEntityDetail,
  normalizeBusinessName,
  pickPersonName,
};
