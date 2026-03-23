#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEADS_DIR = path.join(ROOT, 'leads');
const OUTPUT = process.env.MERGED_OUTPUT || path.join(LEADS_DIR, 'qualified-leads.csv');
const inputs = (process.env.MERGE_INPUTS || process.argv.slice(2).join(','))
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function splitCSV(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
      continue;
    }
    if (ch === ',' && !q) {
      out.push(cur);
      cur = '';
      continue;
    }
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
    const values = splitCSV(line);
    const obj = {};
    headers.forEach((h, i) => obj[String(h || '').trim()] = String(values[i] || '').trim());
    return obj;
  });
}

function csvEscape(v) {
  const s = String(v || '').replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function get(row, keys) {
  for (const key of keys) {
    if (row[key]) return String(row[key]).trim();
  }
  return '';
}

function normalizeWebsite(url) {
  let s = String(url || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  return s.replace(/\/$/, '');
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return '';
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function countSignals(text) {
  return String(text || '').split(';').map(s => s.trim()).filter(Boolean).length;
}

function normalizeRow(row, sourceFile) {
  return {
    businessName: get(row, ['Business Name', 'Company', 'businessName']),
    niche: get(row, ['Niche', 'Industry', 'niche']) || 'Home Services',
    city: get(row, ['City', 'city']),
    state: get(row, ['State', 'state']),
    website: normalizeWebsite(get(row, ['Website', 'Company Website', 'website'])),
    decisionMaker: get(row, ['Decision Maker', 'Name', 'decisionMaker']),
    title: get(row, ['Title', 'title']),
    directPhone: normalizePhone(get(row, ['Direct Phone', 'Phone', 'directPhone'])),
    businessPhone: normalizePhone(get(row, ['Business Phone', 'Main Business Phone', 'businessPhone', 'main_business_phone', 'Phone'])),
    email: get(row, ['Email', 'email']).includes('not_unlocked') ? '' : get(row, ['Email', 'email']),
    linkedin: get(row, ['LinkedIn', 'linkedin']),
    chatbot: get(row, ['Chatbot?', 'Chatbot Present', 'chatbot']) || 'No',
    marketingSignals: get(row, ['Marketing Signals', 'marketing_signals']),
    missedLeadOpportunity: get(row, ['Missed-Lead Opportunity', 'missed_lead_opportunity']),
    fitScore: parseInt(get(row, ['Fit Score', 'fit_score']) || '0', 10) || 0,
    whyItFits: get(row, ['Why It Fits', 'Why It Fits LatchlyAI', 'why_it_fits_latchlyai']),
    source: get(row, ['Source', 'source']) || path.basename(sourceFile),
  };
}

function keep(row) {
  if (!row.businessName || !row.website) return false;
  if (!row.businessPhone && !row.directPhone) return false;
  if (row.fitScore < 8) return false;
  if (/yes|intercom|drift|tidio|tawk|crisp|livechat|podium|birdeye|hubspot/i.test(row.chatbot)) return false;
  return true;
}

function rank(row) {
  return [row.fitScore, countSignals(row.marketingSignals), row.decisionMaker ? 1 : 0, row.businessPhone ? 1 : 0].join('|');
}

if (!inputs.length) {
  console.error('Usage: node scripts/merge-qualified-sources.js file1.csv,file2.csv');
  process.exit(1);
}

const merged = new Map();
for (const input of inputs) {
  if (!fs.existsSync(input)) continue;
  const rows = parseCSV(fs.readFileSync(input, 'utf8')).map(row => normalizeRow(row, input)).filter(keep);
  for (const row of rows) {
    const key = `${row.businessName.toLowerCase()}|${row.website.toLowerCase()}`;
    const prev = merged.get(key);
    if (!prev || rank(row) > rank(prev)) merged.set(key, row);
  }
}

const finalRows = Array.from(merged.values()).sort((a, b) =>
  b.fitScore - a.fitScore ||
  countSignals(b.marketingSignals) - countSignals(a.marketingSignals) ||
  (b.decisionMaker ? 1 : 0) - (a.decisionMaker ? 1 : 0) ||
  a.businessName.localeCompare(b.businessName)
);

const headers = ['Business Name','Niche','City','State','Website','Decision Maker','Title','Direct Phone','Business Phone','Email','LinkedIn','Chatbot?','Marketing Signals','Missed-Lead Opportunity','Fit Score','Why It Fits','Source'];
const csv = [headers.join(',')].concat(finalRows.map(row => [
  row.businessName,row.niche,row.city,row.state,row.website,row.decisionMaker,row.title,row.directPhone,row.businessPhone,row.email,row.linkedin,row.chatbot,row.marketingSignals,row.missedLeadOpportunity,row.fitScore,row.whyItFits,row.source,
].map(csvEscape).join(','))).join('\n') + '\n';
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, csv);
console.log(`Merged ${finalRows.length} qualified leads into ${path.relative(ROOT, OUTPUT)}`);
