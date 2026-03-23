#!/usr/bin/env node
/**
 * daily-pipeline.js
 * Exact-profile SCO pipeline using a rolling verified inventory reservoir.
 *
 * Flow:
 *   1. Optional scrape raw leads
 *   2. Qualify strict exact-profile candidates
 *   3. Replenish durable inventory from newly-qualified rows
 *   4. Dispatch exactly 300 inventory-backed leads (100 each SCO) when available
 *   5. Email each SCO their assigned slice unless SKIP_EMAIL=1
 *
 * Safety thresholds:
 *   INVENTORY_MIN_DISPATCH (default 300)
 *   INVENTORY_LOW_WATER    (default 600)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

const LEADS_DIR = path.join(ROOT, 'leads');
const QUALIFIED_CSV = path.join(LEADS_DIR, 'qualified-leads.csv');
const DISPATCH_CSV = path.join(LEADS_DIR, 'latchly-clean-batch.csv');
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || process.env.INVENTORY_MIN_DISPATCH || '300', 10);

function run(label, command, args, env = {}, allowedExitCodes = [0]) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (!allowedExitCodes.includes(result.status)) {
    throw new Error(`${label} failed (exit ${result.status})`);
  }
  return result.status;
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
    return Math.max(0, lines.length - 1);
  } catch { return 0; }
}

async function main() {
  const startTime = Date.now();
  const runDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York',
  });
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(` LATCHLY DAILY INVENTORY PIPELINE — ${runDate}`);
  console.log(` Target: ${BATCH_SIZE} exact-profile leads from reservoir`);
  console.log('═══════════════════════════════════════════════════════');

  fs.mkdirSync(LEADS_DIR, { recursive: true });

  const rawCsv = path.join(LEADS_DIR, 'apollo-leads.csv');
  const skipScrape = process.env.SKIP_SCRAPE === '1';
  const apolloMode = process.env.APOLLO_MODE === 'cdp';
  const rawNeeded = BATCH_SIZE * 4;

  if (!skipScrape) {
    if (apolloMode) {
      try {
        run('Apollo scrape (live Chrome session)', 'node', ['scripts/apollo-scrape.js'], {
          APOLLO_OUTPUT: rawCsv,
          APOLLO_TARGET: String(rawNeeded),
        });
      } catch (err) {
        console.warn(`\n⚠️  Apollo CDP scrape failed: ${err.message}`);
        console.warn('Falling back to autonomous YP scraper.');
        run('Auto-scrape (YellowPages)', 'node', ['scripts/auto-scrape.js'], {
          APOLLO_OUTPUT: rawCsv,
          RAW_TARGET: String(rawNeeded),
          MASTER_CSV: QUALIFIED_CSV,
        });
      }
    } else {
      run('BBB lead scrape', 'node', ['scripts/source-leads.js'], {
        APOLLO_OUTPUT: rawCsv,
        RAW_TARGET: String(rawNeeded),
        MASTER_CSV: QUALIFIED_CSV,
      });
    }
  }

  const rawInput = exists(rawCsv) ? rawCsv : newestApolloCsv();
  if (!rawInput) {
    console.error('\n❌ No raw leads available. Run scrape/top-up first or place a CSV at leads/apollo-leads.csv');
    process.exit(1);
  }
  console.log(`\n✅ Using raw input: ${path.relative(ROOT, rawInput)} (${countCSVRows(rawInput)} rows)`);

  const qualifier = process.env.QUALIFIER || 'cdp';
  const qualifierScript = qualifier === 'cdp' ? 'scripts/qualify-via-cdp.js' : 'scripts/qualify-leads.js';
  run(`Qualify leads (${qualifier})`, 'node', [qualifierScript], { APOLLO_INPUT: rawInput });

  if (!exists(QUALIFIED_CSV)) {
    console.error('\n❌ Qualification did not produce leads/qualified-leads.csv');
    process.exit(1);
  }
  console.log(`\n✅ Qualified leads this run: ${countCSVRows(QUALIFIED_CSV)}`);

  run('Replenish exact-profile inventory', 'node', ['scripts/replenish-inventory.js'], {
    QUALIFIED_INPUT: QUALIFIED_CSV,
  });

  const dispatchExit = run('Dispatch from inventory reservoir', 'node', ['scripts/dispatch-inventory.js'], {
    DISPATCH_OUTPUT: DISPATCH_CSV,
  }, [0, 2]);

  if (dispatchExit === 2) {
    console.error('\n❌ Daily pipeline stopped: inventory reservoir is below the exact dispatch requirement.');
    process.exit(2);
  }

  if (!exists(DISPATCH_CSV)) {
    console.error('\n❌ Inventory dispatch did not produce leads/latchly-clean-batch.csv');
    process.exit(1);
  }

  if (process.env.SKIP_EMAIL === '1') {
    console.log('\n📧 SKIP_EMAIL=1 — skipping email dispatch (inventory-backed dry run)');
  } else {
    run('Email SCOs', 'node', ['scripts/email-setters.js'], {
      QUALIFIED_INPUT: DISPATCH_CSV,
      BATCH_SIZE: String(BATCH_SIZE),
    });
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(` ✅ PIPELINE COMPLETE — ${elapsed}s`);
  console.log(` ${countCSVRows(DISPATCH_CSV)} inventory-backed leads prepared for SCO dispatch`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
}

main().catch(err => {
  console.error('\n💥 Pipeline fatal error:', err.message);
  process.exit(1);
});
