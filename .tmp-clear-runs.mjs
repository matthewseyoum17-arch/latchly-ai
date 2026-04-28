import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const before = await sql`SELECT COUNT(*)::int AS n FROM latchly_lead_runs`;
const removed = await sql`DELETE FROM latchly_lead_runs WHERE dry_run = true RETURNING id`;
const after = await sql`SELECT COUNT(*)::int AS n FROM latchly_lead_runs`;
console.log(JSON.stringify({ before: before[0].n, deleted: removed.length, after: after[0].n }));
