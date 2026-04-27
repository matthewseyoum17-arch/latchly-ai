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
} = require('./config');
const {
  businessKey,
  domainFromWebsite,
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
  const localCandidateLimit = Math.min(
    limit,
    parseInt(process.env.LATCHLY_LOCAL_CANDIDATE_LIMIT || String(Math.max(TARGET_DAILY_LEADS * 3, 150)), 10),
  );

  const finalize = () => mergeSoftDupes(candidates).slice(0, limit);

  if (liveEnabled) {
    await collectCandidates(candidates, seen, localCandidateLimit, scrapePublicDirectories(localCandidateLimit, LOCAL_MARKETS));
    // OSM Overpass adds local supply for Gainesville/Tallahassee — niche
    // balance is mediocre (OSM `craft=roofer` over-tagged vs other crafts)
    // but for LOCAL it's pure additional volume.
    await collectCandidates(candidates, seen, localCandidateLimit, scrapeOpenStreetMap(localCandidateLimit - candidates.length, LOCAL_MARKETS));
    await collectCandidates(candidates, seen, localCandidateLimit, scrapePaidFallback(localCandidateLimit - candidates.length, LOCAL_MARKETS));
  }

  for (const lead of seeds.filter(isLocalLead)) {
    addCandidate(candidates, seen, lead);
    if (candidates.length >= limit) return finalize();
  }

  if (liveEnabled) {
    const broadMarkets = nonLocalMarkets();
    await collectCandidates(candidates, seen, limit, scrapePublicDirectories(Math.max(0, limit - candidates.length), broadMarkets));
    // OSM in broader Sunbelt pass is opt-in — adds 8-15 min to daily runs.
    if (process.env.LATCHLY_ENABLE_OSM_BROAD === '1') {
      await collectCandidates(candidates, seen, limit, scrapeOpenStreetMap(Math.max(0, limit - candidates.length), broadMarkets));
    }
    await collectCandidates(candidates, seen, limit, scrapePaidFallback(Math.max(0, limit - candidates.length), broadMarkets));
  }

  for (const lead of seeds.filter(lead => !isLocalLead(lead))) {
    addCandidate(candidates, seen, lead);
    if (candidates.length >= limit) return finalize();
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
    const results = [
      ...await scrapeBBB(niche, market.city, market.state).catch(() => []),
      ...await scrapeYellowPages(niche, market.city, market.state).catch(() => []),
    ];
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
  for (const niche of HOME_SERVICE_NICHES) {
    for (const market of markets) {
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
// Best lever for Gainesville/Tallahassee local supply since it lists every
// licensed contractor statewide regardless of how they market themselves.
// Endpoint format may need iteration — defensive: silently yields nothing
// if the endpoint shape changes.
async function* scrapeFloridaDBPR(limit, marketsOverride = null) {
  if (limit <= 0) return;
  if (process.env.LATCHLY_SKIP_DBPR_DISCOVERY === '1') return;
  const onlyMode = process.env.LATCHLY_DISCOVERY_ONLY;
  if (onlyMode && onlyMode !== 'dbpr') return;

  const markets = (marketsOverride || prioritizeMarkets()).filter(m => m.state === 'FL');
  if (!markets.length) return;
  let yielded = 0;

  for (const market of markets) {
    if (yielded >= limit) return;

    for (const niche of HOME_SERVICE_NICHES) {
      if (yielded >= limit) return;
      const licenseTypes = FLORIDA_DBPR_LICENSE_TYPES[niche];
      if (!licenseTypes || !licenseTypes.length) continue;

      for (const licenseType of licenseTypes) {
        if (yielded >= limit) return;
        // Public DBPR business search query — POST-style fields encoded as GET.
        const params = new URLSearchParams({
          professionId: 'all',
          licenseTypeCode: licenseType,
          city: market.city,
          status: 'Current',
        });
        const url = `https://www.myfloridalicense.com/wl11.asp?${params.toString()}`;

        let res;
        try {
          res = await fetchText(url, 25000);
        } catch {
          continue;
        }
        if (!res?.ok || !res.text) continue;

        // The DBPR results page is HTML with a table of licensees. Parse rows
        // looking for company/individual name + city + license number.
        const rows = parseDbprResults(res.text, niche, licenseType, market);
        for (const lead of rows.slice(0, SOURCE_PER_QUERY_LIMIT)) {
          if (yielded >= limit) return;
          if (!keepCandidate(lead)) continue;
          yielded++;
          yield lead;
        }
        await sleep(400);
      }
    }
  }
}

function parseDbprResults(html, niche, licenseType, market) {
  const leads = [];
  if (!html) return leads;
  // Find table rows; pattern is loose to tolerate DBPR HTML variations.
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowPattern.exec(html))) {
    const rowHtml = match[1];
    const cells = [];
    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowHtml))) {
      cells.push(stripHtml(cellMatch[1]).trim());
    }
    if (cells.length < 3) continue;
    const businessName = cells.find(c => /\b(LLC|INC|CORP|CO\.?|COMPANY|CONTRACTORS?|SERVICES?)\b/i.test(c)) || cells[1];
    if (!businessName || businessName.length < 4) continue;
    if (/^\s*Name\s*$/i.test(businessName)) continue; // header row
    const city = cells.find(c => c.toUpperCase() === market.city.toUpperCase()) || market.city;
    leads.push({
      sourceName: 'florida-dbpr',
      sourceRecordId: `dbpr-${licenseType}-${businessName}|${city}`,
      rawPayload: { licenseType, cells },
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
  const html = res.text;
  const chunks = html.split(/<div[^>]+class=["'][^"']*(?:result|search-results-organic)[^"']*["'][^>]*>/i).slice(1, SOURCE_PER_QUERY_LIMIT + 1);
  const leads = [];

  for (const chunk of chunks) {
    const name = clean(extract(chunk, /class=["'][^"']*business-name[^"']*["'][^>]*>([\s\S]*?)<\/a>/i))
      || clean(extract(chunk, /<a[^>]+class=["'][^"']*business-name[^"']*["'][^>]*>([\s\S]*?)<\/a>/i));
    const phone = normalizePhone(clean(extract(chunk, /class=["'][^"']*phones[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)));
    const website = normalizeWebsite(clean(extract(chunk, /href=["'](https?:\/\/(?!www\.yellowpages\.com)[^"']+)["'][^>]*>(?:Website|Visit Website)/i)));
    if (!name || !phone) continue;
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
  seen.add(key);
  candidates.push(lead);
  return true;
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
  parseBBBSearch,
  parseBBBProfile,
  parseDbprResults,
  mergeSoftDupes,
};
