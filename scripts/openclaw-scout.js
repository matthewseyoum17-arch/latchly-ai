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
const config = require('./openclaw.config');
const { createLogger } = require('./openclaw-logger');

const log = createLogger('scout');
const { ROOT, LEADS_DIR, NICHES, CITIES, FRANCHISE_BLACKLIST, SKIP_SITE_CHECK } = config;

// ── BBB Scraper (category pages + profile enrichment) ────────────────────────

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalizePhone(raw) {
  if (Array.isArray(raw)) raw = raw[0] || '';
  const digits = String(raw || '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return '';
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function isFranchise(name) {
  const lower = String(name || '').toLowerCase();
  return FRANCHISE_BLACKLIST.some(f => lower.includes(f));
}

// BBB category slug mapping — maps niche names to BBB URL slugs
const BBB_CATEGORY_SLUGS = {
  'hvac contractor':            'heating-and-air-conditioning',
  'plumber':                    'plumber',
  'roofing contractor':         'roofing-contractors',
  'pest control':               'pest-control',
  'electrician':                'electrician',
  'garage door repair':         'garage-doors',
  'water damage restoration':   'water-damage-restoration',
  'foundation repair':          'foundation-repair',
  'tree service':               'tree-service',
  'remodeling contractor':      'remodeling-services',
  'concrete contractor':        'concrete-contractor',
  'landscaping':                'landscape-contractors',
};

/**
 * Scrape BBB category page for a niche + city.
 * Uses regional category URLs which reliably return results.
 */
async function scrapeBBB(niche, city, state) {
  const slug = BBB_CATEGORY_SLUGS[niche.toLowerCase()]
    || niche.toLowerCase().replace(/\s+/g, '-');
  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = state.toLowerCase();
  const url = `https://www.bbb.org/us/${stateSlug}/${citySlug}/category/${slug}`;

  try {
    const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
    if (!resp.ok) {
      log.warn('bbb_http_error', { niche, city, state, status: resp.status });
      return [];
    }

    const html = await resp.text();
    const preloadMatch = html.match(/__PRELOADED_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/);
    if (!preloadMatch) {
      log.warn('bbb_no_preload', { niche, city, state });
      return [];
    }

    let data;
    try { data = JSON.parse(preloadMatch[1]); } catch { return []; }

    const results = data?.searchResult?.results || [];

    return results
      .filter(r => r.businessName && !isFranchise(r.businessName) && !r.outOfBusinessStatus)
      .map(r => ({
        business_name: r.businessName,
        phone: normalizePhone(r.phone),
        city: r.city || city,
        state: r.state || state,
        website: '', // Populated by profile enrichment below
        niche,
        bbb_rating: r.rating || '',
        bbb_report_url: r.reportUrl || '',
        owner_name: '',
      }));
  } catch (err) {
    log.catch('bbb_scrape_error', err, { niche, city, state });
    return [];
  }
}

/**
 * Enrich a lead from its BBB profile page.
 * Fetches website URL, owner name/title, email, and years in business.
 */
async function enrichFromBBBProfile(lead) {
  if (!lead.bbb_report_url) return lead;

  const url = `https://www.bbb.org${lead.bbb_report_url}`;
  try {
    const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
    if (!resp.ok) return lead;

    const html = await resp.text();
    const m = html.match(/__PRELOADED_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/);
    if (!m) return lead;

    const data = JSON.parse(m[1]);
    const bp = data?.businessProfile;
    if (!bp) return lead;

    // Website
    if (bp.urls?.primary) {
      lead.website = bp.urls.primary;
    }

    // Owner / decision maker
    const contacts = bp.contactInformation?.contacts || [];
    const owner = contacts.find(c => /owner|president|ceo|founder/i.test(c.title || ''));
    const primary = owner || contacts.find(c => c.isPrimary) || contacts[0];
    if (primary?.name) {
      const parts = [primary.name.first, primary.name.last].filter(Boolean);
      lead.owner_name = parts.join(' ');
      lead.owner_title = primary.title || '';
    }

    // Email (BBB obfuscates: !~xK_bL!user__at__domain__dot__com!~xK_bL!)
    const emailFields = bp.contactInformation?.additionalEmailAddresses || [];
    if (emailFields.length > 0) {
      const raw = emailFields[0].value || '';
      const decoded = raw
        .replace(/!~xK_bL!/g, '')
        .replace(/__at__/g, '@')
        .replace(/__dot__/g, '.');
      if (decoded.includes('@')) lead.email = decoded;
    }

    // Years in business
    if (bp.orgDetails?.yearsInBusiness) {
      lead.years_in_business = bp.orgDetails.yearsInBusiness;
    }

    log.info('bbb_profile_enriched', {
      business: lead.business_name,
      website: !!lead.website,
      owner: !!lead.owner_name,
      email: !!lead.email,
    });
  } catch (err) {
    log.catch('bbb_profile_error', err, { business: lead.business_name });
  }

  return lead;
}

// ── Yelp Fusion API Fallback ────────────────────────────────────────────────
// Free tier: 500 requests/day. Set YELP_API_KEY in .env to enable.
// HTML scraping is blocked (403), so the API is the only reliable path.

async function scrapeYelp(niche, city, state) {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) {
    log.info('yelp_skipped', { reason: 'No YELP_API_KEY set' });
    return [];
  }

  const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(niche)}&location=${encodeURIComponent(`${city}, ${state}`)}&limit=20&sort_by=rating`;

  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      log.warn('yelp_api_error', { status: resp.status, niche, city, state });
      return [];
    }

    const data = await resp.json();
    const businesses = data.businesses || [];

    return businesses
      .filter(b => b.name && !isFranchise(b.name) && !b.is_closed)
      .map(b => ({
        business_name: b.name,
        phone: normalizePhone(b.display_phone || b.phone || ''),
        city: b.location?.city || city,
        state: b.location?.state || state,
        website: '', // Yelp API doesn't expose website in search — audit fetches it later
        niche,
        bbb_rating: '',
        owner_name: '',
        source: 'yelp',
      }));
  } catch (err) {
    log.catch('yelp_api_error', err, { niche, city, state });
    return [];
  }
}

// ── Source aggregator (BBB primary, Yelp fallback) ──────────────────────────

async function scrapeLeads(niche, city, state) {
  let results = await scrapeBBB(niche, city, state);

  if (results.length === 0) {
    log.info('bbb_empty_trying_yelp', { niche, city, state });
    await sleep(1000);
    results = await scrapeYelp(niche, city, state);
    if (results.length > 0) {
      log.info('yelp_fallback_success', { niche, city, state, count: results.length });
    }
  }

  return results;
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

/**
 * Load already-known prospects from DB to avoid re-scouting them.
 * Returns a Set of "business_name-city" keys.
 */
async function loadExistingFromDB() {
  const existing = new Set();
  if (config.SKIP_DB || !process.env.DATABASE_URL) return existing;

  try {
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT LOWER(business_name) AS bn, LOWER(city) AS c FROM prospects WHERE business_name IS NOT NULL AND city IS NOT NULL`;
    for (const r of rows) {
      existing.add(`${r.bn}-${r.c}`);
    }
    log.info('dedup_loaded', { existing_count: existing.size });
  } catch (err) {
    log.catch('dedup_load_failed', err);
  }
  return existing;
}

