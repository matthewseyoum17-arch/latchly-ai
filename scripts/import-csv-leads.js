#!/usr/bin/env node
/**
 * import-csv-leads.js — Imports pre-qualified leads from CSV files into the prospects DB.
 *
 * Bypasses the broken BBB/Yelp scrapers by loading existing scored CSV data directly.
 * Handles dedup via ON CONFLICT on (business_name, city, state).
 *
 * Usage:
 *   node scripts/import-csv-leads.js                  # Import all CSVs
 *   node scripts/import-csv-leads.js --dry-run        # Preview without writing to DB
 */

const fs   = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

const ROOT = path.join(__dirname, '..');

// Load .env
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

const DRY_RUN = process.argv.includes('--dry-run');

// ── CSV parser (handles quoted fields with commas) ──────────────────────────

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

// ── Normalize a row from any CSV format into our prospect shape ─────────────

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return '';
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeRow(row, source) {
  // Map different CSV column names to our schema
  const biz = row['business name'] || row['company'] || row['name'] || '';
  const niche = row['niche'] || row['industry'] || '';
  const city = (row['city'] || row['city/state'] || '').replace(/,.*/, '').trim();
  const state = row['state'] || (row['city/state'] || '').replace(/.*,\s*/, '').trim();
  const website = row['website'] || row['company website'] || '';
  const owner = row['decision maker'] || row['owner name'] || row['name'] || '';
  const phone = normalizePhone(
    row['direct phone'] || row['main business phone'] || row['business phone'] || row['phone'] || ''
  );
  const email = row['email'] || '';
  const scoreRaw = row['fit score'] || row['score'] || '';
  const score = parseInt(scoreRaw, 10) || 0;
  const signals = row['marketing signals'] || '';
  const signalCount = signals ? signals.split(';').length : 0;

  if (!biz || !city || !state) return null;

  return {
    business_name: biz,
    niche: niche || 'home services',
    city,
    state: state.length === 2 ? state.toUpperCase() : state,
    website: website.startsWith('http') ? website : website ? `https://${website}` : '',
    owner_name: owner,
    phone,
    email,
    combined_score: score || 10,
    lead_type: 'package',
    status: score >= 9 ? 'audited' : 'scouted',
    demo_slug: slugify(`${biz}-${city}-${state}`),
    source,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  // Define CSV files to import in priority order
  const csvFiles = [
    { path: 'leads/qualified-leads.csv', source: 'qualified-leads' },
    { path: 'leads/latchly-qualified-leads.csv', source: 'latchly-qualified' },
    { path: 'leads/latchly-clean-batch.csv', source: 'latchly-clean-batch' },
    { path: 'leads/apollo-leads.csv', source: 'apollo' },
  ];

  const seen = new Set();
  let imported = 0;
  let skipped = 0;
  let dupes = 0;

  for (const file of csvFiles) {
    const fullPath = path.join(ROOT, file.path);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  ${file.path} not found, skipping`);
      continue;
    }

    const rows = parseCSV(fullPath);
    console.log(`\n📁 ${file.path}: ${rows.length} rows`);

    for (const row of rows) {
      const lead = normalizeRow(row, file.source);
      if (!lead) { skipped++; continue; }
      if (!lead.phone) { skipped++; continue; }

      // Dedup by business + city
      const key = `${lead.business_name.toLowerCase()}-${lead.city.toLowerCase()}-${lead.state.toLowerCase()}`;
      if (seen.has(key)) { dupes++; continue; }
      seen.add(key);

      if (DRY_RUN) {
        if (imported < 5) {
          console.log(`  [DRY] ${lead.business_name} | ${lead.city}, ${lead.state} | ${lead.phone} | score=${lead.combined_score}`);
        }
        imported++;
        continue;
      }

      try {
        // Try insert, handle demo_slug conflicts by appending suffix
        let slug = lead.demo_slug;
        let attempts = 0;
        while (attempts < 3) {
          try {
            await sql`
              INSERT INTO prospects (
                business_name, niche, city, state, website, owner_name,
                phone, email, combined_score, lead_type, status, demo_slug,
                outreach_step, closer_responses, escalated, unsubscribed, created_at, updated_at
              ) VALUES (
                ${lead.business_name}, ${lead.niche}, ${lead.city}, ${lead.state},
                ${lead.website}, ${lead.owner_name}, ${lead.phone}, ${lead.email || null},
                ${lead.combined_score}, ${lead.lead_type}, ${lead.status}, ${slug},
                0, 0, FALSE, FALSE, NOW(), NOW()
              )
              ON CONFLICT (business_name, city, state) DO UPDATE SET
                phone = COALESCE(NULLIF(prospects.phone, ''), EXCLUDED.phone),
                owner_name = COALESCE(NULLIF(prospects.owner_name, ''), EXCLUDED.owner_name),
                website = COALESCE(NULLIF(prospects.website, ''), EXCLUDED.website),
                combined_score = GREATEST(prospects.combined_score, EXCLUDED.combined_score),
                updated_at = NOW()
            `;
            break;
          } catch (innerErr) {
            if (innerErr.message.includes('uq_prospects_demo_slug')) {
              attempts++;
              slug = `${lead.demo_slug}-${attempts}`;
            } else {
              throw innerErr;
            }
          }
        }
        imported++;
      } catch (err) {
        if (err.message.includes('duplicate') || err.message.includes('unique')) {
          dupes++;
        } else {
          console.error(`  ✗ ${lead.business_name}: ${err.message}`);
          skipped++;
        }
      }
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(` ${DRY_RUN ? 'DRY RUN' : 'IMPORT'} COMPLETE`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Duplicates: ${dupes}`);
  console.log(`  Skipped: ${skipped}`);

  if (!DRY_RUN) {
    // Show DB state
    const [{ total }] = await sql`SELECT COUNT(*) as total FROM prospects`;
    const [stats] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'audited') as audited,
        COUNT(*) FILTER (WHERE status = 'scouted') as scouted,
        COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != '') as with_phone,
        COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '') as with_email,
        COUNT(*) FILTER (WHERE combined_score >= 9) as score_9_plus
      FROM prospects
    `;
    console.log(`\n📊 DB State:`);
    console.log(`  Total prospects: ${total}`);
    console.log(`  Audited: ${stats.audited}`);
    console.log(`  Scouted: ${stats.scouted}`);
    console.log(`  With phone: ${stats.with_phone}`);
    console.log(`  With email: ${stats.with_email}`);
    console.log(`  Score 9+: ${stats.score_9_plus}`);
  }
}

main().catch(err => {
  console.error('💥 Fatal:', err.message);
  process.exit(1);
});
