#!/usr/bin/env node
/**
 * openclaw-audit.js  (Agent 2 — Audit)
 *
 * Merges qualify-leads.js (chatbot detection, marketing signals) and
 * leadclaw-qualify.js (site quality audit) into a single pass.
 *
 * Produces: chatbotScore (0-10), redesignScore (0-10), combinedScore
 * Generates per-lead "Site Report Card" HTML snippet for outreach emails.
 *
 * Input:  leads/openclaw/scouted.json
 * Output: leads/openclaw/audited.json + INSERT into prospects table
 */

const fs   = require('fs');
const path = require('path');
const config = require('./openclaw.config');
const { createLogger } = require('./openclaw-logger');

const log = createLogger('audit');
const { ROOT, LEADS_DIR, DRY_RUN, SKIP_DB, AUDIT_MIN_SCORE } = config;

// ── Chatbot detection signatures ─────────────────────────────────────────────

const CHATBOT_SIGNATURES = [
  'intercom.io', 'intercom.com', 'widget.intercom',
  'js.drift.com', 'drift.com',
  'code.tidio.co', 'tidio.com',
  'livechat.com', 'livechatinc.com',
  'zendesk.com/embeddable', 'zopim',
  'crisp.chat', 'client.crisp',
  'tawk.to', 'embed.tawk',
  'hs-scripts.com', 'hubspot.com/conversations',
  'freshchat', 'wchat.freshchat',
  'olark.com', 'smartsupp.com', 'userlike.com',
  'podium.com', 'birdeye.com', 'webchat.so',
  'leadconnector', 'gohighlevel', 'msgsndr.com',
  'purechat.com', 'jivochat.com', 'latchly',
];

// ── Marketing signal patterns ────────────────────────────────────────────────

const MARKETING_SIGNALS = {
  googleAds:       [/gads|google.*ads|adwords|gclid|googletagmanager|gtag.*conversion/i],
  localServiceAds: [/google.*local.*service|google.*guarantee/i],
  seo:             [/service.*area|serving|we.*serve|areas we serve/i],
  reviews:         [/reviews?|testimonials?|rating|stars?|customer.*feedback/i],
  quoteCTA:        [/free.*quote|free.*estimate|get.*quote|book.*now|schedule.*now|call.*now|consultation/i],
  phoneProminent:  [/tel:/i],
  formPresent:     [/<form\b/i],
  coupons:         [/coupon|special offer|financing|save \$|discount/i],
  scheduling:      [/service titan|servicetitan|book online|schedule service/i],
};

// ── Affordability signals — can this business actually pay? ─────────────────
// Each detected signal = +1 to an affordability bonus applied to combined score

