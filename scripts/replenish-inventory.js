#!/usr/bin/env node
const path = require('path');
const {
  LEADS_DIR,
  INVENTORY_PATH,
  INVENTORY_HEADERS,
  readCSV,
  writeCSV,
  normalizeQualifiedRow,
  isExactProfile,
  identityKey,
  toInventoryRecord,
} = require('./inventory-utils');

const INPUT = process.env.QUALIFIED_INPUT || path.join(LEADS_DIR, 'qualified-leads.csv');
const REPORT_PATH = process.env.INVENTORY_REPLENISH_REPORT || path.join(LEADS_DIR, 'inventory-replenish-report.json');
const nowIso = new Date().toISOString();

if (!require('fs').existsSync(INPUT)) {
  console.error(`❌ Missing qualified input: ${INPUT}`);
  process.exit(1);
}

const inventoryRows = readCSV(INVENTORY_PATH);
const inventory = new Map(inventoryRows.map(row => [row.identity_key || identityKey({ businessName: row.business_name, website: row.website, phone: row.phone }), row]));
const sourceRows = readCSV(INPUT).map(normalizeQualifiedRow);

let scanned = 0;
let exactProfile = 0;
let inserted = 0;
let refreshed = 0;
let skipped = 0;

for (const row of sourceRows) {
  scanned++;
  if (!isExactProfile(row)) { skipped++; continue; }
  exactProfile++;
  const key = identityKey(row);
  const existing = inventory.get(key);
  if (!existing) {
    inventory.set(key, toInventoryRecord(row, nowIso));
    inserted++;
    continue;
  }

  existing.business_name = row.businessName;
  existing.niche = row.niche;
  existing.city = row.city;
  existing.state = row.state;
  existing.website = row.website;
  existing.decision_maker = row.decisionMaker;
  existing.title = row.title;
  existing.phone = row.phone;
  existing.email = row.email;
  existing.verified_no_chatbot = 'Yes';
  existing.no_chat_confidence = String(row.noChatConfidence);
  existing.redesign_need_score = String(row.redesignNeedScore);
  existing.buyer_quality_score = String(row.buyerQualityScore);
  existing.package_fit_score = String(row.packageFitScore);
  existing.overall_score = String(row.overallScore);
  existing.reachability = row.reachability;
  existing.marketing_signals = row.signals;
  existing.exact_redesign_problems = row.redesignProblems;
  existing.exact_lead_capture_gaps = row.leadCaptureGaps || row.missed;
  existing.why_it_fits = row.why;
  existing.source = row.source;
  existing.last_qualified_at = nowIso;
  if (!existing.first_qualified_at) existing.first_qualified_at = nowIso;
  if (!existing.inventory_status || existing.inventory_status === 'rejected') {
    existing.inventory_status = 'available';
    existing.available_at = nowIso;
    existing.status_reason = 're-qualified exact-profile';
  }
  refreshed++;
}

const mergedRows = Array.from(inventory.values())
  .sort((a, b) => (parseInt(b.overall_score || '0', 10) - parseInt(a.overall_score || '0', 10)) || String(a.business_name).localeCompare(String(b.business_name)));
writeCSV(INVENTORY_PATH, INVENTORY_HEADERS, mergedRows);

const available = mergedRows.filter(r => r.inventory_status === 'available').length;
const dispatched = mergedRows.filter(r => r.inventory_status === 'dispatched').length;
const report = { nowIso, input: INPUT, inventoryPath: INVENTORY_PATH, scanned, exactProfile, inserted, refreshed, skipped, totalInventory: mergedRows.length, available, dispatched };
require('fs').writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

console.log('═══════════════════════════════════════════════════════');
console.log(' INVENTORY REPLENISH COMPLETE');
console.log('═══════════════════════════════════════════════════════');
console.log(`Input rows scanned:       ${scanned}`);
console.log(`Exact-profile survivors:  ${exactProfile}`);
console.log(`Inserted new inventory:   ${inserted}`);
console.log(`Refreshed existing leads: ${refreshed}`);
console.log(`Skipped non-exact rows:   ${skipped}`);
console.log(`Inventory total:          ${mergedRows.length}`);
console.log(`Inventory available:      ${available}`);
console.log(`Inventory dispatched:     ${dispatched}`);
console.log(`📁 ${INVENTORY_PATH}`);
console.log(`📁 ${REPORT_PATH}`);
