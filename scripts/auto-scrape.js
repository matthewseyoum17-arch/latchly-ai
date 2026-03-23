#!/usr/bin/env node
/**
 * auto-scrape.js
 * Fully autonomous lead scraper — no Chrome session, no manual exports.
 * Scrapes YellowPages across rotating niche/city combos, dedupes against
 * master qualified list, outputs apollo-leads.csv format for the pipeline.
 *
 * Target: RAW_TARGET raw rows (default 450) so qualify-leads.js can find 150+.
 * Rotates city/niche combos daily so each run pulls fresh businesses.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEADS_DIR = path.join(ROOT, 'leads');
const OUTPUT = process.env.APOLLO_OUTPUT || path.join(LEADS_DIR, 'apollo-leads.csv');
const MASTER_CSV = process.env.MASTER_CSV || path.join(LEADS_DIR, 'qualified-leads.csv');
const RAW_TARGET = parseInt(process.env.RAW_TARGET || '600', 10);

// .env loader
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

// ── Search matrix ─────────────────────────────────────────────────────────────
// 14 niches × 40 cities = 560 combos. Rotate by day-of-year so each run hits
// a different slice and we never spam the same city+niche pair in a week.

const NICHES = [
  'HVAC contractor',
  'plumber',
  'electrician',
  'roofing contractor',
  'pest control',
  'landscaping',
  'garage door repair',
  'water damage restoration',
  'foundation repair',
  'tree service',
  'pool service',
  'solar installer',
  'locksmith',
  'moving company',
];

const CITIES = [
  { city: 'Dallas',        state: 'TX' },
  { city: 'Houston',       state: 'TX' },
  { city: 'San Antonio',   state: 'TX' },
  { city: 'Austin',        state: 'TX' },
  { city: 'Jacksonville',  state: 'FL' },
  { city: 'Miami',         state: 'FL' },
  { city: 'Tampa',         state: 'FL' },
  { city: 'Orlando',       state: 'FL' },
  { city: 'Atlanta',       state: 'GA' },
  { city: 'Charlotte',     state: 'NC' },
  { city: 'Raleigh',       state: 'NC' },
  { city: 'Nashville',     state: 'TN' },
  { city: 'Memphis',       state: 'TN' },
  { city: 'Columbus',      state: 'OH' },
  { city: 'Cleveland',     state: 'OH' },
  { city: 'Indianapolis',  state: 'IN' },
  { city: 'Louisville',    state: 'KY' },
  { city: 'Chicago',       state: 'IL' },
  { city: 'Detroit',       state: 'MI' },
  { city: 'Phoenix',       state: 'AZ' },
  { city: 'Tucson',        state: 'AZ' },
  { city: 'Las Vegas',     state: 'NV' },
  { city: 'Denver',        state: 'CO' },
  { city: 'Colorado Springs', state: 'CO' },
  { city: 'Kansas City',   state: 'MO' },
  { city: 'St. Louis',     state: 'MO' },
  { city: 'Oklahoma City', state: 'OK' },
  { city: 'Tulsa',         state: 'OK' },
  { city: 'Minneapolis',   state: 'MN' },
  { city: 'Omaha',         state: 'NE' },
  { city: 'Richmond',      state: 'VA' },
  { city: 'Virginia Beach', state: 'VA' },
  { city: 'Baltimore',     state: 'MD' },
  { city: 'Pittsburgh',    state: 'PA' },
  { city: 'Philadelphia',  state: 'PA' },
  { city: 'Albuquerque',   state: 'NM' },
  { city: 'Salt Lake City', state: 'UT' },
  { city: 'Sacramento',    state: 'CA' },
  { city: 'Riverside',     state: 'CA' },
  { city: 'Bakersfield',   state: 'CA' },
];

// Build today's query rotation (pick 30 combos offset by day-of-year)
function getTodayQueries() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const allCombos = [];
  for (const niche of NICHES) {
    for (const loc of CITIES) {
      allCombos.push({ niche, ...loc });
    }
  }
  // Shuffle deterministically by day so each day picks a different set
  const offset = (dayOfYear * 17) % allCombos.length;
  const rotated = [...allCombos.slice(offset), ...allCombos.slice(0, offset)];
  return rotated.slice(0, 32); // 32 combos × ~15 results each = ~480 raw
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

function csvEscape(v) {
  const s = String(v || '').replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
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
      const name = (vals[nameIdx] || '').toLowerCase().trim();
      const web = (vals[webIdx] || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').trim();
      if (name) keys.add(name);
      if (web) keys.add(web);
    }
  } catch { /* if master doesn't exist or is malformed, skip deduplication */ }
  return keys;
}

// ── Owner name extraction ─────────────────────────────────────────────────────

function extractOwnerName(html) {
  const patterns = [
    /(?:owner|founder|president|ceo|proprietor)[^<\w]{1,25}([A-Z][a-z]{1,20}\s[A-Z][a-z]{1,20})/gi,
    /([A-Z][a-z]{1,20}\s[A-Z][a-z]{1,20})[^<\w]{1,25}(?:owner|founder|president|ceo|proprietor)/gi,
  ];
  for (const p of patterns) {
    p.lastIndex = 0;
    const m = p.exec(html);
    if (m) return m[1].trim();
  }
  return '';
}

// ── YellowPages scraper ───────────────────────────────────────────────────────

