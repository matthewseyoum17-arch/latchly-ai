/**
 * scripts/latchly-leads/site-content-engine.js
 *
 * Generates demo-site copy (hero, subhead, about, services, CTAs, trust items)
 * for a Latchly lead. Two modes:
 *   - 'souped-up'   : lead has an existing site; prefer their existingCopy
 *                     verbatim, fill gaps only.
 *   - 'fresh-build' : no existing site; generate from enrichment fact whitelist.
 *
 * Anti-AI-slop: word counts enforced, banned phrase list rejected.
 * On generation failure: returns null. Caller MUST handle null gracefully.
 */

const SITE_COPY_RULES = {
  heroHeadlineWords: { min: 4, max: 9 },
  heroSubheadWords: { min: 8, max: 18 },
  aboutParagraphWords: { min: 30, max: 70 },
  ctaWords: { min: 2, max: 5 },

  bannedPhrases: [
    'elevate your', "in today's world", 'leverage', 'seamless', 'cutting-edge',
    'world-class', 'best-in-class', 'industry-leading', 'one-stop shop',
    'second to none', 'unlock', 'empower', 'transformative', 'robust',
    'synergy', 'top-notch', 'unparalleled', 'tailored solutions',
    'committed to excellence', 'state-of-the-art', 'comprehensive solutions',
    'proudly serving', 'your trusted partner', 'we understand that',
    'in the heart of', 'nestled in', 'when it comes to',
  ],

  bannedFramings: [
    'with years of experience',
    'no job too big or too small',
    'voted #1',
  ],

  factWhitelist: [
    'businessName', 'city', 'state', 'phone',
    'servicesVerified', 'yearsInBusiness', 'ownerFirstName',
    'reviewCount', 'averageRating', 'serviceArea',
    'bbbAccreditation', 'licenses', 'existingCopy',
  ],
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
- BANNED phrases (reject and retry if any appear in output):
${SITE_COPY_RULES.bannedPhrases.map(p => '  - "' + p + '"').join('\n')}
- BANNED framings (don't position copy this way):
${SITE_COPY_RULES.bannedFramings.map(f => '  - ' + f).join('\n')}

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

  const input = buildContentInput(lead, enrichment, mode, direction);

  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const message = await anthropic.messages.create({
        model: opts.model || 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        temperature: 0.55,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Compose site copy. Mode: ${mode}. Direction: ${direction}. Return JSON only.\n\n<input>\n${JSON.stringify(input, null, 2)}\n</input>`,
          },
        ],
      });

      const text = (message.content || []).map(b => b.text || '').join('').trim();
      const parsed = parseStrictJson(text);
      if (!parsed) throw new Error('content_invalid_json');

      const violation = validateContent(parsed);
      if (violation) {
        lastError = new Error(`content_violation: ${violation}`);
        continue;
      }

      return { ...parsed, mode, direction };
    } catch (err) {
      lastError = err;
    }
  }

  return null; // Caller handles null → skip demo for this lead
}

function buildContentInput(lead, enrichment = {}, mode, direction) {
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
  // exposed for tests
  __test: { validateContent, parseStrictJson },
};
