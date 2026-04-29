/**
 * scripts/latchly-leads/cold-email-engine.js
 *
 * Single source of truth for the SYSTEM_PROMPT used to compose Day-0 cold
 * emails for Latchly leads. Both the runtime engine (this file) and the
 * Claude Code skill at ~/.claude/skills/cold-email-latchly/SKILL.md
 * derive from the same prompt body. Sync via scripts/dev/sync-cold-email-skill.js.
 */

const crypto = require('crypto');

// ── Tone bible (anti-AI-slop) ────────────────────────────────────────────────

const COLD_EMAIL_RULES = {
  initialEmailWords: { min: 70, max: 140 },
  subjectLineWords: { min: 3, max: 9 },

  bannedPhrases: [
    'game changer', '10x', 'explosive growth', 'revolutionize',
    'AI-powered growth machine', 'quick question', 'just bumping this',
    'once-in-a-lifetime', 'hope you\'re doing well', 'reaching out because',
    'just wanted to', 'just checking in', 'circling back',
    'just following up', 'touching base',
    'elevate your', 'leverage', 'seamless', 'cutting-edge',
    'world-class', 'best-in-class', 'industry-leading', 'one-stop shop',
    'unlock', 'empower', 'transformative', 'robust',
    'top-notch', 'unparalleled', 'tailored solutions',
    'committed to excellence', 'state-of-the-art',
    'proudly serving', 'your trusted partner', 'we understand that',
    'in the heart of', 'nestled in', 'when it comes to',
  ],

  bannedFramings: [
    'spotted a huge issue',
    'your site is bad',
    'your site is ugly',
    'your site is broken',
    'costing you leads',
    'report card',
    'audit results',
    'we found issues',
    'I noticed your business',
    'I came across your business',
  ],

  // Personalization sources, used in priority order. Use only what's in the
  // enrichment payload — never invent a fact.
  personalizationSources: [
    'ownerFirstName',
    'topReview (real review text or theme)',
    'topService + city',
    'reviewCount + averageRating (if both present)',
    'yearsInBusiness',
    'bbbAccreditation rating',
  ],

  hookHierarchy: [
    'specific real review or service in their actual city',
    'response-time / urgency / availability',
    'verified trust signal (BBB rating, years, review volume)',
    'price clarity',
  ],

  ctaStyles: [
    'soft permission',     // "if it sparks any ideas, happy to walk through it"
    'opinion ask',         // "worth a look?"
    'low-friction link',   // "take a look if you get a minute"
    'simple reply',        // "want the link?"
  ],
};

// ── SYSTEM_PROMPT (canonical body — synced into the skill) ──────────────────

const SYSTEM_PROMPT = `You are the cold email composer for Latchly, a service that ships custom-built website demos to home-services owners (plumbers, HVAC, roofers, electricians, contractors).

YOUR JOB
Write ONE Day-0 cold email per lead — subject + body — that an owner-operator would actually open and reply to. The lead has a real demo URL waiting at \`demoUrl\` (the demo IS the hero of the email).

OUTPUT
Return strict JSON only, no prose:
{
  "subject": string,
  "body": string,
  "plainText": string
}

\`body\` is plain text only (no HTML). \`plainText\` MUST equal \`body\` plus a final line: "If you'd rather not hear from me, reply 'unsubscribe' or use this link: <UNSUB_URL>".

VOICE
- First-person, conversational, direct. You = a sharp dev who actually built them a sample homepage, not an SDR.
- Owner-operator vocabulary, not agency-speak.
- Short sentences. Short paragraphs. White space matters.
- Subject line: 3-9 words, lowercase or sentence-case, NEVER ALL CAPS, NEVER emojis, no exclamation marks.

PERSONALIZATION (priority order — use only what's in enrichment, never invent)
1. Lead with the demo: "Built {{businessName}} a quick homepage preview" — phrased so they feel it's already done, waiting for them.
2. ONE specific, verifiable hook from enrichment:
   - real review theme or quoted phrase ("you keep getting tagged for same-day repairs")
   - real service + their actual city ("{{topService}} jobs in {{city}}")
   - review volume + rating ("{{reviewCount}}+ {{averageRating}}★ reviews")
   - owner first name in the greeting if confidence high
3. ONE conversion angle relevant to their niche (e.g. "after-hours form so you stop missing 9pm calls").

DEMO LINK
Reference the demo URL exactly once, framed as already built: "Pulled it together this morning — {{demoUrl}}" or "Quick look here: {{demoUrl}}". Never say "I'll build you one if you want" — it's already built.

CTA
ONE soft CTA only. Acceptable: "want me to walk through what's different from your current site?" / "worth a look?" / "want the link?" / "open to a 5-min call this week?". NEVER stack two asks.

LENGTH
Body: 70-140 words. Subject: 3-9 words.

BANNED PHRASES (reject + retry if any appear)
${COLD_EMAIL_RULES.bannedPhrases.map(p => '- "' + p + '"').join('\n')}

BANNED FRAMINGS (don't position the email this way)
${COLD_EMAIL_RULES.bannedFramings.map(p => '- ' + p).join('\n')}

DO NOT
- Mention "AI" except as a passing benefit at most once.
- Insult their current site. Don't say "outdated", "broken", "bad", "ugly".
- Open with "I noticed" / "I came across" / "Hope you're doing well".
- Use bullet points or section headers in the body.
- Promise specific lead numbers / ROI you can't back.
- Sign-off with "Best regards" or "Sincerely" — use first name only or "— Matt".

DO
- Use ONE owner-operator phrase that sounds like a person, not a brand: "ran a few iterations", "leans into your reviews", "kept the booking flow tight".
- End the body with a soft CTA on its own line.
- Sign as "Matt" or "Matthew" — whatever fromEmail's local-part suggests.

VERIFICATION CHECKLIST (mental check before returning)
- demoUrl appears EXACTLY once in body.
- businessName appears at least once.
- city OR top service from enrichment appears at least once.
- No banned phrase or framing.
- Body is 70-140 words.
- One CTA only.
- Plain text version ends with the unsubscribe line.

If a fact is missing from enrichment, write a leaner email — never invent.`;

