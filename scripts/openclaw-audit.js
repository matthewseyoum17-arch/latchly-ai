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

const DRY_RUN = process.env.DRY_RUN === 'true';
const SKIP_DB = process.env.SKIP_DB === 'true';

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

// ── Site quality audit ───────────────────────────────────────────────────────

const SITE_ISSUES = {
  no_mobile:      { label: 'No mobile viewport', weight: 2, test: html => !/meta name="viewport"/i.test(html) },
  no_https:       { label: 'Not using HTTPS', weight: 1, test: (html, url) => !/^https/i.test(url || '') },
  thin_content:   { label: 'Very thin content', weight: 2, test: html => html.length < 8000 },
  no_phone_cta:   { label: 'No phone CTA', weight: 2, test: html => !/tel:|call.*now|call.*us/i.test(html) },
  no_form:        { label: 'No contact form', weight: 2, test: html => !/<form\b/i.test(html) },
  table_layout:   { label: 'Table-based layout', weight: 1, test: html => /<table\b[^>]*>[\s\S]*<table/i.test(html) },
  no_reviews:     { label: 'No reviews/testimonials', weight: 1, test: html => !/reviews?|testimonials?/i.test(html) },
  no_ssl:         { label: 'SSL issues', weight: 1, test: (html, url) => /http:\/\//i.test(url || '') },
  slow_builder:   { label: 'Generic builder site', weight: 1, test: html => /wix\.com|squarespace|weebly|godaddy\.com\/websites/i.test(html) },
  no_schema:      { label: 'No structured data', weight: 1, test: html => !/application\/ld\+json/i.test(html) },
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

function scoreRedesign(html, url) {
  if (!html) return 10; // No website → needs full build
  let score = 0;
  const issues = [];

  for (const [key, { label, weight, test }] of Object.entries(SITE_ISSUES)) {
    if (test(html, url)) {
      score += weight;
      issues.push({ key, label, weight });
    }
  }

  return { score: Math.min(score, 10), issues };
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

// ── Report Card HTML ─────────────────────────────────────────────────────────

function generateReportCard(lead) {
  const issues = lead.report_card?.issues || [];
  const topIssues = issues.slice(0, 3);

  const issueRows = topIssues.map(i =>
    `<tr><td style="padding:6px 12px;font-size:13px;color:#ef4444;">&#10007;</td><td style="padding:6px 12px;font-size:13px;color:#334155;">${i.label}</td></tr>`
  ).join('');

  const signals = lead.marketing_signals || [];
  const signalText = signals.length > 0
    ? `<p style="font-size:12px;color:#64748b;margin:8px 0 0;">Marketing signals detected: ${signals.join(', ')}</p>`
    : '';

  return `<div style="font-family:system-ui,sans-serif;max-width:400px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:16px 20px;">
<h3 style="margin:0;color:#fff;font-size:16px;font-weight:700;">Site Report Card</h3>
<p style="margin:4px 0 0;color:rgba(255,255,255,.6);font-size:12px;">${lead.business_name} &middot; ${lead.city || ''}, ${lead.state || ''}</p>
</div>
<div style="padding:16px 20px;">
<div style="display:flex;gap:12px;margin-bottom:12px;">
<div style="flex:1;text-align:center;padding:12px;background:#f8fafc;border-radius:8px;">
<div style="font-size:24px;font-weight:900;color:${lead.chatbot_score >= 7 ? '#ef4444' : lead.chatbot_score >= 4 ? '#f59e0b' : '#10b981'};">${lead.chatbot_score}/10</div>
<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Chatbot Need</div>
</div>
<div style="flex:1;text-align:center;padding:12px;background:#f8fafc;border-radius:8px;">
<div style="font-size:24px;font-weight:900;color:${lead.redesign_score >= 7 ? '#ef4444' : lead.redesign_score >= 4 ? '#f59e0b' : '#10b981'};">${lead.redesign_score}/10</div>
<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Redesign Need</div>
</div>
</div>
${topIssues.length > 0 ? `<table style="width:100%;border-collapse:collapse;">${issueRows}</table>` : '<p style="font-size:13px;color:#10b981;">No major issues found</p>'}
${signalText}
</div></div>`;
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

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const inputFile = process.argv.includes('--input')
    ? process.argv[process.argv.indexOf('--input') + 1]
    : path.join(LEADS_DIR, 'scouted.json');

  if (!fs.existsSync(inputFile)) {
    console.error(`Input not found: ${inputFile}`);
    process.exit(1);
  }

  const leads = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  console.log(`Loaded ${leads.length} scouted leads for audit`);

  const minCombined = parseInt(process.env.AUDIT_MIN_SCORE || '8', 10);
  const audited = [];
  let skipped = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    console.log(`  [${i + 1}/${leads.length}] ${lead.business_name}...`);

    // Fetch site HTML if we don't already have it
    let html = null;
    if (lead.website) {
      html = await fetchSiteHTML(lead.website);
      await sleep(500);
    }

    // Score
    lead.chatbot_score = scoreChatbot(html);
    const redesign = scoreRedesign(html, lead.website);
    lead.redesign_score = redesign.score;
    lead.combined_score = Math.round((lead.chatbot_score + lead.redesign_score) / 2 * 1.3); // Weighted up
    lead.combined_score = Math.min(lead.combined_score, 10);

    // Marketing signals
    lead.marketing_signals = detectMarketingSignals(html);

    // Report card
    lead.report_card = {
      issues: redesign.issues,
      chatbot_detected: lead.chatbot_score === 0,
      signals_count: lead.marketing_signals.length,
    };
    lead.report_card_html = generateReportCard(lead);

    // Filter
    if (lead.combined_score < minCombined) {
      skipped++;
      continue;
    }

    lead.status = 'audited';
    lead.audited_at = new Date().toISOString();
    audited.push(lead);
  }

  // Save
  const outPath = path.join(LEADS_DIR, 'audited.json');
  fs.writeFileSync(outPath, JSON.stringify(audited, null, 2), 'utf8');

  console.log(`\nAudit complete:`);
  console.log(`  Audited: ${leads.length}`);
  console.log(`  Qualified (score >= ${minCombined}): ${audited.length}`);
  console.log(`  Skipped: ${skipped}`);

  // Insert into DB
  if (!SKIP_DB && !DRY_RUN && audited.length > 0) {
    try {
      const { neon } = require('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);

      let inserted = 0;
      for (const lead of audited) {
        try {
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
          ) ON CONFLICT DO NOTHING`;
          inserted++;
        } catch (err) {
          console.error(`  DB insert failed for ${lead.business_name}: ${err.message}`);
        }
      }
      console.log(`  DB: ${inserted} prospects inserted`);
    } catch (err) {
      console.error(`  DB connection failed: ${err.message}`);
    }
  }

  console.log(`  Output: ${outPath}`);
  return audited;
}

module.exports = { main, scoreChatbot, scoreRedesign, generateReportCard, detectMarketingSignals };

if (require.main === module) {
  main().catch(err => { console.error('Audit failed:', err); process.exit(1); });
}
