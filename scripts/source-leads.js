#!/usr/bin/env node
/**
 * source-leads.js
 * Curl-based BBB lead scraper for LatchlyAI.
 *
 * BBB serves structured JSON in __PRELOADED_STATE__ for search results
 * and profile pages. No browser needed — plain HTTP requests via Node fetch.
 *
 * Flow per niche/city combo:
 *   1. Fetch BBB search page (15 results per page, multiple pages)
 *   2. Parse __PRELOADED_STATE__ JSON for business name, phone, city, state, profileUrl
 *   3. Fetch each profile page for website URL + owner name
 *   4. Dedup against master list + session
 *   5. Output apollo-leads.csv format for qualify-leads.js
 *
 * Env vars:
 *   APOLLO_OUTPUT   output CSV path   (default: leads/apollo-leads.csv)
 *   MASTER_CSV      master list path  (default: leads/qualified-leads.csv)
 *   RAW_TARGET      raw lead target   (default: 450)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEADS_DIR = path.join(ROOT, 'leads');
const OUTPUT = process.env.APOLLO_OUTPUT || path.join(LEADS_DIR, 'apollo-leads.csv');
const MASTER_CSV = process.env.MASTER_CSV || path.join(LEADS_DIR, 'qualified-leads.csv');
const RAW_TARGET = parseInt(process.env.RAW_TARGET || '450', 10);
// No cap on profile lookups — every lead needs a website

// .env loader
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

// ── Niches ────────────────────────────────────────────────────────────────────

const NICHES = [
  'HVAC contractor',
  'plumber',
  'roofing contractor',
  'pest control',
  'garage door repair',
  'electrician',
  'water damage restoration',
  'foundation repair',
  'tree service',
  'remodeling contractor',
  'concrete contractor',
  'landscaping',
  'pool service',
  'locksmith',
  'moving company',
  'fence contractor',
  'painting contractor',
  'carpet cleaning',
  'window cleaning',
  'pressure washing',
  'gutter cleaning',
  'appliance repair',
  'flooring contractor',
  'septic service',
  'chimney sweep',
  'insulation contractor',
  'siding contractor',
  'solar installer',
  'drywall contractor',
  'glass repair',
  'paving contractor',
  'waterproofing contractor',
  'home inspector',
  'lawn care',
  'irrigation service',
  'junk removal',
  'mold remediation',
  'deck builder',
  'handyman service',
  'fire damage restoration',
];

// ── Cities ────────────────────────────────────────────────────────────────────

const CITIES = [
  // Texas
  { city: 'Dallas',           state: 'TX' },
  { city: 'Houston',          state: 'TX' },
  { city: 'San Antonio',      state: 'TX' },
  { city: 'Austin',           state: 'TX' },
  { city: 'Fort Worth',       state: 'TX' },
  { city: 'El Paso',          state: 'TX' },
  { city: 'Lubbock',          state: 'TX' },
  { city: 'Corpus Christi',   state: 'TX' },
  { city: 'McAllen',          state: 'TX' },
  { city: 'Amarillo',         state: 'TX' },
  // Florida
  { city: 'Jacksonville',     state: 'FL' },
  { city: 'Miami',            state: 'FL' },
  { city: 'Tampa',            state: 'FL' },
  { city: 'Orlando',          state: 'FL' },
  { city: 'Fort Myers',       state: 'FL' },
  { city: 'Pensacola',        state: 'FL' },
  { city: 'Tallahassee',      state: 'FL' },
  { city: 'Sarasota',         state: 'FL' },
  // Georgia
  { city: 'Atlanta',          state: 'GA' },
  { city: 'Savannah',         state: 'GA' },
  { city: 'Augusta',          state: 'GA' },
  { city: 'Macon',            state: 'GA' },
  // North Carolina
  { city: 'Charlotte',        state: 'NC' },
  { city: 'Raleigh',          state: 'NC' },
  { city: 'Greensboro',       state: 'NC' },
  { city: 'Wilmington',       state: 'NC' },
  { city: 'Asheville',        state: 'NC' },
  // South Carolina
  { city: 'Charleston',       state: 'SC' },
  { city: 'Columbia',         state: 'SC' },
  { city: 'Greenville',       state: 'SC' },
  // Tennessee
  { city: 'Nashville',        state: 'TN' },
  { city: 'Memphis',          state: 'TN' },
  { city: 'Knoxville',        state: 'TN' },
  { city: 'Chattanooga',      state: 'TN' },
  // Ohio
  { city: 'Columbus',         state: 'OH' },
  { city: 'Cleveland',        state: 'OH' },
  { city: 'Cincinnati',       state: 'OH' },
  { city: 'Dayton',           state: 'OH' },
  { city: 'Akron',            state: 'OH' },
  // Indiana
  { city: 'Indianapolis',     state: 'IN' },
  { city: 'Fort Wayne',       state: 'IN' },
  { city: 'Evansville',       state: 'IN' },
  // Kentucky
  { city: 'Louisville',       state: 'KY' },
  { city: 'Lexington',        state: 'KY' },
  // Illinois
  { city: 'Chicago',          state: 'IL' },
  { city: 'Springfield',      state: 'IL' },
  { city: 'Rockford',         state: 'IL' },
  { city: 'Peoria',           state: 'IL' },
  // Michigan
  { city: 'Detroit',          state: 'MI' },
  { city: 'Grand Rapids',     state: 'MI' },
  { city: 'Lansing',          state: 'MI' },
  { city: 'Kalamazoo',        state: 'MI' },
  // Arizona
  { city: 'Phoenix',          state: 'AZ' },
  { city: 'Tucson',           state: 'AZ' },
  { city: 'Mesa',             state: 'AZ' },
  { city: 'Flagstaff',        state: 'AZ' },
  // Nevada
  { city: 'Las Vegas',        state: 'NV' },
  { city: 'Reno',             state: 'NV' },
  // Colorado
  { city: 'Denver',           state: 'CO' },
  { city: 'Colorado Springs', state: 'CO' },
  { city: 'Fort Collins',     state: 'CO' },
  // Missouri
  { city: 'Kansas City',      state: 'MO' },
  { city: 'St. Louis',        state: 'MO' },
  { city: 'Springfield',      state: 'MO' },
  // Oklahoma
  { city: 'Oklahoma City',    state: 'OK' },
  { city: 'Tulsa',            state: 'OK' },
  // Minnesota
  { city: 'Minneapolis',      state: 'MN' },
  { city: 'Rochester',        state: 'MN' },
  { city: 'Duluth',           state: 'MN' },
  // Virginia
  { city: 'Richmond',         state: 'VA' },
  { city: 'Virginia Beach',   state: 'VA' },
  { city: 'Norfolk',          state: 'VA' },
  { city: 'Roanoke',          state: 'VA' },
  // Maryland
  { city: 'Baltimore',        state: 'MD' },
  { city: 'Annapolis',        state: 'MD' },
  { city: 'Frederick',        state: 'MD' },
  // Pennsylvania
  { city: 'Pittsburgh',       state: 'PA' },
  { city: 'Philadelphia',     state: 'PA' },
  { city: 'Harrisburg',       state: 'PA' },
  { city: 'Allentown',        state: 'PA' },
  // Utah
  { city: 'Salt Lake City',   state: 'UT' },
  { city: 'Provo',            state: 'UT' },
  { city: 'Ogden',            state: 'UT' },
  // California
  { city: 'Sacramento',       state: 'CA' },
  { city: 'Los Angeles',      state: 'CA' },
  { city: 'San Diego',        state: 'CA' },
  { city: 'San Jose',         state: 'CA' },
  { city: 'Fresno',           state: 'CA' },
  { city: 'Bakersfield',      state: 'CA' },
  { city: 'Riverside',        state: 'CA' },
  // New York
  { city: 'New York',         state: 'NY' },
  { city: 'Buffalo',          state: 'NY' },
  { city: 'Rochester',        state: 'NY' },
  { city: 'Syracuse',         state: 'NY' },
  { city: 'Albany',            state: 'NY' },
  // New Jersey
  { city: 'Newark',           state: 'NJ' },
  { city: 'Jersey City',      state: 'NJ' },
  { city: 'Trenton',          state: 'NJ' },
  // Massachusetts
  { city: 'Boston',           state: 'MA' },
  { city: 'Worcester',        state: 'MA' },
  { city: 'Springfield',      state: 'MA' },
  // Connecticut
  { city: 'Hartford',         state: 'CT' },
  { city: 'New Haven',        state: 'CT' },
  // Washington
  { city: 'Seattle',          state: 'WA' },
  { city: 'Spokane',          state: 'WA' },
  { city: 'Tacoma',           state: 'WA' },
  // Oregon
  { city: 'Portland',         state: 'OR' },
  { city: 'Eugene',           state: 'OR' },
  { city: 'Salem',            state: 'OR' },
  // Alabama
  { city: 'Birmingham',       state: 'AL' },
  { city: 'Montgomery',       state: 'AL' },
  { city: 'Huntsville',       state: 'AL' },
  { city: 'Mobile',           state: 'AL' },
  // Mississippi
  { city: 'Jackson',          state: 'MS' },
  { city: 'Biloxi',           state: 'MS' },
  // Louisiana
  { city: 'New Orleans',      state: 'LA' },
  { city: 'Baton Rouge',      state: 'LA' },
  { city: 'Shreveport',       state: 'LA' },
  // Arkansas
  { city: 'Little Rock',      state: 'AR' },
  { city: 'Fayetteville',     state: 'AR' },
  // Iowa
  { city: 'Des Moines',       state: 'IA' },
  { city: 'Cedar Rapids',     state: 'IA' },
  // Kansas
  { city: 'Wichita',          state: 'KS' },
  { city: 'Topeka',           state: 'KS' },
  // Nebraska
  { city: 'Omaha',            state: 'NE' },
  { city: 'Lincoln',          state: 'NE' },
  // Wisconsin
  { city: 'Milwaukee',        state: 'WI' },
  { city: 'Madison',          state: 'WI' },
  { city: 'Green Bay',        state: 'WI' },
  // New Mexico
  { city: 'Albuquerque',      state: 'NM' },
  { city: 'Santa Fe',         state: 'NM' },
  { city: 'Las Cruces',       state: 'NM' },
  // Idaho
  { city: 'Boise',            state: 'ID' },
  { city: 'Idaho Falls',      state: 'ID' },
  // Montana
  { city: 'Billings',         state: 'MT' },
  { city: 'Missoula',         state: 'MT' },
  // Wyoming
  { city: 'Cheyenne',         state: 'WY' },
  { city: 'Casper',           state: 'WY' },
  // North Dakota
  { city: 'Fargo',            state: 'ND' },
  { city: 'Bismarck',         state: 'ND' },
  // South Dakota
  { city: 'Sioux Falls',      state: 'SD' },
  { city: 'Rapid City',       state: 'SD' },
  // West Virginia
  { city: 'Charleston',       state: 'WV' },
  { city: 'Huntington',       state: 'WV' },
  // New Hampshire
  { city: 'Manchester',       state: 'NH' },
  { city: 'Nashua',           state: 'NH' },
  // Maine
  { city: 'Portland',         state: 'ME' },
  { city: 'Bangor',           state: 'ME' },
  // Vermont
  { city: 'Burlington',       state: 'VT' },
  // Rhode Island
  { city: 'Providence',       state: 'RI' },
  // Delaware
  { city: 'Wilmington',       state: 'DE' },
  // Hawaii
  { city: 'Honolulu',         state: 'HI' },
  // Alaska
  { city: 'Anchorage',        state: 'AK' },
  // Washington DC
  { city: 'Washington',       state: 'DC' },
];

// ── Franchise filter ──────────────────────────────────────────────────────────

const FRANCHISE_RE = /one hour|mr\. rooter|roto-rooter|service experts|ars rescue|home depot|lowe'?s|comfort systems|lennox|carrier|trane|terminix|orkin|rentokil|servpro|servicemaster|jiffy lube|merry maids|the groundskeeper|true green|trugreen|sears home|sears service|anytime plumber|mr\. electric|mr\. appliance|aire serv/i;

// ── Rotation ──────────────────────────────────────────────────────────────────

function getTodayQueries(targetCombos = 120) {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const allCombos = [];
  for (const niche of NICHES) {
    for (const loc of CITIES) {
      allCombos.push({ niche, ...loc });
    }
  }
  const offset = (dayOfYear * 17) % allCombos.length;
  const rotated = [...allCombos.slice(offset), ...allCombos.slice(0, offset)];
  return rotated.slice(0, targetCombos);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function csvEscape(v) {
  const s = String(v || '').replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits.slice(0, 10);
  if (ten.length !== 10) return '';
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function splitCSV(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else { q = !q; }
      continue;
    }
    if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function loadMasterKeys() {
  const keys = new Set();
  if (!fs.existsSync(MASTER_CSV)) return keys;
  try {
    const lines = fs.readFileSync(MASTER_CSV, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    const headers = splitCSV(lines[0]);
    const nameIdx = headers.findIndex(h => /business.?name|company/i.test(h));
    const webIdx = headers.findIndex(h => /website/i.test(h));
    for (const line of lines.slice(1)) {
      const vals = splitCSV(line);
      const name = (vals[nameIdx] || '').toLowerCase().replace(/\s+/g, '').trim();
      const web = (vals[webIdx] || '').toLowerCase()
        .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').trim();
      if (name) keys.add(name);
      if (web) keys.add(web);
    }
  } catch {}
  return keys;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── HTTP fetch ───────────────────────────────────────────────────────────────

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function fetchPage(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
      },
      timeout: timeoutMs,
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redir = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        res.resume();
        return fetchPage(redir, timeoutMs).then(resolve, reject);
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── BBB Search Parser ────────────────────────────────────────────────────────

function parseBBBSearch(html) {
  const match = html.match(/window\.__PRELOADED_STATE__\s*=\s*({.*?});\s*<\/script>/s);
  if (!match) return { results: [], totalPages: 0 };

  try {
    const state = JSON.parse(match[1]);
    const sr = state.searchResult || {};
    const results = (sr.results || []).map(r => ({
      businessName: stripHtml(r.businessName || ''),
      phone: (r.phone && r.phone[0]) || '',
      city: r.city || '',
      state: r.state || '',
      category: r.tobText || '',
      rating: r.rating || '',
      profileUrl: r.reportUrl || '',
      bbbMember: r.bbbMember || false,
    }));
    return { results, totalPages: sr.totalPages || 0 };
  } catch {
    return { results: [], totalPages: 0 };
  }
}

// ── BBB Profile Parser ──────────────────────────────────────────────────────

function parseBBBProfile(html) {
  const match = html.match(/window\.__PRELOADED_STATE__\s*=\s*({.*?});\s*<\/script>/s);
  if (!match) return { website: '', ownerName: '', ownerTitle: '' };

  try {
    const state = JSON.parse(match[1]);
    const bp = state.businessProfile || {};
    const website = (bp.urls && bp.urls.primary) || '';

    let ownerName = '';
    let ownerTitle = '';
    if (bp.contactInformation && bp.contactInformation.contacts) {
      for (const c of bp.contactInformation.contacts) {
        if (c.name && (c.isPrincipal || c.title)) {
          const first = c.name.first || '';
          const last = c.name.last || '';
          ownerName = `${first} ${last}`.trim();
          ownerTitle = c.title || 'Owner';
          break;
        }
      }
    }

    return { website, ownerName, ownerTitle };
  } catch {
    return { website: '', ownerName: '', ownerTitle: '' };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(LEADS_DIR, { recursive: true });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(' LATCHLY LEAD SCRAPER (BBB curl-based)');
  console.log(` Target: ${RAW_TARGET} raw leads`);
  console.log('═══════════════════════════════════════════════════════\n');

  const masterKeys = loadMasterKeys();
  console.log(`Loaded ${masterKeys.size} existing keys for deduplication`);

  const queries = getTodayQueries();
  console.log(`Today's rotation: ${queries.length} niche/city combos\n`);

  // Output CSV header
  const HEADERS = 'Name,Title,Company,Industry,Employees,City,State,Email,Phone,LinkedIn,Company Website';
  fs.writeFileSync(OUTPUT, HEADERS + '\n');

  const collected = [];
  const seen = new Set(masterKeys);
  let profileLookups = 0;
  let profileHits = 0;
  let profileErrors = 0;

  for (const q of queries) {
    if (collected.length >= RAW_TARGET) break;

    const { niche, city, state } = q;
    const searchUrl = `https://www.bbb.org/search?find_text=${encodeURIComponent(niche)}&find_loc=${encodeURIComponent(`${city}, ${state}`)}&page=1`;

    process.stdout.write(`[${collected.length}/${RAW_TARGET}] ${niche} / ${city}, ${state}  `);

    let searchResults = [];
    try {
      const html = await fetchPage(searchUrl);
      const parsed = parseBBBSearch(html);
      searchResults = parsed.results;

      // Fetch up to 5 pages with error handling — stop on first failure
      const maxPages = Math.min(parsed.totalPages, 5);
      for (let pg = 2; pg <= maxPages && collected.length + searchResults.length < RAW_TARGET; pg++) {
        await delay(300 + Math.random() * 200);
        try {
          const pgHtml = await fetchPage(searchUrl.replace('page=1', `page=${pg}`));
          const pgParsed = parseBBBSearch(pgHtml);
          if (!pgParsed.results.length) break; // empty page = done
          searchResults.push(...pgParsed.results);
        } catch (pgErr) {
          // Page failed — stop paginating but keep what we have
          process.stdout.write(`(pg${pg} err) `);
          break;
        }
      }
    } catch (err) {
      process.stdout.write(`search error: ${err.message}\n`);
      continue;
    }

    process.stdout.write(`${searchResults.length} found  `);

    // Filter franchises
    searchResults = searchResults.filter(r => !FRANCHISE_RE.test(r.businessName));

    let added = 0;
    for (const result of searchResults) {
      if (collected.length >= RAW_TARGET) break;
      if (!result.businessName || !result.phone) continue;

      // Dedup by business name
      const nameKey = result.businessName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      if (!nameKey || seen.has(nameKey)) continue;

      // Look up profile for website + owner (rate-limited)
      let website = '';
      let ownerName = '';
      let ownerTitle = '';

      if (result.profileUrl) {
        profileLookups++;
        try {
          await delay(200 + Math.random() * 300);
          const profileHtml = await fetchPage(`https://www.bbb.org${result.profileUrl}`);
          const profile = parseBBBProfile(profileHtml);
          website = profile.website;
          ownerName = profile.ownerName;
          ownerTitle = profile.ownerTitle;
          if (website) profileHits++;
        } catch {
          profileErrors++;
        }
      }

      // Skip leads without a website — can't sell a chatbot without one
      if (!website) continue;

      // Dedup by website domain
      const webKey = website.toLowerCase()
        .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
      if (seen.has(webKey)) continue;

      seen.add(nameKey);
      seen.add(webKey);

      const phone = normalizePhone(result.phone);
      if (!phone) continue;

      const row = [
        ownerName,          // Name
        ownerTitle,         // Title
        result.businessName, // Company
        niche,              // Industry
        '',                 // Employees
        result.city || city, // City
        result.state || state, // State
        '',                 // Email
        phone,              // Phone
        '',                 // LinkedIn
        website,            // Company Website
      ].map(csvEscape).join(',');

      fs.appendFileSync(OUTPUT, row + '\n');
      collected.push({
        name: ownerName,
        company: result.businessName,
        phone,
        website,
        city: result.city || city,
        state: result.state || state,
      });
      added++;
    }

    console.log(`→ ${added} new (total: ${collected.length})`);
    await delay(400 + Math.random() * 300);
  }

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(` Scraped ${collected.length} raw leads → ${path.relative(ROOT, OUTPUT)}`);
  console.log(` Profile lookups: ${profileLookups} (${profileHits} with website, ${profileErrors} errors, ${profileLookups - profileHits - profileErrors} no website → skipped)`);
  if (collected.length < RAW_TARGET) {
    console.log(` Below target (${collected.length}/${RAW_TARGET})`);
  }
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('source-leads failed:', err.message);
  process.exit(1);
});
