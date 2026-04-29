// One-shot migration: applies the in-code ALTER TABLE statements from
// scripts/latchly-leads/storage.js to the prod DB so the Next.js API
// route can SELECT place_id / demo_* / outreach_* columns even when the
// GitHub Actions pipeline (which would normally bootstrap them) hasn't
// run yet. Idempotent — every statement uses IF NOT EXISTS.
//
// Usage: node scripts/migrate-latchly-prod.js
// Reads DATABASE_URL_UNPOOLED → POSTGRES_URL_NON_POOLING → DATABASE_URL.

const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

// Minimal .env loader — no extra deps. Only sets vars that aren't already
// in process.env (so an explicit shell DATABASE_URL still wins).
try {
  const envPath = path.join(process.cwd(), '.vercel/.env.production.local');
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=("?)(.*?)\2\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[3];
  }
} catch {
  // No env file — fall back to whatever the shell provides.
}

const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!url) {
  console.error('No DATABASE_URL found. Run: vercel env pull .vercel/.env.production.local');
  process.exit(1);
}

const sql = neon(url);

const STATEMENTS = [
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS archive_reason TEXT`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'standard'`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS signal_count INT NOT NULL DEFAULT 0`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS place_id TEXT`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS enrichment_data JSONB`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS existing_site_clone JSONB`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS demo_slug TEXT`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS demo_url TEXT`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS demo_direction TEXT`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS demo_quality_score NUMERIC(4,1)`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS demo_built_at TIMESTAMP`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS outreach_step INT NOT NULL DEFAULT 0`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS outreach_status TEXT NOT NULL DEFAULT 'none'`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_subject TEXT`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_body TEXT`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_body_preview TEXT`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS outreach_queued_at TIMESTAMP`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS outreach_scheduled_for TIMESTAMP`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS last_resend_email_id TEXT`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS outreach_error TEXT`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_provenance TEXT`,
  `ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'unknown'`,
  `CREATE INDEX IF NOT EXISTS idx_latchly_leads_outreach_status ON latchly_leads (outreach_status)`,
  `CREATE INDEX IF NOT EXISTS idx_latchly_leads_outreach_due ON latchly_leads (outreach_status, outreach_scheduled_for)`,
  `CREATE INDEX IF NOT EXISTS idx_latchly_leads_place_id ON latchly_leads (place_id) WHERE place_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_latchly_leads_email_status ON latchly_leads (email_status)`,
];

(async () => {
  console.log(`Connected: ${url.split('@')[1]?.split('/')[0] || 'unknown host'}`);
  let ok = 0;
  for (const stmt of STATEMENTS) {
    try {
      await sql.query(stmt);
      ok += 1;
      const head = stmt.split('\n')[0].slice(0, 80);
      console.log(`  ✓ ${head}`);
    } catch (err) {
      console.error(`  ✗ ${stmt}`);
      console.error(`    ${err.message}`);
    }
  }
  console.log(`\nDone: ${ok}/${STATEMENTS.length}`);

  // Confirm the column the API was barking about is now present.
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'latchly_leads'
      AND column_name IN ('place_id', 'demo_url', 'outreach_status', 'email_subject')
    ORDER BY column_name`;
  console.log(`Verified columns: ${cols.map(r => r.column_name).join(', ') || 'NONE'}`);
})().catch(err => { console.error(err); process.exit(1); });
