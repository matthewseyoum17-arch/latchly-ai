const fs = require('fs');
const path = require('path');
const {
  ALLOWED_STATES,
  FLORIDA_DBPR_LICENSE_TYPES,
  HOME_SERVICE_NICHES,
  LOCAL_MARKETS,
  MARKET_COORDS,
  OSM_NICHE_TAGS,
  SEED_FILES,
  SOURCE_PER_QUERY_LIMIT,
  SUNBELT_MARKETS,
  TARGET_DAILY_LEADS,
  WEBSITE_RICH_MARKET_CAP,
  WEBSITE_RICH_SOURCE_CAP,
} = require('./config');
const {
  businessKey,
  domainFromWebsite,
  fetchFormText,
  fetchText,
  normalizeKey,
  normalizePhone,
  normalizeWebsite,
  parseCSV,
  sleep,
  stripHtml,
} = require('./utils');
const { isChainBusiness, isHomeService } = require('./scoring');

async function discoverCandidates(options = {}) {
  const limit = options.limit || 300;
  const deliveredKeys = options.deliveredKeys || new Set();
  const candidates = [];
  const seen = new Set(deliveredKeys);
  const seeds = loadSeedCandidates();
  const liveEnabled = process.env.LATCHLY_SKIP_LIVE_DISCOVERY !== '1';
  const discoveryOnly = process.env.LATCHLY_DISCOVERY_ONLY || '';
  const useSource = source => !discoveryOnly || discoveryOnly === source;
  const localCandidateLimit = Math.min(
    limit,
    parseInt(process.env.LATCHLY_LOCAL_CANDIDATE_LIMIT || String(Math.max(TARGET_DAILY_LEADS * 3, 150)), 10),
  );

  const finalize = () => orderCandidatesForAudit(mergeSoftDupes(candidates)).slice(0, limit);

  if (liveEnabled) {
    if (useSource('directories')) {
      await collectCandidates(candidates, seen, localCandidateLimit, scrapePublicDirectories(localCandidateLimit, LOCAL_MARKETS));
    }
    if (useSource('dbpr')) {
      await collectCandidates(candidates, seen, localCandidateLimit, scrapeFloridaDBPR(localCandidateLimit - candidates.length, LOCAL_MARKETS));
    }
    // OSM Overpass adds local supply for Gainesville/Tallahassee — niche
    // balance is mediocre (OSM `craft=roofer` over-tagged vs other crafts)
    // but for LOCAL it's pure additional volume.
    if (useSource('osm')) {
      await collectCandidates(candidates, seen, localCandidateLimit, scrapeOpenStreetMap(localCandidateLimit - candidates.length, LOCAL_MARKETS));
    }
    if (useSource('paid')) {
      await collectCandidates(candidates, seen, localCandidateLimit, scrapePaidFallback(localCandidateLimit - candidates.length, LOCAL_MARKETS));
    }
  }

  if (!discoveryOnly) {
    for (const lead of seeds.filter(isLocalLead)) {
      addCandidate(candidates, seen, lead);
      if (candidates.length >= limit) return finalize();
    }
  }

  if (liveEnabled) {
    const broadMarkets = nonLocalMarkets();
    if (useSource('directories')) {
      await collectCandidates(candidates, seen, limit, scrapePublicDirectories(Math.max(0, limit - candidates.length), broadMarkets));
    }
    if (useSource('dbpr')) {
      await collectCandidates(candidates, seen, limit, scrapeFloridaDBPR(Math.max(0, limit - candidates.length), broadMarkets));
    }
    // OSM in broader Sunbelt pass is opt-in — adds 8-15 min to daily runs.
    if (useSource('osm') && process.env.LATCHLY_ENABLE_OSM_BROAD === '1') {
      await collectCandidates(candidates, seen, limit, scrapeOpenStreetMap(Math.max(0, limit - candidates.length), broadMarkets));
    }
    if (useSource('paid')) {
      await collectCandidates(candidates, seen, limit, scrapePaidFallback(Math.max(0, limit - candidates.length), broadMarkets));
    }
  }

  if (!discoveryOnly) {
    for (const lead of seeds.filter(lead => !isLocalLead(lead))) {
      addCandidate(candidates, seen, lead);
      if (candidates.length >= limit) return finalize();
    }
  }

  return finalize();
}

