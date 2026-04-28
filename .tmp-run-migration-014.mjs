import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const file = '/home/matthewseyoum17/leadpilot-ai/scripts/migrations/014-latchly-leads-crm.sql';
const text = readFileSync(file, 'utf8');

const stripped = text.replace(/--.*$/gm, '');
const parts = [];
let buf = '';
let inDollar = false;
let dollarTag = '';
for (let i = 0; i < stripped.length; i++) {
  const ch = stripped[i];
  buf += ch;
  if (!inDollar) {
    const m = stripped.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
    if (m) { inDollar = true; dollarTag = m[0]; buf += stripped.slice(i + 1, i + m[0].length); i += m[0].length - 1; continue; }
    if (ch === ';') { parts.push(buf.trim()); buf = ''; }
  } else {
    if (stripped.slice(i, i + dollarTag.length) === dollarTag) { inDollar = false; buf += stripped.slice(i + 1, i + dollarTag.length); i += dollarTag.length - 1; }
  }
}
if (buf.trim()) parts.push(buf.trim());

let n = 0;
for (const stmt of parts) {
  if (!stmt) continue;
  try {
    await sql.query(stmt);
    n++;
  } catch (err) {
    console.error('FAILED on statement', n + 1, ':', stmt.split('\n')[0]);
    console.error(err.message);
    process.exit(1);
  }
}
console.log(`Applied ${n} statements`);

const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'latchly_%' ORDER BY table_name`;
console.log('Latchly tables:', tables.map(r => r.table_name));
