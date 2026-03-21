#!/usr/bin/env node
/**
 * Variation Engine Rubric System
 *
 * 1) Structural similarity audit between design families
 * 2) Generated demo quality scoring on a 100-point scale
 *
 * Usage:
 *   node scripts/variation-engine/rubric.js                      # family similarity audit
 *   node scripts/variation-engine/rubric.js --generated          # generated demo audit for first lead
 */

const fs = require('fs');
const path = require('path');
const { detectNiche, normalizeText } = require('./shared/utils');
const { nicheContent } = require('./shared/copy');

// ── FAMILY DESIGN DNA ────────────────────────────────────────────────────────

const familyDNA = {
  luxury: {
    layout: 'single-column-editorial',
    hero: 'centered-text-no-image',
    typography: 'playfair-display+dm-sans',
    sectionOrder: 'hero|philosophy|services|testimonial|contact|footer',
    components: 'borderless-cards|pill-btn|pullquote-testimonial|text-stats|no-icons',
    personality: 'quiet-confident-premium-restrained',
    ctaStrategy: 'consultation-low-pressure',
    colorScheme: 'light-cream-gold-minimal',
    density: 'very-airy',
    navStyle: 'minimal-centered',
  },
  trust: {
    layout: 'multi-column-traditional',
    hero: 'split-image-right-text-left',
    typography: 'lora+source-sans-3',
    sectionOrder: 'hero|trust-badges|alternating-services|team|testimonials|faq|contact|footer',
    components: 'rounded-warm-cards|rounded-btn|grid-testimonials|badge-stats|icon-heavy',
    personality: 'warm-community-family-trustworthy',
    ctaStrategy: 'call-us-phone-forward',
    colorScheme: 'warm-cream-navy-teal',
    density: 'comfortable',
    navStyle: 'traditional-3zone',
  },
  emergency: {
    layout: 'dense-conversion-split-form',
    hero: 'split-text-left-form-right',
    typography: 'barlow-condensed+roboto',
    sectionOrder: 'sticky-nav|emergency-bar|hero-form|badges|services|reviews|faq|sticky-bottom',
    components: 'sharp-cards|large-bold-btn|strip-testimonials|bold-stats|urgent-badges',
    personality: 'urgent-direct-conversion-focused',
    ctaStrategy: 'emergency-call-now-immediate',
    colorScheme: 'dark-black-red-orange',
    density: 'very-tight',
    navStyle: 'sticky-phone-visible',
  },
  modern: {
    layout: 'card-grid-system',
    hero: 'minimal-text-no-image',
    typography: 'space-grotesk+inter',
    sectionOrder: 'nav|hero|service-tabs|features|stats-card|testimonials-scroll|how-it-works|contact|footer',
    components: 'clean-border-cards|pill-btn|scroll-testimonials|refined-stats|process-steps',
    personality: 'clean-efficient-tech-forward',
    ctaStrategy: 'book-online-digital-first',
    colorScheme: 'white-gray-single-accent',
    density: 'consistent-medium',
    navStyle: 'pill-links-clean',
  },
  regional: {
    layout: 'wide-proof-heavy',
    hero: 'full-image-stats-overlay',
    typography: 'lexend+nunito-sans',
    sectionOrder: 'utility-bar|nav|hero-stats|service-area|services|reviews-wall|why-us|faq|contact|footer',
    components: 'medium-rounded-cards|bold-btn|large-review-grid|overlapping-stats|area-list',
    personality: 'authoritative-data-driven-dominant',
    ctaStrategy: 'request-service-area-focused',
    colorScheme: 'navy-white-blue-mixed',
    density: 'comfortable-data-heavy',
    navStyle: 'two-tier-utility-bar',
  },
  craft: {
    layout: 'asymmetric-visual-led',
    hero: 'large-image-overlapping-card',
    typography: 'cormorant-garamond+montserrat',
    sectionOrder: 'transparent-nav|hero-overlap|philosophy|project-showcase|services-editorial|pullquote|process|consultation|footer',
    components: 'dark-thin-border-cards|text-arrow-btn|single-pullquote|inline-stats|editorial-list',
    personality: 'artisanal-detail-obsessed-premium',
    ctaStrategy: 'consultation-portfolio-driven',
    colorScheme: 'dark-charcoal-gold-warm',
    density: 'dramatic-asymmetric',
    navStyle: 'transparent-overlay-minimal',
  },
};

