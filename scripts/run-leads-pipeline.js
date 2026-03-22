#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const LEADS_DIR = path.join(ROOT, 'leads');
const BATCH_SIZE = process.env.BATCH_SIZE || process.argv[2] || '25';
const RAW_INPUT = process.env.APOLLO_RAW_INPUT || path.join(LEADS_DIR, 'apollo-leads.csv');
const QUALIFIED_OUTPUT = path.join(LEADS_DIR, 'qualified-leads.csv');
const CLEAN_OUTPUT = path.join(LEADS_DIR, 'latchly-clean-batch.csv');

function run(label, command, args, env = {}) {
  console.log(`\n=== ${label} ===`);
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function exists(p) {
  return fs.existsSync(p) && fs.statSync(p).size > 0;
}

function newestRawApolloCsv() {
  const candidates = fs.readdirSync(LEADS_DIR)
    .filter(name => /^apollo-leads.*\.csv$/i.test(name))
    .map(name => path.join(LEADS_DIR, name))
    .filter(full => exists(full))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return candidates[0] || null;
}

function printSummary() {
  console.log('\n=== Pipeline outputs ===');
  [
    path.join(LEADS_DIR, 'qualified-leads.csv'),
    path.join(LEADS_DIR, 'qualified-leads.json'),
    path.join(LEADS_DIR, 'latchly-clean-batch.csv'),
    path.join(LEADS_DIR, 'latchly-clean-batch.md'),
    path.join(LEADS_DIR, 'latchly-email-ready.md'),
    path.join(LEADS_DIR, 'latchly-setter-ready.md'),
    path.join(LEADS_DIR, 'latchly-setter-ready.txt'),
  ].forEach(file => {
    const rel = path.relative(ROOT, file);
    const ok = exists(file);
    console.log(`${ok ? '✅' : '⚠️ '} ${rel}`);
  });
}

function main() {
  fs.mkdirSync(LEADS_DIR, { recursive: true });

  const mode = process.env.APOLLO_MODE || 'auto';
  const skipScrape = process.env.SKIP_APOLLO_SCRAPE === '1';

  if (!skipScrape && (mode === 'auto' || mode === 'cdp')) {
    try {
      run('Apollo scrape via live Chrome session', 'node', ['scripts/apollo-scrape.js'], {
        APOLLO_OUTPUT: RAW_INPUT,
      });
    } catch (error) {
      console.warn(`\nApollo scrape did not complete cleanly: ${error.message}`);
      console.warn('Continuing with the freshest existing Apollo CSV on disk.');
    }
  }

  const fallbackRaw = exists(RAW_INPUT) ? RAW_INPUT : newestRawApolloCsv();
  if (!fallbackRaw) {
    console.error('No Apollo raw CSV found. Put a fresh export at leads/apollo-leads.csv or get the CDP scraper working.');
    process.exit(1);
  }

  console.log(`\nUsing Apollo input: ${path.relative(ROOT, fallbackRaw)}`);

  const qualifier = process.env.QUALIFIER || 'cdp';
  const qualifierScript = qualifier === 'cdp' ? 'scripts/qualify-via-cdp.js' : 'scripts/qualify-leads.js';
  run(`Qualify leads (${qualifier})`, 'node', [qualifierScript], {
    APOLLO_INPUT: fallbackRaw,
  });

  if (!exists(QUALIFIED_OUTPUT)) {
    console.error('Qualification step did not produce leads/qualified-leads.csv');
    process.exit(1);
  }

  run('Build clean batch + setter/email outputs', 'node', ['scripts/build-clean-batch.js', String(BATCH_SIZE)], {
    QUALIFIED_INPUT: QUALIFIED_OUTPUT,
    BATCH_SIZE: String(BATCH_SIZE),
  });

  if (!exists(CLEAN_OUTPUT)) {
    console.error('Clean batch step did not produce leads/latchly-clean-batch.csv');
    process.exit(1);
  }

  printSummary();
}

main();
