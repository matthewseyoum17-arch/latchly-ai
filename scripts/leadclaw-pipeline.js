#!/usr/bin/env node
/**
 * leadclaw-pipeline.js
 * Daily orchestrator for LeadClaw web design lead pipeline.
 *   1. Scrape raw leads from BBB (both website + no-website)
 *   2. Qualify into Bucket A (no site, 30) + Bucket B (bad site, 20)
 *   3. Email daily report to matthewseyoum17@gmail.com via AgentMail
 */

const fs = require('fs');
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

const LEADS_DIR = path.join(ROOT, 'leads', 'leadclaw');
const DAILY_DIR = path.join(LEADS_DIR, 'daily');
const QUALIFIED_CSV = path.join(LEADS_DIR, 'qualified.csv');
const DAILY_MD = path.join(LEADS_DIR, 'daily-leads.md');
const OWNER_EMAIL    = process.env.LEADCLAW_EMAIL || 'matthewseyoum8@icloud.com';
const OWNER_COUNT    = 90;

function run(label, command, args, env = {}) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status})`);
  }
}

function exists(p) {
  return fs.existsSync(p) && fs.statSync(p).size > 0;
}

function countCSVRows(file) {
  try {
    return Math.max(0, fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).length - 1);
  } catch { return 0; }
}

function splitCSV(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else { q = !q; }
      continue;
    }
    if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCSV(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCSV(lines[0]);
  return lines.slice(1).map(line => {
    const vals = splitCSV(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  });
}

function buildEmailHtml(leads, date) {
  function issueBadges(topIssues) {
    if (!topIssues) return '';
    return topIssues.split(';').map(i => i.trim()).filter(Boolean).map(issue => {
      let color = '#d97706';
      if (/mobile|viewport|responsive/i.test(issue))    color = '#dc2626';
      if (/Flash|IE conditional|jQuery 1|copyright.*201[0-9]|dead/i.test(issue)) color = '#7c3aed';
      if (/no.*form|no.*CTA|no.*call-to-action|dead end/i.test(issue)) color = '#0369a1';
      if (/trust|review|license|social proof/i.test(issue)) color = '#b45309';
      return `<span style="display:inline-block;margin:2px 3px;padding:2px 7px;background:${color}15;color:${color};border:1px solid ${color}40;border-radius:4px;font-size:11px;font-weight:600">${issue.length > 50 ? issue.slice(0, 47) + '…' : issue}</span>`;
    }).join('');
  }

  const rows = leads.map((l, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};border-bottom:1px solid #f1f5f9">
      <td style="padding:12px 10px;font-weight:600;color:#111;vertical-align:top">${i + 1}. ${l['Business Name']}<br><span style="font-weight:400;font-size:12px;color:#6b7280">${l.Niche}</span></td>
      <td style="padding:12px 10px;vertical-align:top">${l.City}, ${l.State}</td>
      <td style="padding:12px 10px;vertical-align:top"><a href="tel:${l.Phone}" style="color:#1a56db;font-weight:600">${l.Phone}</a><br><span style="font-size:12px;color:#6b7280">${l.Owner || 'Needs lookup'}</span></td>
      <td style="padding:12px 10px;vertical-align:top"><a href="${l.Website}" style="color:#6b7280;font-size:11px;word-break:break-all">${l.Website}</a></td>
      <td style="padding:12px 10px;vertical-align:top">${issueBadges(l['Top Issues'])}</td>
      <td style="padding:12px 10px;vertical-align:top;font-size:12px;color:#0369a1">${l['Pitch Angle'] || ''}</td>
      <td style="padding:12px 10px;vertical-align:top;font-size:12px;color:#065f46;font-style:italic">${l['Personalized Opening Angle'] || ''}</td>
      <td style="padding:12px 10px;text-align:center;font-weight:700;font-size:15px;color:#dc2626;vertical-align:top">${l.Score}/10</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:20px">
  <div style="max-width:1200px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#0f172a;padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:22px">LeadClaw — Bad Website Leads</h1>
      <p style="color:#94a3b8;margin:8px 0 0;font-size:14px">${date} &nbsp;|&nbsp; ${leads.length} home service businesses with sites that need a redesign</p>
    </div>
    <div style="background:#fef3c7;border-left:4px solid #d97706;padding:14px 32px">
      <p style="margin:0;font-size:13px;color:#92400e"><strong>These businesses have real budget</strong> (active BBB, years in business, high-ticket niches) but their websites are actively costing them customers. Easy pitch.</p>
    </div>
    <div style="padding:16px 32px 24px;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0">
            <th style="padding:10px;text-align:left">Business</th>
            <th style="padding:10px;text-align:left">Location</th>
            <th style="padding:10px;text-align:left">Phone / Owner</th>
            <th style="padding:10px;text-align:left">Current Site</th>
            <th style="padding:10px;text-align:left">What's Wrong</th>
            <th style="padding:10px;text-align:left">Pitch Angle</th>
            <th style="padding:10px;text-align:left">Opening Line</th>
            <th style="padding:10px;text-align:center">Score</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:12px;color:#64748b">LeadClaw | Web Design Lead Pipeline | Home Services | All leads sourced from public BBB data</p>
    </div>
  </div>
</body></html>`;
}

