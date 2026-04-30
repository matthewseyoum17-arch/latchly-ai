/**
 * scripts/latchly-leads/site-content-engine.js
 *
 * Generates demo-site copy (hero, subhead, about, services, CTAs, trust items)
 * for a Latchly lead. Two modes:
 *   - 'souped-up'   : lead has an existing site; prefer their existingCopy
 *                     verbatim, fill gaps only.
 *   - 'fresh-build' : no existing site; generate from enrichment fact whitelist.
 *
 * Anti-AI-slop: word counts enforced, banned phrase list rejected,
 * em-dash cap, cross-lead 7-gram de-dupe (Phase B.6).
 * Per-lead variation seeds pick a voice / headline-structure / about-opener
 * trio so demos don't all read the same way.
 *
 * On generation failure: returns null. Caller MUST handle null gracefully.
 */

const crypto = require('crypto');

const SITE_COPY_RULES = {
  heroHeadlineWords: { min: 4, max: 9 },
  heroSubheadWords: { min: 8, max: 18 },
  aboutParagraphWords: { min: 30, max: 70 },
  ctaWords: { min: 2, max: 5 },

  // Em-dash cap across heroHeadline + heroSubhead + aboutParagraph combined.
  // Same AI-cadence-tell logic as cold email — just tighter, since site copy
  // is shorter than email bodies.
  maxEmDashesAcrossCopy: 1,

  bannedPhrases: [
    // Original list -------------------------------------------------------
    'elevate your', "in today's world", 'leverage', 'seamless', 'cutting-edge',
    'world-class', 'best-in-class', 'industry-leading', 'one-stop shop',
    'second to none', 'unlock', 'empower', 'transformative', 'robust',
    'synergy', 'top-notch', 'unparalleled', 'tailored solutions',
    'committed to excellence', 'state-of-the-art', 'comprehensive solutions',
    'proudly serving', 'your trusted partner', 'we understand that',
    'in the heart of', 'nestled in', 'when it comes to',
    // Phase B.6 expansion — AI cadence tells that converged across demos --
    'delve', 'deep dive', 'in today\'s market', 'given that',
    'holistic', 'ecosystem', 'paradigm', 'mission-critical',
    'value proposition', 'turn-key', 'optimize your', 'drive growth',
    'navigate', 'scalable solutions', 'our team is',
    'we pride ourselves', 'dedicated to providing',
  ],

  bannedFramings: [
    // Original list -------------------------------------------------------
    'with years of experience',
    'no job too big or too small',
    'voted #1',
    // Phase B.6 expansion -------------------------------------------------
    'no project too big',
    'your one-stop',
    'from start to finish',
    'we go above and beyond',
    'your trusted choice',
    'time and time again',
    'your business deserves',
  ],

  factWhitelist: [
    'businessName', 'city', 'state', 'phone',
    'servicesVerified', 'yearsInBusiness', 'ownerFirstName',
    'reviewCount', 'averageRating', 'serviceArea',
    'bbbAccreditation', 'licenses', 'existingCopy',
  ],

  // ── Per-lead variation pools (Phase B.6) ───────────────────────────────
  // Hashed by lead.id so repeat composes for the same lead are stable but
  // every distinct lead picks a different voice/headline/opener trio.
  voicePool: [
    { key: 'owner-on-the-job',
      directive: 'Owner-on-the-job: short, in-the-moment ("we showed up Tuesday, fixed it Tuesday"). Plain trade words, no marketing.' },
    { key: 'quiet-craftsman',
      directive: 'Quiet-craftsman: understated, earned-not-claimed ("we don\'t say best. our customers do"). No superlatives.' },
    { key: 'neighborhood-direct',
      directive: 'Neighborhood-direct: name local references where real, plain talk, no marketing speak. Sounds like a sign-painter from down the street.' },
    { key: 'trades-pragmatic',
      directive: 'Trades-pragmatic: numbers, timelines, what-it-actually-costs. Concrete over abstract. No adjectives without a number behind them.' },
    { key: 'family-business-warm',
      directive: 'Family-business-warm: generational, names, faces, no corporate. Mention the owner by first name once if available.' },
  ],

  headlinePool: [
    { key: 'question',     directive: 'Headline structure: a focused question. Format: "{Real-niche-pain-or-question} in {City}?"' },
    { key: 'statement',    directive: 'Headline structure: a flat declarative sentence. Format: "{BusinessName} {does verb} {real service} in {City}."' },
    { key: 'list-fragment',directive: 'Headline structure: a noun-fragment list. Format: "{service 1}. {service 2}. {service 3}." — three real verified services, ordered by what they emphasize.' },
    { key: 'promise-timeline', directive: 'Headline structure: a promise + timeline. Format: "{Service} fixed by {timeframe} — {city, state}". Only use a timeframe that is in the enrichment.' },
    { key: 'owner-quote',  directive: 'Headline structure: a one-line quote from the owner voice (no quotation marks needed). Format: "{Owner first name} answers the phone." or similar — 4-9 words, must be true.' },
  ],

  aboutOpenerPool: [
    { key: 'origin-story',  directive: 'About paragraph opener: a short origin story grounded in the real business. "We\'ve been doing {service} in {city} since {year}." Only use a year if yearsInBusiness is in the enrichment.' },
    { key: 'what-we-dont-do', directive: 'About paragraph opener: declare a constraint. "We don\'t do {generic adjacent service}. {Niche} — that\'s the entire shop." Anchors the niche specifically.' },
    { key: 'specific-recent-job', directive: 'About paragraph opener: reference a specific kind of recent job. "Last week we {real verified service} on a {realistic context for the niche}." Stays in the fact whitelist.' },
    { key: 'service-area-niche', directive: 'About paragraph opener: name the radius first. "We work {service area or city}, mostly {top verified service}." Nothing else in the opener.' },
    { key: 'owner-intro',   directive: 'About paragraph opener: introduce the owner by first name (only if ownerFirstName is in the input). "I\'m {ownerFirstName}. I run {businessName}. I answer the phone." Three short lines.' },
  ],

  // Cross-lead de-dupe: reject if 7-gram Jaccard overlap with any prior
  // demo's heroHeadline + aboutParagraph exceeds threshold.
  dedupeOverlapThreshold: 0.35,
  dedupeNgramSize: 7,
  dedupeRecentLimit: 30,
};