async function main() {
  if (!fs.existsSync(LEADS_DIR)) fs.mkdirSync(LEADS_DIR, { recursive: true });

  // Load existing prospects from DB for cross-run dedup
  const dbSeen = await loadExistingFromDB();
  const seen = new Set([...dbSeen]);
  const scouted = [];
  let total = 0;
  let dupSkipped = 0;

  // Limit scope per run to avoid rate limits
  const maxPerNiche = config.SCOUT_MAX_PER_NICHE;
  const maxTotal = config.SCOUT_MAX_TOTAL;
  const skipSiteCheck = SKIP_SITE_CHECK;

  log.startRun({ niches: NICHES.length, cities: CITIES.length, max_per_niche: maxPerNiche, max_total: maxTotal, existing_in_db: dbSeen.size });

  for (const niche of NICHES) {
    if (scouted.length >= maxTotal) break;

    let nicheCount = 0;
    for (const { city, state } of CITIES) {
      if (nicheCount >= maxPerNiche || scouted.length >= maxTotal) break;

      const results = await scrapeLeads(niche, city, state);
      total += results.length;

      for (const lead of results) {
        if (nicheCount >= maxPerNiche) break;

        // Dedup by business name + city (includes DB existing)
        const key = `${lead.business_name.toLowerCase()}-${lead.city.toLowerCase()}`;
        if (seen.has(key)) { dupSkipped++; continue; }
        seen.add(key);

        if (!lead.phone) continue;

        // Enrich from BBB profile page (website, owner, email)
        if (lead.bbb_report_url) {
          await enrichFromBBBProfile(lead);
          await sleep(800); // Rate limit profile fetches
        }

        // Quick site check (skip in fast mode)
        let siteCheck = { reachable: false, hasIssues: true, hasChatbot: false };
        if (!skipSiteCheck && lead.website) {
          siteCheck = await quickSiteCheck(lead.website);
          await sleep(500); // Rate limit
        }

        lead.lead_type = classifyLeadType(lead, siteCheck);
        lead.site_issues = siteCheck.issues || [];
        lead.has_chatbot = siteCheck.hasChatbot || false;
        lead.cached_html = siteCheck.html || null; // Pass to audit to avoid re-fetch
        lead.status = 'scouted';
        lead.scouted_at = new Date().toISOString();

        scouted.push(lead);
        nicheCount++;
      }

      await sleep(1000); // Rate limit between BBB requests
    }

    log.info('niche_complete', { niche, count: nicheCount });
  }

  // Save output
  const outPath = path.join(LEADS_DIR, 'scouted.json');
  fs.writeFileSync(outPath, JSON.stringify(scouted, null, 2), 'utf8');

  // Stats
  const byType = { package: 0, chatbot_only: 0, redesign_only: 0 };
  scouted.forEach(l => { byType[l.lead_type] = (byType[l.lead_type] || 0) + 1; });

  log.endRun({ total_scraped: total, after_dedup: scouted.length, dup_skipped: dupSkipped, ...byType });

  return scouted;
}

module.exports = { main, classifyLeadType, quickSiteCheck, scrapeBBB, enrichFromBBBProfile, scrapeYelp, scrapeLeads };

if (require.main === module) {
  main().catch(err => { log.catch('fatal', err); process.exit(1); });
}
