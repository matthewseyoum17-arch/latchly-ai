#!/usr/bin/env node
/**
 * openclaw-scout.js  (Agent 1 — Scout)
 *
 * Enhanced lead sourcing that KEEPS no-website leads (for redesign package).
 * Tags each lead with leadType: package | chatbot_only | redesign_only
 *
 * Reuses: source-leads.js (BBB scraping), leadclaw-source.js patterns
 * Output: leads/openclaw/scouted.json
 */

const fs   = require('fs');
const path = require('path');

const ROOT      = path.join(__dirname, '..');
const LEADS_DIR = path.join(ROOT, 'leads', 'openclaw');

// Load .env
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

// ── Config ───────────────────────────────────────────────────────────────────

const NICHES = [
  'HVAC contractor', 'plumber', 'roofing contractor', 'pest control',
  'garage door repair', 'electrician', 'water damage restoration',
  'foundation repair', 'tree service', 'remodeling contractor',
  'concrete contractor', 'landscaping',
];

const CITIES = [
  // Texas
  { city: 'Dallas', state: 'TX' }, { city: 'Houston', state: 'TX' },
  { city: 'San Antonio', state: 'TX' }, { city: 'Austin', state: 'TX' },
  { city: 'Fort Worth', state: 'TX' },
  // Florida
  { city: 'Jacksonville', state: 'FL' }, { city: 'Miami', state: 'FL' },
  { city: 'Tampa', state: 'FL' }, { city: 'Orlando', state: 'FL' },
  // Arizona
  { city: 'Phoenix', state: 'AZ' }, { city: 'Tucson', state: 'AZ' },
  // Georgia
  { city: 'Atlanta', state: 'GA' },
  // North Carolina
  { city: 'Charlotte', state: 'NC' }, { city: 'Raleigh', state: 'NC' },
  // Tennessee
  { city: 'Nashville', state: 'TN' }, { city: 'Memphis', state: 'TN' },
  // Colorado
  { city: 'Denver', state: 'CO' },
  // Nevada
  { city: 'Las Vegas', state: 'NV' },
];

const FRANCHISE_BLACKLIST = [
  '1-hour', 'one hour', 'mr. rooter', 'roto-rooter', 'servicemaster',
  'servpro', '1-800', 'terminix', 'orkin', 'home depot',
];

// ── BBB Scraper ──────────────────────────────────────────────────────────────

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return '';
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function isFranchise(name) {
  const lower = String(name || '').toLowerCase();
  return FRANCHISE_BLACKLIST.some(f => lower.includes(f));
}

async function scrapeBBB(niche, city, state) {
  const query = encodeURIComponent(`${niche} ${city} ${state}`);
  const url = `https://www.bbb.org/search?find_country=US&find_text=${query}&page=1&sort=Distance`;

  try {
    const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return [];

    const html = await resp.text();
    const preloadMatch = html.match(/__PRELOADED_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/);
    if (!preloadMatch) return [];

    const data = JSON.parse(preloadMatch[1]);
    const results = data?.search?.searchResults?.results || [];

    return results
      .filter(r => r.businessName && !isFranchise(r.businessName))
      .map(r => ({
        business_name: r.businessName,
        phone: normalizePhone(r.phone),
        city: r.city || city,
        state: r.state || state,
        website: r.websiteUrl || '',
        niche,
        bbb_rating: r.rating || '',
        owner_name: '',
      }));
  } catch (err) {
    console.error(`  BBB error for ${niche} in ${city}, ${state}: ${err.message}`);
    return [];
  }
}

// ── Website quality check (lightweight) ──────────────────────────────────────

async function quickSiteCheck(url) {
  if (!url) return { reachable: false, hasIssues: true };
  try {
    const resp = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    if (!resp.ok) return { reachable: false, hasIssues: true };

    const html = await resp.text();
    const issues = [];

    // Check for common bad-site indicators
    if (html.length < 5000) issues.push('thin_content');
    if (!/meta name="viewport"/i.test(html)) issues.push('no_mobile_viewport');
    if (!/https/i.test(url)) issues.push('no_https');
    if (/<table\b[^>]*>[\s\S]*<table/i.test(html)) issues.push('table_layout');
    if (/wix\.com|squarespace\.com|weebly\.com|godaddy\.com/i.test(html)) issues.push('builder_site');
    if (!/tel:|phone|call/i.test(html)) issues.push('no_phone_cta');
    if (!/<form\b/i.test(html)) issues.push('no_form');

    // Check for existing chatbot
    const chatbotPatterns = [
      'intercom', 'drift', 'tidio', 'livechat', 'zendesk', 'crisp.chat',
      'tawk.to', 'hubspot.com/conversations', 'freshchat', 'olark',
      'smartsupp', 'podium', 'birdeye', 'webchat.so', 'latchly',
      'leadconnector', 'gohighlevel', 'purechat', 'jivochat',
    ];
    const hasChatbot = chatbotPatterns.some(p => html.toLowerCase().includes(p));

    return { reachable: true, hasIssues: issues.length >= 3, issues, hasChatbot, html };
  } catch {
    return { reachable: false, hasIssues: true };
  }
}

