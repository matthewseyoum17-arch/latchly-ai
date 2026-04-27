#!/usr/bin/env node
const { neon } = require('@neondatabase/serverless');
const { loadEnv } = require('./utils');

const ARCHIVE_REASON = 'Archived bad seed-only CRM import: uniform 8.6 scores, all has_website, no local/no-site mix';

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const expectedCount = parseInt(process.env.LATCHLY_BAD_IMPORT_EXPECTED || '50', 10);
  const execute = process.argv.includes('--execute') || process.env.LATCHLY_ARCHIVE_BAD_IMPORT_EXECUTE === '1';
  const sql = neon(process.env.DATABASE_URL);

  await sql`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`;
  await sql`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS archive_reason TEXT`;

  const where = `
    archived_at IS NULL
    AND source_name = 'seed-list'
    AND website_status = 'has_website'
    AND score = 8.6
    AND is_local_market = false
    AND website IS NOT NULL
    AND website <> ''
    AND (
      source_payload #>> '{meta,date}' = '2026-04-26'
      OR source_payload #>> '{meta,stats,date}' = '2026-04-26'
    )`;

  const [match] = await sql.query(
    `SELECT COUNT(*)::int AS count FROM latchly_leads WHERE ${where}`,
  );

  if (Number(match.count) !== expectedCount) {
    throw new Error(`Archive safety check failed: expected ${expectedCount} rows, matched ${match.count}`);
  }

  if (!execute) {
    console.log(JSON.stringify({
      dryRun: true,
      matched: Number(match.count),
      executeWith: 'npm run leads:funnel:archive-bad-import -- --execute',
    }, null, 2));
    return;
  }

  const archived = await sql.query(
    `UPDATE latchly_leads
     SET archived_at = NOW(), archive_reason = $1, updated_at = NOW()
     WHERE ${where}
     RETURNING id`,
    [ARCHIVE_REASON],
  );

  await sql.query(
    `INSERT INTO latchly_lead_activities (lead_id, activity_type, note, payload)
     SELECT id, 'archived', $1, $2::jsonb
     FROM latchly_leads
     WHERE archive_reason = $1
       AND archived_at IS NOT NULL`,
    [ARCHIVE_REASON, JSON.stringify({ reason: ARCHIVE_REASON, matched: archived.length })],
  );

  console.log(JSON.stringify({
    dryRun: false,
    archived: archived.length,
    reason: ARCHIVE_REASON,
  }, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