const SYSTEM_PROMPT = `You are the site-copy engine for a custom demo homepage built for a single home-services business.

YOUR JOB
Output ONE JSON object containing copy for one section of a custom-built homepage. Owner-operator voice (plumber, HVAC, roofer, electrician, contractor). First-person plural ("we", "our crew"), short sentences.

OUTPUT
Return strict JSON only:
{
  "heroHeadline": string,                  // 4-9 words
  "heroSubhead": string,                   // 8-18 words
  "aboutParagraph": string,                // 30-70 words, owner voice
  "primaryCta": string,                    // 2-5 words
  "secondaryCta": string,                  // 2-5 words
  "trustItems": string[],                  // 2-4 short bullet labels
  "reviewSelections": [                    // 2-3 review excerpts to feature
    { "author": string, "rating": number, "text": string }
  ]
}

RULES
- Use input fields verbatim where possible. Their own words beat generated copy.
- Never invent a fact. If a fact is missing, write a leaner section instead of filling.
- Specificity over abstraction. Real city, real service, real number, not "your area".
- No agency-speak. No marketing jargon. No "we understand that". No "in the heart of".
- Em-dashes: max ONE across heroHeadline + heroSubhead + aboutParagraph combined. More is an AI cadence tell.
- BANNED phrases (reject and retry if any appear in output):
${SITE_COPY_RULES.bannedPhrases.map(p => '  - "' + p + '"').join('\n')}
- BANNED framings (don't position copy this way):
${SITE_COPY_RULES.bannedFramings.map(f => '  - ' + f).join('\n')}

PER-LEAD VARIATION (input.variation block)
The input includes a \`variation\` block with three hashed directives. Follow ALL THREE EXACTLY — these directives are how we keep ten demo sites feeling like ten different shops, not ten outputs of the same template.
- variation.voice            — sentence cadence + register
- variation.headlineStructure — heroHeadline shape
- variation.aboutOpener      — first sentence of aboutParagraph

If the chosen voice contradicts the structural rules above, the structural rules still win — but stretch them as far as the voice allows.

MODE-SPECIFIC
- 'souped-up' mode: input includes \`existingCopy.about\` and \`existingCopy.hero\`. Use those VERBATIM if non-empty. Only generate sections that are missing from existingCopy.
- 'fresh-build' mode: generate from the fact whitelist only (no invented years, services, awards).

VERIFICATION (mental check before returning)
- heroHeadline contains businessName OR city OR a real verified service.
- aboutParagraph: 30-70 words, no banned phrases.
- reviewSelections: only from input.reviews; copied verbatim, never paraphrased.
- All CTAs are short, action-oriented ("Call now", "See pricing", "Book this week").`;

