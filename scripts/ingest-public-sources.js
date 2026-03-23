#!/usr/bin/env node
// Build a normalized candidate CSV from public/manual source files.
// Pragmatic fallback when Apollo scrape/Brave sourcing isn't available.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INPUT_DIR = process.env.PUBLIC_SOURCE_DIR || path.join(ROOT, 'leads', 'public-sources');
const OUTPUT = process.env.PUBLIC_OUTPUT || path.join(ROOT, 'leads', 'public-candidates.csv');

function splitCSV(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
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
    headers.forEach((h, i) => obj[String(h || '').trim()] = String(vals[i] || '').trim());
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
  s = s.replace(/^@/, '');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  return s.replace(/\/$/, '');
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return '';
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function inferNiche(text) {
  const c = String(text || '').toLowerCase();
  if (/hvac|heating|cooling|air condition/.test(c)) return 'HVAC';
  if (/plumb|drain|sewer|rooter/.test(c)) return 'Plumbing';
  if (/roof/.test(c)) return 'Roofing';
  if (/electri/.test(c)) return 'Electrical';
  if (/garage door/.test(c)) return 'Garage Door';
  if (/pest|termite/.test(c)) return 'Pest Control';
  if (/foundation/.test(c)) return 'Foundation Repair';
  if (/tree/.test(c)) return 'Tree Service';
  if (/restoration|water damage/.test(c)) return 'Water Damage';
  return 'Home Services';
}

function normalizeRow(row, sourceFile) {
  const businessName = get(row, ['Business Name', 'Company', 'Name', 'business_name']);
  const website = normalizeWebsite(get(row, ['Website', 'URL', 'Domain', 'Company Website', 'website']));
  const phone = normalizePhone(get(row, ['Phone', 'Business Phone', 'Main Business Phone', 'phone']));
  const niche = get(row, ['Niche', 'Category', 'Industry', 'niche']) || inferNiche(`${businessName} ${website}`);
  const city = get(row, ['City', 'city']);
  const state = get(row, ['State', 'state']);
  const decisionMaker = get(row, ['Decision Maker', 'Owner', 'Contact', 'decision_maker']);
  const title = get(row, ['Title', 'title']) || (decisionMaker ? 'Owner/Manager' : '');
  const notes = get(row, ['Notes', 'Source Notes', 'notes']);
  const source = get(row, ['Source', 'source']) || path.basename(sourceFile);
  return { businessName, website, phone, niche, city, state, decisionMaker, title, notes, source };
}

function rowsFromTxt(text, sourceFile) {
  return String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    if (/^https?:\/\//i.test(line) || /^[\w.-]+\.[a-z]{2,}/i.test(line)) {
      const website = normalizeWebsite(line);
      const host = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      const base = host.split('.').slice(0, -1).join(' ') || host;
      const businessName = base.replace(/[-_]+/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
      return { businessName, website, phone: '', niche: inferNiche(base), city: '', state: '', decisionMaker: '', title: '', notes: '', source: path.basename(sourceFile) };
    }
    return null;
  }).filter(Boolean);
}

function loadRows(file) {
  const ext = path.extname(file).toLowerCase();
  const raw = fs.readFileSync(file, 'utf8');
  if (ext === '.json') {
    const data = JSON.parse(raw);
    const rows = Array.isArray(data) ? data : Array.isArray(data.rows) ? data.rows : [];
    return rows.map(row => normalizeRow(row, file));
  }
  if (ext === '.txt') return rowsFromTxt(raw, file);
  return parseCSV(raw).map(row => normalizeRow(row, file));
}

const headers = ['Company','Industry','City','State','Phone','Company Website','Name','Title','Email','LinkedIn','Source Notes','Source'];
const merged = new Map();
if (!fs.existsSync(INPUT_DIR)) fs.mkdirSync(INPUT_DIR, { recursive: true });
for (const name of fs.readdirSync(INPUT_DIR).sort()) {
  const file = path.join(INPUT_DIR, name);
  if (!fs.statSync(file).isFile()) continue;
  if (!/\.(csv|json|txt)$/i.test(name)) continue;
  for (const row of loadRows(file)) {
    if (!row.businessName || !row.website) continue;
    const key = `${row.businessName.toLowerCase()}|${row.website.toLowerCase()}`;
    if (!merged.has(key)) merged.set(key, row);
  }
}

const outRows = Array.from(merged.values()).sort((a, b) => a.businessName.localeCompare(b.businessName));
const csv = [headers.join(',')].concat(outRows.map(row => [
  row.businessName,row.niche,row.city,row.state,row.phone,row.website,row.decisionMaker,row.title,'','',row.notes,row.source,
].map(csvEscape).join(','))).join('\n') + '\n';
fs.writeFileSync(OUTPUT, csv);
console.log(`Wrote ${outRows.length} public candidates to ${path.relative(ROOT, OUTPUT)}`);
