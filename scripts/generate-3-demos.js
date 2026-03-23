#!/usr/bin/env node
/**
 * Quick script to generate 3 sample demos across different niches.
 * Usage: SKIP_DB=true node scripts/generate-3-demos.js
 */

const path = require('path');
const fs   = require('fs');

// Force skip DB so we don't need a live connection
process.env.SKIP_DB = 'true';

// We need to pull in the demo builder's generate function.
// Since it's not exported, we'll replicate the flow inline using the same modules.

const config = require('./openclaw.config');
const { ROOT, DEMOS_DIR, TEMPLATES_DIR, SITE_BASE, BOOKING_LINK } = config;

const VARIANCE = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, 'variance.json'), 'utf8'));

// 3 fake leads — different niches, cities, with realistic report cards
const SAMPLE_LEADS = [
  {
    business_name: 'Comfort Zone HVAC',
    phone: '(512) 555-0183',
    city: 'Austin',
    state: 'TX',
    niche: 'HVAC contractor',
    website: 'http://comfortzonehvac-austin.com',
    report_card: {
      issues: [
        { key: 'no_mobile', label: 'No mobile viewport' },
        { key: 'no_phone_cta', label: 'No click-to-call' },
        { key: 'no_reviews', label: 'No reviews shown' },
      ]
    }
  },
  {
    business_name: 'FlowRight Plumbing',
    phone: '(904) 555-0247',
    city: 'Jacksonville',
    state: 'FL',
    niche: 'plumber',
    website: 'http://flowrightplumbing.net',
    report_card: {
      issues: [
        { key: 'thin_content', label: 'Thin content' },
        { key: 'no_form', label: 'No contact form' },
        { key: 'no_schema', label: 'No structured data' },
      ]
    }
  },
  {
    business_name: 'Summit Roofing Co',
    phone: '(303) 555-0391',
    city: 'Denver',
    state: 'CO',
    niche: 'roofing contractor',
    website: 'http://summitroofingdenver.com',
    report_card: {
      issues: [
        { key: 'table_layout', label: 'Table-based layout' },
        { key: 'no_https', label: 'No HTTPS' },
        { key: 'no_phone_cta', label: 'No click-to-call' },
      ]
    }
  },
];

// ── Pull in the demo builder's core functions by requiring the file and
//    extracting what we need. Since the file is a script (not a module that
//    exports generateDemo), we'll need to do a small workaround: read the
//    source and eval the functions we need, OR just run the pipeline with
//    a custom audited.json input.

// Simplest approach: write the leads to a temp audited.json and run the builder.
const tempInput = path.join(ROOT, 'leads', 'openclaw', '_sample-audited.json');
fs.mkdirSync(path.dirname(tempInput), { recursive: true });

// Add demo_slug to each lead
SAMPLE_LEADS.forEach(l => {
  l.demo_slug = [l.business_name, l.city, l.state]
    .filter(Boolean).join('-')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  l.combined_score = 9;
  l.chatbot_score = 2;
  l.redesign_score = 8;
});

fs.writeFileSync(tempInput, JSON.stringify(SAMPLE_LEADS, null, 2));

console.log('Wrote sample leads to', tempInput);
console.log('Running demo builder...\n');

// Now run the demo builder with this input
const { execSync } = require('child_process');
try {
  const out = execSync(
    `SKIP_DB=true node scripts/openclaw-demo-builder.js --input "${tempInput}"`,
    { cwd: ROOT, stdio: 'inherit', timeout: 30000 }
  );
} catch (e) {
  // Builder may exit with errors on DB skip, but HTML files still get written
}

// List generated files
console.log('\n--- Generated Demos ---');
SAMPLE_LEADS.forEach(l => {
  const file = path.join(DEMOS_DIR, `${l.demo_slug}.html`);
  if (fs.existsSync(file)) {
    const size = (fs.statSync(file).size / 1024).toFixed(1);
    console.log(`✓ ${l.business_name} (${l.niche}) → ${file} [${size} KB]`);
  } else {
    console.log(`✗ ${l.business_name} — file not generated`);
  }
});

// Cleanup temp file
fs.unlinkSync(tempInput);
