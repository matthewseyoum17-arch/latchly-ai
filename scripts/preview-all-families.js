#!/usr/bin/env node
/**
 * Generate all 6 family demos for the same lead — for side-by-side comparison.
 * Usage: node scripts/preview-all-families.js
 */

const fs = require('fs');
const path = require('path');
const engine = require('./variation-engine');

const lead = {
  business_name: 'Comfort Zone HVAC',
  phone: '(512) 555-0183',
  city: 'Austin',
  state: 'TX',
  niche: 'HVAC contractor',
  email: 'info@comfortzonehvac.com',
};

const outDir = path.join(__dirname, '..', 'demos', 'preview');
fs.mkdirSync(outDir, { recursive: true });

const families = engine.listFamilies();

console.log(`\nGenerating ${families.length} family demos for: ${lead.business_name}\n`);

for (const { name } of families) {
  try {
    const result = engine.generate(lead, { family: name });
    const file = path.join(outDir, `${name}.html`);
    fs.writeFileSync(file, result.html);
    const size = (Buffer.byteLength(result.html) / 1024).toFixed(1);
    console.log(`  ✓ ${name.padEnd(12)} → ${size} KB  score: ${result.score}/100`);
    if (result.rubric.hardFails.length) {
      result.rubric.hardFails.forEach(msg => console.log(`    HARD FAIL: ${msg}`));
    }
  } catch (e) {
    console.log(`  ✗ ${name.padEnd(12)} — ERROR: ${e.message}`);
  }
}

console.log(`\nFiles written to: ${outDir}/`);
console.log('Serve with: npx serve demos/preview -p 3333\n');
