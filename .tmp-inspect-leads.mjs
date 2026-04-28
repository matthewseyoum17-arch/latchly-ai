import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

const runs = await sql`SELECT id, run_date, target_count, delivered_count, local_count, rejected_count, dry_run, email_sent, created_at, under_target_reason FROM latchly_lead_runs ORDER BY created_at DESC LIMIT 10`;
console.log('latchly_lead_runs (latest 10):');
for (const r of runs) console.log(JSON.stringify(r));

const leadsTotal = await sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE archived_at IS NULL)::int AS active FROM latchly_leads`;
console.log('\nlatchly_leads counts:', JSON.stringify(leadsTotal[0]));

const sample = await sql`SELECT id, business_name, niche, city, state, score, status, archived_at, delivered_at FROM latchly_leads ORDER BY id DESC LIMIT 5`;
console.log('\nlatchly_leads sample (latest 5):');
for (const r of sample) console.log(JSON.stringify(r));