// Soft-dedupe: same normalized name + state across cities, where neither row
// has a hard identifier (domain or phone), almost certainly the same business
// listed twice. Collapse into a single primary row with cityVariants attached.
// Multi-branch businesses with distinct phones/domains are preserved as separate.
function mergeSoftDupes(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const hasHard = Boolean(domainFromWebsite(candidate.website)) || Boolean(normalizePhone(candidate.phone));
    const softKey = `${normalizeKey(candidate.businessName)}::${normalizeKey(candidate.state)}`;
    if (!groups.has(softKey)) groups.set(softKey, []);
    groups.get(softKey).push({ candidate, hasHard });
  }

  const merged = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push(group[0].candidate);
      continue;
    }
    if (group.some(entry => entry.hasHard)) {
      // At least one row has phone or domain — treat as real distinct branches.
      for (const entry of group) merged.push(entry.candidate);
      continue;
    }
    // No hard identifiers anywhere — collapse to first row, list cities as variants.
    const primary = { ...group[0].candidate };
    const cityVariants = [];
    const seenCity = new Set();
    for (const entry of group) {
      const city = (entry.candidate.city || '').trim();
      if (!city) continue;
      const key = city.toLowerCase();
      if (seenCity.has(key)) continue;
      seenCity.add(key);
      cityVariants.push(city);
    }
    if (cityVariants.length) primary.cityVariants = cityVariants;
    merged.push(primary);
  }
  return merged;
}

function loadSeedCandidates() {
  const out = [];
  for (const file of SEED_FILES) {
    if (!fs.existsSync(file)) continue;
    const rows = parseCSV(fs.readFileSync(file, 'utf8'));
    for (const row of rows) {
      const lead = normalizeSeedRow(row, 'seed-list');
      if (lead) out.push(lead);
    }
  }
  return out;
}

function normalizeSeedRow(row, sourceName) {
  const businessName = get(row, ['Business Name', 'Company', 'Name', 'business_name']);
  const niche = get(row, ['Niche', 'Industry', 'Category', 'niche']);
  const city = get(row, ['City', 'city']);
  const state = get(row, ['State', 'state']);
  const phone = normalizePhone(get(row, ['Phone', 'Main Business Phone', 'Business Phone', 'Direct Phone']));
  const website = normalizeWebsite(get(row, ['Website', 'Company Website', 'website']));
  const ownerName = get(row, ['Owner', 'Owner Name if public', 'Decision Maker', 'Name', 'owner_name']);
  const ownerTitle = get(row, ['Title', 'owner_title']);
  const sourceScore = Number(get(row, ['Score', 'Fit Score', 'Overall Score', 'combined_score']) || 0);
  const sourceIssues = get(row, ['Issues', 'Top Issues', 'Exact Redesign Problems', 'Exact Lead-Capture Gaps']);
  const sourcePitch = get(row, ['Pitch Angle', 'Personalized Opening Angle', 'Why It Fits']);

  if (!businessName || !phone || !city || !state) return null;
  const lead = {
    sourceName,
    sourceRecordId: `${businessName}|${city}|${state}`,
    rawPayload: row,
    businessName,
    normalizedName: businessName.toLowerCase(),
    niche: niche || inferNiche(businessName),
    city,
    state: state.toUpperCase(),
    phone,
    website,
    ownerName,
    ownerTitle,
    decisionMaker: ownerName,
    title: ownerTitle,
    sourceScore,
    sourceIssues,
    sourcePitch,
  };
  return keepCandidate(lead) ? lead : null;
}

async function* scrapePublicDirectories(limit, marketsOverride = null) {
  if (limit <= 0) return;
  const markets = marketsOverride || prioritizeMarkets();
  let yielded = 0;

  for (const { niche, market } of sourcePlan(markets)) {
    if (yielded >= limit) return;
    const [bbbResults, yellowPagesResults] = await Promise.all([
      scrapeBBB(niche, market.city, market.state).catch(() => []),
      scrapeYellowPages(niche, market.city, market.state).catch(() => []),
    ]);
    const results = orderCandidatesForAudit([
      ...yellowPagesResults,
      ...bbbResults,
    ]);
    for (const lead of results) {
      if (yielded >= limit) return;
      if (!keepCandidate(lead)) continue;
      yielded++;
      yield lead;
    }
  }
}