async function generateSiteContent(lead, enrichment, opts = {}) {
  if (!lead) throw new Error('lead required');
  const anthropic = opts.anthropic;
  if (!anthropic) throw new Error('anthropic client required');

  const mode = opts.mode || (lead.website ? 'souped-up' : 'fresh-build');
  const direction = opts.direction || 'craft-editorial';

  // Phase B.6: per-lead variation seed. Different bytes of a SHA-1 digest
  // pick voice/headline-structure/about-opener so two leads don't share
  // the same trio.
  const variation = pickVariation(lead);
  const input = buildContentInput(lead, enrichment, mode, direction, variation);

  // Cross-lead de-dupe corpus. Caller can pass `recentCopy: string[]`
  // (heroHeadline + aboutParagraph pairs from the last 30 demos). When
  // omitted, dedupe is skipped — ban + structural validators still run.
  const recentCopy = Array.isArray(opts.recentCopy) ? opts.recentCopy : [];
  const recentNgrams = recentCopy
    .map(text => ngramSet(String(text || ''), SITE_COPY_RULES.dedupeNgramSize))
    .filter(set => set.size > 0);

  let lastError = null;
  let overlapFeedback = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const userContent = overlapFeedback
        ? `Compose site copy. Mode: ${mode}. Direction: ${direction}. Return JSON only.\n\n<input>\n${JSON.stringify(input, null, 2)}\n</input>\n\n<retry_feedback>\nThe prior version overlapped with a recently generated demo (${(overlapFeedback.ratio * 100).toFixed(0)}% 7-gram overlap on heroHeadline + aboutParagraph). Use a fundamentally different opener and rhythm. Do NOT echo the prior version's phrasing.\n</retry_feedback>`
        : `Compose site copy. Mode: ${mode}. Direction: ${direction}. Return JSON only.\n\n<input>\n${JSON.stringify(input, null, 2)}\n</input>`;

      const message = await anthropic.messages.create({
        model: opts.model || 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        // Phase B.6: bumped 0.55 → 0.78. Haiku 4.5 rejects setting both
        // temperature and top_p simultaneously, so we use temperature alone
        // — the variation-seed pools carry the rest of the diversity budget.
        temperature: 0.78,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      });

      const text = (message.content || []).map(b => b.text || '').join('').trim();
      const parsed = parseStrictJson(text);
      if (!parsed) throw new Error('content_invalid_json');

      const violation = validateContent(parsed);
      if (violation) {
        lastError = new Error(`content_violation: ${violation}`);
        continue;
      }

      // Cross-lead de-dupe: compare new heroHeadline + aboutParagraph 7-grams
      // against the recent corpus. Retry once with explicit feedback.
      if (recentNgrams.length) {
        const candidateText = `${parsed.heroHeadline || ''} ${parsed.aboutParagraph || ''}`;
        const candidate = ngramSet(candidateText, SITE_COPY_RULES.dedupeNgramSize);
        let maxRatio = 0;
        for (const prior of recentNgrams) {
          const ratio = jaccardOverlap(candidate, prior);
          if (ratio > maxRatio) maxRatio = ratio;
        }
        if (maxRatio >= SITE_COPY_RULES.dedupeOverlapThreshold) {
          overlapFeedback = { ratio: maxRatio };
          lastError = new Error(`overlap_with_prior_demo:${maxRatio.toFixed(2)}`);
          continue;
        }
      }

      return {
        ...parsed,
        mode,
        direction,
        variation: { voice: variation.voice.key, headlineStructure: variation.headlineStructure.key, aboutOpener: variation.aboutOpener.key },
      };
    } catch (err) {
      lastError = err;
    }
  }

  return null; // Caller handles null → skip demo for this lead
}

