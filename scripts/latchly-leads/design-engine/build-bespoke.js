/**
 * scripts/latchly-leads/design-engine/build-bespoke.js
 *
 * Bespoke per-business demo HTML, generated end-to-end via the Claude Code
 * CLI (`claude -p`) using three skills installed in the operator's
 * environment:
 *
 *   - huashu-design     (build) — scans business profile, picks 3
 *                                 differentiated design directions, then
 *                                 builds 3 candidate HTML files
 *   - ui-ux-pro-max     (polish) — tightens spacing/hierarchy/typography
 *   - impeccable        (gate)   — anti-AI-slop detection (already in lint.js)
 *
 * The CLI runs against the operator's Claude Max subscription so per-call
 * cost is zero. Wall time is ~3-4 min per lead with parallel candidates.
 *
 * Pass 0 — Generate copy (site-content-engine) + SEO (seo.js). These are
 *          deterministic, real-fact-only, and FROZEN. Later passes inject
 *          them verbatim into the HTML — Claude is forbidden from
 *          regenerating them.
 *
 * Pass 1 — Scan: huashu profiles the business along its design axes and
 *          recommends 3 directions from 3 different philosophy families.
 *
 * Pass 2 — Build: 3 parallel `claude -p` calls, one per recommended
 *          direction, each producing a self-contained HTML file with the
 *          frozen copy + frozen SEO blocks embedded.
 *
 * Pass 3 — Polish: 3 parallel ui-ux-pro-max passes refine each candidate.
 *
 * Pass 4 — Score + pick: impeccable + structural-uniqueness + AEO
 *          presence + content-fit. Highest weighted total wins.
 *
 * If `claude` CLI is not available (e.g. production Vercel runtime),
 * returns { ok: false, reason: 'claude_cli_unavailable' } and the caller
 * falls back to the legacy template flow in design-engine/index.js.
 */

const fs = require('fs');
const path = require('path');
const { runClaude, runClaudeJson, isClaudeCliAvailable, makeTempDir } = require('./claude-runner');
const { buildSeo } = require('./seo');
const { generateSiteContent } = require('../site-content-engine');
const { lintDemoHtml } = require('./lint');
const { appendTrace } = require('../build-trace');

const SITE_BASE_DEFAULT = 'https://latchlyai.com';
const DEFAULT_CANDIDATE_COUNT = Number(process.env.LATCHLY_DEMO_CANDIDATES || 3);

// Three photo treatments — the build pass picks one per candidate so the
// 3 demos for a single lead are visibly different even when the underlying
// images are the same. The huashu-design philosophy still drives the rest
// of the layout; this is just the photo "lens".
const PHOTO_TREATMENTS = [
  'collage-led: 2-3 photos arranged as an editorial grid in the hero or just after, with intentional white space between them. NO single full-bleed hero photo.',
  'hero-background: ONE photo as a full-bleed hero with a strong dark gradient overlay so the hero copy stays readable. The other photos appear smaller in services or about.',
  'minimal/single-photo: ONE photo only on the entire page, used in a small framed crop (about 480-640px wide) inside the about section. The hero is text-only, no image.',
];

const HUASHU_FAMILIES = [
  'information-architecture',
  'motion-poetry',
  'minimalism',
  'experimental',
  'east-asian-philosophy',
];

const FAMILY_HINTS = {
  'information-architecture': 'Pentagram-style information architecture. Grid-driven, dense legibility, structural restraint, magazine-like hierarchy.',
  'motion-poetry':            'Field.io-style motion poetry. Generative typography, kinetic feel even when static, technical-meets-poetic.',
  'minimalism':               'Kenya Hara / Wim Crouwel minimalism. Whitespace as substance, monochrome restraint, single-axis variation.',
  'experimental':             'Sagmeister / brutalist-trade experimental. Hand-feel typography, raw textures, single moment of audacity.',
  'east-asian-philosophy':    'Hara / mu emptiness, ma negative space, soft-warm-residential. Quiet, considered, never showy.',
};

/**
 * Generate a bespoke demo for one lead. Returns the same shape as the
 * existing template-based engine: { ok, html, direction, qualityScore, lint }
 * on success, { ok: false, reason, lint? } on failure.
 *
 * Caller must pass an `anthropic` client for the copy-generation pass.
 */