const AFFORDABILITY_SIGNALS = {
  paidAds:        [/gads|google.*ads|adwords|gclid|gtag.*conversion|google.*local.*service|google.*guarantee/i],
  multiplePages:  [/\/services|\/about|\/contact|\/gallery|\/projects|\/areas/i],
  financing:      [/financing|payment.*plan|we.*finance|approved.*credit/i],
  bbbAccredited:  [/bbb.*accredited|better business bureau/i],
  licensing:      [/licensed|bonded|insured|license.*#|lic.*#/i],
  established:    [/since\s+\d{4}|established\s+\d{4}|years.*experience|\d+\+?\s*years/i],
};

// ── Site quality audit ───────────────────────────────────────────────────────

const SITE_ISSUES = {
  no_mobile:      { label: 'No mobile viewport', weight: 3, test: html => !/meta name="viewport"/i.test(html) },
  no_https:       { label: 'Not using HTTPS', weight: 2, test: (html, url) => !/^https/i.test(url || '') },
  thin_content:   { label: 'Very thin content', weight: 3, test: html => {
    // Strip JS/CSS bloat before measuring — Wix outputs 70K+ of framework code
    const visible = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return visible.length < 3000;
  }},
  no_phone_cta:   { label: 'No phone CTA', weight: 2, test: html => !/tel:|call.*now|call.*us/i.test(html) },
  no_form:        { label: 'No contact form', weight: 2, test: html => !/<form\b/i.test(html) },
  table_layout:   { label: 'Table-based layout', weight: 2, test: html => /<table\b[^>]*>[\s\S]*<table/i.test(html) },
  no_reviews:     { label: 'No reviews/testimonials', weight: 2, test: html => !/reviews?|testimonials?/i.test(html) },
  no_ssl:         { label: 'SSL issues', weight: 2, test: (html, url) => /http:\/\//i.test(url || '') },
  // Cheap/outdated builders — the exact kind of site we want to replace
  weebly:         { label: 'Weebly site', weight: 4, test: html => /weebly\.com/i.test(html) },
  godaddy_builder:{ label: 'GoDaddy builder', weight: 4, test: html => /godaddy\.com\/websites|secureserver\.net.*website-builder/i.test(html) },
  old_wix:        { label: 'Old Wix template', weight: 3, test: html => /wix\.com/i.test(html) && !/wix-thunderbolt|wixpress\.com\/pages-css/i.test(html) },
  old_squarespace:{ label: 'Old Squarespace', weight: 3, test: html => /squarespace\.com/i.test(html) && !/squarespace-cdn.*fluid-engine/i.test(html) },
  // Modern Wix/Squarespace with current responsive patterns = NOT a target
  // (no weight — these are decent sites that don't need a redesign)
  no_schema:      { label: 'No structured data', weight: 1, test: html => !/application\/ld\+json/i.test(html) },
  outdated_tech:  { label: 'Outdated technology', weight: 3, test: html => /revolution\.?slider|revslider|jquery\.cycle|jquery\.bx|ga\.js|swfobject|flash|mootools/i.test(html) },
  stale_copyright:{ label: 'Stale copyright year', weight: 3, test: html => {
    const m = html.match(/©\s*(20\d{2})|copyright\s*(20\d{2})/i);
    if (!m) return false;
    const year = parseInt(m[1] || m[2], 10);
    return year > 0 && year < 2023;
  }},
  old_framework:  { label: 'Legacy framework', weight: 3, test: html => /jquery-1\.|jquery\/1\.|prototype\.js|yui\/build|bootstrap\/3\.|bootstrap@3/i.test(html) },
  old_wordpress:  { label: 'Outdated WordPress theme', weight: 3, test: html => /wp-content/i.test(html) && /theme.*flavor|theme.*flavor|flavor|flavor/i.test(html) === false && (/developer|flavor|flavor/i.test(html) === false) && /jquery-1\.|jquery\/1\.|revslider|revolution\.?slider|ga\.js/i.test(html) },
  few_pages:      { label: 'Very few pages', weight: 2, test: html => {
    // Count internal nav links — sites with <5 pages are tiny/neglected
    const navLinks = (html.match(/<a[^>]+href=["'][^"']*["'][^>]*>/gi) || [])
      .filter(a => !a.includes('tel:') && !a.includes('mailto:') && !a.includes('#') && !a.includes('facebook') && !a.includes('instagram') && !a.includes('google'));
    return navLinks.length < 8;
  }},
};

// ── Scoring functions ────────────────────────────────────────────────────────

function scoreChatbot(html) {
  if (!html) return 10; // No website → maximum opportunity for chatbot
  const detected = CHATBOT_SIGNATURES.filter(sig => html.toLowerCase().includes(sig));
  if (detected.length > 0) return 0; // Already has chatbot
  // Score based on how much they'd benefit
  let score = 7; // Base score for sites without chatbot
  if (/contact|quote|book/i.test(html)) score += 1; // Has intent pages
  if (/<form\b/i.test(html)) score += 1; // Has forms (but no chat)
  if (/tel:/i.test(html)) score += 1; // Phone-dependent (chat would capture after-hours)
  return Math.min(score, 10);
}

// Signs that a site is modern/well-built — each one subtracts from redesign score
const MODERN_SIGNALS = {
  modern_css:       { sub: 2, test: html => /css-grid|display:\s*grid|display:\s*flex|--[a-z]+-color|:root\s*\{/i.test(html) },
  modern_framework: { sub: 4, test: html => /react|vue\.js|next\.js|nuxt|svelte|wix-thunderbolt|fluid-engine/i.test(html) },
  rich_content:     { sub: 3, test: html => {
    const visible = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return visible.length > 8000;
  }},
  many_pages:       { sub: 4, test: html => {
    const navLinks = (html.match(/<a[^>]+href=["']\/[^"']*["'][^>]*>/gi) || []).length;
    return navLinks > 15;
  }},
  modern_images:    { sub: 2, test: html => /srcset=|loading="lazy"|\.webp|picture>/i.test(html) },
  trust_badges:     { sub: 3, test: html => /bbb.*accredited|epa.*certified|nari|nahb|home.*advisor.*screened|angi.*certified/i.test(html) },
};

function scoreRedesign(html, url) {
  if (!html) return { score: 10, issues: [{ key: 'no_website', label: 'No website', weight: 10 }] };
  let score = 0;
  const issues = [];

  for (const [key, { label, weight, test }] of Object.entries(SITE_ISSUES)) {
    if (test(html, url)) {
      score += weight;
      issues.push({ key, label, weight });
    }
  }

  // Subtract points for modern/well-built signals
  for (const [key, { sub, test }] of Object.entries(MODERN_SIGNALS)) {
    if (test(html)) {
      score -= sub;
    }
  }

  return { score: Math.max(0, Math.min(score, 10)), issues };
}

function detectMarketingSignals(html) {
  if (!html) return [];
  const found = [];
  for (const [name, patterns] of Object.entries(MARKETING_SIGNALS)) {
    for (const pat of patterns) {
      if (pat.test(html)) {
        found.push(name);
        break;
      }
    }
  }
  return found;
}

function detectAffordability(html) {
  if (!html) return [];
  const found = [];
  for (const [name, patterns] of Object.entries(AFFORDABILITY_SIGNALS)) {
    for (const pat of patterns) {
      if (pat.test(html)) {
        found.push(name);
        break;
      }
    }
  }
  return found;
}


// ── Fetch site HTML ──────────────────────────────────────────────────────────

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
};

async function fetchSiteHTML(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000), redirect: 'follow' });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeSlug(lead) {
  return [lead.business_name, lead.city]
    .filter(Boolean).join('-')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

// ── Email enrichment (free — no paid APIs) ──────────────────────────────────

/**
 * Extract emails from website HTML.
 * Looks for mailto: links, plain-text emails, and contact page patterns.
 */
function extractEmailsFromHTML(html) {
  if (!html) return [];
  const found = new Set();

  // mailto: links
  const mailtoPattern = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  let m;
  while ((m = mailtoPattern.exec(html)) !== null) {
    found.add(m[1].toLowerCase());
  }

  // Plain-text emails in visible content (not in scripts/styles)
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const emailPattern = /\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/g;
  while ((m = emailPattern.exec(stripped)) !== null) {
    const email = m[1].toLowerCase();
    // Filter out common false positives
    if (!email.includes('example.com') &&
        !email.includes('sentry.io') &&
        !email.includes('schema.org') &&
        !email.includes('googleapis.com') &&
        !email.includes('w3.org') &&
        !email.endsWith('.png') &&
        !email.endsWith('.jpg') &&
        !email.endsWith('.js') &&
        !email.endsWith('.css')) {
      found.add(email);
    }
  }

  return [...found];
}

/**
 * Extract domain from a website URL.
 */
function extractDomain(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Score an extracted email for quality. Higher = more likely a real decision-maker.
 * Returns { email, score, reason }
 */
function scoreEmail(email, domain) {
  const local = email.split('@')[0].toLowerCase();
  const emailDomain = email.split('@')[1]?.toLowerCase() || '';

  // Prefer emails on the business's own domain
  const onDomain = domain && emailDomain === domain;

  // Priority list (higher = better for cold outreach)
  if (onDomain && /^(owner|ceo|president|founder)/.test(local)) return { email, score: 10, reason: 'owner_role' };
  if (onDomain && /^[a-z]+$/.test(local) && local.length >= 3 && local.length <= 15) return { email, score: 9, reason: 'first_name' };
  if (onDomain && /^[a-z]+\.[a-z]+$/.test(local)) return { email, score: 9, reason: 'first_last' };
  if (onDomain && /^(info|contact|hello|office|admin)$/.test(local)) return { email, score: 7, reason: 'generic_business' };
  if (onDomain && /^(service|support|help|sales)$/.test(local)) return { email, score: 5, reason: 'department' };
  if (onDomain) return { email, score: 6, reason: 'on_domain' };

  // Off-domain (gmail, yahoo, etc.) — still usable for small businesses
  if (/gmail\.com|yahoo\.com|hotmail\.com|outlook\.com|aol\.com/.test(emailDomain)) {
    return { email, score: 4, reason: 'personal_email' };
  }

  return { email, score: 2, reason: 'unknown' };
}

/**
 * Generate common email patterns to try for a domain.
 */
function generatePatterns(domain, ownerName) {
  if (!domain) return [];
  const patterns = [
    `info@${domain}`,
    `contact@${domain}`,
    `hello@${domain}`,
    `office@${domain}`,
  ];

  if (ownerName) {
    const parts = ownerName.toLowerCase().trim().split(/\s+/);
    const first = parts[0]?.replace(/[^a-z]/g, '');
    const last = parts[parts.length - 1]?.replace(/[^a-z]/g, '');
    if (first) {
      patterns.unshift(`${first}@${domain}`);
      if (last && last !== first) {
        patterns.unshift(`${first}.${last}@${domain}`);
        patterns.push(`${first[0]}${last}@${domain}`);
      }
    }
  }

  return patterns;
}

/**
 * Check if a domain has valid MX records (can receive email).
 * Does NOT verify specific addresses — leaves that to Resend bounce handling.
 * Port 25 SMTP checks are unreliable from cloud hosts (blocked by most providers).
 */
async function domainAcceptsMail(domain) {
  if (!domain) return false;
  const dns = require('dns').promises;
  try {
    const mx = await dns.resolveMx(domain);
    return mx && mx.length > 0;
  } catch {
    return false;
  }
}

/**
 * Full email enrichment for a lead.
 * 1. Extract from website HTML (most reliable)
 * 2. If none found, generate pattern guesses for domains with valid MX
 * Returns the best email or empty string.
 *
 * Address-level validation is handled by Resend bounce tracking —
 * bad addresses get flagged via the email-webhook and stop future sends.
 */
async function enrichEmail(lead, html) {
  // Already has email? Keep it.
  if (lead.email) return lead.email;

  const domain = extractDomain(lead.website);

  // Step 1: Extract from HTML
  const extracted = extractEmailsFromHTML(html);
  if (extracted.length > 0) {
    // Score and pick the best one
    const scored = extracted.map(e => scoreEmail(e, domain));
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    log.info('email_extracted', { business: lead.business_name, email: best.email, score: best.score, reason: best.reason });
    return best.email;
  }

  // Step 2: Pattern guess — only if domain has MX records
  if (domain && await domainAcceptsMail(domain)) {
    const patterns = generatePatterns(domain, lead.owner_name);
    // Use the highest-confidence pattern (first name or info@)
    if (patterns.length > 0) {
      const best = patterns[0];
      log.info('email_pattern_guess', { business: lead.business_name, email: best, method: 'mx_verified_pattern' });
      return best;
    }
    log.info('email_not_found', { business: lead.business_name, domain });
  }

  return '';
}

// ── Contact page fetcher ────────────────────────────────────────────────────

/**
 * Try to fetch the contact page for more email addresses.
 * Many local businesses hide their email on /contact or /about.
 */
async function fetchContactPage(baseUrl) {
  if (!baseUrl) return '';
  const contactPaths = ['/contact', '/contact-us', '/about', '/about-us'];

  for (const p of contactPaths) {
    try {
      const url = new URL(p, baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`).href;
      const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000), redirect: 'follow' });
      if (resp.ok) {
        const html = await resp.text();
        if (html.length > 500) return html; // Got a real page
      }
    } catch {}
  }
  return '';
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const inputFile = process.argv.includes('--input')
    ? process.argv[process.argv.indexOf('--input') + 1]
    : path.join(LEADS_DIR, 'scouted.json');

  if (!fs.existsSync(inputFile)) {
    log.warn('no_input', { file: inputFile, detail: 'Run scout first' });
    return [];
  }

  const leads = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  log.startRun({ count: leads.length, min_score: AUDIT_MIN_SCORE });

  const minCombined = AUDIT_MIN_SCORE;
  const audited = [];
  const noEmail = [];
  let skipped = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    log.lead('auditing', lead, { progress: `${i + 1}/${leads.length}` });

    // Use cached HTML from scout if available, otherwise fetch
    let html = lead.cached_html || null;
    if (!html && lead.website) {
      html = await fetchSiteHTML(lead.website);
      await sleep(500);
    }
    delete lead.cached_html; // Don't persist the HTML blob

    // Score
    lead.chatbot_score = scoreChatbot(html);
    const redesign = scoreRedesign(html, lead.website);
    lead.redesign_score = redesign.score;

    // Marketing signals
    lead.marketing_signals = detectMarketingSignals(html);

    // Affordability — can they pay for the service?
    lead.affordability_signals = detectAffordability(html);
    const affordBonus = Math.min(lead.affordability_signals.length * 0.5, 2);

    // Combined: redesign need (60%) + chatbot opportunity (40%) + affordability bonus
    // Capped at 10
    lead.combined_score = Math.min(10,
      Math.round((lead.redesign_score * 0.6 + lead.chatbot_score * 0.4 + affordBonus) * 10) / 10
    );

    // Report card (internal use only — not shown to prospects)
    lead.report_card = {
      issues: redesign.issues,
      chatbot_detected: lead.chatbot_score === 0,
      signals_count: lead.marketing_signals.length,
      affordability: lead.affordability_signals,
    };

    // Filter by score — combined >= 7 AND redesign >= 5
    // The redesign floor ensures we only send truly crappy sites, not
    // decent sites that just happen to lack a chatbot.
    if (lead.combined_score < minCombined || lead.redesign_score < 5) {
      skipped++;
      continue;
    }

    // Email enrichment — try homepage HTML first, then contact page
    if (!lead.email) {
      let combinedHtml = html || '';
      const contactHtml = await fetchContactPage(lead.website);
      if (contactHtml) combinedHtml += '\n' + contactHtml;
      lead.email = await enrichEmail(lead, combinedHtml);
      await sleep(300);
    }

    lead.demo_slug = lead.demo_slug || makeSlug(lead);
    lead.status = 'audited';
    lead.audited_at = new Date().toISOString();

    if (lead.email) {
      audited.push(lead);
    } else {
      noEmail.push(lead);
      log.info('qualified_no_email', { business: lead.business_name, city: lead.city });
    }
  }

  // Save
  const outPath = path.join(LEADS_DIR, 'audited.json');
  fs.writeFileSync(outPath, JSON.stringify(audited, null, 2), 'utf8');

  // Save qualified leads without emails for manual enrichment
  if (noEmail.length > 0) {
    const noEmailPath = path.join(LEADS_DIR, 'needs-email.json');
    fs.writeFileSync(noEmailPath, JSON.stringify(noEmail, null, 2), 'utf8');
  }

  log.info('audit_summary', {
    total: leads.length,
    qualified: audited.length,
    qualified_no_email: noEmail.length,
    skipped,
    min_score: minCombined,
    enrichment_rate: leads.length > 0
      ? Math.round(audited.length / (audited.length + noEmail.length) * 100) + '%'
      : '0%',
  });

  // Insert into DB (batched in transaction for atomicity)
  if (!SKIP_DB && !DRY_RUN && audited.length > 0) {
    try {
      const { neon } = require('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);

      // Process in batches of 25 within transactions
      const BATCH_SIZE = 25;
      let inserted = 0;
      for (let i = 0; i < audited.length; i += BATCH_SIZE) {
        const batch = audited.slice(i, i + BATCH_SIZE);
        try {
          await sql`BEGIN`;
          for (const lead of batch) {
            await sql`INSERT INTO prospects (
              business_name, website, phone, email, owner_name, niche,
              city, state, lead_type, chatbot_score, redesign_score,
              combined_score, report_card, status
            ) VALUES (
              ${lead.business_name}, ${lead.website || null}, ${lead.phone || null},
              ${lead.email || null}, ${lead.owner_name || null}, ${lead.niche || null},
              ${lead.city || null}, ${lead.state || null}, ${lead.lead_type || null},
              ${lead.chatbot_score}, ${lead.redesign_score}, ${lead.combined_score},
              ${JSON.stringify(lead.report_card)}::jsonb, 'audited'
            ) ON CONFLICT (business_name, city, state)
              WHERE business_name IS NOT NULL AND city IS NOT NULL
              DO UPDATE SET
                chatbot_score = EXCLUDED.chatbot_score,
                redesign_score = EXCLUDED.redesign_score,
                combined_score = EXCLUDED.combined_score,
                report_card = EXCLUDED.report_card,
                email = COALESCE(EXCLUDED.email, prospects.email),
                phone = COALESCE(EXCLUDED.phone, prospects.phone),
                updated_at = NOW()`;
            inserted++;
          }
          await sql`COMMIT`;
        } catch (err) {
          await sql`ROLLBACK`.catch(() => {});
          log.catch('db_batch_insert_failed', err, { batch_start: i, batch_size: batch.length });
          inserted -= batch.length;
        }
      }
      log.info('db_insert_complete', { inserted });
    } catch (err) {
      log.catch('db_connection_failed', err);
    }
  }

  log.endRun({ qualified: audited.length, qualified_no_email: noEmail.length, skipped });
  return audited;
}

module.exports = { main, scoreChatbot, scoreRedesign, detectMarketingSignals, detectAffordability };

if (require.main === module) {
  main().catch(err => { log.catch('fatal', err); process.exit(1); });
}
