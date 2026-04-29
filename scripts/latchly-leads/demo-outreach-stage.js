/**
 * scripts/latchly-leads/demo-outreach-stage.js
 *
 * Per-lead orchestration: enrichment → site-content → demo build → queue cold
 * email. Run after upsertLeads in pipeline.js, gated by LATCHLY_DEMO_OUTREACH=1.
 *
 * Failures are isolated per-lead — one bad lead never aborts the run.
 * The pipeline does NOT send emails. That's the cron's job (drain queue).
 */

const fs = require('fs');
const path = require('path');
const { businessKey, ensureDir } = require('./utils');
const { LEADS_DIR } = require('./config');
const { enrichLead } = require('./enrichment');
const { generateSiteContent } = require('./site-content-engine');
const { buildDemoForLead } = require('./design-engine');
const { queueDayZeroForLead } = require('./outreach-queue');
const { findEmail } = require('./email-finder');
const { deriveBusinessDomain } = require('./email-utils');

const SITE_BASE = (process.env.SITE_BASE || 'https://latchlyai.com').replace(/\/+$/, '');
const DEMOS_DIR = path.join(process.cwd(), 'demos', 'prospects');

let _anthropic = null;
async function getAnthropic() {
  if (_anthropic) return _anthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  _anthropic = new Anthropic({ apiKey });
  return _anthropic;
}

let _sql = null;
async function getSql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
  if (!url) return null;
  const { neon } = await import('@neondatabase/serverless');
  _sql = neon(url);
  return _sql;
}