async function buildBespokeDemoForLead(lead, opts = {}) {
  if (!lead) throw new Error('lead required');
  const anthropic = opts.anthropic;
  const enrichment = opts.enrichment || {};
  const slug = opts.slug || makeSlug(lead);
  const siteBase = opts.siteBase || SITE_BASE_DEFAULT;
  const qualityFloor = Number(opts.qualityFloor || process.env.LATCHLY_DEMO_QUALITY_FLOOR || 80);
  const candidatesCount = Math.max(1, Number(opts.candidatesCount || DEFAULT_CANDIDATE_COUNT));
  const startedAt = Date.now();

  if (!(await isClaudeCliAvailable())) {
    return { ok: false, reason: 'claude_cli_unavailable' };
  }

  // ── Pass 0: copy + SEO (deterministic) ────────────────────────────────
  // If the caller already produced site copy (e.g. Stage 2 of the
  // showcase pipeline), use it verbatim and skip the SDK call. Anthropic
  // client is only required when we need to generate copy here.
  let content = opts.content;
  if (!content) {
    if (!anthropic) {
      return { ok: false, reason: 'anthropic_client_required_for_copy' };
    }
    content = await generateSiteContent(lead, enrichment, {
      anthropic,
      mode: lead.website ? 'souped-up' : 'fresh-build',
      recentCopy: opts.recentCopy || [],
    });
  }
  if (!content) return { ok: false, reason: 'copy_generation_failed' };

  const seo = buildSeo({ lead, enrichment, content, slug, siteBase });

  const tmp = makeTempDir(slug);
  try {
    const briefPath = path.join(tmp.dir, 'brief.json');
    fs.writeFileSync(briefPath, JSON.stringify({
      lead: pickLeadFields(lead),
      enrichment: pickEnrichmentFields(enrichment),
      content,
      seo,
      slug,
      siteBase,
    }, null, 2), 'utf8');

    // ── Pass 1: scan + 3-direction recommendation ──────────────────────
    const scan = await passScan({ briefPath, tmpDir: tmp.dir });
    if (!scan.ok) {
      return { ok: false, reason: `scan_failed:${scan.reason}`, scanError: scan.error };
    }
    const directions = scan.recommendedDirections.slice(0, candidatesCount);

    // ── Pass 2: parallel candidate builds ─────────────────────────────
    // Promise.all gets us 3 concurrent `claude -p` subprocesses. Max-plan
    // auth means no per-token cost, and claude-runner has exponential
    // backoff for the 30k tok/min org rate limit. Wall time goes from
    // ~25 min sequential to ~9 min parallel.
    const candidatePaths = directions.map((_, i) => path.join(tmp.dir, `candidate-${i + 1}.html`));
    const candidateResults = await Promise.all(
      directions.map((direction, i) => passBuild({
        briefPath,
        scanPath: scan.scanPath,
        direction,
        photoTreatment: PHOTO_TREATMENTS[i % PHOTO_TREATMENTS.length],
        outFile: candidatePaths[i],
        tmpDir: tmp.dir,
      })),
    );

    // ── Pass 3: parallel polish passes ─────────────────────────────────
    const polishedPaths = directions.map((_, i) => path.join(tmp.dir, `polished-${i + 1}.html`));
    const polishedResults = await Promise.all(
      candidateResults.map((cand, i) => {
        if (!cand.ok) return Promise.resolve({ ok: false, reason: cand.reason });
        return passPolish({
          inFile: candidatePaths[i],
          outFile: polishedPaths[i],
          tmpDir: tmp.dir,
        });
      }),
    );

    // ── Pass 4: score + pick winner ────────────────────────────────────
    const scoreds = await Promise.all(directions.map(async (direction, i) => {
      if (!polishedResults[i].ok) {
        return { i, ok: false, reason: polishedResults[i].reason, direction };
      }
      let html;
      try {
        html = fs.readFileSync(polishedPaths[i], 'utf8');
      } catch (err) {
        return { i, ok: false, reason: `polished_unreadable:${err.code || err.message}`, direction };
      }
      const lint = await lintDemoHtml(html, { lead, enrichment });
      const aeoScore = scoreAeoPresence(html);
      const fitScore = await scoreContentFit({ html, scanProfile: scan.profile, direction, tmpDir: tmp.dir })
        .catch(() => 75); // soft default if the score pass fails
      const total =
        0.35 * (lint.score || 0) +
        0.20 * aeoScore +
        0.25 * uniquenessScoreFromLint(lint) +
        0.20 * fitScore;
      const hardFail = (lint.score || 0) < qualityFloor || aeoScore < 60 ||
        (lint.issues || []).some(x => x.severity === 'critical');
      return { i, ok: !hardFail, html, lint, aeoScore, fitScore, total, direction, hardFail };
    }));

    const eligible = scoreds.filter(s => s.ok).sort((a, b) => b.total - a.total);
    const candidatesScored = scoreds.map(s => ({
      direction: s.direction?.key || s.direction?.philosophy || null,
      ok: s.ok,
      reason: s.reason || null,
      total: s.total,
      impeccable: s.lint?.score,
      aeo: s.aeoScore,
      fit: s.fitScore,
      hardFail: s.hardFail,
    }));

    if (eligible.length) {
      const winner = eligible[0];
      const wallTimeMs = Date.now() - startedAt;
      await appendTrace(slug, {
        businessKey: lead.businessKey || null,
        businessName: lead.businessName || null,
        path: 'bespoke',
        candidatesScored,
        scanProfile: scan.profile,
        wallTimeMs,
        lintScore: winner.lint?.score ?? null,
        fallbackReason: null,
      }, { storage: opts.storage });
      return {
        ok: true,
        html: winner.html,
        direction: winner.direction.key || winner.direction.philosophy || 'bespoke',
        qualityScore: Math.round(winner.total),
        lint: winner.lint,
        candidatesScored,
        scanProfile: scan.profile,
        wallTimeMs,
      };
    }

    const wallTimeMs = Date.now() - startedAt;
    await appendTrace(slug, {
      businessKey: lead.businessKey || null,
      businessName: lead.businessName || null,
      path: 'bespoke',
      candidatesScored,
      scanProfile: scan.profile,
      wallTimeMs,
      lintScore: null,
      fallbackReason: 'no_candidate_passed_gates',
    }, { storage: opts.storage });
    return {
      ok: false,
      reason: 'no_candidate_passed_gates',
      scanProfile: scan.profile,
      candidatesScored,
      wallTimeMs,
    };
  } finally {
    if (!opts.keepTemp) tmp.cleanup();
  }
}

