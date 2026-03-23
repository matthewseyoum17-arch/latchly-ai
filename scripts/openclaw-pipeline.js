#!/usr/bin/env node
/**
 * openclaw-pipeline.js  (Master Orchestrator)
 *
 * Runs the full OpenClaw pipeline:
 *   Scout → Audit → Demo Builder → Outreach
 *
 * Each agent can be skipped via env vars:
 *   SKIP_SCOUT=1  SKIP_AUDIT=1  SKIP_DEMO=1  SKIP_OUTREACH=1
 *
 * Usage:
 *   node scripts/openclaw-pipeline.js                  # Full pipeline
 *   SKIP_SCOUT=1 node scripts/openclaw-pipeline.js     # Skip sourcing, use existing leads
 *   DRY_RUN=true node scripts/openclaw-pipeline.js     # Preview without sending/writing
 *
 * Cron: 0 6 * * *  (daily at 6 AM)
 */

const fs   = require('fs');
const path = require('path');
const config = require('./openclaw.config');
const { createLogger } = require('./openclaw-logger');

const log = createLogger('pipeline');
const { ROOT } = config;

// ── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Check if another pipeline run is already in progress.
 * Prevents double-processing when cron overlaps.
 */
async function checkOverlap() {
  if (!process.env.DATABASE_URL) return false;
  try {
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    // If a run started in the last 30 min and has no duration (still running), skip
    const [row] = await sql`
      SELECT id FROM pipeline_runs
      WHERE agent = 'openclaw'
        AND created_at > NOW() - INTERVAL '30 minutes'
        AND duration_ms IS NULL
      LIMIT 1`;
    return !!row;
  } catch {
    return false; // If we can't check, proceed anyway
  }
}

async function runPipeline() {
  const start = Date.now();
  const DRY_RUN = process.env.DRY_RUN === 'true';
  const results = {};

  // Guard against overlapping runs
  if (!DRY_RUN && await checkOverlap()) {
    log.warn('overlap_detected', { detail: 'Another pipeline run is in progress — skipping' });
    return { skipped: true, reason: 'overlap' };
  }

  log.startRun({ mode: DRY_RUN ? 'dry_run' : 'live' });

  // ── Step 1: Scout ──────────────────────────────────────────────────────────
  if (process.env.SKIP_SCOUT !== '1') {
    log.info('step_start', { step: 'scout' });
    try {
      const scout = require('./openclaw-scout');
      results.scout = await scout.main();
      log.info('step_complete', { step: 'scout', count: results.scout?.length || 0 });
    } catch (err) {
      log.catch('step_failed', err, { step: 'scout' });
      results.scout = { error: err.message };
    }
  } else {
    log.info('step_skipped', { step: 'scout' });
  }

  // ── Step 2: Audit ──────────────────────────────────────────────────────────
  if (process.env.SKIP_AUDIT !== '1') {
    log.info('step_start', { step: 'audit' });
    try {
      const audit = require('./openclaw-audit');
      results.audit = await audit.main();
      log.info('step_complete', { step: 'audit', count: results.audit?.length || 0 });
    } catch (err) {
      log.catch('step_failed', err, { step: 'audit' });
      results.audit = { error: err.message };
    }
  } else {
    log.info('step_skipped', { step: 'audit' });
  }

  // ── Step 3: Demo Builder ───────────────────────────────────────────────────
  if (process.env.SKIP_DEMO !== '1') {
    log.info('step_start', { step: 'demo-builder' });
    try {
      const demo = require('./openclaw-demo-builder');
      results.demo = await demo.main();
      log.info('step_complete', { step: 'demo-builder', count: results.demo?.length || 0 });
    } catch (err) {
      log.catch('step_failed', err, { step: 'demo-builder' });
      results.demo = { error: err.message };
    }
  } else {
    log.info('step_skipped', { step: 'demo-builder' });
  }

  // ── Step 4: Outreach ───────────────────────────────────────────────────────
  if (process.env.SKIP_OUTREACH !== '1') {
    log.info('step_start', { step: 'outreach' });
    try {
      const outreach = require('./openclaw-outreach');
      results.outreach = await outreach.main();
      log.info('step_complete', { step: 'outreach', count: results.outreach?.length || 0 });
    } catch (err) {
      log.catch('step_failed', err, { step: 'outreach' });
      results.outreach = { error: err.message };
    }
  } else {
    log.info('step_skipped', { step: 'outreach' });
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const summary = {
    duration_s: parseFloat(elapsed),
    scout: Array.isArray(results.scout) ? results.scout.length : 0,
    audit: Array.isArray(results.audit) ? results.audit.length : 0,
    demo: Array.isArray(results.demo) ? results.demo.length : 0,
    outreach: Array.isArray(results.outreach) ? results.outreach.length : 0,
  };

  log.endRun(summary);

  // Also write to pipeline-log.jsonl for historical tracking
  const logDir = path.join(ROOT, 'leads', 'openclaw');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  const logEntry = { timestamp: new Date().toISOString(), mode: DRY_RUN ? 'dry_run' : 'live', ...summary };
  const logPath = path.join(logDir, 'pipeline-log.jsonl');
  fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n', 'utf8');

  // Log to DB for dashboard visibility
  if (!DRY_RUN && process.env.DATABASE_URL) {
    try {
      const { neon } = require('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);
      const errorCount = Object.values(results).filter(v => v?.error).length;
      await sql`INSERT INTO pipeline_runs
        (agent, scouted, audited, demos_built, emails_sent, errors, duration_ms, metadata)
        VALUES ('openclaw', ${summary.scout}, ${summary.audit}, ${summary.demo},
                ${summary.outreach}, ${errorCount}, ${Math.round(summary.duration_s * 1000)},
                ${JSON.stringify(logEntry)}::jsonb)`;
      log.info('pipeline_run_logged_to_db');
    } catch (err) {
      log.catch('db_log_failed', err);
    }
  }

  // Send daily summary email to Matt
  if (!DRY_RUN && process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'YOUR_RESEND_KEY_HERE') {
    try {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const notifyEmail = config.NOTIFY_EMAIL;

      const date = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const errors = Object.entries(results)
        .filter(([, v]) => v?.error)
        .map(([k, v]) => `${k}: ${v.error}`)
        .join('\n');

      await resend.emails.send({
        from: `Latchly Pipeline <notifications@latchlyai.com>`,
        to: notifyEmail,
        subject: `Pipeline ${date}: ${summary.outreach} sent, ${summary.scout} scouted`,
        text: `OpenClaw Daily Summary — ${date}

Scouted:  ${summary.scout} new leads
Audited:  ${summary.audit} qualified
Demos:    ${summary.demo} built
Emails:   ${summary.outreach} sent
Duration: ${summary.duration_s}s
${errors ? '\nErrors:\n' + errors : ''}
Check the admin dashboard for details.`,
      });

      log.info('summary_email_sent', { to: notifyEmail });
    } catch (err) {
      log.catch('summary_email_failed', err);
    }
  }

  return results;
}

if (require.main === module) {
  runPipeline().catch(err => {
    log.catch('fatal', err);
    process.exit(1);
  });
}

module.exports = { runPipeline };