// ── Lead type classification ─────────────────────────────────────────────────

function classifyLeadType(lead, siteCheck) {
  if (!lead.website || !siteCheck.reachable) {
    return 'package'; // No website → sell full package (site + chatbot)
  }
  if (siteCheck.hasIssues && !siteCheck.hasChatbot) {
    return 'package'; // Bad site + no chatbot → full package
  }
  if (siteCheck.hasIssues && siteCheck.hasChatbot) {
    return 'redesign_only'; // Bad site + has chatbot → just redesign
  }
  if (!siteCheck.hasIssues && !siteCheck.hasChatbot) {
    return 'chatbot_only'; // Good site + no chatbot → just chatbot
  }
  return 'chatbot_only'; // Default
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(LEADS_DIR)) fs.mkdirSync(LEADS_DIR, { recursive: true });

  const seen = new Set();
  const scouted = [];
  let total = 0;

  // Limit scope per run to avoid rate limits
  const maxPerNiche = parseInt(process.env.SCOUT_MAX_PER_NICHE || '20', 10);
  const maxTotal = parseInt(process.env.SCOUT_MAX_TOTAL || '200', 10);
  const skipSiteCheck = process.env.SKIP_SITE_CHECK === 'true';

  console.log(`OpenClaw Scout starting — ${NICHES.length} niches × ${CITIES.length} cities`);
  console.log(`Max per niche: ${maxPerNiche}, Max total: ${maxTotal}`);

  for (const niche of NICHES) {
    if (scouted.length >= maxTotal) break;

    let nicheCount = 0;
    for (const { city, state } of CITIES) {
      if (nicheCount >= maxPerNiche || scouted.length >= maxTotal) break;

      const results = await scrapeBBB(niche, city, state);
      total += results.length;

      for (const lead of results) {
        if (nicheCount >= maxPerNiche) break;

        // Dedup by business name + city
        const key = `${lead.business_name.toLowerCase()}-${lead.city.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (!lead.phone) continue;

        // Quick site check (skip in fast mode)
        let siteCheck = { reachable: false, hasIssues: true, hasChatbot: false };
        if (!skipSiteCheck && lead.website) {
          siteCheck = await quickSiteCheck(lead.website);
          await sleep(500); // Rate limit
        }

        lead.lead_type = classifyLeadType(lead, siteCheck);
        lead.site_issues = siteCheck.issues || [];
        lead.has_chatbot = siteCheck.hasChatbot || false;
        lead.status = 'scouted';
        lead.scouted_at = new Date().toISOString();

        scouted.push(lead);
        nicheCount++;
      }

      await sleep(1000); // Rate limit between BBB requests
    }

    console.log(`  ${niche}: ${nicheCount} leads`);
  }

  // Save output
  const outPath = path.join(LEADS_DIR, 'scouted.json');
  fs.writeFileSync(outPath, JSON.stringify(scouted, null, 2), 'utf8');

  // Stats
  const byType = { package: 0, chatbot_only: 0, redesign_only: 0 };
  scouted.forEach(l => { byType[l.lead_type] = (byType[l.lead_type] || 0) + 1; });

  console.log(`\nScout complete:`);
  console.log(`  Total scraped: ${total}`);
  console.log(`  After dedup/filter: ${scouted.length}`);
  console.log(`  Package deals: ${byType.package}`);
  console.log(`  Chatbot only: ${byType.chatbot_only}`);
  console.log(`  Redesign only: ${byType.redesign_only}`);
  console.log(`  Output: ${outPath}`);

  return scouted;
}

module.exports = { main, classifyLeadType, quickSiteCheck, scrapeBBB };

if (require.main === module) {
  main().catch(err => { console.error('Scout failed:', err); process.exit(1); });
}
