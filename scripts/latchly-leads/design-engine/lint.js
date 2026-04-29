/**
 * design-engine/lint.js
 *
 * Quality gate for generated demo HTML. Runs:
 *   1. `npx impeccable detect --stdin` if available (anti-AI-slop heuristics)
 *   2. Custom checks that the runtime *must* enforce regardless of impeccable
 */

const { spawn } = require('child_process');

const CUSTOM_BANNED = [
  'lorem ipsum',
  '[review here]',
  '[hero headline]',
  '[business name]',
  'placeholder',
  'font-family: inter', // backup check (impeccable also catches this in CSS)
];

async function lintDemoHtml(html, { lead = {}, enrichment = {} } = {}) {
  const issues = [];
  let score = 100;

  // Custom: banned tokens
  const lowered = html.toLowerCase();
  for (const token of CUSTOM_BANNED) {
    if (lowered.includes(token)) {
      issues.push({ rule: `banned_token:${token}`, severity: 'major' });
      score -= 12;
    }
  }

  // Custom: businessName must appear
  if (lead.businessName && !lowered.includes(String(lead.businessName).toLowerCase())) {
    issues.push({ rule: 'missing_business_name', severity: 'critical' });
    score -= 20;
  }

  // Custom: city OR a verified service must appear in hero region
  const heroSection = (html.match(/<header class="hero">[\s\S]*?<\/header>/i) || [''])[0].toLowerCase();
  const cityHit = lead.city && heroSection.includes(String(lead.city).toLowerCase());
  const serviceHit = (enrichment.servicesVerified || []).some(s =>
    heroSection.includes(String(s).toLowerCase()),
  );
  if (!cityHit && !serviceHit) {
    issues.push({ rule: 'hero_lacks_city_or_service', severity: 'major' });
    score -= 10;
  }

  // Custom: at least one review section if reviews are present in enrichment
  if ((enrichment.reviews || []).length && !/section[^>]*id="reviews"/i.test(html)) {
    issues.push({ rule: 'reviews_section_missing', severity: 'minor' });
    score -= 5;
  }

  // Custom: phone link must be present if lead has a phone
  if (lead.phone && !/href="tel:[+\d]/i.test(html)) {
    issues.push({ rule: 'missing_phone_link', severity: 'major' });
    score -= 10;
  }

  // Optional: impeccable detect (if installed). Failures are non-fatal.
  const impec = await tryImpeccable(html).catch(() => null);
  if (impec && Array.isArray(impec.findings)) {
    for (const f of impec.findings) {
      issues.push({ rule: `impeccable:${f.rule || f.id || 'unknown'}`, severity: f.severity || 'minor' });
      const weight = f.severity === 'critical' ? 12 : f.severity === 'major' ? 6 : 3;
      score -= weight;
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    impeccableRan: Boolean(impec),
  };
}

async function tryImpeccable(html) {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn('npx', ['--yes', 'impeccable', 'detect', '--stdin', '--json'], {
        timeout: 8000,
      });
    } catch {
      return resolve(null);
    }
    let out = '';
    let err = '';
    proc.stdout?.on('data', d => { out += d.toString(); });
    proc.stderr?.on('data', d => { err += d.toString(); });
    proc.on('error', () => resolve(null));
    proc.on('close', (code) => {
      if (code !== 0 || !out.trim()) return resolve(null);
      try {
        resolve(JSON.parse(out));
      } catch {
        resolve(null);
      }
    });
    proc.stdin?.write(html);
    proc.stdin?.end();
  });
}

module.exports = { lintDemoHtml };