async function scrapeYP(browser, niche, city, state) {
  const url = `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(niche)}&geo_location_terms=${encodeURIComponent(`${city}, ${state}`)}`;
  let context, page;
  try {
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    page = await context.newPage();
    await page.goto(url, { timeout: 25000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const results = await page.evaluate(() => {
      const out = [];
      for (const card of document.querySelectorAll('.result, [class*="result"]')) {
        const nameEl = card.querySelector('.business-name, [class*="business-name"] a, h2 a');
        const phoneEl = card.querySelector('.phones, [class*="phones"]');
        const websiteEl = card.querySelector('a.track-visit-website, a[href*="http"]:not([href*="yellowpages"])');
        const addrEl = card.querySelector('.adr, [class*="address"], .locality');

        const name = nameEl?.textContent?.trim();
        if (!name) continue;

        let website = websiteEl?.getAttribute('href') || '';
        if (website.includes('yellowpages.com')) website = '';

        let phone = phoneEl?.textContent?.trim() || '';
        // Normalize phone digits
        const digits = phone.replace(/\D/g, '');
        if (digits.length >= 10) {
          const ten = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits.slice(0, 10);
          phone = `(${ten.slice(0,3)}) ${ten.slice(3,6)}-${ten.slice(6)}`;
        }

        const addr = addrEl?.textContent?.trim() || '';
        out.push({ name, phone, website, addr });
        if (out.length >= 20) break;
      }
      return out;
    });

    return results;
  } catch (err) {
    return [];
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

// ── Website owner lookup ──────────────────────────────────────────────────────

async function lookupOwner(browser, website) {
  if (!website) return '';
  let context, page;
  try {
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });
    page = await context.newPage();

    for (const suffix of ['', '/about', '/about-us', '/team', '/our-team']) {
      try {
        const target = suffix ? new URL(suffix, website).href : website;
        await page.goto(target, { timeout: 10000, waitUntil: 'domcontentloaded' });
        const html = await page.content();
        const name = extractOwnerName(html);
        if (name) return name;
      } catch { continue; }
    }
    return '';
  } catch {
    return '';
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(LEADS_DIR, { recursive: true });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(' LATCHLY AUTONOMOUS LEAD SCRAPER');
  console.log(`  Target: ${RAW_TARGET} raw leads → qualify pipeline`);
  console.log('═══════════════════════════════════════════════════════\n');

  const masterKeys = loadMasterKeys();
  console.log(`📚 Loaded ${masterKeys.size} existing keys for deduplication`);

  const queries = getTodayQueries();
  console.log(`📅 Today's rotation: ${queries.length} niche/city combos\n`);

  // Output header (apollo-leads.csv format consumed by qualify-leads.js)
  const HEADERS = 'Name,Title,Company,Industry,Employees,City,State,Email,Phone,LinkedIn,Company Website';
  fs.writeFileSync(OUTPUT, HEADERS + '\n');

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const collected = [];
  const seen = new Set(masterKeys);

  try {
    for (const q of queries) {
      if (collected.length >= RAW_TARGET) break;

      process.stdout.write(`🔍 ${q.niche} / ${q.city}, ${q.state}  `);
      const listings = await scrapeYP(browser, q.niche, q.city, q.state);
      process.stdout.write(`${listings.length} found  `);

      let added = 0;
      for (const listing of listings) {
        if (collected.length >= RAW_TARGET) break;
        if (!listing.name || !listing.phone) continue;

        // Dedup by business name
        const nameKey = listing.name.toLowerCase().replace(/\s+/g, '');
        if (seen.has(nameKey)) continue;

        // Dedup by website domain
        let webKey = '';
        if (listing.website) {
          webKey = listing.website.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/$/, '');
          if (seen.has(webKey)) continue;
        }

        seen.add(nameKey);
        if (webKey) seen.add(webKey);

        // Look up owner name from website (non-blocking — if slow, skip)
        let ownerName = '';
        if (listing.website) {
          ownerName = await Promise.race([
            lookupOwner(browser, listing.website),
            new Promise(r => setTimeout(() => r(''), 8000)),
          ]);
        }

        const row = {
          name: ownerName || '',
          title: ownerName ? 'Owner' : '',
          company: listing.name,
          industry: q.niche,
          employees: '',
          city: q.city,
          state: q.state,
          email: '',
          phone: listing.phone,
          linkedin: '',
          website: listing.website || '',
        };

        const csvRow = [
          row.name, row.title, row.company, row.industry, row.employees,
          row.city, row.state, row.email, row.phone, row.linkedin, row.website,
        ].map(csvEscape).join(',');

        fs.appendFileSync(OUTPUT, csvRow + '\n');
        collected.push(row);
        added++;
      }

      console.log(`→ ${added} new`);

      // Brief pause between queries to avoid rate limiting
      await new Promise(r => setTimeout(r, 800 + Math.random() * 400));
    }
  } finally {
    await browser.close().catch(() => {});
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(` ✅ Scraped ${collected.length} raw leads → ${path.relative(ROOT, OUTPUT)}`);
  if (collected.length < RAW_TARGET) {
    console.log(`  ⚠️  Below target (${collected.length}/${RAW_TARGET}) — daily rotation may overlap with master list`);
  }
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('❌ Auto-scrape failed:', err.message);
  process.exit(1);
});
