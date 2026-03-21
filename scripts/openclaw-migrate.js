#!/usr/bin/env node
/**
 * openclaw-migrate.js
 * Runs database migrations for the OpenClaw prospects table.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

async function run() {
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    console.log(`\n--- Running migration: ${file} ---`);
    const migration = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    // Split on semicolons and run each statement
    const statements = migration.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      console.log(`  Running: ${stmt.slice(0, 60)}...`);
      await sql.query(stmt);
    }
    console.log(`  Done: ${file}`);
  }

  console.log('\nAll migrations complete');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