// ── DIMENSION SCORING ────────────────────────────────────────────────────────

function hammingDistance(a, b) {
  if (a === b) return 0;
  const wordsA = a.split(/[-|+]/);
  const wordsB = b.split(/[-|+]/);
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return 1 - (intersection / union);
}

function scoreDimension(valA, valB) {
  const dist = hammingDistance(valA, valB);
  return Math.round(dist * 10);
}

function scorePair(nameA, nameB) {
  const a = familyDNA[nameA];
  const b = familyDNA[nameB];

  const dimensions = {
    'Layout architecture': scoreDimension(a.layout, b.layout),
    'Hero composition': scoreDimension(a.hero, b.hero),
    Typography: scoreDimension(a.typography, b.typography),
    'Section order': scoreDimension(a.sectionOrder, b.sectionOrder),
    'Component styling': scoreDimension(a.components, b.components),
    'Brand personality': scoreDimension(a.personality, b.personality),
    'CTA strategy': scoreDimension(a.ctaStrategy, b.ctaStrategy),
    'Visual identity': Math.round(
      (
        scoreDimension(a.colorScheme, b.colorScheme) +
        scoreDimension(a.density, b.density) +
        scoreDimension(a.navStyle, b.navStyle)
      ) / 3
    ),
  };

  const total = Object.values(dimensions).reduce((s, v) => s + v, 0);
  const avg = total / Object.keys(dimensions).length;

  return { dimensions, total, avg, pass: avg >= 7 && total >= 56 };
}

function runSimilarityAudit() {
  const names = Object.keys(familyDNA);
  const results = [];
  let allPass = true;

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  VARIATION ENGINE — FAMILY SIMILARITY AUDIT');
  console.log('══════════════════════════════════════════════════════════\n');

  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i], b = names[j];
      const result = scorePair(a, b);
      results.push({ a, b, ...result });

      const status = result.pass ? '✓ PASS' : '✗ FAIL';
      console.log(`  ${a.padEnd(12)} vs ${b.padEnd(12)}  │ Total: ${String(result.total).padStart(2)}/80  Avg: ${result.avg.toFixed(1)}  │ ${status}`);

      if (!result.pass) allPass = false;
    }
  }

  console.log('\n──────────────────────────────────────────────────────────');
  console.log(allPass
    ? '  ✓ ALL PAIRS PASS — Variation engine produces distinct designs.'
    : '  ✗ SOME PAIRS FAILED — Revision needed for insufficient variation.');
  console.log('══════════════════════════════════════════════════════════\n');

  return { results, allPass };
}

// ── GENERATED DEMO QUALITY RUBRIC ───────────────────────────────────────────

function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function hasAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function serviceKeywordCoverage(lower, niche) {
  const defaults = {
    hvac: ['ac', 'cooling', 'heating', 'furnace', 'heat pump', 'air quality', 'duct'],
    plumbing: ['plumb', 'drain', 'sewer', 'water heater', 'leak', 'pipe', 'fixture'],
    roofing: ['roof', 'storm', 'inspection', 'repair', 'replacement', 'gutter', 'insurance'],
  };

  const keywords = defaults[niche] || defaults.hvac;
  const hits = keywords.filter(keyword => lower.includes(keyword)).length;
  return { hits, total: keywords.length };
}

function suspiciousLocalityRegex(city) {
  const safeCity = String(city || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!safeCity) return null;
  return new RegExp(`${safeCity}\\s+(heights|park|hills|springs|valley)`, 'i');
}