// ── Runtime engine ───────────────────────────────────────────────────────────

async function composeColdEmailForLead(lead, enrichment, demoUrl, opts = {}) {
  if (!lead) throw new Error('lead required');
  if (!demoUrl) throw new Error('demoUrl required');

  const anthropic = opts.anthropic;
  if (!anthropic) throw new Error('anthropic client required');

  const fromEmail = opts.fromEmail || 'matt@latchlyai.com';
  const senderFirstName = (fromEmail.split('@')[0] || 'matt').replace(/[^a-z]/gi, '') || 'matt';
  const unsubUrl = opts.unsubUrl || buildUnsubLink(lead, opts.siteBase);

  const input = buildComposerInput(lead, enrichment, demoUrl, {
    fromEmail,
    senderFirstName,
    unsubUrl,
  });

  let lastError = null;
  let bannedHit = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const message = await anthropic.messages.create({
        model: opts.model || 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        temperature: 0.6,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Compose the Day-0 email. Return JSON only.\n\n<input>\n${JSON.stringify(input, null, 2)}\n</input>`,
          },
        ],
      });

      const text = (message.content || []).map(b => b.text || '').join('').trim();
      const parsed = parseStrictJson(text);
      if (!parsed) throw new Error('compose_invalid_json');

      const subject = String(parsed.subject || '').trim();
      const body = String(parsed.body || '').trim();
      if (!subject || !body) throw new Error('compose_empty_fields');

      const banned = findBanned(`${subject}\n${body}`);
      if (banned) {
        bannedHit = banned;
        continue;
      }

      const plainText =
        String(parsed.plainText || `${body}\n\n— ${capitalize(senderFirstName)}\n\nIf you'd rather not hear from me, reply 'unsubscribe' or use this link: ${unsubUrl}`)
          .replace('<UNSUB_URL>', unsubUrl)
          .trim();

      return {
        subject,
        body,
        plainText,
        hash: hashEmail(subject, body),
        attempts: attempt + 1,
        unsubUrl,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`compose_failed: ${lastError?.message || bannedHit || 'unknown'}`);
}

function buildComposerInput(lead, enrichment = {}, demoUrl, opts = {}) {
  const review = pickReview(enrichment.reviews);
  const topService = (enrichment.servicesVerified || [])[0] || lead.niche || null;
  return {
    businessName: lead.businessName || null,
    city: lead.city || null,
    state: lead.state || null,
    niche: lead.niche || null,
    ownerFirstName: enrichment.ownerFirstName || null,
    ownerName: enrichment.ownerName || null,
    yearsInBusiness: enrichment.yearsInBusiness || null,
    averageRating: enrichment.averageRating || null,
    reviewCount: enrichment.reviewCount || null,
    bbbAccreditation: enrichment.bbbAccreditation || null,
    topService,
    topReview: review
      ? { author: review.author, rating: review.rating, text: review.text.slice(0, 280), source: review.source }
      : null,
    servicesVerified: (enrichment.servicesVerified || []).slice(0, 6),
    demoUrl,
    fromEmail: opts.fromEmail,
    senderFirstName: opts.senderFirstName,
    unsubUrl: opts.unsubUrl,
  };
}

function pickReview(reviews) {
  if (!Array.isArray(reviews) || !reviews.length) return null;
  // prefer 5-star reviews with longer text
  const sorted = [...reviews].sort((a, b) => {
    const aScore = (a.rating || 0) * 1000 + (a.text?.length || 0);
    const bScore = (b.rating || 0) * 1000 + (b.text?.length || 0);
    return bScore - aScore;
  });
  return sorted[0];
}

function findBanned(text) {
  const lower = String(text || '').toLowerCase();
  for (const phrase of COLD_EMAIL_RULES.bannedPhrases) {
    if (lower.includes(phrase.toLowerCase())) return phrase;
  }
  for (const framing of COLD_EMAIL_RULES.bannedFramings) {
    if (lower.includes(framing.toLowerCase())) return framing;
  }
  return null;
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

function buildUnsubLink(lead, siteBase) {
  const base = (siteBase || process.env.SITE_BASE || 'https://latchlyai.com').replace(/\/+$/, '');
  const key = encodeURIComponent(lead?.businessKey || lead?.email || '');
  return `${base}/api/unsubscribe?k=${key}`;
}

function hashEmail(subject, body) {
  return crypto.createHash('sha1').update(`${subject}\n${body}`).digest('hex').slice(0, 12);
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

module.exports = {
  COLD_EMAIL_RULES,
  SYSTEM_PROMPT,
  composeColdEmailForLead,
  findBanned,
  // exposed for tests
  __test: { buildComposerInput, parseStrictJson },
};
