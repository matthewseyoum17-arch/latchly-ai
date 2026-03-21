#!/usr/bin/env node
/**
 * Variation Engine CLI — Generate demos using the new engine.
 *
 * Usage:
 *   node scripts/variation-engine/generate.js                     # from audited.json
 *   node scripts/variation-engine/generate.js --input file.json
 *   node scripts/variation-engine/generate.js --preview           # all 6 families for first lead
 *   node scripts/variation-engine/generate.js --family emergency  # force a family
 *   DRY_RUN=true node scripts/variation-engine/generate.js
 */

const fs = require('fs');
const path = require('path');
const engine = require('./index');
const { makeSlug } = require('./shared/utils');

const ROOT = path.join(__dirname, '..', '..');
const DEMOS_DIR = path.join(ROOT, 'demos', 'prospects');
const DRY_RUN = process.env.DRY_RUN === 'true';
const SITE_BASE = process.env.SITE_BASE || 'https://latchlyai.com';

// Load .env
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

function main() {
  const args = process.argv.slice(2);
  const isPreview = args.includes('--preview');
  const forcedFamily = args.includes('--family') ? args[args.indexOf('--family') + 1] : null;

  const inputFile = args.includes('--input')
    ? args[args.indexOf('--input') + 1]
    : path.join(ROOT, 'leads', 'openclaw', 'audited.json');

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  const leads = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  console.log(`Loaded ${leads.length} leads`);

  if (!fs.existsSync(DEMOS_DIR)) fs.mkdirSync(DEMOS_DIR, { recursive: true });

  let built = 0;

  if (isPreview) {
    // Generate all 6 families for the first lead
    const lead = leads[0];
    if (!lead) { console.error('No leads found'); process.exit(1); }

    console.log(`\nPreview mode: generating all 6 families for "${lead.business_name}"\n`);
    const families = engine.listFamilies();

    for (const fam of families) {
      const slug = makeSlug(lead.business_name, lead.city, lead.state) + '-' + fam.name;
      const { html } = engine.generate(lead, { family: fam.name });
      const outPath = path.join(DEMOS_DIR, `${slug}.html`);

      if (DRY_RUN) {
        console.log(`  [DRY] ${fam.name.padEnd(12)} → ${slug}`);
      } else {
        fs.writeFileSync(outPath, html, 'utf8');
        console.log(`  ✓ ${fam.label.padEnd(30)} → /demo/${slug}`);
      }
      built++;
    }

    // Generate preview index page
    if (!DRY_RUN) {
      const previewHtml = generatePreviewPage(lead, families);
      const previewPath = path.join(DEMOS_DIR, 'preview-index.html');
      fs.writeFileSync(previewPath, previewHtml, 'utf8');
      console.log(`\n  ✓ Preview index → /demo/preview-index`);
    }
  } else {
    // Normal mode: one demo per lead
    for (const lead of leads) {
      if (!lead.business_name) continue;

      const slug = lead.demo_slug || makeSlug(lead.business_name, lead.city, lead.state);
      lead.demo_slug = slug;
      lead.demo_url = `${SITE_BASE}/demo/${slug}`;

      const opts = forcedFamily ? { family: forcedFamily } : {};
      const { html, family } = engine.generate(lead, opts);
      const outPath = path.join(DEMOS_DIR, `${slug}.html`);

      if (DRY_RUN) {
        console.log(`  [DRY] ${lead.business_name} → ${family}`);
      } else {
        fs.writeFileSync(outPath, html, 'utf8');
        console.log(`  ✓ ${lead.business_name.padEnd(30)} → ${family.padEnd(12)} → /demo/${slug}`);
      }
      built++;
    }

    if (!DRY_RUN) {
      fs.writeFileSync(inputFile, JSON.stringify(leads, null, 2), 'utf8');
    }
  }

  console.log(`\nDone: ${built} demos ${DRY_RUN ? '(dry run)' : 'built'}`);
}

function generatePreviewPage(lead, families) {
  const biz = lead.business_name;
  const slug = makeSlug(lead.business_name, lead.city, lead.state);

  const frames = families.map(f => `
    <div class="preview-card">
      <div class="preview-header">
        <span class="family-badge">${f.name}</span>
        <span class="family-label">${f.label}</span>
        <a href="/demo/${slug}-${f.name}" target="_blank" class="open-btn">Open Full ↗</a>
      </div>
      <iframe src="/demo/${slug}-${f.name}" class="preview-frame"></iframe>
    </div>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Variation Engine Preview — ${biz}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #fff; padding: 32px; }
h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
.subtitle { color: #888; margin-bottom: 32px; font-size: 15px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(500px, 1fr)); gap: 24px; }
.preview-card { background: #151515; border: 1px solid #252525; border-radius: 12px; overflow: hidden; }
.preview-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #252525; }
.family-badge { background: #2563eb; color: #fff; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
.family-label { flex: 1; font-size: 14px; color: #aaa; }
.open-btn { color: #60a5fa; text-decoration: none; font-size: 13px; font-weight: 600; }
.open-btn:hover { text-decoration: underline; }
.preview-frame { width: 100%; height: 600px; border: none; background: #fff; }
</style>
</head>
<body>
<h1>Variation Engine Preview</h1>
<p class="subtitle">6 design families for ${biz} — ${lead.city}, ${lead.state} — ${lead.niche || 'hvac'}</p>
<div class="grid">
${frames}
</div>
</body>
</html>`;
}

main();
