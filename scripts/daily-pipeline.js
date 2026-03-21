#!/usr/bin/env node
/**
 * daily-pipeline.js
 * Runs the full automated daily lead pipeline:
 *   1. Scrape raw leads from BBB (curl-based, no browser)
 *   2. Qualify + dedupe against master list (website check, chatbot detection, fit scoring)
 *   3. Build clean batch of BATCH_SIZE leads
 *   4. Email each setter their slice via AgentMail (4 setters × 50 leads)
 *
 * Env vars required:
 *   AGENTMAIL_API_KEY
 *   AGENTMAIL_INBOX_ID
 *
 * Optional:
 *   BATCH_SIZE           (default 200)
 *   APOLLO_MODE          (set to "cdp" to use Apollo CDP scraper instead of auto-scrape)
 *   SKIP_SCRAPE          (set to "1" to skip all scraping, use newest existing CSV)
 *   SKIP_EMAIL           (set to "1" to skip email dispatch — dry run)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// Load .env if present
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}
const LEADS_DIR = path.join(ROOT, 'leads');
const DAILY_DIR = path.join(LEADS_DIR, 'daily');
const MASTER_CSV = path.join(LEADS_DIR, 'qualified-leads.csv');
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100', 10);

// ── Helpers ──────────────────────────────────────────────────────────────────

function run(label, command, args, env = {}) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status})`);
  }
}

function exists(p) {
  return fs.existsSync(p) && fs.statSync(p).size > 0;
}

function newestApolloCsv() {
  try {
    return fs.readdirSync(LEADS_DIR)
      .filter(n => /^apollo-leads.*\.csv$/i.test(n))
      .map(n => path.join(LEADS_DIR, n))
      .filter(exists)
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
  } catch { return null; }
}

function countCSVRows(file) {
  try {
    const text = fs.readFileSync(file, 'utf8').trim();
    const lines = text.split(/\r?\n/).filter(Boolean);
    return Math.max(0, lines.length - 1); // subtract header
  } catch { return 0; }
}

function archiveToDaily(label) {
  const date = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(DAILY_DIR, { recursive: true });
  const dest = path.join(DAILY_DIR, `${date}-${label}`);
  if (exists(MASTER_CSV)) {
    fs.copyFileSync(MASTER_CSV, dest);
    console.log(`📁 Archived to ${path.relative(ROOT, dest)}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  const runDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/New_York',
  });

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(` LATCHLY DAILY LEAD PIPELINE — ${runDate}`);
  console.log(` Target: ${BATCH_SIZE} qualified leads → 4 setters`);
  console.log('═══════════════════════════════════════════════════════');

  fs.mkdirSync(LEADS_DIR, { recursive: true });

  // ── Step 1: Scrape raw leads ──────────────────────────────────────────────
  const rawCsv = path.join(LEADS_DIR, 'apollo-leads.csv');
  const skipScrape = process.env.SKIP_SCRAPE === '1';
  const apolloMode = process.env.APOLLO_MODE === 'cdp';
  const rawNeeded = BATCH_SIZE * 3; // ~600 raw to qualify 200

  if (!skipScrape) {
    if (apolloMode) {
      // CDP mode: requires Chrome open with Apollo logged in
      try {
        run('Apollo scrape (live Chrome session)', 'node', ['scripts/apollo-scrape.js'], {
          APOLLO_OUTPUT: rawCsv,
          APOLLO_TARGET: String(rawNeeded),
        });
      } catch (err) {
        console.warn(`\n⚠️  Apollo CDP scrape failed: ${err.message}`);
        console.warn('Falling back to autonomous YP scraper.');
        try {
          run('Auto-scrape (YellowPages)', 'node', ['scripts/auto-scrape.js'], {
            APOLLO_OUTPUT: rawCsv,
            RAW_TARGET: String(rawNeeded),
            MASTER_CSV: MASTER_CSV,
          });
        } catch (e2) {
          console.warn(`⚠️  Auto-scrape also failed: ${e2.message}`);
        }
      }
    } else {
      // Default: BBB curl-based scraper (no browser needed)
      run('BBB lead scrape', 'node', ['scripts/source-leads.js'], {
        APOLLO_OUTPUT: rawCsv,
        RAW_TARGET: String(rawNeeded),
        MASTER_CSV: MASTER_CSV,
      });
    }
  }

  let rawInput = exists(rawCsv) ? rawCsv : newestApolloCsv();
  if (!rawInput) {
    console.error('\n❌ No raw leads available. Run auto-scrape or place a CSV at leads/apollo-leads.csv');
    process.exit(1);
  }

  console.log(`\n✅ Using raw input: ${path.relative(ROOT, rawInput)} (${countCSVRows(rawInput)} rows)`);

  // ── Step 3: Qualify ───────────────────────────────────────────────────────
  const qualifier = process.env.QUALIFIER || 'playwright';
  const qualifierScript = qualifier === 'cdp' ? 'scripts/qualify-via-cdp.js' : 'scripts/qualify-leads.js';

  run(`Qualify leads (${qualifier})`, 'node', [qualifierScript], {
    APOLLO_INPUT: rawInput,
  });

  if (!exists(MASTER_CSV)) {
    console.error('\n❌ Qualification did not produce leads/qualified-leads.csv');
    process.exit(1);
  }

  const qualifiedRows = countCSVRows(MASTER_CSV);
  console.log(`\n✅ Qualified leads: ${qualifiedRows}`);

  if (qualifiedRows < 10) {
    console.error(`❌ Only ${qualifiedRows} qualified leads — too few to dispatch. Pipeline aborted.`);
    process.exit(1);
  }

  // ── Step 4: Build clean batch ─────────────────────────────────────────────
  run('Build clean batch', 'node', ['scripts/build-clean-batch.js', String(BATCH_SIZE)], {
    QUALIFIED_INPUT: MASTER_CSV,
    BATCH_SIZE: String(BATCH_SIZE),
  });

  // ── Step 5: Archive today's batch ─────────────────────────────────────────
  archiveToDaily('qualified-leads.csv');

  // ── Step 6: Email setters ─────────────────────────────────────────────────
  const cleanBatchCsv = path.join(LEADS_DIR, 'latchly-clean-batch.csv');
  const emailInput = exists(cleanBatchCsv) ? cleanBatchCsv : MASTER_CSV;

  if (process.env.SKIP_EMAIL === '1') {
    console.log('\n📧 SKIP_EMAIL=1 — skipping email dispatch (dry run)');
  } else {
    run('Email setters', 'node', ['scripts/email-setters.js'], {
      QUALIFIED_INPUT: emailInput,
      BATCH_SIZE: String(BATCH_SIZE),
    });
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(` ✅ PIPELINE COMPLETE — ${elapsed}s`);
  console.log(` ${qualifiedRows} qualified → ${Math.min(qualifiedRows, BATCH_SIZE)} dispatched to 4 setters`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
}

main().catch(err => {
  console.error('\n💥 Pipeline fatal error:', err.message);
  process.exit(1);
});
