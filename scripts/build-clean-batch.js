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
const EXACT_PROFILE_MIN = {
  noChatConfidence: 8,
  redesign: 8,
  buyer: 7,
  packageFit: 8,
  overall40: 32,
  redesignProblems: 3,
  leadCaptureGaps: 3,
};

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
  const decisionMaker = get(row, ['Owner Name if public', 'Decision Maker', 'decisionMaker', 'person_name', 'Name']);
  const title = get(row, ['Title', 'title']);
  const phone = get(row, ['Main Business Phone', 'Business Phone', 'businessPhone', 'main_business_phone', 'Direct Phone', 'Direct Phone if available', 'Phone']);
  const niche = get(row, ['Niche', 'niche', 'Industry']) || 'Home Services';
  const city = get(row, ['City', 'city']);
  const state = get(row, ['State', 'state']);
  const chatbot = (get(row, ['Chatbot?', 'Site has chatbot/live chat', 'site_has_chatbot_or_live_chat']) || '').toLowerCase();
  const verifiedNoChatbot = get(row, ['Verified No Chatbot', 'verifiedNoChatbot']).toLowerCase();
  const noChatConfidence = parseInt(get(row, ['No-Chat Confidence', 'noChatConfidence']) || '0', 10) || 0;
  const redesignNeedScore = parseInt(get(row, ['Redesign Need Score', 'redesignNeedScore']) || '0', 10) || 0;
  const buyerQualityScore = parseInt(get(row, ['Buyer Quality Score', 'buyerQualityScore']) || '0', 10) || 0;
  const packageFitScore = parseInt(get(row, ['Package-Fit Score', 'packageFitScore']) || '0', 10) || 0;
  const overallScore = parseInt(get(row, ['Overall Score', 'overallScore', 'Fit Score', 'fit_score']) || '0', 10) || 0;
  const signals = get(row, ['Marketing Signals', 'marketing_signals']);
  const missed = get(row, ['Missed-Lead Opportunity', 'missed_lead_opportunity', 'Exact Lead-Capture Gaps']);
  const redesignProblems = get(row, ['Exact Redesign Problems', 'exactRedesignProblems']);
  const leadCaptureGaps = get(row, ['Exact Lead-Capture Gaps', 'exactLeadCaptureGaps']);
  const why = get(row, ['Why This Is A Strong Combo-Offer Lead', 'Why It Fits LatchlyAI', 'Why It Fits', 'why_it_fits_latchlyai']);
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
    verifiedNoChatbot,
    noChatConfidence,
    redesignNeedScore,
    buyerQualityScore,
    packageFitScore,
    overallScore,
    signals,
    missed,
    redesignProblems,
    leadCaptureGaps,
    why,
    fitScore: overallScore,
    reachability: inferReachability(title),
  };
}