async function scrapeBBB(niche, city, state) {
  if (process.env.LATCHLY_SKIP_BBB_DISCOVERY === '1') return [];
  const firstPage = `https://www.bbb.org/search?find_text=${encodeURIComponent(niche)}&find_loc=${encodeURIComponent(`${city}, ${state}`)}&page=1`;
  const first = await fetchText(firstPage, 20000);
  if (!first.ok) return [];

  const parsed = parseBBBSearch(first.text);
  let searchResults = parsed.results;
  if (parsed.totalPages > 1) {
    await sleep(250);
    const second = await fetchText(firstPage.replace('page=1', 'page=2'), 20000).catch(() => null);
    if (second?.ok) searchResults = searchResults.concat(parseBBBSearch(second.text).results);
  }

  const leads = [];
  for (const result of searchResults.slice(0, SOURCE_PER_QUERY_LIMIT)) {
    const phone = normalizePhone(result.phone);
    if (!result.businessName || !phone) continue;

    let profile = { website: '', ownerName: '', ownerTitle: '', yearsInBusiness: 0 };
    if (result.profileUrl) {
      await sleep(150);
      const profileUrl = absoluteBBBUrl(result.profileUrl);
      const profileRes = await fetchText(profileUrl, 18000).catch(() => null);
      if (profileRes?.ok) profile = parseBBBProfile(profileRes.text);
    }

    leads.push({
      sourceName: 'bbb',
      sourceRecordId: result.profileUrl || `${result.businessName}|${city}|${state}`,
      rawPayload: {
        searchUrl: firstPage,
        profileUrl: result.profileUrl,
        bbbMember: result.bbbMember,
        bbbRating: result.rating,
        yearsInBusiness: profile.yearsInBusiness || 0,
      },
      businessName: result.businessName,
      normalizedName: result.businessName.toLowerCase(),
      niche,
      city: result.city || city,
      state: String(result.state || state).toUpperCase(),
      phone,
      website: normalizeWebsite(profile.website),
      ownerName: profile.ownerName || '',
      ownerTitle: profile.ownerTitle || '',
    });
  }

  return leads;
}

function isLocalLead(lead) {
  const city = String(lead.city || '').toLowerCase();
  const state = String(lead.state || '').toUpperCase();
  return LOCAL_MARKETS.some(market => market.city.toLowerCase() === city && market.state === state);
}