// ── Pass 1: scan ────────────────────────────────────────────────────────

async function passScan({ briefPath, tmpDir }) {
  const scanPath = path.join(tmpDir, 'scan.json');
  const prompt = [
    'Use the huashu-design skill AND the karpathy-guidelines skill — huashu drives the visual direction, karpathy keeps the reasoning honest and concrete.',
    '',
    'You are profiling a single home-services business so we can pick the right design direction for its homepage. Read the JSON brief at:',
    `  ${briefPath}`,
    '',
    'Reason from the brief — services, reviews, owner, neighborhood, BBB rating, photos, hours — to a profile along huashu\'s axes:',
    '  brand temperature (warm / neutral / cool)',
    '  audience distance (10cm / 1m / 10m)',
    '  industry archetype (one phrase)',
    '  photo aesthetic (one phrase)',
    '  voice register (one phrase)',
    '  neighborhood feel (one phrase)',
    '  signature details (array of strings)',
    '  avoidThese (array of strings — slop signals to keep out)',
    '',
    'Then RECOMMEND 3 design directions, each from a DIFFERENT huashu philosophy family. The 5 families are:',
    HUASHU_FAMILIES.map(f => `  - ${f}: ${FAMILY_HINTS[f]}`).join('\n'),
    '',
    'Each recommendation must include:',
    '  key       — a unique short id you invent (kebab-case)',
    '  family    — one of the 5 families, NEVER duplicating another recommendation\'s family',
    '  philosophy — one-line description of the design philosophy',
    '  why       — 1 sentence justification grounded in the profile (must reference at least 2 specific facts from the brief)',
    '',
    `Write the result as JSON to ${scanPath}. Use the Write tool. Do NOT include any other prose in your reply.`,
    '',
    'Schema:',
    '{',
    '  "profile": {...},',
    '  "recommendedDirections": [',
    '    { "key": "...", "family": "...", "philosophy": "...", "why": "..." },',
    '    ...x3',
    '  ]',
    '}',
  ].join('\n');

  const res = await runClaude({ prompt, expectFile: scanPath });
  if (!res.ok) return { ok: false, reason: res.reason, error: res.stderr || res.stdout };
  let parsed;
  try {
    parsed = JSON.parse(res.output);
  } catch (err) {
    return { ok: false, reason: `scan_invalid_json:${err.message}` };
  }
  if (!parsed?.recommendedDirections?.length || !parsed?.profile) {
    return { ok: false, reason: 'scan_shape_invalid' };
  }
  // Enforce family diversity: drop duplicates from the back.
  const seenFamilies = new Set();
  const dedupedDirections = [];
  for (const d of parsed.recommendedDirections) {
    if (!d.family || seenFamilies.has(d.family)) continue;
    seenFamilies.add(d.family);
    dedupedDirections.push(d);
  }
  if (dedupedDirections.length < 3) {
    // Pad with families we haven't seen yet — don't crash, just keep going.
    for (const f of HUASHU_FAMILIES) {
      if (dedupedDirections.length >= 3) break;
      if (!seenFamilies.has(f)) {
        dedupedDirections.push({
          key: `auto-${f}`,
          family: f,
          philosophy: FAMILY_HINTS[f],
          why: 'auto-padded family because scan returned fewer than 3 distinct families',
        });
      }
    }
  }
  return {
    ok: true,
    profile: parsed.profile,
    recommendedDirections: dedupedDirections,
    scanPath,
  };
}