function scoreGeneratedDemo(html, lead = {}, familyName = 'unknown') {
  const lower = normalizeText(html);
  const niche = detectNiche(lead.niche);
  const city = String(lead.city || '').trim();
  const hardFails = [];
  const warnings = [];
  const checks = [];

  const addCheck = (label, score, max, note) => {
    checks.push({ label, score, max, note });
  };

  // Hard fail: deceptive fake social proof / booking popups
  if (hasAny(lower, [
    /booking-popup/i,
    /just booked a service/i,
    /someone in .* just requested service/i,
    /new booking/i,
  ])) {
    hardFails.push('Contains deceptive fake booking / urgency popup patterns.');
  }

  // Hard fail: fabricated-looking locality filler
  const suspiciousLocality = suspiciousLocalityRegex(city);
  if (suspiciousLocality && suspiciousLocality.test(html)) {
    hardFails.push('Contains suspicious fabricated locality/service-area names.');
  }

  // Hard fail: pricing CTA mismatch
  if (/see pricing/i.test(html) && !(/\$\d+|pricing plan|starting at|upfront pricing/i.test(html))) {
    hardFails.push('Has a pricing CTA without a real pricing section or price framing.');
  }

  // Hard fail: no phone CTA in home-service demo
  if (!/href="tel:/i.test(html)) {
    hardFails.push('Missing click-to-call phone CTA for a home-service demo.');
  }

  // 1) Conversion & CTA clarity — 25
  let conversion = 0;
  const telCount = countMatches(html, /href="tel:/gi);
  if (telCount >= 1) conversion += 8;
  if (telCount >= 3) conversion += 2;

  const hasForm = /<form\b/i.test(html);
  if (hasForm) conversion += 6;
  else warnings.push('No visible lead form found.');

  const ctaCount = countMatches(lower, /(call now|get help now|request service|schedule|book|estimate|quote|consultation)/gi);
  conversion += clamp(ctaCount, 0, 6);

  const earlyPhone = /href="tel:/i.test(html.slice(0, 9000));
  if (earlyPhone) conversion += 3;
  else warnings.push('Phone CTA is not visible early in the page source.');

  const stickyOrPrimary = /(sticky|fixed).*call now|mobile-cta|book a plumber|request service today|schedule service/i.test(lower);
  if (stickyOrPrimary) conversion += 2;

  conversion = clamp(conversion, 0, 25);
  addCheck('Conversion path & CTA clarity', conversion, 25, telCount ? `${telCount} tel CTA(s)` : 'No tel CTA');

  // 2) Trust & credibility stack — 20
  let trust = 0;
  const trustKeywords = [
    /licensed/i,
    /insured/i,
    /bonded/i,
    /warranty|guarantee/i,
    /upfront pricing|transparent pricing|no hidden fees/i,
    /review|testimonial|google/i,
    /years|jobs|rating/i,
  ];
  trust += trustKeywords.filter(re => re.test(html)).length * 2;
  trust = clamp(trust, 0, 20);
  if (trust < 12) warnings.push('Trust stack is thin for a local-service sales demo.');
  addCheck('Trust & credibility', trust, 20, `${trust}/20 from trust markers`);

  // 3) Niche fit & messaging — 20
  let nicheScore = 0;
  const keywordCoverage = serviceKeywordCoverage(lower, niche);
  nicheScore += clamp(keywordCoverage.hits * 2.5, 0, 10);

  const nicheLabel = (nicheContent[niche] || nicheContent.hvac).nicheLabel.toLowerCase();
  if (lower.includes(nicheLabel.toLowerCase())) nicheScore += 3;
  if (city && lower.includes(normalizeText(city))) nicheScore += 3;
  if (/(same-day|emergency|free estimate|service area|financing|warranty|inspection)/i.test(html)) nicheScore += 4;
  nicheScore = clamp(nicheScore, 0, 20);
  addCheck('Niche fit & messaging', nicheScore, 20, `${keywordCoverage.hits}/${keywordCoverage.total} niche keyword hits`);

  // 4) Frontend craft & polish — 20
  let polish = 0;
  const sectionCount = countMatches(html, /<section\b/gi);
  if (sectionCount >= 6 && sectionCount <= 11) polish += 6;
  else if (sectionCount >= 5) polish += 4;
  else warnings.push('Page structure looks too thin.');

  if (/fonts.googleapis.com/i.test(html)) polish += 4;
  if (/tailwindcss.com|tailwind\.config/i.test(html)) polish += 2;
  if (/scroll-behavior|transition|shadow|rounded/i.test(html)) polish += 3;
  if (/button|cta|hero/i.test(lower)) polish += 2;

  const placeholderVisual = /text-5xl[^<]*>\s*[🔧❄️🏠⚡]/.test(html) || /group-hover:bg[^\n]+>\s*<span class="text-[^"]+">\d+<\/span>/i.test(html);
  if (placeholderVisual) {
    polish -= 4;
    warnings.push('Contains placeholder-feeling visual treatment or cheap service icon treatment.');
  } else {
    polish += 3;
  }
  polish = clamp(polish, 0, 20);
  addCheck('Frontend craft & polish', polish, 20, `${sectionCount} sections`);

  // 5) Local authenticity — 10
  let local = 0;
  const cityMentions = city ? countMatches(lower, new RegExp(normalizeText(city), 'gi')) : 0;
  local += clamp(cityMentions, 0, 4);
  if (/service area|coverage area|serving/i.test(html)) local += 2;
  if (city && !hardFails.some(msg => msg.includes('locality'))) local += 4;
  local = clamp(local, 0, 10);
  addCheck('Local authenticity', local, 10, city ? `${cityMentions} city mention(s)` : 'No city provided');

  // 6) Honesty / anti-deception — 5
  let honesty = 5;
  if (hardFails.some(msg => /booking|urgency|pricing|locality/.test(msg.toLowerCase()))) honesty = 0;
  addCheck('Honesty / non-deception', honesty, 5, honesty ? 'No deceptive patterns detected' : 'One or more deceptive patterns detected');

  const total = checks.reduce((sum, item) => sum + item.score, 0);
  const pass90 = total >= 90 && hardFails.length === 0;
  const pass80 = total >= 80 && hardFails.length === 0;

  return {
    familyName,
    niche,
    total,
    max: 100,
    pass80,
    pass90,
    hardFails,
    warnings,
    checks,
  };
}