// Pick a variation set deterministically from lead.id. SHA-1 bytes give
// uniform distribution even on small ids.
function pickVariation(lead) {
  const idStr = String(lead?.id ?? lead?.businessKey ?? lead?.businessName ?? Math.random());
  const digest = crypto.createHash('sha1').update(idStr).digest();
  return {
    voice:             SITE_COPY_RULES.voicePool      [digest[0] % SITE_COPY_RULES.voicePool.length],
    headlineStructure: SITE_COPY_RULES.headlinePool   [digest[1] % SITE_COPY_RULES.headlinePool.length],
    aboutOpener:       SITE_COPY_RULES.aboutOpenerPool[digest[2] % SITE_COPY_RULES.aboutOpenerPool.length],
  };
}

function ngramSet(text, n = 7) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < n) return new Set();
  const out = new Set();
  for (let i = 0; i <= words.length - n; i += 1) out.add(words.slice(i, i + n).join(' '));
  return out;
}

function jaccardOverlap(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  const small = a.size <= b.size ? a : b;
  const large = small === a ? b : a;
  for (const g of small) if (large.has(g)) inter += 1;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function buildContentInput(lead, enrichment = {}, mode, direction, variation = null) {
  return {
    mode,
    direction,
    businessName: lead.businessName || null,
    city: lead.city || null,
    state: lead.state || null,
    phone: lead.phone || null,
    niche: lead.niche || null,
    ownerFirstName: enrichment.ownerFirstName || null,
    yearsInBusiness: enrichment.yearsInBusiness || null,
    averageRating: enrichment.averageRating || null,
    reviewCount: enrichment.reviewCount || null,
    bbbAccreditation: enrichment.bbbAccreditation || null,
    licenses: enrichment.licenses || [],
    serviceArea: enrichment.serviceArea || (lead.city ? [lead.city] : []),
    servicesVerified: (enrichment.servicesVerified || []).slice(0, 8),
    reviews: (enrichment.reviews || []).slice(0, 5),
    existingCopy: enrichment.existingCopy || null,
    // Per-lead variation seed — Claude must follow these directives exactly.
    variation: variation ? {
      voice: variation.voice.directive,
      headlineStructure: variation.headlineStructure.directive,
      aboutOpener: variation.aboutOpener.directive,
    } : null,
  };
}

function validateContent(content) {
  const checks = [];
  const wordCount = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;

  const hh = wordCount(content.heroHeadline);
  if (hh < SITE_COPY_RULES.heroHeadlineWords.min || hh > SITE_COPY_RULES.heroHeadlineWords.max) {
    checks.push(`heroHeadline word count out of range (${hh})`);
  }

  const hs = wordCount(content.heroSubhead);
  if (hs < SITE_COPY_RULES.heroSubheadWords.min || hs > SITE_COPY_RULES.heroSubheadWords.max) {
    checks.push(`heroSubhead word count out of range (${hs})`);
  }

  const ap = wordCount(content.aboutParagraph);
  if (ap < SITE_COPY_RULES.aboutParagraphWords.min || ap > SITE_COPY_RULES.aboutParagraphWords.max) {
    checks.push(`aboutParagraph word count out of range (${ap})`);
  }

  // Em-dash cap across the three big copy fields combined.
  const combinedCopy = [content.heroHeadline, content.heroSubhead, content.aboutParagraph]
    .map(v => String(v || ''))
    .join(' ');
  const emDashCount = (combinedCopy.match(/—/g) || []).length;
  if (emDashCount > SITE_COPY_RULES.maxEmDashesAcrossCopy) {
    checks.push(`em_dash_overuse: ${emDashCount}`);
  }

  const blob = JSON.stringify(content).toLowerCase();
  for (const phrase of SITE_COPY_RULES.bannedPhrases) {
    if (blob.includes(phrase.toLowerCase())) {
      checks.push(`banned phrase: ${phrase}`);
      break;
    }
  }
  for (const framing of SITE_COPY_RULES.bannedFramings) {
    if (blob.includes(framing.toLowerCase())) {
      checks.push(`banned framing: ${framing}`);
      break;
    }
  }

  return checks[0] || null;
}

function parseStrictJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

module.exports = {
  SITE_COPY_RULES,
  SYSTEM_PROMPT,
  generateSiteContent,
  // exposed for tests + sync script
  __test: { validateContent, parseStrictJson, pickVariation, ngramSet, jaccardOverlap, buildContentInput },
};