// ── Pass 2: build a single candidate ────────────────────────────────────

async function passBuild({ briefPath, scanPath, direction, photoTreatment, outFile, tmpDir }) {
  const prompt = [
    'Use the huashu-design skill (visual direction) AND the site-content-latchly skill (copy rules) AND the karpathy-guidelines skill (concrete-over-abstract reasoning). All three.',
    '',
    'You are designing a single self-contained HTML homepage for the local home-services business described in the JSON brief at:',
    `  ${briefPath}`,
    'and the scan profile at:',
    `  ${scanPath}`,
    '',
    `DESIGN DIRECTION (assigned to this candidate; do not pick a different one):`,
    `  key:        ${direction.key || 'unspecified'}`,
    `  family:     ${direction.family || 'unspecified'}`,
    `  philosophy: ${direction.philosophy || 'unspecified'}`,
    `  why:        ${direction.why || 'unspecified'}`,
    '',
    `PHOTO TREATMENT (assigned to this candidate, NOT optional):`,
    `  ${photoTreatment || 'collage-led: 2-3 photos arranged as an editorial grid in the hero.'}`,
    '',
    'STRICT RULES (every bullet is a hard requirement):',
    '- The brief includes a `content` object (heroHeadline, heroSubhead, aboutParagraph, primaryCta, secondaryCta, trustItems, reviewSelections). USE THESE STRINGS VERBATIM. Do not reword.',
    '- The brief includes a `seo` object with three pre-rendered HTML strings: `seoHead`, `seoJsonLd`, `faqSection`. EMBED THESE VERBATIM:',
    '    * `seoHead` and `seoJsonLd` go inside `<head>` exactly as given.',
    '    * `faqSection` goes inside `<body>` immediately before the closing `</footer>` (or before `</body>` if no footer).',
    '- The brief includes `enrichment.servicesVerified[]` and `enrichment.reviews[]`. Use only those services and only those review texts. NEVER invent.',
    '- PHOTOS — pre-vetted, you do NOT fetch your own. Use these sources, in this order:',
    '    1. `enrichment.existingCopy.heroImageUrl` and `enrichment.existingCopy.galleryImageUrls[]` — real images from the lead\'s actual website. Prefer these when present.',
    '    2. `content.stockPhotos[]` — Pexels/Unsplash photos pre-selected for the niche. Use when (1) is empty or thin.',
    '  Render at LEAST 4 photos as `<img>` tags across the page (hero, services, about, gallery — wherever your direction calls for them). Use the assigned PHOTO TREATMENT above so this candidate looks visibly different from the others. Add `loading="lazy"` and `decoding="async"` to non-hero `<img>` tags. Each `<img>` must have a meaningful `alt` attribute drawn from the photo\'s alt or a verified service.',
    '- ANIMATIONS — required:',
    '    * Hero text fades in and rises on load (CSS `@keyframes`, ~600ms ease-out).',
    '    * Services grid items reveal on scroll using a single inline vanilla `IntersectionObserver` (total inline JS < 3kb, no external scripts).',
    '    * Hover micro-interactions on cards, CTAs, and the phone link (transform/opacity only — no layout-shifting properties).',
    '    * Wrap ALL motion in `@media (prefers-reduced-motion: no-preference) { ... }`. Static must remain readable.',
    '    * No animation may delay first paint; the page renders fine with JS off.',
    '- DO NOT use the Fraunces+Inter font combo (it is the existing template — we are explicitly making something different).',
    '- DO NOT use any banned slop signals from huashu-design §6.2 (purple gradients, emoji icons, rounded-card+left-border, SVG-drawn imagery, GitHub-dark deep-blue).',
    '- The visual register MUST match this candidate\'s philosophy. The point of having 3 candidates is that they must be visibly distinct from each other.',
    '- Hero must include the business name, the city, and a verified service.',
    '- The page must have a visible reviews section AND a visible FAQ accordion (the latter from `seo.faqSection` verbatim).',
    '- Phone link with `tel:` href must be present.',
    '- Page must be fully responsive (mobile-first, single self-contained HTML, all CSS inline in `<style>`).',
    '- Output is a single complete HTML file (`<!DOCTYPE html>` … `</html>`).',
    '',
    `Write the final HTML to: ${outFile}`,
    'Use the Write tool. After writing, output a single sentence confirming the path.',
  ].join('\n');

  // Opus 4.7 + high on a full HTML build is 5-10 min on its own, but
  // 3 parallel candidates compete for the org's 30k input-tok/min rate
  // limit — each call queues behind the others' backoff windows, pushing
  // wall time to 20-25 min on the slow candidate. 35 min ceiling absorbs
  // that without false-positive timeouts; per-token cost is zero under
  // Max-plan auth so the only downside is wall-clock patience.
  const res = await runClaude({ prompt, expectFile: outFile, timeoutMs: 35 * 60 * 1000 });
  if (!res.ok) return { ok: false, reason: res.reason };
  // Sanity: HTML must contain the seo blocks verbatim.
  return { ok: true };
}