function auditGeneratedDemos(lead, families) {
  return families
    .map(entry => ({
      family: entry.family || entry.name,
      label: entry.label,
      score: scoreGeneratedDemo(entry.html, lead, entry.family || entry.name),
    }))
    .sort((a, b) => b.score.total - a.score.total);
}

function runGeneratedAudit() {
  const ROOT = path.join(__dirname, '..', '..');
  const inputFile = path.join(ROOT, 'leads', 'openclaw', 'audited.json');
  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  const leads = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const lead = leads[0];
  if (!lead) {
    console.error('No leads found in audited.json');
    process.exit(1);
  }

  const familyModules = {
    luxury: require('./families/luxury'),
    trust: require('./families/trust'),
    emergency: require('./families/emergency'),
    modern: require('./families/modern'),
    regional: require('./families/regional'),
    craft: require('./families/craft'),
  };

  const niche = detectNiche(lead.niche);
  const families = Object.values(familyModules).map(family => ({
    family: family.name,
    label: family.label,
    html: family.generate(lead, niche),
  }));

  const results = auditGeneratedDemos(lead, families);

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  VARIATION ENGINE — GENERATED DEMO QUALITY AUDIT');
  console.log('══════════════════════════════════════════════════════════\n');
  console.log(`Lead: ${lead.business_name} — ${lead.city || 'Unknown city'} — ${niche}\n`);

  for (const result of results) {
    const badge = result.score.pass90 ? 'A / 9+ READY' : result.score.pass80 ? 'B / usable' : 'C / needs work';
    console.log(`  ${result.family.padEnd(12)} ${String(result.score.total).padStart(3)}/100  ${badge}`);
    if (result.score.hardFails.length) {
      result.score.hardFails.forEach(msg => console.log(`    HARD FAIL: ${msg}`));
    }
    result.score.warnings.slice(0, 3).forEach(msg => console.log(`    note: ${msg}`));
  }

  console.log('\n══════════════════════════════════════════════════════════\n');
  return results;
}

if (require.main === module) {
  if (process.argv.includes('--generated')) {
    runGeneratedAudit();
  } else {
    runSimilarityAudit();
  }
}

module.exports = {
  scorePair,
  runSimilarityAudit,
  scoreGeneratedDemo,
  auditGeneratedDemos,
  runGeneratedAudit,
  familyDNA,
};
