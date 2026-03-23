#!/usr/bin/env node
// scripts/scrape-leads.js
// Scrapes 50 qualified home-service leads for Latchly AI cold outreach
// Output: leads/qualified-leads.csv
// Strategy: fresh browser per YP search (avoids Cloudflare session fingerprinting)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_LEADS = 50;
const OUTPUT_FILE = path.join(__dirname, '..', 'leads', 'qualified-leads.csv');

const SEARCH_QUERIES = [
  { category: 'HVAC contractor',    city: 'Dallas',      state: 'TX', tz: 'CST' },
  { category: 'plumber',            city: 'Houston',     state: 'TX', tz: 'CST' },
  { category: 'electrician',        city: 'Chicago',     state: 'IL', tz: 'CST' },
  { category: 'roofing contractor', city: 'Atlanta',     state: 'GA', tz: 'EST' },
  { category: 'landscaping',        city: 'Phoenix',     state: 'AZ', tz: 'MST' },
  { category: 'HVAC contractor',    city: 'Nashville',   state: 'TN', tz: 'CST' },
  { category: 'plumber',            city: 'Denver',      state: 'CO', tz: 'MST' },
  { category: 'electrician',        city: 'Miami',       state: 'FL', tz: 'EST' },
  { category: 'roofing contractor', city: 'Dallas',      state: 'TX', tz: 'CST' },
  { category: 'pest control',       city: 'Charlotte',   state: 'NC', tz: 'EST' },
  { category: 'HVAC contractor',    city: 'Columbus',    state: 'OH', tz: 'EST' },
  { category: 'plumber',            city: 'San Antonio', state: 'TX', tz: 'CST' },
  { category: 'electrician',        city: 'Austin',      state: 'TX', tz: 'CST' },
  { category: 'landscaping',        city: 'Dallas',      state: 'TX', tz: 'CST' },
  { category: 'HVAC contractor',    city: 'Jacksonville',state: 'FL', tz: 'EST' },
  { category: 'plumber',            city: 'Memphis',     state: 'TN', tz: 'CST' },
];

const CHAT_WIDGET_SIGNATURES = [
  'intercom.io', 'intercom.com', 'widget.intercom',
  'js.drift.com', 'drift.com/core',
  'code.tidio.co', 'tidio.com',
  'livechat.com', 'livechatinc.com',
  'zendesk.com/embeddable', 'zopim',
  'crisp.chat', 'client.crisp',
  'tawk.to', 'embed.tawk',
  'hs-scripts.com', 'hubspot.com/conversations',
  'freshchat', 'wchat.freshchat',
  'olark.com',
  'smartsupp.com',
  'userlike.com',
  'chaport.com',
  'botpress',
  'landbot.io',
  'latchly',
];

const BEST_CALL_TIMES = {
  CST: '10:00 AM – 11:00 AM CST',
  CDT: '10:00 AM – 11:00 AM CST',
  EST: '9:00 AM – 10:00 AM CST',
  EDT: '9:00 AM – 10:00 AM CST',
  MST: '11:00 AM – 12:00 PM CST',
  MDT: '11:00 AM – 12:00 PM CST',
  PST: '12:00 PM – 1:00 PM CST',
  PDT: '12:00 PM – 1:00 PM CST',
};

