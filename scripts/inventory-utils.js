const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEADS_DIR = path.join(ROOT, 'leads');
const INVENTORY_PATH = process.env.EXACT_PROFILE_INVENTORY || path.join(LEADS_DIR, 'exact-profile-inventory.csv');

const EXACT_PROFILE_MIN = {
  noChatConfidence: 8,
  redesign: 8,
  buyer: 7,
  packageFit: 8,
  overall40: 32,
  redesignProblems: 3,
  leadCaptureGaps: 3,
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function splitCSV(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; }
      else { q = !q; }
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
    const row = {};
    headers.forEach((h, i) => { row[String(h || '').trim()] = String(values[i] || '').trim(); });
    return row;
  });
}

function readCSV(file) {
  if (!fs.existsSync(file)) return [];
  return parseCSV(fs.readFileSync(file, 'utf8'));
}

function csvEscape(value) {
  const s = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCSV(file, headers, rows) {
  ensureDir(path.dirname(file));
  const text = [headers.join(',')]
    .concat(rows.map(row => headers.map(h => csvEscape(row[h])).join(',')))
    .join('\n') + '\n';
  fs.writeFileSync(file, text, 'utf8');
}

function get(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function normalizeWebsite(url) {
  let s = String(url || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s.replace(/\/$/, '');
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : '';
}

function countListItems(value) {
  return String(value || '').split(';').map(s => s.trim()).filter(Boolean).length;
}

function inferReachability(title) {
  const t = String(title || '').toLowerCase();
  if (/owner|founder|president|operator/.test(t)) return 'High';
  if (/ceo|general manager|managing partner|co-owner/.test(t)) return 'Medium-High';
  return 'Medium';
}

function normalizeQualifiedRow(row) {
  const businessName = get(row, ['Business Name', 'Company', 'company', 'businessName']);
  const website = normalizeWebsite(get(row, ['Website', 'website', 'Company Website']));
  const decisionMaker = get(row, ['Owner Name if public', 'Decision Maker', 'decisionMaker', 'person_name', 'Name']);
  const title = get(row, ['Title', 'title']);
  const phone = normalizePhone(get(row, ['Main Business Phone', 'Business Phone', 'businessPhone', 'main_business_phone', 'Direct Phone', 'Direct Phone if available', 'Phone']));
  const niche = get(row, ['Niche', 'niche', 'Industry']) || 'Home Services';
  const city = get(row, ['City', 'city']);
  const state = get(row, ['State', 'state']);
  const chatbot = get(row, ['Chatbot?', 'Site has chatbot/live chat', 'site_has_chatbot_or_live_chat']).toLowerCase();
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
  const email = get(row, ['Email', 'email']);
  const source = get(row, ['Source', 'source']) || 'qualified';
  return {
    businessName,
    niche,
    city,
    state,
    website,
    decisionMaker,
    title,
    phone,
    email,
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
    source,
    fitScore: overallScore,
    reachability: inferReachability(title),
  };
}

function isExactProfile(row) {
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

function identityKey(row) {
  const websiteKey = normalizeWebsite(row.website).replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase();
  const phoneKey = normalizePhone(row.phone).replace(/\D/g, '');
  return [String(row.businessName || '').trim().toLowerCase(), websiteKey, phoneKey].join('|');
}

function leadId(row) {
  return Buffer.from(identityKey(row)).toString('base64').replace(/=+$/g, '').slice(0, 48);
}

const INVENTORY_HEADERS = [
  'lead_id','identity_key','business_name','niche','city','state','website','decision_maker','title','phone','email',
  'verified_no_chatbot','no_chat_confidence','redesign_need_score','buyer_quality_score','package_fit_score','overall_score',
  'reachability','marketing_signals','exact_redesign_problems','exact_lead_capture_gaps','why_it_fits','source',
  'first_qualified_at','last_qualified_at','inventory_status','status_reason','available_at','reserved_at','dispatched_at',
  'dispatch_count','last_dispatch_run_id','last_dispatch_date','last_dispatch_sco_name','last_dispatch_sco_email','dispatch_history_json'
];

function toInventoryRecord(row, nowIso) {
  return {
    lead_id: leadId(row),
    identity_key: identityKey(row),
    business_name: row.businessName,
    niche: row.niche,
    city: row.city,
    state: row.state,
    website: row.website,
    decision_maker: row.decisionMaker,
    title: row.title,
    phone: row.phone,
    email: row.email,
    verified_no_chatbot: 'Yes',
    no_chat_confidence: String(row.noChatConfidence || 0),
    redesign_need_score: String(row.redesignNeedScore || 0),
    buyer_quality_score: String(row.buyerQualityScore || 0),
    package_fit_score: String(row.packageFitScore || 0),
    overall_score: String(row.overallScore || 0),
    reachability: row.reachability,
    marketing_signals: row.signals,
    exact_redesign_problems: row.redesignProblems,
    exact_lead_capture_gaps: row.leadCaptureGaps || row.missed,
    why_it_fits: row.why,
    source: row.source,
    first_qualified_at: nowIso,
    last_qualified_at: nowIso,
    inventory_status: 'available',
    status_reason: 'exact-profile qualified',
    available_at: nowIso,
    reserved_at: '',
    dispatched_at: '',
    dispatch_count: '0',
    last_dispatch_run_id: '',
    last_dispatch_date: '',
    last_dispatch_sco_name: '',
    last_dispatch_sco_email: '',
    dispatch_history_json: '[]',
  };
}

function fromInventoryRecord(record) {
  return {
    businessName: record.business_name,
    niche: record.niche,
    city: record.city,
    state: record.state,
    website: record.website,
    decisionMaker: record.decision_maker,
    title: record.title,
    phone: record.phone,
    email: record.email,
    verifiedNoChatbot: String(record.verified_no_chatbot || '').toLowerCase(),
    noChatConfidence: parseInt(record.no_chat_confidence || '0', 10) || 0,
    redesignNeedScore: parseInt(record.redesign_need_score || '0', 10) || 0,
    buyerQualityScore: parseInt(record.buyer_quality_score || '0', 10) || 0,
    packageFitScore: parseInt(record.package_fit_score || '0', 10) || 0,
    overallScore: parseInt(record.overall_score || '0', 10) || 0,
    reachability: record.reachability,
    signals: record.marketing_signals,
    redesignProblems: record.exact_redesign_problems,
    leadCaptureGaps: record.exact_lead_capture_gaps,
    why: record.why_it_fits,
    chatbot: 'no',
    missed: record.exact_lead_capture_gaps,
  };
}

module.exports = {
  ROOT,
  LEADS_DIR,
  INVENTORY_PATH,
  EXACT_PROFILE_MIN,
  INVENTORY_HEADERS,
  splitCSV,
  parseCSV,
  readCSV,
  csvEscape,
  writeCSV,
  get,
  normalizeQualifiedRow,
  isExactProfile,
  identityKey,
  leadId,
  toInventoryRecord,
  fromInventoryRecord,
  ensureDir,
  countListItems,
};
