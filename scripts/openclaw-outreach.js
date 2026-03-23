#!/usr/bin/env node
/**
 * openclaw-outreach.js  (Agent 4 — Outreach)
 *
 * Sends plain-text cold emails with:
 *   - Custom homepage concept as the hook
 *   - Live demo link
 *   - 3-step drip: Day 0 (concept) → Day 3 (reminder) → Day 7 (breakup)
 *   - CAN-SPAM compliant (physical address + unsubscribe link)
 *   - Reply detection: stops drip if prospect replies or bounces
 *
 * Uses Resend for email delivery (outreach@latchlyai.com).
 * Tracks sequence state in prospects table.
 *
 * Input:  leads/openclaw/audited.json (or DB query)
 * Timezone-aware: only sends when it's 7:00–9:30 AM in the prospect's
 * local timezone. Run via cron every 30 min from 7 AM–1 PM ET to catch
 * all US timezone windows (PT 7 AM = ET 10 AM):
 *   0,30 7-12 * * 1-5 node /path/to/scripts/openclaw-outreach.js
 *
 * Usage:
 *   node scripts/openclaw-outreach.js
 *   DRY_RUN=true node scripts/openclaw-outreach.js
 *   MAX_EMAILS=20 node scripts/openclaw-outreach.js
 */

const fs   = require('fs');
const path = require('path');
const config = require('./openclaw.config');
const { createLogger } = require('./openclaw-logger');

const log = createLogger('outreach');
const { ROOT, SITE_BASE, FROM_EMAIL, PHYSICAL_ADDRESS,
        DRY_RUN } = config;

// ── Warm-up mode ────────────────────────────────────────────────────────────
// Fresh sending domains land in spam if you blast 20+ emails on day 1.
// Set WARMUP_START=2026-03-23 (your first send date) and we auto-ramp:
//   Week 1: 5/day, Week 2: 10/day, Week 3: 20/day, Week 4+: MAX_EMAILS
function getEffectiveMaxEmails() {
  const warmupStart = process.env.WARMUP_START;
  if (!warmupStart) return config.MAX_EMAILS;

  const start = new Date(warmupStart);
  const now = new Date();
  const daysSince = Math.floor((now - start) / (1000 * 60 * 60 * 24));

  if (daysSince < 0) return 0; // Not started yet
  if (daysSince < 7) return 5;
  if (daysSince < 14) return 10;
  if (daysSince < 21) return 20;
  return config.MAX_EMAILS; // Full volume after 3 weeks
}

const MAX_EMAILS = getEffectiveMaxEmails();

// ── Timezone lookup ─────────────────────────────────────────────────────────
// Maps US state abbreviations to IANA timezone (most common per state)
const STATE_TZ = {
  AL:'America/Chicago',AK:'America/Anchorage',AZ:'America/Phoenix',AR:'America/Chicago',
  CA:'America/Los_Angeles',CO:'America/Denver',CT:'America/New_York',DE:'America/New_York',
  FL:'America/New_York',GA:'America/New_York',HI:'Pacific/Honolulu',ID:'America/Boise',
  IL:'America/Chicago',IN:'America/Indiana/Indianapolis',IA:'America/Chicago',KS:'America/Chicago',
  KY:'America/New_York',LA:'America/Chicago',ME:'America/New_York',MD:'America/New_York',
  MA:'America/New_York',MI:'America/Detroit',MN:'America/Chicago',MS:'America/Chicago',
  MO:'America/Chicago',MT:'America/Denver',NE:'America/Chicago',NV:'America/Los_Angeles',
  NH:'America/New_York',NJ:'America/New_York',NM:'America/Denver',NY:'America/New_York',
  NC:'America/New_York',ND:'America/Chicago',OH:'America/New_York',OK:'America/Chicago',
  OR:'America/Los_Angeles',PA:'America/New_York',RI:'America/New_York',SC:'America/New_York',
  SD:'America/Chicago',TN:'America/Chicago',TX:'America/Chicago',UT:'America/Denver',
  VT:'America/New_York',VA:'America/New_York',WA:'America/Los_Angeles',WV:'America/New_York',
  WI:'America/Chicago',WY:'America/Denver',DC:'America/New_York',
};

/**
 * Returns true if it's currently between 7:00–9:30 AM in the prospect's
 * local timezone. Falls back to true (send anyway) if state is unknown.
 */
function isLocalSendWindow(state) {
  const abbr = (state || '').trim().toUpperCase();
  const tz = STATE_TZ[abbr];
  if (!tz) return true; // Unknown state — don't block the send

  const now = new Date();
  const localTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const h = localTime.getHours();
  const m = localTime.getMinutes();
  const minuteOfDay = h * 60 + m;

  // 7:00 AM (420) to 9:30 AM (570)
  return minuteOfDay >= 420 && minuteOfDay <= 570;
}

// ── Email templates ──────────────────────────────────────────────────────────