// ── Pass 3: polish ──────────────────────────────────────────────────────

async function passPolish({ inFile, outFile, tmpDir }) {
  const prompt = [
    'Use the ui-ux-pro-max skill AND the karpathy-guidelines skill. Both.',
    '',
    `Read the candidate HTML at: ${inFile}`,
    '',
    'Polish it for production-grade UI/UX:',
    '- Tighten spacing, alignment, typographic rhythm.',
    '- Improve hierarchy without changing the visual register or design philosophy.',
    '- Tune the color palette so the accent is intentional, not arbitrary.',
    '- Improve the hero, services grid, reviews section, FAQ accordion, and contact area.',
    '- Ensure mobile responsiveness is excellent at 390x844 and desktop at 1440x900.',
    '- Preserve all animations from the candidate (entrance fade, scroll reveal, hover) — refine timing/easing if appropriate, but do not remove. Keep the `prefers-reduced-motion` guard intact.',
    '',
    'STRICT PRESERVATION RULES:',
    '- DO NOT remove, edit, reformat, or move any `<script type="application/ld+json">` block.',
    '- DO NOT remove, edit, reformat, or move any `<meta>` tag, `<title>`, or `<link rel="canonical">`.',
    '- DO NOT remove the visible `<section id="faq">` accordion.',
    '- DO NOT change any business-fact text (services, reviews, owner, ratings, addresses).',
    '- DO NOT remove or substitute photos. The `<img>` tags and their `src` URLs are pre-vetted — keep them. You may resize/reposition photo containers but the photos must stay rendered.',
    '- DO NOT add new `<img>` URLs of your own (no fetching new stock photos).',
    '',
    `Write the polished HTML to: ${outFile}`,
    'Use the Write tool. Output is a single complete HTML file.',
  ].join('\n');

  // Polish pass is shorter than build (input HTML exists) but 3 parallel
  // polishes contend for the same 30k tok/min cap as the build pass, so
  // give it 25 min — same logic as passBuild's ceiling.
  const res = await runClaude({ prompt, expectFile: outFile, timeoutMs: 25 * 60 * 1000 });
  if (!res.ok) return { ok: false, reason: res.reason };
  return { ok: true };
}

// ── Pass 4 helpers: scoring ─────────────────────────────────────────────

