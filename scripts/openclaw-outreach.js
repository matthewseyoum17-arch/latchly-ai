#!/usr/bin/env node
/**
 * openclaw-outreach.js  (Agent 4 — Outreach)
 *
 * Sends personalized cold emails with:
 *   - Report card highlights (top 2-3 issues from audit)
 *   - Live demo link
 *   - Stripe payment link
 *   - 3-step drip: Day 0 (initial) → Day 3 (follow-up) → Day 7 (final)
 *   - CAN-SPAM compliant (physical address + unsubscribe link)
 *
 * Uses Resend for email delivery (outreach@latchlyai.com).
 * Tracks sequence state in prospects table.
 *
 * Input:  leads/openclaw/audited.json (or DB query)
 * Usage:
 *   node scripts/openclaw-outreach.js
 *   DRY_RUN=true node scripts/openclaw-outreach.js
 *   MAX_EMAILS=20 node scripts/openclaw-outreach.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Load .env
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

const DRY_RUN   = process.env.DRY_RUN === 'true';
const MAX_EMAILS = parseInt(process.env.MAX_EMAILS || '20', 10);
const SITE_BASE  = process.env.SITE_BASE || 'https://latchlyai.com';
const FROM_EMAIL = process.env.OUTREACH_FROM || 'outreach@latchlyai.com';
const STRIPE_LINK = process.env.STRIPE_PAYMENT_LINK || 'https://buy.stripe.com/your-link';
const BOOKING_LINK = process.env.BOOKING_LINK || 'https://calendly.com/latchlyai/demo';

// Physical address for CAN-SPAM
const PHYSICAL_ADDRESS = 'Latchly AI · 123 Main St · Austin, TX 78701';

// ── Email templates ──────────────────────────────────────────────────────────

function unsubLink(email) {
  const token = Buffer.from(email).toString('base64url');
  return `${SITE_BASE}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

function buildEmail(lead, step) {
  const biz = lead.business_name;
  const city = lead.city || '';
  const demoUrl = lead.demo_url || `${SITE_BASE}/demo/${lead.demo_slug}`;
  const issues = lead.report_card?.issues || [];
  const topIssues = issues.slice(0, 3);
  const unsub = unsubLink(lead.email);

  const issueList = topIssues.length > 0
    ? topIssues.map(i => `  - ${i.label}`).join('\n')
    : '  - Your site could benefit from modern lead capture';

  const footer = `\n\n---\n${PHYSICAL_ADDRESS}\n[Unsubscribe](${unsub})`;

  if (step === 0) {
    // Initial outreach — lead with the demo, soft CTA to book a call
    return {
      subject: `${biz} — I built something for you`,
      html: buildInitialHtml(lead, demoUrl, issueList, topIssues, unsub),
      text: `Hi${lead.owner_name ? ' ' + lead.owner_name.split(' ')[0] : ''},

I checked out ${biz}'s website and noticed a few things that might be costing you leads:

${issueList}

Instead of just pointing that out, I built a free demo of what a modern site could look like for ${biz} — with an AI assistant that answers customer questions and captures leads 24/7:

${demoUrl}

Try the chat widget in the bottom right — it works live.

If you want, I can walk you through it in 10 minutes: ${BOOKING_LINK}

Either way, the demo is yours to keep. No strings.

Best,
Matthew
Latchly AI${footer}`,
    };
  }

  if (step === 1) {
    // Day 3 follow-up — reference the demo, push toward a call
    return {
      subject: `Re: ${biz} — did you see the demo?`,
      html: buildFollowUpHtml(lead, demoUrl, unsub),
      text: `Hi${lead.owner_name ? ' ' + lead.owner_name.split(' ')[0] : ''},

Just circling back — did you get a chance to check out the demo I built for ${biz}?

${demoUrl}

The AI chat assistant on there typically captures 5-15 extra leads per month that would otherwise bounce off your site. And it works while you sleep.

Happy to do a quick 10-minute walkthrough if that's easier: ${BOOKING_LINK}

Best,
Matthew${footer}`,
    };
  }

  // Step 2: Day 7 final — low pressure, leave the door open
  return {
    subject: `${biz} demo — last note`,
    html: buildFinalHtml(lead, demoUrl, unsub),
    text: `Hi${lead.owner_name ? ' ' + lead.owner_name.split(' ')[0] : ''},

Last follow-up from me. Your demo is still live:

${demoUrl}

If the timing isn't right, no worries at all. When you're ready, grab 10 minutes here and I'll show you how it works: ${BOOKING_LINK}

Have a good one!

Matthew${footer}`,
  };
}

// ── HTML email builders ──────────────────────────────────────────────────────

function escHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function emailWrapper(content, unsub) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;">
<div style="max-width:580px;margin:0 auto;padding:24px;">
${content}
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;">
<p style="font-size:11px;color:#94a3b8;margin:0;">${PHYSICAL_ADDRESS}</p>
<p style="font-size:11px;color:#94a3b8;margin:4px 0 0;"><a href="${unsub}" style="color:#94a3b8;">Unsubscribe</a></p>
</div>
</div></body></html>`;
}

function buildInitialHtml(lead, demoUrl, issueList, topIssues, unsub) {
  const firstName = lead.owner_name ? lead.owner_name.split(' ')[0] : '';
  const greeting = firstName ? `Hi ${escHtml(firstName)},` : 'Hi,';

  const issueRows = topIssues.map(i =>
    `<tr><td style="padding:4px 8px;font-size:14px;color:#ef4444;">&#10007;</td><td style="padding:4px 8px;font-size:14px;color:#334155;">${escHtml(i.label)}</td></tr>`
  ).join('');

  return emailWrapper(`
<p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 16px;">${greeting}</p>
<p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 16px;">I was looking at <strong>${escHtml(lead.business_name)}</strong>'s online presence and noticed a few things that could be costing you leads:</p>
${topIssues.length > 0 ? `<table style="margin:0 0 16px;border-collapse:collapse;">${issueRows}</table>` : ''}
<p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 16px;">Instead of just pointing that out, I built a free demo of what a modern site could look like for ${escHtml(lead.business_name)} — with an AI assistant that answers customer questions and captures leads 24/7:</p>
<div style="text-align:center;margin:24px 0;">
<a href="${demoUrl}" style="display:inline-block;background:#1B5FA8;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">See Your Demo</a>
</div>
<p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 8px;">Try the chat widget in the bottom right — it works live.</p>
<p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 16px;">Want me to walk you through it? <a href="${BOOKING_LINK}" style="color:#1B5FA8;font-weight:600;">Grab 10 minutes here</a> — no pressure.</p>
<p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 4px;">Best,</p>
<p style="font-size:15px;color:#334155;font-weight:600;margin:0;">Matthew</p>
<p style="font-size:13px;color:#64748b;margin:2px 0 0;">Latchly AI</p>`, unsub);
}

function buildFollowUpHtml(lead, demoUrl, unsub) {
  const firstName = lead.owner_name ? lead.owner_name.split(' ')[0] : '';
  const greeting = firstName ? `Hi ${escHtml(firstName)},` : 'Hi,';

  return emailWrapper(`
<p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 16px;">${greeting}</p>
<p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 16px;">Just following up on the demo I built for <strong>${escHtml(lead.business_name)}</strong>:</p>
<div style="text-align:center;margin:24px 0;">
<a href="${demoUrl}" style="display:inline-block;background:#1B5FA8;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">View Your Demo</a>
</div>
<p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 16px;">The AI chat on there typically captures <strong>5-15 extra leads per month</strong> that would otherwise bounce off your site. And it works while you sleep.</p>
<p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 16px;">Want a quick walkthrough? <a href="${BOOKING_LINK}" style="color:#1B5FA8;font-weight:600;">Grab 10 minutes here</a>.</p>
<p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 4px;">Best,</p>
<p style="font-size:15px;color:#334155;font-weight:600;margin:0;">Matthew</p>`, unsub);
}

function buildFinalHtml(lead, demoUrl, unsub) {
  const firstName = lead.owner_name ? lead.owner_name.split(' ')[0] : '';
  const greeting = firstName ? `Hi ${escHtml(firstName)},` : 'Hi,';

  return emailWrapper(`
<p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 16px;">${greeting}</p>
<p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 16px;">This is my last follow-up. Your custom demo is still live:</p>
<div style="text-align:center;margin:24px 0;">
<a href="${demoUrl}" style="display:inline-block;background:#1B5FA8;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">View Demo</a>
</div>
<p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 16px;">No pressure at all. When you're ready, <a href="${BOOKING_LINK}" style="color:#1B5FA8;font-weight:600;">grab 10 minutes here</a> and I'll show you how it works.</p>
<p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 4px;">Wishing you a great week!</p>
<p style="font-size:15px;color:#334155;font-weight:600;margin:0;">Matthew</p>`, unsub);
}

// ── Sending ──────────────────────────────────────────────────────────────────

async function sendEmail(to, subject, html, text) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would send to ${to}: "${subject}"`);
    return { success: true, dry: true };
  }

  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: `Matthew from Latchly <${FROM_EMAIL}>`,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    console.error(`  Email error for ${to}: ${error.message}`);
    return { success: false, error };
  }

  return { success: true, id: data?.id };
}

// ── Drip schedule ────────────────────────────────────────────────────────────

function shouldSendDrip(lead) {
  const step = lead.outreach_step || 0;
  if (step >= 3) return null; // Sequence complete
  if (lead.unsubscribed) return null;
  if (!lead.email) return null;

  const lastSent = lead.last_outreach_at ? new Date(lead.last_outreach_at) : null;
  const now = new Date();

  if (step === 0) return 0; // Never sent → send initial
  if (step === 1 && lastSent) {
    const daysSince = (now - lastSent) / (1000 * 60 * 60 * 24);
    if (daysSince >= 3) return 1; // Day 3 follow-up
  }
  if (step === 2 && lastSent) {
    const daysSince = (now - lastSent) / (1000 * 60 * 60 * 24);
    if (daysSince >= 4) return 2; // Day 7 final (4 days after step 1)
  }

  return null; // Not time yet
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const inputFile = path.join(ROOT, 'leads', 'openclaw', 'audited.json');

  // Try to load from DB first, fall back to file
  let leads = [];
  let useDB = false;

  if (!process.env.SKIP_DB && process.env.DATABASE_URL) {
    try {
      const { neon } = require('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);
      const rows = await sql`
        SELECT * FROM prospects
        WHERE status IN ('audited', 'outreach')
          AND unsubscribed = FALSE
          AND email IS NOT NULL
          AND outreach_step < 3
        ORDER BY combined_score DESC
        LIMIT ${MAX_EMAILS * 2}
      `;
      if (rows.length > 0) {
        leads = rows;
        useDB = true;
        console.log(`Loaded ${leads.length} prospects from DB`);
      }
    } catch (err) {
      console.log(`DB unavailable, falling back to file: ${err.message}`);
    }
  }

  if (!useDB && fs.existsSync(inputFile)) {
    leads = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    console.log(`Loaded ${leads.length} leads from file`);
  }

  if (leads.length === 0) {
    console.log('No leads to outreach. Run audit first.');
    return;
  }

  let sent = 0;
  const results = [];

  for (const lead of leads) {
    if (sent >= MAX_EMAILS) break;

    const step = shouldSendDrip(lead);
    if (step === null) continue;

    const email = buildEmail(lead, step);
    console.log(`  Sending step ${step} to ${lead.email} (${lead.business_name})...`);

    const result = await sendEmail(lead.email, email.subject, email.html, email.text);

    if (result.success) {
      sent++;
      lead.outreach_step = (lead.outreach_step || 0) + 1;
      lead.last_outreach_at = new Date().toISOString();
      lead.status = 'outreach';

      // Update DB
      if (useDB && !DRY_RUN) {
        try {
          const { neon } = require('@neondatabase/serverless');
          const sql = neon(process.env.DATABASE_URL);
          await sql`UPDATE prospects SET
            outreach_step = ${lead.outreach_step},
            last_outreach_at = NOW(),
            status = 'outreach',
            updated_at = NOW()
          WHERE id = ${lead.id}`;
        } catch (err) {
          console.error(`  DB update failed: ${err.message}`);
        }
      }

      results.push({
        business: lead.business_name,
        email: lead.email,
        step,
        success: true,
      });
    }

    // Rate limit: 1 email per 2 seconds
    await new Promise(r => setTimeout(r, 2000));
  }

  // Update file
  if (!useDB && !DRY_RUN) {
    fs.writeFileSync(inputFile, JSON.stringify(leads, null, 2), 'utf8');
  }

  console.log(`\nOutreach complete: ${sent} emails sent`);
  return results;
}

module.exports = { main, buildEmail, shouldSendDrip };

if (require.main === module) {
  main().catch(err => { console.error('Outreach failed:', err); process.exit(1); });
}