function unsubLink(email) {
  const token = Buffer.from(email).toString('base64url');
  return `${SITE_BASE}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

function hashLead(value) {
  let h = 0;
  const s = String(value || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickVariant(lead, step, options) {
  const seed = `${lead.demo_slug || lead.business_name || ''}|${lead.email || ''}|${step}`;
  return options[hashLead(seed) % options.length];
}

function buildEmail(lead, step) {
  const biz = lead.business_name;
  const city = lead.city || '';
  const firstName = lead.owner_name ? lead.owner_name.split(' ')[0] : '';
  const greeting = firstName ? `${firstName},` : 'Hi,';
  const demoUrl = lead.demo_url || `${SITE_BASE}/demo/${lead.demo_slug}`;
  const unsub = unsubLink(lead.email);
  const cityLine = city ? ` and the ${city} market` : '';
  const footerAddress = String(PHYSICAL_ADDRESS || 'Latchly · Austin, TX').replace(/Latchly AI/g, 'Latchly');
  const footer = `\n\n---\n${footerAddress}\nUnsubscribe: ${unsub}`;

  if (step === 0) {
    const variant = pickVariant(lead, step, [
      {
        subject: `homepage concept for ${biz}`,
        opener: `I put together a custom homepage concept for ${biz}. Not a pitch deck — an actual working design built around your services${cityLine}.`,
        body: `The goal was to tighten up the conversion flow so more of your existing visitors turn into calls and booked jobs, especially on mobile and after hours. It also gives you a cleaner lead-capture path for people who don’t want to call right away.`,
        close: `No strings. If it sparks any ideas, I’m happy to walk you through it.`
      },
      {
        subject: `built this for ${biz}`,
        opener: `I spent a little time mocking up a live homepage concept for ${biz}. It’s tailored to the services you already offer${cityLine}.`,
        body: `Main idea was simple: make the site feel more current, make the next step clearer, and give you a better shot at turning traffic into real jobs with stronger lead capture instead of relying on people to call during business hours.`,
        close: `If it’s useful, I can show you what I changed and why.`
      },
      {
        subject: `quick site concept for ${biz}`,
        opener: `I built a quick homepage concept for ${biz} after looking through the current site${cityLine ? cityLine : ''}.`,
        body: `It’s meant to show what a cleaner, higher-converting version could look like — better structure, stronger mobile flow, and better lead capture for visitors who land after hours or aren’t ready to call.`,
        close: `Take a look when you have a minute. Happy to break it down if you want.`
      },
    ]);

    return {
      subject: variant.subject,
      text: `${greeting}

${variant.opener}

${variant.body}

${demoUrl}

${variant.close}

Matthew
Latchly${footer}`,
    };
  }

  if (step === 1) {
    const variant = pickVariant(lead, step, [
      {
        subject: `Re: homepage concept for ${biz}`,
        text: `${greeting}

Wanted to make sure the ${biz} concept I sent over didn’t get buried.

It’s here if you want to take a quick look:
${demoUrl}

Matthew${footer}`,
      },
      {
        subject: `Re: built this for ${biz}`,
        text: `${greeting}

Following up once on the homepage concept I put together for ${biz}.

Here’s the link again:
${demoUrl}

Matthew${footer}`,
      },
      {
        subject: `Re: quick site concept for ${biz}`,
        text: `${greeting}

Just resurfacing the concept I built for ${biz} in case it got missed.

${demoUrl}

Matthew${footer}`,
      },
    ]);
    return variant;
  }

  const variant = pickVariant(lead, step, [
    {
      subject: `${biz} concept — last note`,
      text: `${greeting}

I won’t keep bugging you about this. If a stronger web presence for ${biz} ever moves up the list, the concept I built is here:

${demoUrl}

All the best,

Matthew${footer}`,
    },
    {
      subject: `${biz} homepage concept`,
      text: `${greeting}

Last note from me on this. Keeping the concept link here in case it’s useful later:

${demoUrl}

Best,

Matthew${footer}`,
    },
  ]);
  return variant;
}

async function demoReachable(lead) {
  const demoUrl = lead.demo_url || `${SITE_BASE}/demo/${lead.demo_slug || ''}`;
  if (!lead.demo_slug || !demoUrl) {
    return { ok: false, reason: 'missing_demo_slug' };
  }

  try {
    const resp = await fetch(demoUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 LatchlyOutreachCheck' },
    });

    if (!resp.ok) return { ok: false, reason: `http_${resp.status}` };
    const text = await resp.text();
    if (/Demo not found|Demo Expired/i.test(text)) return { ok: false, reason: 'demo_unavailable' };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// ── Sending ──────────────────────────────────────────────────────────────────

async function sendEmail(to, subject, text, step, retries = 2) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would send to ${to}: "${subject}"`);
    return { success: true, dry: true, id: 'dry-run' };
  }

  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const replyTo = process.env.AGENTMAIL_INBOX_ID || FROM_EMAIL;
      const { data, error } = await resend.emails.send({
        from: `Matthew from Latchly <${FROM_EMAIL}>`,
        reply_to: replyTo,
        to,
        subject,
        text,
        headers: {
          'X-Latchly-Step': String(step ?? ''),
        },
      });

      if (error) {
        // Permanent errors — don't retry
        if (error.statusCode && error.statusCode < 500) {
          log.error('send_permanent_fail', { email: to, step, message: error.message });
          return { success: false, error };
        }
        // Transient error — retry with backoff
        if (attempt < retries) {
          const delay = 1000 * Math.pow(2, attempt);
          log.warn('send_retry', { email: to, step, attempt: attempt + 1, delay_ms: delay });
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        log.error('send_exhausted', { email: to, step, attempts: retries + 1, message: error.message });
        return { success: false, error };
      }

      return { success: true, id: data?.id };
    } catch (err) {
      if (attempt < retries) {
        const delay = 1000 * Math.pow(2, attempt);
        log.warn('send_exception_retry', { email: to, step, attempt: attempt + 1, delay_ms: delay });
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      log.catch('send_exception', err, { email: to, step, attempts: retries + 1 });
      return { success: false, error: err };
    }
  }
}

