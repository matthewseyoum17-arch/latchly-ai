#!/usr/bin/env node
/**
 * bootstrap.js — Safe first run that populates the DB with a small batch.
 *
 * Runs: Scout (10 leads) → Audit → Demo Builder in DRY_RUN mode,
 * then shows what would be sent. Populates the DB so crons have data.
 *
 * Usage:
 *   node scripts/bootstrap.js            # Scout + Audit + Demo (writes to DB, no emails)
 *   node scripts/bootstrap.js --live     # Same but also sends the first outreach batch
 */

const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// Load .env
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

const isLive = process.argv.includes('--live');

function header(msg) {
  console.log(`\n${'═'.repeat(56)}`);
  console.log(` ${msg}`);
  console.log(`${'═'.repeat(56)}\n`);
}

function run(label, script, env = {}) {
  console.log(`\n--- ${label} ---`);
  const result = spawnSync('node', [path.join(ROOT, script)], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    console.error(`\n${label} exited with code ${result.status}`);
    return false;
  }
  return true;
}

async function main() {
  header('LATCHLY BOOTSTRAP — First Run');

  // ── Preflight ─────────────────────────────────────────────────────────────
  console.log('Running preflight checks...\n');
  const preflight = spawnSync('node', [path.join(ROOT, 'scripts/preflight.js')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });

  // Check critical failures (missing API keys)
  const resendOk = process.env.RESEND_API_KEY && !/^YOUR_/i.test(process.env.RESEND_API_KEY);
  const dbOk = process.env.DATABASE_URL && !/^your_/i.test(process.env.DATABASE_URL);

  if (!dbOk) {
    console.error('\n❌ DATABASE_URL is required for bootstrap. Set it in .env and try again.');
    process.exit(1);
  }

  // ── Step 1: Scout (small batch) ───────────────────────────────────────────
  header('Step 1/4 — Scout (small batch: 10 leads)');

  const scoutOk = run('Scout', 'scripts/openclaw-scout.js', {
    SCOUT_MAX_TOTAL: '10',
    SCOUT_MAX_PER_NICHE: '5',
    SKIP_SITE_CHECK: 'true', // Fast mode — skip slow site fetches
  });

  if (!scoutOk) {
    console.error('Scout failed. Check the errors above.');
    process.exit(1);
  }

  // Check output
  const scoutedPath = path.join(ROOT, 'leads', 'openclaw', 'scouted.json');
  if (!fs.existsSync(scoutedPath)) {
    console.error('❌ No scouted.json produced. BBB/Yelp may be blocking requests.');
    process.exit(1);
  }
  const scouted = JSON.parse(fs.readFileSync(scoutedPath, 'utf8'));
  console.log(`\n✅ Scouted ${scouted.length} leads`);

  // ── Step 2: Audit ─────────────────────────────────────────────────────────
  header('Step 2/4 — Audit (score + enrich emails)');

  const auditOk = run('Audit', 'scripts/openclaw-audit.js', {
    AUDIT_MIN_SCORE: '6', // Lower threshold for bootstrap so we get some results
  });

  if (!auditOk) {
    console.error('Audit failed. Check the errors above.');
    process.exit(1);
  }

  const auditedPath = path.join(ROOT, 'leads', 'openclaw', 'audited.json');
  let auditedCount = 0;
  if (fs.existsSync(auditedPath)) {
    auditedCount = JSON.parse(fs.readFileSync(auditedPath, 'utf8')).length;
  }
  console.log(`\n✅ Audited: ${auditedCount} leads qualified (inserted into DB)`);

  // ── Step 3: Demo Builder ──────────────────────────────────────────────────
  header('Step 3/4 — Build Demo Pages');

  if (auditedCount > 0) {
    run('Demo Builder', 'scripts/openclaw-demo-builder.js');

    const demosDir = path.join(ROOT, 'demos', 'prospects');
    if (fs.existsSync(demosDir)) {
      const demos = fs.readdirSync(demosDir).filter(f => f.endsWith('.html') && f !== 'preview-index.html');
      console.log(`\n✅ ${demos.length} demo pages in demos/prospects/`);
    }
  } else {
    console.log('⚠️  No qualified leads — skipping demo build.');
  }

  // ── Step 4: Outreach preview ──────────────────────────────────────────────
  header('Step 4/4 — Outreach Preview');

  if (isLive && resendOk && auditedCount > 0) {
    console.log('🔴 LIVE MODE — sending first batch of outreach emails...\n');
    run('Outreach', 'scripts/openclaw-outreach.js', {
      MAX_EMAILS: '5', // Conservative first send
    });
  } else if (!isLive && auditedCount > 0) {
    console.log('Running in DRY_RUN mode (pass --live to actually send)...\n');
    run('Outreach (dry run)', 'scripts/openclaw-outreach.js', {
      DRY_RUN: 'true',
      MAX_EMAILS: '5',
    });
  } else if (!resendOk) {
    console.log('⚠️  RESEND_API_KEY not set — skipping outreach.');
    console.log('   Add your key to .env, then run: node scripts/openclaw-outreach.js');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  header('BOOTSTRAP COMPLETE');

  // Check DB state
  try {
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    const [{ c }] = await sql`SELECT COUNT(*) as c FROM prospects`;
    console.log(`📊 Prospects in DB: ${c}`);

    const [stats] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'audited') as audited,
        COUNT(*) FILTER (WHERE status = 'outreach') as outreach,
        COUNT(*) FILTER (WHERE email IS NOT NULL) as with_email
      FROM prospects
    `;
    console.log(`   Audited: ${stats.audited}`);
    console.log(`   In outreach: ${stats.outreach}`);
    console.log(`   With email: ${stats.with_email}`);
  } catch {}

  console.log('\n📋 Next steps:');
  if (!resendOk) {
    console.log('   1. Add RESEND_API_KEY to .env (get from resend.com/api-keys)');
    console.log('   2. Verify latchlyai.com domain in Resend dashboard');
  }
  if (!process.env.ANTHROPIC_API_KEY || /^YOUR_/i.test(process.env.ANTHROPIC_API_KEY)) {
    console.log('   3. Add ANTHROPIC_API_KEY to .env (for the Closer agent)');
  }
  console.log(`   ${resendOk ? '1' : '4'}. Deploy to Vercel with all env vars`);
  console.log(`   ${resendOk ? '2' : '5'}. Set up Resend webhook → https://latchlyai.com/api/email-webhook`);
  console.log(`   ${resendOk ? '3' : '6'}. Run again with --live to send first emails`);
  console.log('');
}

main().catch(err => {
  console.error('\n💥 Bootstrap fatal:', err.message);
  process.exit(1);
});