function buildEmailText(leads, date) {
  let text = `LEADCLAW DAILY REPORT — ${date}\n`;
  text += `${leads.length} Bad-Website Leads | Home Services | Redesign Prospects\n`;
  text += '='.repeat(60) + '\n\n';

  leads.forEach((l, i) => {
    text += `${i + 1}. ${l['Business Name']} (${l.Niche})\n`;
    text += `   Location: ${l.City}, ${l.State}\n`;
    text += `   Phone:    ${l.Phone}\n`;
    text += `   Owner:    ${l.Owner || 'Needs lookup'}\n`;
    text += `   Website:  ${l.Website}\n`;
    text += `   Issues:   ${l['Top Issues'] || l.Issues || ''}\n`;
    text += `   ${l['Pitch Angle'] || ''}\n`;
    text += `   Opener:   ${l['Personalized Opening Angle'] || ''}\n`;
    text += `   Score:    ${l.Score}/10\n\n`;
  });

  return text;
}

async function main() {
  const startTime = Date.now();
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/New_York',
  });

  console.log('');
  console.log('===================================================');
  console.log(` LEADCLAW DAILY PIPELINE — ${date}`);
  console.log(' Target: 90 bad-website leads (HVAC/Roofing/Plumbing/Electrical, score 9+) — 50 owner / 40 Mo');
  console.log('===================================================');

  fs.mkdirSync(LEADS_DIR, { recursive: true });
  fs.mkdirSync(DAILY_DIR, { recursive: true });

  // ── Step 1: Scrape ──────────────────────────────────────────────────────
  if (process.env.SKIP_SCRAPE !== '1') {
    run('LeadClaw source (BBB)', 'node', [path.join(__dirname, 'leadclaw-source.js')]);
  }

  const rawCsv = path.join(LEADS_DIR, 'raw.csv');
  if (!exists(rawCsv)) {
    console.error('\nNo raw leads available.');
    process.exit(1);
  }
  console.log(`\nRaw leads: ${countCSVRows(rawCsv)} rows`);

  // ── Step 2: Qualify ─────────────────────────────────────────────────────
  run('LeadClaw qualify', 'node', [path.join(__dirname, 'leadclaw-qualify.js')]);

  if (!exists(QUALIFIED_CSV)) {
    console.error('\nQualification produced no output.');
    process.exit(1);
  }

  const qualifiedCount = countCSVRows(QUALIFIED_CSV);
  console.log(`\nQualified leads: ${qualifiedCount}`);

  // ── Step 3: Archive ─────────────────────────────────────────────────────
  const archiveDate = new Date().toISOString().slice(0, 10);
  if (exists(QUALIFIED_CSV)) {
    fs.copyFileSync(QUALIFIED_CSV, path.join(DAILY_DIR, `${archiveDate}-qualified.csv`));
  }
  if (exists(DAILY_MD)) {
    fs.copyFileSync(DAILY_MD, path.join(DAILY_DIR, `${archiveDate}-report.md`));
  }

  // ── Step 4: Email ───────────────────────────────────────────────────────
  if (process.env.SKIP_EMAIL === '1') {
    console.log('\nSKIP_EMAIL=1 — skipping email dispatch (dry run)');
  } else {
    const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;
    const AGENTMAIL_INBOX_ID = process.env.AGENTMAIL_INBOX_ID;

    if (!AGENTMAIL_API_KEY || !AGENTMAIL_INBOX_ID) {
      console.error('\nAGENTMAIL_API_KEY or AGENTMAIL_INBOX_ID not set. Skipping email.');
    } else {
      const allLeads = parseCSV(fs.readFileSync(QUALIFIED_CSV, 'utf8'));
      const ownerBatch  = allLeads.slice(0, OWNER_COUNT);

      const { AgentMailClient } = require('agentmail');
      const client = new AgentMailClient({ apiKey: AGENTMAIL_API_KEY });

      if (ownerBatch.length > 0) {
        console.log(`\nSending ${ownerBatch.length} leads to ${OWNER_EMAIL}...`);
        try {
          await client.inboxes.messages.send(AGENTMAIL_INBOX_ID, {
            to: OWNER_EMAIL,
            subject: `LeadClaw Daily Report — ${date} — ${ownerBatch.length} Leads`,
            text: buildEmailText(ownerBatch, date),
            html: buildEmailHtml(ownerBatch, date),
          });
          console.log(`✅ Sent to ${OWNER_EMAIL}`);
        } catch (err) {
          console.error(`❌ Email failed: ${err.message}`);
        }
      }
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log('');
  console.log('===================================================');
  console.log(` LEADCLAW COMPLETE — ${elapsed}s`);
  console.log(` ${qualifiedCount} leads — 90 to ${OWNER_EMAIL}`);
  console.log('===================================================\n');
}

main().catch(err => {
  console.error('LeadClaw pipeline failed:', err.message);
  process.exit(1);
});