function prioritizeMarkets() {
  const seen = new Set();
  const markets = [...LOCAL_MARKETS, ...SUNBELT_MARKETS];
  return markets.filter(market => {
    const key = `${market.city}-${market.state}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nonLocalMarkets() {
  return prioritizeMarkets().filter(market => !LOCAL_MARKETS.some(local =>
    local.city.toLowerCase() === market.city.toLowerCase() && local.state === market.state));
}

function sourcePlan(markets) {
  const plan = [];
  for (const market of markets) {
    for (const niche of HOME_SERVICE_NICHES) {
      plan.push({ niche, market });
    }
  }
  return plan;
}

async function collectCandidates(candidates, seen, limit, iterable) {
  if (limit <= candidates.length) return;
  for await (const lead of iterable) {
    addCandidate(candidates, seen, lead);
    if (candidates.length >= limit) return;
  }
}

// OpenStreetMap Overpass API source. Free, no auth, niche-tagged via
// craft= / shop= / amenity=. Returns nodes/ways with tags.{name, phone,
// website, addr:*}. Niche balance is excellent — no roofing skew.
async function* scrapeOpenStreetMap(limit, marketsOverride = null) {
  if (limit <= 0) return;
  if (process.env.LATCHLY_SKIP_OSM_DISCOVERY === '1') return;
  const onlyMode = process.env.LATCHLY_DISCOVERY_ONLY;
  if (onlyMode && onlyMode !== 'osm') return;

  const markets = marketsOverride || prioritizeMarkets();
  let yielded = 0;
  const HALF_DEG = 0.18; // ~12 mi N/S, 12-15 mi E/W (varies with latitude)

  for (const market of markets) {
    if (yielded >= limit) return;
    const coordKey = `${market.city},${market.state}`;
    const coord = MARKET_COORDS[coordKey];
    if (!coord) continue;
    const south = coord.lat - HALF_DEG;
    const west = coord.lon - HALF_DEG;
    const north = coord.lat + HALF_DEG;
    const east = coord.lon + HALF_DEG;
    const bbox = `${south},${west},${north},${east}`;

    for (const niche of HOME_SERVICE_NICHES) {
      if (yielded >= limit) return;
      const tagPairs = OSM_NICHE_TAGS[niche];
      if (!tagPairs || !tagPairs.length) continue;

      const queryBody = tagPairs
        .map(([k, v]) => `node["${k}"="${v}"](${bbox});way["${k}"="${v}"](${bbox});`)
        .join('');
      const query = `[out:json][timeout:25];(${queryBody});out center;`;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

      let parsed;
      try {
        const res = await fetchText(url, 30000);
        if (!res.ok || !res.text) continue;
        parsed = JSON.parse(res.text);
      } catch {
        continue;
      }
      const elements = parsed?.elements || [];

      for (const elem of elements.slice(0, SOURCE_PER_QUERY_LIMIT * 2)) {
        if (yielded >= limit) return;
        const tags = elem.tags || {};
        const name = (tags.name || '').trim();
        if (!name) continue;
        const lead = {
          sourceName: 'osm-overpass',
          sourceRecordId: `osm-${elem.type}-${elem.id}`,
          rawPayload: {
            osmType: elem.type,
            osmId: elem.id,
            tags,
            queryNiche: niche,
            queryMarket: coordKey,
          },
          businessName: name,
          normalizedName: name.toLowerCase(),
          niche,
          city: (tags['addr:city'] || market.city).trim(),
          state: String(tags['addr:state'] || market.state).toUpperCase(),
          phone: normalizePhone(tags.phone || tags['contact:phone'] || ''),
          website: normalizeWebsite(tags.website || tags['contact:website'] || ''),
        };
        if (!keepCandidate(lead)) continue;
        yielded++;
        yield lead;
      }
      await sleep(500);
    }
  }
}

// Florida DBPR public license search. Florida-only (filters markets by state).
// DBPR gives licensed names/addresses but no phone, so each result is enriched
// through YellowPages before it can pass the normal phone-required gate.
async function* scrapeFloridaDBPR(limit, marketsOverride = null) {
  if (limit <= 0) return;
  if (process.env.LATCHLY_SKIP_DBPR_DISCOVERY === '1') return;
  const onlyMode = process.env.LATCHLY_DISCOVERY_ONLY;
  if (onlyMode && onlyMode !== 'dbpr') return;

  const markets = (marketsOverride || prioritizeMarkets()).filter(m => m.state === 'FL');
  if (!markets.length) return;
  let yielded = 0;
  const dbprNiches = HOME_SERVICE_NICHES
    .filter(niche => FLORIDA_DBPR_LICENSE_TYPES[niche]?.length)
    .sort((a, b) => Number(a === 'roofing contractor') - Number(b === 'roofing contractor'));
  const maxLicenseSearches = parseInt(
    process.env.LATCHLY_DBPR_MAX_LICENSE_SEARCHES || String(Math.min(8, Math.max(3, limit))),
    10,
  );
  const dbprTimeoutMs = parseInt(process.env.LATCHLY_DBPR_TIMEOUT_MS || '10000', 10);
  let licenseSearches = 0;

  for (const market of markets) {
    if (yielded >= limit) return;

    for (const niche of dbprNiches) {
      if (yielded >= limit) return;
      const licenseTypes = FLORIDA_DBPR_LICENSE_TYPES[niche];
      const directoryResults = await scrapeYellowPages(niche, market.city, market.state).catch(() => []);
      if (!directoryResults.length) continue;

      for (const licenseSearch of licenseTypes) {
        if (yielded >= limit) return;
        if (licenseSearches >= maxLicenseSearches) return;
        licenseSearches++;

        const form = new URLSearchParams({
          hSearchType: 'City',
          hDivision: 'ALL',
          Board: licenseSearch.board,
          LicenseType: licenseSearch.licenseType,
          City: market.city,
          County: '',
          State: 'FL',
          SpecQual2: '',
          SearchHistoric: '',
          RecsPerPage: '50',
          Search1: 'Search',
        });
        const url = 'https://www.myfloridalicense.com/wl11.asp?mode=2&search=City&SID=&brd=&typ=';

        let res;
        try {
          res = await fetchFormText(url, form, dbprTimeoutMs);
        } catch {
          continue;
        }
        if (!res?.ok || !res.text) continue;

        const rows = parseDbprResults(res.text, niche, licenseSearch, market);
        for (const dbprLead of rows.slice(0, SOURCE_PER_QUERY_LIMIT)) {
          if (yielded >= limit) return;
          const enriched = enrichDbprCandidate(dbprLead, directoryResults);
          if (!enriched || !keepCandidate(enriched)) continue;
          yielded++;
          yield enriched;
        }
        await sleep(400);
      }
    }
  }
}

function parseDbprResults(html, niche, licenseType, market) {
  const leads = [];
  if (!html) return leads;
  const rowPattern = /<tr\s+height=['"]40['"][^>]*>\s*<td\s+colspan=['"]1['"][^>]*\s+width=['"]20%['"][\s\S]*?(?=<tr\s+height=['"]40['"][^>]*>\s*<td\s+colspan=['"]1['"][^>]*\s+width=['"]20%['"]|<tr>\s*<td\s+colspan=["']7["']|<\/table>\s*<\/td>\s*<\/tr>)/gi;
  let match;
  while ((match = rowPattern.exec(html))) {
    const rowHtml = match[0];
    const cells = [];
    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowHtml))) {
      cells.push(stripHtml(cellMatch[1]).trim());
    }
    if (cells.length < 5) continue;
    const licenseName = clean(cells[1]);
    const relation = clean(cells[2]);
    const licenseNumber = clean(cells[3]).split(/\s+/)[0];
    const status = clean(cells[4]);
    if (!/Current\s*,?\s*Active/i.test(status)) continue;
    if (!isDbprBusinessName(licenseName, relation)) continue;

    const businessName = normalizeDbprBusinessName(licenseName);
    if (!businessName || businessName.length < 4) continue;
    const address = extractDbprAddress(rowHtml) || '';
    const city = market.city;
    leads.push({
      sourceName: 'florida-dbpr',
      sourceRecordId: `dbpr-${licenseType.licenseType}-${licenseNumber || businessName}|${city}`,
      rawPayload: { licenseSearch: licenseType, licenseNumber, relation, status, address, cells },
      businessName,
      normalizedName: businessName.toLowerCase(),
      niche,
      city,
      state: 'FL',
      phone: '',
      website: '',
    });
  }
  return leads;
}

function enrichDbprCandidate(dbprLead, directoryResults = []) {
  const yp = findDirectoryBusinessMatch(dbprLead.businessName, directoryResults);
  if (!yp || !yp.phone) return null;
  return {
    ...dbprLead,
    sourceName: 'florida-dbpr',
    sourceRecordId: dbprLead.sourceRecordId,
    rawPayload: {
      ...dbprLead.rawPayload,
      enrichmentSource: yp.sourceName,
      enrichmentRecordId: yp.sourceRecordId,
      enrichmentPayload: yp.rawPayload,
    },
    phone: yp.phone,
    website: yp.website || dbprLead.website,
    ownerName: yp.ownerName || '',
    ownerTitle: yp.ownerTitle || '',
  };
}

function findDirectoryBusinessMatch(businessName, results = []) {
  const expected = normalizeKey(businessName);
  return results.find(result => {
    const actual = normalizeKey(result.businessName);
    return actual === expected || actual.includes(expected) || expected.includes(actual);
  }) || null;
}

function isDbprBusinessName(name, relation) {
  if (/DBA/i.test(relation)) return true;
  return /\b(LLC|L\.L\.C\.|INC|INC\.|CORP|CORPORATION|CO\.?|COMPANY|CONTRACTORS?|CONSTRUCTION|SERVICES?|PLUMBING|ELECTRIC|ELECTRICAL|ROOFING|AIR|HVAC|MECHANICAL|POOL|SPA)\b/i.test(name);
}

function normalizeDbprBusinessName(name) {
  return clean(name)
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*(LLC|INC|CORP)\b/ig, ' $1')
    .trim();
}

function extractDbprAddress(rowHtml) {
  const addressMatch = String(rowHtml || '').match(/(?:License Location Address\*:[\s\S]*?|Main Address\*:[\s\S]*?)<\/font><\/td>\s*<td[^>]*><font[^>]*>([\s\S]*?)<\/font>/i);
  return clean(addressMatch?.[1] || '');
}

async function* scrapePaidFallback(limit, marketsOverride = null) {
  if (limit <= 0) return;
  if (!process.env.SERPAPI_API_KEY) return;

  const markets = marketsOverride || prioritizeMarkets();
  let yielded = 0;
  for (const { niche, market } of sourcePlan(markets)) {
    if (yielded >= limit) return;
    const results = await scrapeSerpApiMaps(niche, market.city, market.state).catch(() => []);
    for (const lead of results) {
      if (yielded >= limit) return;
      if (!keepCandidate(lead)) continue;
      yielded++;
      yield lead;
    }
  }
}

async function scrapeSerpApiMaps(niche, city, state) {
  if (!process.env.SERPAPI_API_KEY) return [];
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_maps');
  url.searchParams.set('q', `${niche} ${city} ${state}`);
  url.searchParams.set('hl', 'en');
  url.searchParams.set('api_key', process.env.SERPAPI_API_KEY);

  const res = await fetchText(url.href, 25000);
  if (!res.ok) return [];
  const payload = JSON.parse(res.text);
  const results = payload.local_results || (payload.place_results ? [payload.place_results] : []);
  return results.slice(0, SOURCE_PER_QUERY_LIMIT).map(result => {
    const businessName = clean(result.title || '');
    return {
      sourceName: 'serpapi-google-maps',
      sourceRecordId: result.place_id || result.data_id || `${businessName}|${city}|${state}`,
      rawPayload: result,
      businessName,
      normalizedName: businessName.toLowerCase(),
      niche,
      city,
      state,
      phone: normalizePhone(result.phone || ''),
      website: normalizeWebsite(result.website || ''),
      ownerName: '',
      ownerTitle: '',
    };
  });
}

async function scrapeYellowPages(niche, city, state) {
  if (process.env.LATCHLY_SKIP_YP_DISCOVERY === '1') return [];
  const url = `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(niche)}&geo_location_terms=${encodeURIComponent(`${city}, ${state}`)}`;
  const res = await fetchText(url, 20000);
  if (!res.ok) return [];
  return parseYellowPagesSearch(res.text, niche, city, state, url);
}

function parseYellowPagesSearch(html, niche, city, state, url = '') {
  const chunks = String(html || '')
    .split(/<div[^>]+class=["'](?:result(?:\s[^"']*)?|search-results-organic[^"']*)["'][^>]*>/i)
    .slice(1, SOURCE_PER_QUERY_LIMIT + 1);
  const leads = [];

  for (const chunk of chunks) {
    const name = clean(extract(chunk, /class=["'][^"']*business-name[^"']*["'][^>]*>([\s\S]*?)<\/a>/i))
      || clean(extract(chunk, /<a[^>]+class=["'][^"']*business-name[^"']*["'][^>]*>([\s\S]*?)<\/a>/i));
    const phone = normalizePhone(clean(extract(chunk, /class=["'][^"']*phones?[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)));
    const website = normalizeWebsite(clean(extract(chunk, /href=["'](https?:\/\/(?!www\.yellowpages\.com)[^"']+)["'][^>]*>(?:Website|Visit Website)/i)));
    if (!name || !phone || isYellowPagesAdLead(name)) continue;
    leads.push({
      sourceName: 'yellowpages',
      sourceRecordId: `${name}|${city}|${state}`,
      rawPayload: { url },
      businessName: name,
      normalizedName: name.toLowerCase(),
      niche,
      city,
      state,
      phone,
      website,
      ownerName: '',
      ownerTitle: '',
    });
  }

  return leads;
}

function isYellowPagesAdLead(name) {
  return [
    /^compare\b.*\b(experts|pros|contractors|companies|services)\b/i,
    /^best\s+home\s+savings\b/i,
    /\bfind\s+(a|the)\s+(pro|contractor|service)\b/i,
    /\btop\s+rated\b.*\b(experts|pros|contractors|companies|services)\b/i,
  ].some(pattern => pattern.test(String(name || '')));
}

function parseBBBSearch(html) {
  const match = String(html || '').match(/window\.__PRELOADED_STATE__\s*=\s*({.*?});\s*<\/script>/s);
  if (!match) return { results: [], totalPages: 0 };
  try {
    const state = JSON.parse(match[1]);
    const searchResult = state.searchResult || {};
    const results = (searchResult.results || []).map(result => ({
      businessName: clean(result.businessName || ''),
      phone: (result.phone && result.phone[0]) || '',
      city: result.city || '',
      state: result.state || '',
      category: result.tobText || '',
      rating: result.rating || '',
      profileUrl: result.reportUrl || '',
      bbbMember: Boolean(result.bbbMember),
    }));
    return { results, totalPages: Number(searchResult.totalPages || 0) };
  } catch {
    return { results: [], totalPages: 0 };
  }
}

function parseBBBProfile(html) {
  const match = String(html || '').match(/window\.__PRELOADED_STATE__\s*=\s*({.*?});\s*<\/script>/s);
  if (!match) return { website: '', ownerName: '', ownerTitle: '', yearsInBusiness: 0 };
  try {
    const state = JSON.parse(match[1]);
    const profile = state.businessProfile || {};
    let ownerName = '';
    let ownerTitle = '';
    for (const contact of profile.contactInformation?.contacts || []) {
      if (!contact.name || (!contact.isPrincipal && !contact.title)) continue;
      ownerName = `${contact.name.first || ''} ${contact.name.last || ''}`.trim();
      ownerTitle = contact.title || 'Owner';
      if (ownerName) break;
    }
    return {
      website: profile.urls?.primary || '',
      ownerName,
      ownerTitle,
      yearsInBusiness: Number(profile.yearsInBusiness || 0),
    };
  } catch {
    return { website: '', ownerName: '', ownerTitle: '', yearsInBusiness: 0 };
  }
}

function absoluteBBBUrl(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://www.bbb.org${url.startsWith('/') ? '' : '/'}${url}`;
}

function keepCandidate(lead) {
  if (!lead.businessName || !lead.phone) return false;
  if (!ALLOWED_STATES.includes(String(lead.state || '').toUpperCase())) return false;
  if (isChainBusiness(lead.businessName)) return false;
  if (!isHomeService(lead)) return false;
  return true;
}

function addCandidate(candidates, seen, lead) {
  if (!lead || !keepCandidate(lead)) return false;
  const key = businessKey(lead);
  if (!key || seen.has(key)) return false;
  const candidate = annotateSourceOpportunity(lead);
  if (!candidateAdmissionAllowed(candidates, candidate)) return false;
  seen.add(key);
  candidates.push(candidate);
  return true;
}

function candidateAdmissionAllowed(candidates, candidate) {
  if (candidate.sourceOpportunity !== 'website_rich_low_priority') return true;
  const sourceKey = candidate.sourceName || 'unknown';
  const marketKey = `${candidate.sourceName || 'unknown'}|${candidate.city || ''}|${candidate.state || ''}`.toLowerCase();
  const sourceCount = candidates.filter(item =>
    item.sourceOpportunity === 'website_rich_low_priority'
    && (item.sourceName || 'unknown') === sourceKey).length;
  const marketCount = candidates.filter(item =>
    item.sourceOpportunity === 'website_rich_low_priority'
    && `${item.sourceName || 'unknown'}|${item.city || ''}|${item.state || ''}`.toLowerCase() === marketKey).length;
  return sourceCount < WEBSITE_RICH_SOURCE_CAP && marketCount < WEBSITE_RICH_MARKET_CAP;
}

function annotateSourceOpportunity(lead = {}) {
  const sourceOpportunity = classifySourceOpportunity(lead);
  return {
    ...lead,
    sourceOpportunity,
    opportunityBucket: sourceOpportunity,
  };
}

function classifySourceOpportunity(lead = {}) {
  if (!normalizeWebsite(lead.website)) return 'no_source_website';

  const sourceName = String(lead.sourceName || '').toLowerCase();
  const payload = lead.rawPayload || {};
  const sourceIssues = String(lead.sourceIssues || '');
  const yearsInBusiness = Number(payload.yearsInBusiness || 0);
  const establishedBbb = sourceName === 'bbb'
    && (yearsInBusiness >= 5 || payload.bbbMember || payload.bbbRating || payload.rating);

  if (establishedBbb) return 'website_rich_low_priority';
  if (sourceName === 'bbb' && normalizeWebsite(lead.website)) return 'website_rich_low_priority';
  if (/poor|outdated|old|mobile|slow|no\s+(?:form|cta|quote|estimate)|stale/i.test(sourceIssues)) {
    return 'possible_poor_site';
  }
  return 'possible_poor_site';
}

function orderCandidatesForAudit(candidates = [], options = {}) {
  const sourceCap = Number(options.websiteRichSourceCap || WEBSITE_RICH_SOURCE_CAP);
  const marketCap = Number(options.websiteRichMarketCap || WEBSITE_RICH_MARKET_CAP);
  const indexed = candidates.map((candidate, index) => ({
    candidate: annotateSourceOpportunity(candidate),
    index,
  }));
  indexed.sort((a, b) => opportunityRank(a.candidate) - opportunityRank(b.candidate)
    || localRank(a.candidate) - localRank(b.candidate)
    || sourceRank(a.candidate) - sourceRank(b.candidate)
    || a.index - b.index);

  const primary = [];
  const deferred = [];
  const bySource = new Map();
  const byMarket = new Map();

  for (const entry of indexed) {
    const candidate = entry.candidate;
    if (candidate.sourceOpportunity !== 'website_rich_low_priority') {
      primary.push(candidate);
      continue;
    }

    const sourceKey = candidate.sourceName || 'unknown';
    const marketKey = `${candidate.sourceName || 'unknown'}|${candidate.city || ''}|${candidate.state || ''}`.toLowerCase();
    const sourceCount = bySource.get(sourceKey) || 0;
    const marketCount = byMarket.get(marketKey) || 0;
    if (sourceCount >= sourceCap || marketCount >= marketCap) {
      deferred.push(candidate);
      continue;
    }
    bySource.set(sourceKey, sourceCount + 1);
    byMarket.set(marketKey, marketCount + 1);
    primary.push(candidate);
  }

  return [
    ...interleaveOpportunityBuckets(primary),
    ...interleaveOpportunityBuckets(deferred),
  ];
}

function opportunityRank(lead) {
  return ({
    no_source_website: 0,
    possible_poor_site: 1,
    website_rich_low_priority: 2,
  })[lead.sourceOpportunity] ?? 1;
}

function localRank(lead) {
  return isLocalLead(lead) ? 0 : 1;
}

function sourceRank(lead) {
  const source = String(lead.sourceName || '').toLowerCase();
  if (source === 'yellowpages') return 0;
  if (source === 'florida-dbpr') return 1;
  if (source === 'osm-overpass') return 2;
  if (source === 'serpapi-google-maps') return 3;
  if (source === 'seed-list') return 4;
  if (source === 'bbb') return 5;
  return 6;
}

function interleaveOpportunityBuckets(candidates) {
  const buckets = ['no_source_website', 'possible_poor_site', 'website_rich_low_priority'];
  return buckets.flatMap(bucket => roundRobinByNiche(
    candidates.filter(candidate => candidate.sourceOpportunity === bucket),
  ));
}

function roundRobinByNiche(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const niche = normalizeKey(candidate.niche || 'unknown') || 'unknown';
    if (!groups.has(niche)) groups.set(niche, []);
    groups.get(niche).push(candidate);
  }
  const orderedKeys = [...groups.keys()];
  const out = [];
  while (orderedKeys.length) {
    for (let i = 0; i < orderedKeys.length; i++) {
      const key = orderedKeys[i];
      const next = groups.get(key).shift();
      if (next) out.push(next);
      if (!groups.get(key).length) {
        orderedKeys.splice(i, 1);
        i--;
      }
    }
  }
  return out;
}