// ── Drip schedule ────────────────────────────────────────────────────────────

function shouldSendDrip(lead) {
  const step = lead.outreach_step || 0;
  if (step >= 3) return null; // Sequence complete
  if (lead.unsubscribed) return null;
  if (!lead.email) return null;

  // Stop drip if prospect has replied (closer has processed a response)
  if ((lead.closer_responses || 0) > 0) return null;
  if (lead.escalated) return null;

  // Stop drip if prospect has bounced
  if (lead.bounce_type) return null;

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
  log.startRun({ dry_run: DRY_RUN, max_emails: MAX_EMAILS });
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
          AND bounce_type IS NULL
          AND email IS NOT NULL
          AND outreach_step < 3
          AND sco_dispatched_at IS NULL
        ORDER BY combined_score DESC
        LIMIT ${MAX_EMAILS * 2}
      `;
      if (rows.length > 0) {
        leads = rows;
        useDB = true;
        log.info('loaded_from_db', { count: leads.length });
      }
    } catch (err) {
      log.warn('db_unavailable', { message: err.message, detail: 'falling back to file' });
    }
  }

  if (!useDB && fs.existsSync(inputFile)) {
    leads = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    log.info('loaded_from_file', { count: leads.length });
  }

  if (leads.length === 0) {
    log.warn('no_leads', { detail: 'Run audit first' });
    return;
  }

  let sent = 0;
  let skipped_tz = 0;
  let skipped_demo = 0;
  const results = [];

  for (const lead of leads) {
    if (sent >= MAX_EMAILS) break;

    const step = shouldSendDrip(lead);
    if (step === null) continue;

    // Only send if it's 7-9:30 AM in the prospect's local timezone
    if (!isLocalSendWindow(lead.state)) {
      skipped_tz++;
      log.info('skipped_timezone', { business: lead.business_name, state: lead.state });
      continue;
    }

    const demoCheck = await demoReachable(lead);
    if (!demoCheck.ok) {
      skipped_demo++;
      log.info('skipped_demo_unreachable', { business: lead.business_name, slug: lead.demo_slug, reason: demoCheck.reason });
      continue;
    }

    const email = buildEmail(lead, step);
    log.lead('sending', lead, { step });

    const result = await sendEmail(lead.email, email.subject, email.text, step);

    if (result.success) {
      sent++;
      const newStep = (lead.outreach_step || 0) + 1;
      lead.outreach_step = newStep;
      lead.last_outreach_at = new Date().toISOString();
      lead.last_resend_email_id = result.id || null;
      lead.status = 'outreach';

      log.lead('sent', lead, { step, email_id: result.id });

      // Update DB in a transaction (atomic: step + email ID together)
      if (useDB && !DRY_RUN) {
        try {
          const { neon } = require('@neondatabase/serverless');
          const sql = neon(process.env.DATABASE_URL);
          await sql`UPDATE prospects SET
            outreach_step = ${newStep},
            last_outreach_at = NOW(),
            last_resend_email_id = ${result.id || null},
            status = 'outreach',
            updated_at = NOW()
          WHERE id = ${lead.id}
            AND outreach_step < ${newStep}`;
        } catch (err) {
          log.catch('db_update_failed', err, { lead_id: lead.id, business: lead.business_name });
        }
      }

      results.push({
        business: lead.business_name,
        email: lead.email,
        step,
        emailId: result.id,
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

  log.endRun({ sent, skipped_tz, skipped_demo, total_leads: leads.length });
  return results;
}

module.exports = { main, buildEmail, shouldSendDrip };

if (require.main === module) {
  main().catch(err => { log.catch('fatal', err); process.exit(1); });
}
