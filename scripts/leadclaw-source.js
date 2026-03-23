#!/usr/bin/env node
/**
 * leadclaw-source.js
 * BBB curl-based scraper for LeadClaw (web design agency leads).
 * Unlike Latchly scraper, keeps BOTH website and no-website leads.
 *
 * Bucket A targets: businesses with NO website
 * Bucket B targets: businesses WITH a website (quality scored later)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEADS_DIR = path.join(ROOT, 'leads', 'leadclaw');
const OUTPUT = process.env.LEADCLAW_OUTPUT || path.join(LEADS_DIR, 'raw.csv');
const MASTER_CSV = process.env.LEADCLAW_MASTER || path.join(LEADS_DIR, 'master.csv');
const RAW_TARGET = parseInt(process.env.RAW_TARGET || '450', 10);

// .env loader
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

// Hyper-focused: 4 highest-ticket home service niches with worst websites
const NICHES = [
  'HVAC contractor',
  'plumber',
  'roofing contractor',
  'electrician',
];

// Sun Belt + major metros — highest density of independent operators
const CITIES = [
  { city: 'Dallas',        state: 'TX' },
  { city: 'Houston',       state: 'TX' },
  { city: 'San Antonio',   state: 'TX' },
  { city: 'Austin',        state: 'TX' },
  { city: 'Fort Worth',    state: 'TX' },
  { city: 'El Paso',       state: 'TX' },
  { city: 'Jacksonville',  state: 'FL' },
  { city: 'Miami',         state: 'FL' },
  { city: 'Tampa',         state: 'FL' },
  { city: 'Orlando',       state: 'FL' },
  { city: 'Fort Lauderdale', state: 'FL' },
  { city: 'Atlanta',       state: 'GA' },
  { city: 'Charlotte',     state: 'NC' },
  { city: 'Raleigh',       state: 'NC' },
  { city: 'Nashville',     state: 'TN' },
  { city: 'Memphis',       state: 'TN' },
  { city: 'Phoenix',       state: 'AZ' },
  { city: 'Tucson',        state: 'AZ' },
  { city: 'Las Vegas',     state: 'NV' },
  { city: 'Denver',        state: 'CO' },
  { city: 'Colorado Springs', state: 'CO' },
  { city: 'Oklahoma City', state: 'OK' },
  { city: 'Tulsa',         state: 'OK' },
  { city: 'Kansas City',   state: 'MO' },
  { city: 'St. Louis',     state: 'MO' },
  { city: 'Indianapolis',  state: 'IN' },
  { city: 'Columbus',      state: 'OH' },
  { city: 'Cincinnati',    state: 'OH' },
  { city: 'Louisville',    state: 'KY' },
  { city: 'Richmond',      state: 'VA' },
  { city: 'Virginia Beach', state: 'VA' },
  { city: 'Baltimore',     state: 'MD' },
  { city: 'Philadelphia',  state: 'PA' },
  { city: 'Pittsburgh',    state: 'PA' },
  { city: 'Chicago',       state: 'IL' },
  { city: 'Sacramento',    state: 'CA' },
  { city: 'Riverside',     state: 'CA' },
  { city: 'Albuquerque',   state: 'NM' },
  { city: 'Salt Lake City', state: 'UT' },
  { city: 'Birmingham',    state: 'AL' },
];

const FRANCHISE_RE = /one hour|mr\. rooter|roto-rooter|service experts|ars rescue|home depot|lowe'?s|comfort systems|lennox|carrier|trane|terminix|orkin|rentokil|servpro|servicemaster|jiffy lube|merry maids|true green|trugreen|sears home|sears service|mr\. electric|mr\. appliance|aire serv|aspen dental|heartland dental|comfort dental|western dental|bright now|pacific dental/i;

function getTodayQueries(targetCombos = 55) {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const allCombos = [];
  for (const niche of NICHES) {
    for (const loc of CITIES) {
      allCombos.push({ niche, ...loc });
    }
  }
  const offset = (dayOfYear * 19) % allCombos.length; // different prime from Latchly
  const rotated = [...allCombos.slice(offset), ...allCombos.slice(0, offset)];
  return rotated.slice(0, targetCombos);
}

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
    const nameIdx = headers.findIndex(h => /business.?name/i.test(h));
    const webIdx = headers.findIndex(h => /website/i.test(h));
    for (const line of lines.slice(1)) {
      const vals = splitCSV(line);
      const name = (vals[nameIdx] || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      const web = (vals[webIdx] || '').toLowerCase()
        .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').trim();
      if (name) keys.add(name);
      if (web) keys.add(web);
    }
  } catch {}
  return keys;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

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

function parseBBBProfile(html) {
  const match = html.match(/window\.__PRELOADED_STATE__\s*=\s*({.*?});\s*<\/script>/s);
  if (!match) return { website: '', ownerName: '', ownerTitle: '', yearsInBusiness: 0 };
  try {
    const state = JSON.parse(match[1]);
    const bp = state.businessProfile || {};
    const website = (bp.urls && bp.urls.primary) || '';
    let ownerName = '';
    let ownerTitle = '';
    if (bp.contactInformation && bp.contactInformation.contacts) {
      for (const c of bp.contactInformation.contacts) {
        if (c.name && (c.isPrincipal || c.title)) {
          ownerName = `${c.name.first || ''} ${c.name.last || ''}`.trim();
          ownerTitle = c.title || 'Owner';
          break;
        }
      }
    }
    const yearsInBusiness = bp.yearsInBusiness || 0;
    return { website, ownerName, ownerTitle, yearsInBusiness };
  } catch {
    return { website: '', ownerName: '', ownerTitle: '', yearsInBusiness: 0 };
  }
}

async function main() {
  fs.mkdirSync(LEADS_DIR, { recursive: true });

  console.log('\n===================================================');
  console.log(' LEADCLAW SOURCE (BBB curl-based)');
  console.log(` Target: ${RAW_TARGET} raw leads (both website + no-website)`);
  console.log('===================================================\n');

  const masterKeys = loadMasterKeys();
  console.log(`Loaded ${masterKeys.size} existing keys for deduplication`);

  const queries = getTodayQueries();
  console.log(`Today's rotation: ${queries.length} niche/city combos\n`);

  const HEADERS = 'Business Name,Niche,City,State,Phone,Website,Owner,Title,BBB Accredited,Years In Business';
  fs.writeFileSync(OUTPUT, HEADERS + '\n');

  const collected = [];
  const seen = new Set(masterKeys);
  let profileLookups = 0;
  let withSite = 0;
  let noSite = 0;

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

      if (parsed.totalPages > 1 && collected.length + searchResults.length < RAW_TARGET) {
        await delay(300);
        try {
          const html2 = await fetchPage(searchUrl.replace('page=1', 'page=2'));
          searchResults.push(...parseBBBSearch(html2).results);
        } catch {}
      }
    } catch (err) {
      process.stdout.write(`search error: ${err.message}\n`);
      continue;
    }

    process.stdout.write(`${searchResults.length} found  `);
    searchResults = searchResults.filter(r => !FRANCHISE_RE.test(r.businessName));

    let added = 0;
    for (const result of searchResults) {
      if (collected.length >= RAW_TARGET) break;
      if (!result.businessName || !result.phone) continue;

      const nameKey = result.businessName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      if (!nameKey || seen.has(nameKey)) continue;

      let website = '';
      let ownerName = '';
      let ownerTitle = '';
      let yearsInBusiness = 0;

      if (result.profileUrl) {
        profileLookups++;
        try {
          await delay(200 + Math.random() * 300);
          const profileHtml = await fetchPage(`https://www.bbb.org${result.profileUrl}`);
          const profile = parseBBBProfile(profileHtml);
          website = profile.website;
          ownerName = profile.ownerName;
          ownerTitle = profile.ownerTitle;
          yearsInBusiness = profile.yearsInBusiness;
        } catch {}
      }

      // Dedup by website domain if present
      if (website) {
        const webKey = website.toLowerCase()
          .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
        if (seen.has(webKey)) continue;
        seen.add(webKey);
        withSite++;
      } else {
        noSite++;
      }

      seen.add(nameKey);

      const phone = normalizePhone(result.phone);
      if (!phone) continue;

      const row = [
        result.businessName,
        niche,
        result.city || city,
        result.state || state,
        phone,
        website,
        ownerName,
        ownerTitle,
        result.bbbMember ? 'Yes' : 'No',
        yearsInBusiness || '',
      ].map(csvEscape).join(',');

      fs.appendFileSync(OUTPUT, row + '\n');
      collected.push({
        businessName: result.businessName,
        niche,
        city: result.city || city,
        state: result.state || state,
        phone,
        website,
        ownerName,
        ownerTitle,
        bbbMember: result.bbbMember,
        yearsInBusiness,
      });
      added++;
    }

    console.log(`-> ${added} new (total: ${collected.length})`);
    await delay(400 + Math.random() * 300);
  }

  console.log('\n===================================================');
  console.log(` Scraped ${collected.length} raw leads -> ${path.relative(ROOT, OUTPUT)}`);
  console.log(` With website: ${withSite} | No website: ${noSite}`);
  console.log(` Profile lookups: ${profileLookups}`);
  console.log('===================================================\n');
}

main().catch(err => {
  console.error('leadclaw-source failed:', err.message);
  process.exit(1);
});