function inferNiche(name) {
  const text = String(name || '').toLowerCase();
  if (/roof/.test(text)) return 'roofing contractor';
  if (/hvac|heating|cooling|air/.test(text)) return 'hvac contractor';
  if (/plumb/.test(text)) return 'plumber';
  if (/electric/.test(text)) return 'electrician';
  if (/remodel|construction|renovation/.test(text)) return 'remodeling contractor';
  if (/tree/.test(text)) return 'tree service';
  if (/pest|termite/.test(text)) return 'pest control';
  if (/garage/.test(text)) return 'garage door repair';
  if (/landscap|lawn/.test(text)) return 'landscaping';
  return 'home service';
}

function get(row, keys) {
  for (const key of keys) {
    if (row[key]) return row[key];
  }
  const lower = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
  for (const key of keys) {
    const value = lower[key.toLowerCase()];
    if (value) return value;
  }
  return '';
}

function extract(text, pattern) {
  const match = String(text || '').match(pattern);
  return match ? match[1] : '';
}

function clean(value) {
  return stripHtml(value).replace(/\s+/g, ' ').trim();
}

module.exports = {
  discoverCandidates,
  loadSeedCandidates,
  scrapeBBB,
  scrapeYellowPages,
  scrapeSerpApiMaps,
  scrapeOpenStreetMap,
  scrapeFloridaDBPR,
  normalizeSeedRow,
  sourcePlan,
  parseYellowPagesSearch,
  parseBBBSearch,
  parseBBBProfile,
  parseDbprResults,
  mergeSoftDupes,
  annotateSourceOpportunity,
  classifySourceOpportunity,
  roundRobinByNiche,
  orderCandidatesForAudit,
};
