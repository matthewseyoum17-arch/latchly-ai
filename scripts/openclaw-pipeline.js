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

const ROOT = path.join(__dirname, '..');

// Load .env
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

async function runPipeline() {
  const start = Date.now();
  const DRY_RUN = process.env.DRY_RUN === 'true';
  const results = {};

  console.log('═══════════════════════════════════════════');
  console.log('  OpenClaw Pipeline');
  console.log(`  ${new Date().toISOString()}`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('═══════════════════════════════════════════\n');

  // ── Step 1: Scout ──────────────────────────────────────────────────────────
  if (process.env.SKIP_SCOUT !== '1') {
    console.log('▶ Step 1: Scout (sourcing leads)...\n');
    try {
      const scout = require('./openclaw-scout');
      results.scout = await scout.main();
      console.log(`\n✓ Scout complete: ${results.scout?.length || 0} leads\n`);
    } catch (err) {
      console.error(`✗ Scout failed: ${err.message}\n`);
      results.scout = { error: err.message };
    }
  } else {
    console.log('▶ Step 1: Scout — SKIPPED\n');
  }

  // ── Step 2: Audit ──────────────────────────────────────────────────────────
  if (process.env.SKIP_AUDIT !== '1') {
    console.log('▶ Step 2: Audit (qualifying leads)...\n');
    try {
      const audit = require('./openclaw-audit');
      results.audit = await audit.main();
      console.log(`\n✓ Audit complete: ${results.audit?.length || 0} qualified\n`);
    } catch (err) {
      console.error(`✗ Audit failed: ${err.message}\n`);
      results.audit = { error: err.message };
    }
  } else {
    console.log('▶ Step 2: Audit — SKIPPED\n');
  }

  // ── Step 3: Demo Builder ───────────────────────────────────────────────────
  if (process.env.SKIP_DEMO !== '1') {
    console.log('▶ Step 3: Demo Builder (generating sites)...\n');
    try {
      const demo = require('./openclaw-demo-builder');
      results.demo = await demo.main();
      console.log(`\n✓ Demo Builder complete: ${results.demo?.length || 0} demos\n`);
    } catch (err) {
      console.error(`✗ Demo Builder failed: ${err.message}\n`);
      results.demo = { error: err.message };
    }
  } else {
    console.log('▶ Step 3: Demo Builder — SKIPPED\n');
  }

  // ── Step 4: Outreach ───────────────────────────────────────────────────────
  if (process.env.SKIP_OUTREACH !== '1') {
    console.log('▶ Step 4: Outreach (sending emails)...\n');
    try {
      const outreach = require('./openclaw-outreach');
      results.outreach = await outreach.main();
      console.log(`\n✓ Outreach complete: ${results.outreach?.length || 0} emails\n`);
    } catch (err) {
      console.error(`✗ Outreach failed: ${err.message}\n`);
      results.outreach = { error: err.message };
    }
  } else {
    console.log('▶ Step 4: Outreach — SKIPPED\n');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log('═══════════════════════════════════════════');
  console.log('  Pipeline Summary');
  console.log('═══════════════════════════════════════════');
  console.log(`  Duration: ${elapsed}s`);
  console.log(`  Scout:    ${Array.isArray(results.scout) ? results.scout.length + ' leads' : results.scout?.error || 'skipped'}`);
  console.log(`  Audit:    ${Array.isArray(results.audit) ? results.audit.length + ' qualified' : results.audit?.error || 'skipped'}`);
  console.log(`  Demo:     ${Array.isArray(results.demo) ? results.demo.length + ' built' : results.demo?.error || 'skipped'}`);
  console.log(`  Outreach: ${Array.isArray(results.outreach) ? results.outreach.length + ' sent' : results.outreach?.error || 'skipped'}`);
  console.log('═══════════════════════════════════════════\n');

  // Log results to file
  const logDir = path.join(ROOT, 'leads', 'openclaw');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  const logEntry = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry_run' : 'live',
    duration_s: parseFloat(elapsed),
    scout: Array.isArray(results.scout) ? results.scout.length : 0,
    audit: Array.isArray(results.audit) ? results.audit.length : 0,
    demo: Array.isArray(results.demo) ? results.demo.length : 0,
    outreach: Array.isArray(results.outreach) ? results.outreach.length : 0,
  };

  const logPath = path.join(logDir, 'pipeline-log.jsonl');
  fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n', 'utf8');

  return results;
}

if (require.main === module) {
  runPipeline().catch(err => {
    console.error('Pipeline failed:', err);
    process.exit(1);
  });
}

module.exports = { runPipeline };