function csvEscape(val) {
  const str = String(val ?? '');
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function hasChatWidget(html) {
  const lower = html.toLowerCase();
  return CHAT_WIDGET_SIGNATURES.some(sig => lower.includes(sig.toLowerCase()));
}

function extractOwnerName(html) {
  const patterns = [
    /(?:owner|founder|president|ceo|proprietor)[^<\w]{1,25}([A-Z][a-z]{1,20} [A-Z][a-z]{1,20})/gi,
    /([A-Z][a-z]{1,20} [A-Z][a-z]{1,20})[^<\w]{1,25}(?:owner|founder|president|ceo|proprietor)/gi,
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(html);
    if (match) return match[1].trim();
  }
  return null;
}

async function findOwnerOnWebsite(page, baseUrl) {
  const paths = ['', '/about', '/about-us', '/team', '/our-team', '/staff'];
  for (const p of paths) {
    try {
      const url = p ? new URL(p, baseUrl).href : baseUrl;
      await page.goto(url, { timeout: 10000, waitUntil: 'domcontentloaded' });
      const html = await page.content();
      const name = extractOwnerName(html);
      if (name) return name;
    } catch {}
  }
  return null;
}

async function checkWebsite(page, url) {
  try {
    await page.goto(url, { timeout: 15000, waitUntil: 'domcontentloaded' });
    const html = await page.content();
    if (hasChatWidget(html)) return { hasWidget: true };
    const ownerName = await findOwnerOnWebsite(page, url);
    return { hasWidget: false, ownerName };
  } catch {
    return { hasWidget: false, ownerName: null };
  }
}

// Fresh browser per query to avoid Cloudflare session blocking
async function scrapeYellowPages(category, city, state) {
  const url = `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(category)}&geo_location_terms=${encodeURIComponent(`${city}, ${state}`)}`;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    return await page.evaluate(() => {
      const results = [];
      for (const card of document.querySelectorAll('.result')) {
        const nameEl = card.querySelector('.business-name');
        const phoneEl = card.querySelector('.phones');
        const websiteEl = card.querySelector('a.track-visit-website');
        const name = nameEl?.textContent?.trim();
        if (!name) continue;
        const phone = phoneEl?.textContent?.trim() || '';
        let website = websiteEl?.getAttribute('href') || '';
        if (website.includes('yellowpages.com')) website = '';
        results.push({ name, phone, website });
        if (results.length >= 20) break;
      }
      return results;
    });
  } catch (e) {
    console.error(`  YP error (${category} / ${city}): ${e.message}`);
    return [];
  } finally {
    await browser.close();
  }
}

async function main() {
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  const csvHeader = 'Business Name,Owner Name,LinkedIn Search URL,Business Phone,Website,Category,City/State,Best Call Time (CST),Chat Widget Detected\n';
  fs.writeFileSync(OUTPUT_FILE, csvHeader);

  // Shared browser for website checks (no fingerprint issue here)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const websitePage = await context.newPage();

  const leads = [];
  const seen = new Set();

  console.log(`🎯 Target: ${TARGET_LEADS} qualified leads\n📁 Output: ${OUTPUT_FILE}\n`);

  for (const q of SEARCH_QUERIES) {
    if (leads.length >= TARGET_LEADS) break;
    console.log(`\n🔍 ${q.category} — ${q.city}, ${q.state}`);
    const listings = await scrapeYellowPages(q.category, q.city, q.state);
    console.log(`   ${listings.length} listings found`);

    for (const listing of listings) {
      if (leads.length >= TARGET_LEADS) break;
      const key = listing.name.toLowerCase().replace(/\s+/g, '');
      if (seen.has(key)) continue;
      seen.add(key);

      if (!listing.website) {
        process.stdout.write(`   ⏭  ${listing.name} (no website)\n`);
        continue;
      }

      process.stdout.write(`   🌐 ${listing.name}... `);
      const { hasWidget, ownerName } = await checkWebsite(websitePage, listing.website);

      if (hasWidget) {
        console.log('❌ has chat widget');
        continue;
      }

      const linkedInUrl = ownerName
        ? ''
        : `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`owner ${listing.name}`)}`;

      const lead = {
        businessName: listing.name,
        ownerName: ownerName || '',
        linkedInUrl,
        phone: listing.phone,
        website: listing.website,
        category: q.category,
        location: `${q.city}, ${q.state}`,
        bestCallTime: BEST_CALL_TIMES[q.tz] || '10:00 AM – 11:00 AM CST',
        chatWidget: 'No',
      };

      leads.push(lead);
      const row = [
        lead.businessName, lead.ownerName, lead.linkedInUrl,
        lead.phone, lead.website, lead.category,
        lead.location, lead.bestCallTime, lead.chatWidget,
      ].map(csvEscape).join(',') + '\n';
      fs.appendFileSync(OUTPUT_FILE, row);

      console.log(`✅ #${leads.length}${ownerName ? ` (${ownerName})` : ''}`);
      await websitePage.waitForTimeout(300);
    }
  }

  await browser.close();
  console.log(`\n✅ Done! ${leads.length} leads → ${OUTPUT_FILE}`);
  if (leads.length < TARGET_LEADS) {
    console.log(`⚠️  Only ${leads.length}/${TARGET_LEADS} — add more queries to SEARCH_QUERIES`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