async function runDemoOutreachStage(leads, opts = {}) {
  const stats = {
    candidates: leads.length,
    enriched: 0,
    contentGenerated: 0,
    demosBuilt: 0,
    demosFailed: 0,
    outreachQueued: 0,
    outreachSkipped: { no_email: 0, no_demo: 0, already_queued_or_sent: 0, compose_failed: 0, other: 0 },
    errors: [],
  };

  if (!leads.length) return stats;

  let anthropic;
  try {
    anthropic = await getAnthropic();
  } catch (err) {
    stats.errors.push({ stage: 'anthropic_init', error: err.message });
    return stats;
  }

  const sql = await getSql();

  ensureDir(DEMOS_DIR);

  const fromEmail = process.env.OUTREACH_FROM || 'Matthew @ Latchly <matt@latchlyai.com>';
  const testEmail = process.env.LATCHLY_OUTREACH_TEST_EMAIL || null;
  const testNow = process.env.LATCHLY_OUTREACH_TEST_NOW === '1';
  // QA gate is ON by default — new outreach lands as 'draft' and waits for
  // Approve/Reject in the CRM. Set LATCHLY_OUTREACH_REQUIRE_APPROVAL=0 to
  // bypass and queue straight for autonomous send.
  const requireApproval = process.env.LATCHLY_OUTREACH_REQUIRE_APPROVAL !== '0';

  for (const lead of leads) {
    const key = businessKey(lead) || lead.businessKey;
    if (!key) {
      stats.errors.push({ stage: 'business_key', error: 'no_business_key' });
      continue;
    }
    const ctx = { stage: 'unknown', businessKey: key, name: lead.businessName };

    try {
      // 1) Enrichment
      ctx.stage = 'enrichment';
      const enrichment = await enrichLead(lead, { anthropic, googleApiKey: process.env.GOOGLE_MAPS_API_KEY });
      if (enrichment) stats.enriched += 1;

      // 1a) Pattern-guess email when enrichment found an owner name + the lead
      // has a domain but no real email. MX-validated against the domain to
      // avoid shipping addresses to dead servers. Marked `pattern_guess_mx_only`
      // so QA stays aware the mailbox wasn't directly verified.
      //
      // Gate hard on ownerConfidence and isPersonName: business-name heuristics
      // can produce candidates like "Service Department" with confidence 0.5,
      // and pattern-guessing those would ship junk emails that hard-bounce
      // and damage Resend warmup. The guess is opt-in by quality, not by
      // existence of any string in ownerName.
      const hasRealEmail =
        Boolean(lead.email)
        || Boolean(enrichment?.email)
        || (Array.isArray(enrichment?.verifiedEmails) && enrichment.verifiedEmails.length > 0);
      const ownerForGuess = enrichment?.ownerName || lead.decisionMakerName || lead.ownerName || '';
      const ownerConfidenceForGuess = Number(
        enrichment?.ownerConfidence
        ?? enrichment?.decisionMakerConfidence
        ?? lead.decisionMakerConfidence
        ?? 0,
      );
      const domainForGuess = deriveBusinessDomain(lead.website || enrichment?.website || '');
      if (!hasRealEmail && ownerForGuess && domainForGuess) {
        try {
          const guess = await findEmail({
            ownerName: ownerForGuess,
            domain: domainForGuess,
            ownerConfidence: Number.isFinite(ownerConfidenceForGuess) ? ownerConfidenceForGuess : null,
          });
          if (guess?.ok && guess.email) {
            enrichment.guessedEmail = guess.email;
            enrichment.guessedEmailMethod = guess.method;
            enrichment.email = enrichment.email || guess.email;
            enrichment.emailProvenance = enrichment.emailProvenance || guess.method;
            stats.outreachSkipped.no_email_recovered = (stats.outreachSkipped.no_email_recovered || 0) + 1;
          } else if (guess?.reason) {
            // Surface the gate reason for observability without blocking
            // the lead from the rest of the demo+outreach flow.
            stats.errors.push({ stage: 'email_guess_skipped', businessKey: key, reason: guess.reason });
          }
        } catch (err) {
          // Pattern guess is best-effort; never block the lead on it.
          stats.errors.push({ stage: 'email_guess', businessKey: key, error: err.message });
        }
      }

      if (opts.storage?.attachEnrichment) {
        await opts.storage.attachEnrichment(key, {
          placeId: enrichment.placeId,
          enrichmentData: enrichment,
          existingSiteClone: enrichment.existingCopy ? { ...enrichment.existingCopy, brandColors: enrichment.brandColors, brandLogo: enrichment.brandLogo } : null,
        });
      }

      // 2) Site content
      ctx.stage = 'site_content';
      const content = await generateSiteContent(lead, enrichment, {
        anthropic,
        mode: lead.website ? 'souped-up' : 'fresh-build',
      });
      if (content) stats.contentGenerated += 1;

      // 3) Demo build
      ctx.stage = 'demo_build';
      const slugForLead = makeSlug(lead);
      const demo = await buildDemoForLead(lead, {
        enrichment,
        content: content || {},
        slug: slugForLead,
        siteBase: SITE_BASE,
      });
      if (!demo.ok) {
        stats.demosFailed += 1;
        stats.errors.push({ businessKey: key, stage: 'demo_build', reason: demo.reason, lint: demo.lint });
        continue;
      }

      const slug = slugForLead;
      const demoUrl = `${SITE_BASE}/demo/${slug}`;
      const demoPath = path.join(DEMOS_DIR, `${slug}.html`);

      // Persist HTML to disk for visual debug
      if (!opts.dryRun) {
        try {
          fs.writeFileSync(demoPath, demo.html, 'utf8');
        } catch (err) {
          stats.errors.push({ businessKey: key, stage: 'demo_write_file', error: err.message });
        }

        // Persist HTML to db for production serving
        if (sql) {
          try {
            await sql`
              INSERT INTO demo_pages (slug, html, source, created_at, updated_at)
              VALUES (${slug}, ${demo.html}, 'latchly-pipeline', NOW(), NOW())
              ON CONFLICT (slug) DO UPDATE SET
                html = EXCLUDED.html,
                source = EXCLUDED.source,
                updated_at = NOW()
            `;
          } catch (err) {
            // demo_pages may not exist or schema may differ — non-fatal
            stats.errors.push({ businessKey: key, stage: 'demo_pages_insert', error: err.message });
          }
        }

        if (opts.storage?.attachDemo) {
          await opts.storage.attachDemo(key, {
            demoSlug: slug,
            demoUrl,
            demoDirection: demo.direction,
            demoQualityScore: demo.qualityScore,
          });
        }
      }
      stats.demosBuilt += 1;

      // 4) Queue cold email (no send — cron drains)
      ctx.stage = 'queue';
      // Pull the freshest email + owner from the enrichment object before
      // queueing. queueDayZeroForLead bails on lead.email being empty, so a
      // pattern-guess we just resolved would otherwise be dropped on the
      // floor (the original lead row has the stale empty value).
      const resolvedEmail =
        lead.email
        || enrichment?.email
        || (Array.isArray(enrichment?.verifiedEmails) ? enrichment.verifiedEmails[0] : null)
        || '';
      const resolvedOwner = lead.decisionMakerName || enrichment?.ownerName || lead.ownerName || '';
      const queued = await queueDayZeroForLead(
        {
          ...lead,
          demoUrl,
          businessKey: key,
          outreachStatus: 'none',
          email: resolvedEmail,
          decisionMakerName: resolvedOwner,
          ownerName: resolvedOwner,
        },
        enrichment,
        {
          anthropic,
          storage: opts.storage,
          dryRun: opts.dryRun,
          fromEmail,
          siteBase: SITE_BASE,
          testEmail,
          testNow,
          requireApproval,
        },
      );

      if (queued.ok) {
        stats.outreachQueued += 1;
      } else if (stats.outreachSkipped[queued.reason] != null) {
        stats.outreachSkipped[queued.reason] += 1;
      } else {
        stats.outreachSkipped.other += 1;
        stats.errors.push({ businessKey: key, stage: 'queue', reason: queued.reason, error: queued.error });
      }

      if (opts.verbose) {
        console.log(`[demo-outreach] ${lead.businessName} → ${queued.ok ? 'queued ' + queued.scheduledFor : 'skipped ' + queued.reason}`);
      }
    } catch (err) {
      stats.errors.push({ businessKey: key, stage: ctx.stage, error: err?.message || String(err) });
      if (opts.verbose) console.error(`[demo-outreach] ${lead.businessName}: ${ctx.stage} failed:`, err);
    }
  }

  return stats;
}

function makeSlug(lead) {
  const raw = `${lead.businessName || 'business'}-${lead.city || ''}-${lead.state || ''}`;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

module.exports = { runDemoOutreachStage };
