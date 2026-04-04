#!/usr/bin/env node
/**
 * preflight.js — Pre-run validation for both pipelines.
 *
 * Checks every env var, API connection, DB schema, and config
 * before you try to run anything. Tells you exactly what's missing.
 *
 * Usage: node scripts/preflight.js
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

let pass = 0;
let fail = 0;
let warn = 0;

function ok(label) {
  console.log(`  ✅ ${label}`);
  pass++;
}

function bad(label, fix) {
  console.log(`  ❌ ${label}`);
  if (fix) console.log(`     → ${fix}`);
  fail++;
}

function warning(label, detail) {
  console.log(`  ⚠️  ${label}`);
  if (detail) console.log(`     → ${detail}`);
  warn++;
}

function isPlaceholder(val) {
  if (!val) return true;
  return /^(your_|YOUR_|placeholder|changeme|xxx)/i.test(val);
}

async function main() {
  console.log('\n══════════════════════════════════════════════════');
  console.log(' LATCHLY PIPELINE PREFLIGHT CHECK');
  console.log('══════════════════════════════════════════════════\n');

  // ── 1. Environment Variables ──────────────────────────────────────────────
  console.log('📋 Environment Variables\n');

  // Required
  const checks = [
    ['RESEND_API_KEY',     'Get from https://resend.com/api-keys'],
    ['ANTHROPIC_API_KEY',  'Get from https://console.anthropic.com/settings/keys'],
    ['DATABASE_URL',       'Get from Neon dashboard → Connection Details'],
    ['AGENTMAIL_API_KEY',  'Get from AgentMail dashboard'],
    ['AGENTMAIL_INBOX_ID', 'Get from AgentMail dashboard'],
    ['CRON_SECRET',        'Already generated in .env — copy to Vercel env vars'],
  ];

  for (const [key, fix] of checks) {
    const val = process.env[key];
    if (!val || isPlaceholder(val)) {
      bad(`${key} — not set`, fix);
    } else {
      ok(`${key}`);
    }
  }

  // Optional
  if (!process.env.NOTIFY_EMAIL) {
    warning('NOTIFY_EMAIL not set', 'Set NOTIFY_EMAIL in .env for notifications');
  }

  // ── 2. Database ───────────────────────────────────────────────────────────
  console.log('\n📦 Database\n');

  if (process.env.DATABASE_URL && !isPlaceholder(process.env.DATABASE_URL)) {
    try {
      const { neon } = require('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);

      // Check connection
      const [{ now }] = await sql`SELECT NOW() as now`;
      ok(`Connected to Neon (${now})`);

      // Check tables exist
      const tables = await sql`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `;
      const tableNames = tables.map(t => t.tablename);
      const required = ['prospects', 'demo_visits', 'demo_leads', 'pipeline_runs'];
      for (const t of required) {
        if (tableNames.includes(t)) {
          ok(`Table: ${t}`);
        } else {
          bad(`Table: ${t} — missing`, `Run: node -e "..." with migration SQL`);
        }
      }

      // Check key columns exist
      const cols = await sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'prospects'
      `;
      const colNames = cols.map(c => c.column_name);
      const requiredCols = ['opened_at', 'clicked_at', 'open_count', 'click_count'];
      const missingCols = requiredCols.filter(c => !colNames.includes(c));
      if (missingCols.length === 0) {
        ok('All migration columns present');
      } else {
        bad(`Missing columns: ${missingCols.join(', ')}`, 'Run pending migrations');
      }

      // Check prospect count
      const [{ c }] = await sql`SELECT COUNT(*) as c FROM prospects`;
      if (parseInt(c) === 0) {
        warning('Prospects table is empty', 'Run: node scripts/bootstrap.js to populate initial leads');
      } else {
        ok(`${c} prospects in DB`);
      }
    } catch (err) {
      bad(`Database connection failed: ${err.message}`);
    }
  } else {
    bad('DATABASE_URL not set — skipping DB checks');
  }

  // ── 3. API Connectivity ───────────────────────────────────────────────────
  console.log('\n🔌 API Connectivity\n');

  // Resend
  if (process.env.RESEND_API_KEY && !isPlaceholder(process.env.RESEND_API_KEY)) {
    try {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data } = await resend.domains.list();
      if (data?.data?.length > 0) {
        const verified = data.data.filter(d => d.status === 'verified');
        if (verified.length > 0) {
          ok(`Resend — ${verified.length} verified domain(s): ${verified.map(d => d.name).join(', ')}`);
        } else {
          warning('Resend — no verified domains', 'Verify latchlyai.com in Resend dashboard → Domains');
        }
      } else {
        warning('Resend — no domains configured', 'Add latchlyai.com in Resend dashboard → Domains');
      }
    } catch (err) {
      bad(`Resend API error: ${err.message}`, 'Check your RESEND_API_KEY');
    }
  } else {
    bad('Resend — key not set, skipping');
  }

  // AgentMail
  if (process.env.AGENTMAIL_API_KEY && !isPlaceholder(process.env.AGENTMAIL_API_KEY)) {
    try {
      const { AgentMailClient } = require('agentmail');
      const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
      const inbox = await client.inboxes.get(process.env.AGENTMAIL_INBOX_ID);
      ok(`AgentMail — inbox: ${inbox.email || process.env.AGENTMAIL_INBOX_ID}`);
    } catch (err) {
      warning(`AgentMail — ${err.message}`, 'Check AGENTMAIL_API_KEY and AGENTMAIL_INBOX_ID');
    }
  } else {
    bad('AgentMail — key not set, skipping');
  }

  // ── 4. File System ────────────────────────────────────────────────────────
  console.log('\n📁 Files & Directories\n');

  const dirs = [
    'leads/openclaw',
    'leads/daily',
    'demos/prospects',
  ];
  for (const d of dirs) {
    const full = path.join(ROOT, d);
    if (fs.existsSync(full)) {
      ok(d);
    } else {
      warning(`${d} — creating`, 'Will be created on first run');
      fs.mkdirSync(full, { recursive: true });
    }
  }

  // Check templates
  const templatesDir = path.join(ROOT, 'scripts', 'templates');
  if (fs.existsSync(templatesDir)) {
    const templateFiles = fs.readdirSync(templatesDir).filter(f => f.endsWith('.json'));
    ok(`Templates: ${templateFiles.length} files in scripts/templates/`);
  } else {
    bad('scripts/templates/ missing — demo builder won\'t work');
  }

  // ── 5. Vercel Config ─────────────────────────────────────────────────────
  console.log('\n☁️  Vercel Config\n');

  const vercelJson = path.join(ROOT, 'vercel.json');
  if (fs.existsSync(vercelJson)) {
    const config = JSON.parse(fs.readFileSync(vercelJson, 'utf8'));
    const crons = config.crons || [];
    ok(`vercel.json — ${crons.length} cron(s) configured`);
    crons.forEach(c => {
      console.log(`     ${c.schedule} → ${c.path}`);
    });
  } else {
    bad('vercel.json missing');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log(` RESULTS: ${pass} passed, ${fail} failed, ${warn} warnings`);
  console.log('══════════════════════════════════════════════════');

  if (fail === 0) {
    console.log('\n🚀 All clear — both pipelines are ready to run.\n');
  } else {
    console.log(`\n🔧 Fix the ${fail} failure(s) above before going live.\n`);
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Preflight fatal:', err);
  process.exit(1);
});