// Score AEO/SEO presence on the produced HTML. Out of 100.
function scoreAeoPresence(html) {
  const checks = [
    [/<title>[^<][\s\S]{2,}<\/title>/i,                                       18, 'title'],
    [/<meta\s+name="description"\s+content="[^"]+"/i,                         12, 'meta_description'],
    [/<link\s+rel="canonical"\s+href="[^"]+"/i,                               10, 'canonical'],
    [/<meta\s+property="og:image"\s+content="[^"]+"/i,                        10, 'og_image'],
    [/<script\s+type="application\/ld\+json">[\s\S]*?(?:LocalBusiness|Electrician|Plumber|RoofingContractor|HVACBusiness|GeneralContractor|HomeAndConstructionBusiness)[\s\S]*?<\/script>/i, 18, 'jsonld_localbusiness'],
    [/<script\s+type="application\/ld\+json">[\s\S]*?FAQPage[\s\S]*?<\/script>/i,        14, 'jsonld_faq'],
    [/<section[^>]+id=["']faq["'][^>]*>/i,                                    10, 'visible_faq'],
    [/aggregateRating/i,                                                       8, 'aggregateRating'],
  ];
  let score = 0;
  for (const [re, weight] of checks) if (re.test(html)) score += weight;
  return Math.min(100, score);
}

// Translate impeccable + structural-sameness lint findings into a 0-100
// uniqueness score. Anything that hits a structural-sameness issue gets
// hammered hard.
function uniquenessScoreFromLint(lint) {
  if (!lint || !lint.issues) return 70;
  let score = 100;
  for (const issue of lint.issues) {
    if (/sameness|dom_collision|structural/i.test(issue.rule || '')) score -= 25;
    else if (issue.severity === 'critical') score -= 12;
    else if (issue.severity === 'major') score -= 6;
    else score -= 2;
  }
  return Math.max(0, score);
}

// Ask Claude (haiku, cheap) whether the polished HTML's visual register
// matches the scan profile. Returns 0-100. On any failure, throws and the
// caller defaults to 75.
async function scoreContentFit({ html, scanProfile, direction, tmpDir }) {
  const inFile = path.join(tmpDir, `fit-input-${Math.random().toString(36).slice(2, 8)}.html`);
  fs.writeFileSync(inFile, html, 'utf8');
  const prompt = [
    'You are a strict design critic. Read the HTML at:',
    `  ${inFile}`,
    '',
    'And the business profile + chosen direction:',
    JSON.stringify({ profile: scanProfile, direction }, null, 2),
    '',
    'Question: Does this HTML\'s visual register actually match the chosen direction\'s philosophy AND fit the business profile (temperature, archetype, voice register, neighborhood feel)?',
    '',
    'Score from 0-100. Be strict — generic templates that ignore the profile should score below 60.',
    '',
    'Reply with a JSON object between fences exactly:',
    '<<<JSON_START>>>',
    '{ "score": <int>, "rationale": "<one-line>" }',
    '<<<JSON_END>>>',
  ].join('\n');

  // Fit-score is a small judgment call — Haiku is plenty for it. Everything
  // creative (scan / build / polish) defaults to Opus 4.7 + high from
  // claude-runner.js.
  const res = await runClaudeJson({ prompt, model: 'claude-haiku-4-5-20251001', effort: 'medium', timeoutMs: 60_000 });
  if (!res.ok || !res.json || typeof res.json.score !== 'number') {
    throw new Error(res.reason || 'fit_score_invalid');
  }
  return Math.max(0, Math.min(100, Math.round(res.json.score)));
}

// ── helpers ─────────────────────────────────────────────────────────────

function pickLeadFields(lead) {
  return {
    id: lead.id ?? null,
    businessKey: lead.businessKey ?? null,
    businessName: lead.businessName ?? null,
    niche: lead.niche ?? null,
    city: lead.city ?? null,
    state: lead.state ?? null,
    phone: lead.phone ?? null,
    website: lead.website ?? null,
  };
}

function pickEnrichmentFields(enrichment) {
  return {
    ownerName: enrichment.ownerName || null,
    ownerFirstName: enrichment.ownerFirstName || null,
    yearsInBusiness: enrichment.yearsInBusiness || null,
    averageRating: enrichment.averageRating || null,
    reviewCount: enrichment.reviewCount || null,
    bbbAccreditation: enrichment.bbbAccreditation || null,
    licenses: enrichment.licenses || [],
    serviceArea: enrichment.serviceArea || [],
    servicesVerified: (enrichment.servicesVerified || []).slice(0, 8),
    reviews: (enrichment.reviews || []).slice(0, 5),
    // Google Places photos no longer passed through (the array is empty by
    // design — see enrichment.js). Real photos live on existingCopy now.
    hours: enrichment.hours || null,
    formattedAddress: enrichment.formattedAddress || null,
    coordinates: enrichment.coordinates || null,
    googleMapsUrl: enrichment.googleMapsUrl || null,
    existingCopy: enrichment.existingCopy || null,
    brandColors: enrichment.brandColors || null,
  };
}

function makeSlug(lead) {
  const raw = `${lead.businessName || 'business'}-${lead.city || ''}-${lead.state || ''}`;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

module.exports = { buildBespokeDemoForLead };
