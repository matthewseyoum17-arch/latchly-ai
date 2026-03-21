#!/usr/bin/env node
/**
 * Similarity Rubric System
 *
 * Scores each pair of design families on 8 dimensions.
 * Fails if any pair is too similar (avg < 7, total < 56/80).
 *
 * Usage: node scripts/variation-engine/rubric.js
 */

// ── FAMILY DESIGN DNA ────────────────────────────────────────────────────────
// Each family's structural fingerprint for automated comparison.

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
  // Compare two strings, return 0-1 similarity
  if (a === b) return 0;
  const wordsA = a.split(/[-|+]/);
  const wordsB = b.split(/[-|+]/);
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return 1 - (intersection / union); // Jaccard distance
}

function scoreDimension(valA, valB) {
  // Returns 0-10 score (10 = maximally different)
  const dist = hammingDistance(valA, valB);
  return Math.round(dist * 10);
}

function scorePair(nameA, nameB) {
  const a = familyDNA[nameA];
  const b = familyDNA[nameB];

  const dimensions = {
    'Layout architecture':   scoreDimension(a.layout, b.layout),
    'Hero composition':      scoreDimension(a.hero, b.hero),
    'Typography':            scoreDimension(a.typography, b.typography),
    'Section order':         scoreDimension(a.sectionOrder, b.sectionOrder),
    'Component styling':     scoreDimension(a.components, b.components),
    'Brand personality':     scoreDimension(a.personality, b.personality),
    'CTA strategy':          scoreDimension(a.ctaStrategy, b.ctaStrategy),
    'Visual identity':       Math.round((
      scoreDimension(a.colorScheme, b.colorScheme) +
      scoreDimension(a.density, b.density) +
      scoreDimension(a.navStyle, b.navStyle)
    ) / 3),
  };

  const total = Object.values(dimensions).reduce((s, v) => s + v, 0);
  const avg = total / Object.keys(dimensions).length;

  return { dimensions, total, avg, pass: avg >= 7 && total >= 56 };
}

// ── FULL AUDIT ───────────────────────────────────────────────────────────────

function runAudit() {
  const names = Object.keys(familyDNA);
  const results = [];
  let allPass = true;

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  VARIATION ENGINE — SIMILARITY RUBRIC AUDIT');
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
  console.log('  DETAILED BREAKDOWN');
  console.log('──────────────────────────────────────────────────────────\n');

  for (const r of results) {
    console.log(`  ${r.a} vs ${r.b}:`);
    for (const [dim, score] of Object.entries(r.dimensions)) {
      const bar = '█'.repeat(score) + '░'.repeat(10 - score);
      const flag = score < 7 ? ' ← WEAK' : '';
      console.log(`    ${dim.padEnd(22)} ${bar} ${score}/10${flag}`);
    }
    console.log(`    ${'TOTAL'.padEnd(22)} ${' '.repeat(10)} ${r.total}/80  avg ${r.avg.toFixed(1)}`);
    console.log();
  }

  // Structural self-audit
  console.log('──────────────────────────────────────────────────────────');
  console.log('  STRUCTURAL SELF-AUDIT');
  console.log('──────────────────────────────────────────────────────────\n');

  const checks = [
    ['Unique layout model', 'layout'],
    ['Unique hero composition', 'hero'],
    ['Unique typography pairing', 'typography'],
    ['Unique section flow', 'sectionOrder'],
    ['Unique component language', 'components'],
    ['Unique nav style', 'navStyle'],
    ['Unique color approach', 'colorScheme'],
    ['Unique density/rhythm', 'density'],
  ];

  for (const [label, key] of checks) {
    const vals = names.map(n => familyDNA[n][key]);
    const unique = new Set(vals).size;
    const status = unique === vals.length ? '✓' : `⚠ ${unique}/${vals.length} unique`;
    console.log(`  ${label.padEnd(30)} ${status}`);
  }

  console.log('\n──────────────────────────────────────────────────────────');
  if (allPass) {
    console.log('  ✓ ALL PAIRS PASS — Variation engine produces distinct designs.');
  } else {
    console.log('  ✗ SOME PAIRS FAILED — Revision needed for insufficient variation.');
  }
  console.log('══════════════════════════════════════════════════════════\n');

  return { results, allPass };
}

if (require.main === module) {
  runAudit();
}

module.exports = { scorePair, runAudit, familyDNA };
