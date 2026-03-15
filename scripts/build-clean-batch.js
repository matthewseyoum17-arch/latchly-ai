#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEADS_DIR = path.join(ROOT, 'leads');
const QUALIFIED_INPUT = process.env.QUALIFIED_INPUT || path.join(LEADS_DIR, 'qualified-leads.csv');
const OUTPUT_CSV = path.join(LEADS_DIR, 'latchly-clean-batch.csv');
const OUTPUT_MD = path.join(LEADS_DIR, 'latchly-clean-batch.md');
const OUTPUT_EMAIL_MD = path.join(LEADS_DIR, 'latchly-email-ready.md');
const OUTPUT_SETTER_MD = path.join(LEADS_DIR, 'latchly-setter-ready.md');
const OUTPUT_SETTER_TXT = path.join(LEADS_DIR, 'latchly-setter-ready.txt');
const TARGET = parseInt(process.argv[2] || process.env.BATCH_SIZE || '25', 10);

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
      } else {
        q = !q;
      }
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
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCSV(lines[0]);
  return lines.slice(1).map(line => {
    const values = splitCSV(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[String(h || '').trim()] = String(values[i] || '').trim();
    });
    return obj;
  });
}

function csvEscape(v) {
  const s = String(v || '').replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function get(row, keys) {
  for (const k of keys) {
    if (row[k]) return row[k];
  }
  return '';
}

function normalizeWebsite(url) {
  let s = String(url || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  return s.replace(/\/$/, '');
}

function inferReachability(title) {
  const t = String(title || '').toLowerCase();
  if (/owner|founder|president|operator/.test(t)) return 'High';
  if (/ceo|general manager|managing partner|co-owner/.test(t)) return 'Medium-High';
  return 'Medium';
}

function normalizeRow(row) {
  const businessName = get(row, ['Business Name', 'Company', 'company', 'businessName']);
  const website = normalizeWebsite(get(row, ['Website', 'website', 'Company Website']));
  const decisionMaker = get(row, ['Decision Maker', 'decisionMaker', 'person_name', 'Name']);
  const title = get(row, ['Title', 'title']);
  const phone = get(row, ['Main Business Phone', 'Business Phone', 'businessPhone', 'main_business_phone', 'Direct Phone', 'Direct Phone if available', 'Phone']);
  const niche = get(row, ['Niche', 'niche', 'Industry']) || 'Home Services';
  const city = get(row, ['City', 'city']);
  const state = get(row, ['State', 'state']);
  const chatbot = (get(row, ['Chatbot?', 'Site has chatbot/live chat', 'site_has_chatbot_or_live_chat']) || '').toLowerCase();
  const signals = get(row, ['Marketing Signals', 'marketing_signals']);
  const missed = get(row, ['Missed-Lead Opportunity', 'missed_lead_opportunity']);
  const why = get(row, ['Why It Fits LatchlyAI', 'Why It Fits', 'why_it_fits_latchlyai']);
  const fitScore = parseInt(get(row, ['Fit Score', 'fit_score']) || '0', 10) || 0;
  return {
    businessName,
    niche,
    city,
    state,
    website,
    decisionMaker,
    title,
    phone,
    chatbot,
    signals,
    missed,
    why,
    fitScore,
    reachability: inferReachability(title),
  };
}

function isKeep(row) {
  if (!row.businessName || !row.phone || !row.website) return false;
  if (row.fitScore < 8) return false;
  if (row.chatbot && row.chatbot !== 'no' && row.chatbot !== 'no obvious chatbot seen') return false;
  const bad = /intercom|hubspot|birdeye|drift|tidio|tawk|crisp|livechat|yes/i;
  if (bad.test(row.chatbot)) return false;
  return true;
}

function scoreTiebreak(row) {
  const signalCount = String(row.signals || '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean).length;
  const dmBonus = row.decisionMaker ? 1 : 0;
  return signalCount + dmBonus;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

if (!fs.existsSync(QUALIFIED_INPUT)) {
  console.error(`Missing qualified input: ${QUALIFIED_INPUT}`);
  process.exit(1);
}

ensureDir(LEADS_DIR);
const rows = parseCSV(fs.readFileSync(QUALIFIED_INPUT, 'utf8'));
const merged = new Map();
for (const raw of rows) {
  const row = normalizeRow(raw);
  if (!isKeep(row)) continue;
  const key = `${row.businessName.toLowerCase()}|${row.website.toLowerCase()}`;
  const prev = merged.get(key);
  if (!prev) {
    merged.set(key, row);
    continue;
  }
  const better = row.fitScore > prev.fitScore || (row.fitScore === prev.fitScore && scoreTiebreak(row) > scoreTiebreak(prev));
  if (better) merged.set(key, row);
}

const finalRows = Array.from(merged.values())
  .sort((a, b) => b.fitScore - a.fitScore || scoreTiebreak(b) - scoreTiebreak(a) || a.businessName.localeCompare(b.businessName))
  .slice(0, TARGET);

const headers = ['Business Name','Niche','City','State','Website','Decision Maker','Title','Main Business Phone','Chatbot Present','Fit Score','Reachability','Marketing Signals','Missed-Lead Opportunity','Why It Fits'];
const csvOut = [headers.join(',')].concat(finalRows.map(r => [
  r.businessName, r.niche, r.city, r.state, r.website, r.decisionMaker, r.title,
  r.phone, r.chatbot || 'No', r.fitScore, r.reachability, r.signals, r.missed, r.why,
].map(csvEscape).join(','))).join('\n') + '\n';
fs.writeFileSync(OUTPUT_CSV, csvOut);

const generatedAt = new Date().toISOString();
const md = ['# Latchly clean batch', '', `Generated ${generatedAt}`, '', `Count: ${finalRows.length}`, ''];
for (const r of finalRows) {
  md.push(`## ${r.businessName}`);
  md.push(`- Niche: ${r.niche}`);
  md.push(`- Location: ${r.city}, ${r.state}`);
  md.push(`- Website: ${r.website}`);
  md.push(`- Decision Maker: ${r.decisionMaker || 'Needs lookup'}`);
  md.push(`- Title: ${r.title || 'Unknown'}`);
  md.push(`- Phone: ${r.phone}`);
  md.push(`- Chatbot: ${r.chatbot || 'No'}`);
  md.push(`- Fit Score: ${r.fitScore}`);
  if (r.signals) md.push(`- Marketing Signals: ${r.signals}`);
  if (r.missed) md.push(`- Missed-Lead Opportunity: ${r.missed}`);
  if (r.why) md.push(`- Why It Fits: ${r.why}`);
  md.push('');
}
fs.writeFileSync(OUTPUT_MD, md.join('\n'));

const nicheCounts = new Map();
for (const row of finalRows) nicheCounts.set(row.niche, (nicheCounts.get(row.niche) || 0) + 1);
const topNiches = Array.from(nicheCounts.entries()).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} (${c})`).join(', ');

const emailMd = [
  '# Latchly email-ready batch summary',
  '',
  `Generated ${generatedAt}`,
  '',
  `This run produced **${finalRows.length} clean leads** scored 8+ with a phone number, website, and no detected chatbot/live chat.`,
  '',
  `Top niches: ${topNiches || 'N/A'}`,
  '',
  '## Recommended outreach angle',
  '',
  'These businesses are already spending effort on marketing but still leave inbound demand exposed after hours and between callbacks. The pitch should stay simple: convert missed calls / form traffic / after-hours visitors into booked jobs without adding headcount.',
  '',
  '## Lead rollup',
  ''
];

finalRows.forEach((r, index) => {
  emailMd.push(`### ${index + 1}. ${r.businessName}`);
  emailMd.push(`- Contact: ${r.decisionMaker || 'Needs lookup'}${r.title ? ` — ${r.title}` : ''}`);
  emailMd.push(`- Location: ${r.city}, ${r.state}`);
  emailMd.push(`- Website: ${r.website}`);
  emailMd.push(`- Phone: ${r.phone}`);
  emailMd.push(`- Fit: ${r.fitScore}/10 | Reachability: ${r.reachability}`);
  if (r.signals) emailMd.push(`- Signals: ${r.signals}`);
  if (r.missed) emailMd.push(`- Opportunity: ${r.missed}`);
  emailMd.push('');
});
fs.writeFileSync(OUTPUT_EMAIL_MD, emailMd.join('\n'));

const setterLines = [
  '# Latchly setter-ready lead sheet',
  '',
  `Generated ${generatedAt}`,
  '',
  'Use this as the call/texting queue. Prioritize owners / founders first, then high marketing-signal shops.',
  ''
];
const setterTxt = [];
finalRows.forEach((r, index) => {
  setterLines.push(`## ${index + 1}. ${r.businessName}`);
  setterLines.push(`- Contact: ${r.decisionMaker || 'Needs lookup'}`);
  setterLines.push(`- Title: ${r.title || 'Unknown'}`);
  setterLines.push(`- Phone: ${r.phone}`);
  setterLines.push(`- Location: ${r.city}, ${r.state}`);
  setterLines.push(`- Website: ${r.website}`);
  setterLines.push(`- Why now: ${r.missed || 'No instant engagement / after-hours capture gap'}`);
  setterLines.push(`- Proof of demand: ${r.signals || 'Website appears active'}`);
  setterLines.push(`- Fit: ${r.fitScore}/10`);
  setterLines.push('');

  setterTxt.push([
    `${index + 1}. ${r.businessName}`,
    `Contact: ${r.decisionMaker || 'Needs lookup'}${r.title ? ` (${r.title})` : ''}`,
    `Phone: ${r.phone}`,
    `Location: ${r.city}, ${r.state}`,
    `Website: ${r.website}`,
    `Why now: ${r.missed || 'No instant engagement / after-hours capture gap'}`,
    `Proof of demand: ${r.signals || 'Website appears active'}`,
    `Fit: ${r.fitScore}/10`,
  ].join('\n'));
});
fs.writeFileSync(OUTPUT_SETTER_MD, setterLines.join('\n'));
fs.writeFileSync(OUTPUT_SETTER_TXT, setterTxt.join('\n\n---\n\n') + '\n');

console.log(`Wrote ${finalRows.length} leads`);
console.log(OUTPUT_CSV);
console.log(OUTPUT_MD);
console.log(OUTPUT_EMAIL_MD);
console.log(OUTPUT_SETTER_MD);
console.log(OUTPUT_SETTER_TXT);