function countListItems(value) {
  return String(value || '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .length;
}

function isKeep(row) {
  if (!row.businessName || !row.phone || !row.website) return false;
  if (row.verifiedNoChatbot !== 'yes') return false;
  if (row.noChatConfidence < EXACT_PROFILE_MIN.noChatConfidence) return false;
  if (row.redesignNeedScore < EXACT_PROFILE_MIN.redesign) return false;
  if (row.buyerQualityScore < EXACT_PROFILE_MIN.buyer) return false;
  if (row.packageFitScore < EXACT_PROFILE_MIN.packageFit) return false;
  if (row.overallScore < EXACT_PROFILE_MIN.overall40) return false;
  if (countListItems(row.redesignProblems) < EXACT_PROFILE_MIN.redesignProblems) return false;
  if (countListItems(row.leadCaptureGaps || row.missed) < EXACT_PROFILE_MIN.leadCaptureGaps) return false;
  const bad = /intercom|hubspot|birdeye|drift|tidio|tawk|crisp|livechat|podium|leadconnector|msgsndr|yes/i;
  if (bad.test(row.chatbot)) return false;
  return true;
}

function scoreTiebreak(row) {
  const signalCount = String(row.signals || '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean).length;
  return (row.packageFitScore || 0) + signalCount + (row.decisionMaker ? 1 : 0);
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
  .sort((a, b) => (
    b.redesignNeedScore - a.redesignNeedScore ||
    b.packageFitScore - a.packageFitScore ||
    b.fitScore - a.fitScore ||
    scoreTiebreak(b) - scoreTiebreak(a) ||
    a.businessName.localeCompare(b.businessName)
  ))
  .slice(0, TARGET);

const headers = [
  'Business Name','Niche','City','State','Website','Decision Maker','Title','Main Business Phone',
  'Verified No Chatbot','No-Chat Confidence','Redesign Need Score','Buyer Quality Score','Package-Fit Score','Overall Score',
  'Reachability','Marketing Signals','Exact Redesign Problems','Exact Lead-Capture Gaps','Why This Is A Strong Combo-Offer Lead'
];
const csvOut = [headers.join(',')].concat(finalRows.map(r => [
  r.businessName, r.niche, r.city, r.state, r.website, r.decisionMaker, r.title,
  r.phone, 'Yes', r.noChatConfidence, r.redesignNeedScore, r.buyerQualityScore, r.packageFitScore, r.overallScore,
  r.reachability, r.signals, r.redesignProblems, r.leadCaptureGaps, r.why,
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
  md.push(`- Verified no-chatbot: Yes (${r.noChatConfidence}/10 confidence)`);
  md.push(`- Redesign need: ${r.redesignNeedScore}/10`);
  md.push(`- Buyer quality: ${r.buyerQualityScore}/10`);
  md.push(`- Package fit: ${r.packageFitScore}/10`);
  md.push(`- Overall score: ${r.overallScore}/40`);
  if (r.signals) md.push(`- Marketing Signals: ${r.signals}`);
  if (r.redesignProblems) md.push(`- Exact redesign problems: ${r.redesignProblems}`);
  if (r.leadCaptureGaps) md.push(`- Exact lead-capture gaps: ${r.leadCaptureGaps}`);
  if (r.why) md.push(`- Why this is a strong combo-offer lead: ${r.why}`);
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
  `This run produced **${finalRows.length} clean leads** that passed the exact-profile gates: verified no-chatbot, no-chat confidence >= 8, redesign need >= 8, buyer quality >= 7, package-fit >= 8, and multiple visible redesign + lead-capture problems.`,
  '',
  `Top niches: ${topNiches || 'N/A'}`,
  '',
  '## Recommended outreach angle',
  '',
  'Lead with the combo offer: the business is legitimate enough to buy, the website clearly needs redesign help, and the current lead-capture path is weak enough that AI lead capture has a clean value story.',
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
  emailMd.push(`- Scores: redesign ${r.redesignNeedScore}/10 | buyer ${r.buyerQualityScore}/10 | package-fit ${r.packageFitScore}/10 | overall ${r.overallScore}/40`);
  if (r.signals) emailMd.push(`- Signals: ${r.signals}`);
  if (r.redesignProblems) emailMd.push(`- Redesign problems: ${r.redesignProblems}`);
  if (r.leadCaptureGaps) emailMd.push(`- Lead-capture gaps: ${r.leadCaptureGaps}`);
  if (r.why) emailMd.push(`- Combo reason: ${r.why}`);
  emailMd.push('');
});
fs.writeFileSync(OUTPUT_EMAIL_MD, emailMd.join('\n'));

const setterLines = [
  '# Latchly setter-ready lead sheet',
  '',
  `Generated ${generatedAt}`,
  '',
  'Use this as the call/texting queue. Prioritize owners / founders first, then the highest package-fit scores.',
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
  setterLines.push(`- Redesign need: ${r.redesignNeedScore}/10`);
  setterLines.push(`- Buyer quality: ${r.buyerQualityScore}/10`);
  setterLines.push(`- Package fit: ${r.packageFitScore}/10`);
  setterLines.push(`- Why now: ${r.leadCaptureGaps || r.missed || 'No instant engagement / after-hours capture gap'}`);
  setterLines.push(`- Proof of demand: ${r.signals || 'Website appears active'}`);
  setterLines.push(`- Combo reason: ${r.why}`);
  setterLines.push('');

  setterTxt.push([
    `${index + 1}. ${r.businessName}`,
    `Contact: ${r.decisionMaker || 'Needs lookup'}${r.title ? ` (${r.title})` : ''}`,
    `Phone: ${r.phone}`,
    `Location: ${r.city}, ${r.state}`,
    `Website: ${r.website}`,
    `Redesign need: ${r.redesignNeedScore}/10`,
    `Buyer quality: ${r.buyerQualityScore}/10`,
    `Package fit: ${r.packageFitScore}/10`,
    `Why now: ${r.leadCaptureGaps || r.missed || 'No instant engagement / after-hours capture gap'}`,
    `Proof of demand: ${r.signals || 'Website appears active'}`,
    `Combo reason: ${r.why}`,
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
