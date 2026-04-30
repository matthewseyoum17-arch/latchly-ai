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

const SYSTEM_PROMPT = `You are the cold email composer for Latchly, a B2B service that delivers custom-built website demos to home-services business owners (plumbers, HVAC, roofers, electricians, contractors).

YOUR JOB
Compose ONE Day-0 cold email — subject + body — that a busy owner-operator would actually open on their phone, read in 30 seconds, and reply to. A working demo URL is already live at \`demoUrl\`. The demo IS the hero of the email.

OUTPUT
Strict JSON only, no prose, no markdown:
{
  "subject": string,
  "body": string,
  "plainText": string
}

\`body\` is plain text (no HTML). \`plainText\` is \`body\` followed by:
"\\n\\nIf you'd rather not hear from me, reply 'unsubscribe' or use this link: <UNSUB_URL>"

═══ SUBJECT LINE — STRICT RULES ═══
- 4-8 words, sentence-case (capitalize the first word + proper nouns + business name).
- Business name MUST appear, capitalized exactly as in input.
- NEVER all-lowercase, NEVER ALL CAPS, NEVER emojis, NEVER exclamation marks.
- End with a clear noun phrase or a brief question. No filler verbs ("just", "quick", "real quick").
- GOOD: "Homepage redesign for Cornerstone Refinishing" / "Quick redesign for Cornerstone Refinishing" / "Cornerstone Refinishing — homepage idea" / "Built a homepage redesign for Cornerstone Refinishing"
- BAD: "built cornerstone refinishing a quick homepage" (lowercase, missing punctuation, awkward word order)
- BAD: "QUICK QUESTION!!" (caps, exclamation, banned phrase)

═══ BODY STRUCTURE — 4 PARTS, IN ORDER ═══

1. **Greeting line** (1 line, then blank line)
   - "Hi {{ownerFirstName}}," if ownerFirstName is provided AND not empty
   - "Hi there," if ownerFirstName is missing
   - NEVER "Dear", NEVER "Hey {{firstName}}!", NEVER "Hope this finds you well"

2. **Hook + value paragraph** (2-3 short sentences, ~30-50 words)
   - Lead with what you DID, not what you'd LIKE to do: "I built a homepage redesign for {{businessName}}…"
   - Anchor it to ONE specific, verifiable detail from enrichment:
     * a real review theme: "leaning into your {{reviewCount}}+ five-star reviews"
     * a real service in their city: "focused on {{topService}} jobs in {{city}}"
     * verified credential: "BBB {{bbbRating}}, {{yearsInBusiness}} years in {{city}}"
   - End with one concrete thing the redesign improves (mobile flow, after-hours capture, quote clarity).

3. **Demo link** (own line, blank lines above + below)
   - Format: "Preview: {{demoUrl}}"
   - OR: "Live preview: {{demoUrl}}"
   - The URL appears EXACTLY ONCE in the body.

4. **CTA + sign-off** (1 short question, blank line, dash + name + company)
   - CTA must be ONE low-friction question, ending with "?":
     * "Worth 60 seconds?"
     * "Worth a quick look?"
     * "Open to a 5-minute walk-through this week?"
     * "Want me to send a written summary?"
   - Sign-off: a blank line, then "—" on its own line OR "Thanks,", then sender first name on next line, then "Latchly" on the last line.
   - Example sign-off:
     \`\`\`
     —
     Matt
     Latchly
     \`\`\`

═══ TOTAL LENGTH ═══
Body: 70-130 words. Subject: 4-8 words. Hard caps — go shorter, never longer.

═══ TONE ═══
- Owner-to-owner. You're a builder showing real work, not an agency pitching services.
- Short declarative sentences. Active voice. Concrete nouns over abstract ones.
- Confident, not cute. Specific, not generic. Direct, not pushy.
- Grammar matters: complete sentences, periods, proper capitalization throughout.

═══ BANNED PHRASES — REJECT IF PRESENT ═══
${COLD_EMAIL_RULES.bannedPhrases.map(p => '  - "' + p + '"').join('\n')}

═══ BANNED FRAMINGS — DON'T POSITION THIS WAY ═══
${COLD_EMAIL_RULES.bannedFramings.map(p => '  - ' + p).join('\n')}

═══ HARD DON'TS ═══
- DO NOT mention "AI" — they don't care, and it cheapens the offer.
- DO NOT criticize their current site ("outdated", "broken", "needs work").
- DO NOT open with "I noticed" / "I came across" / "Hope you're doing well" / "Hope this finds you well".
- DO NOT use bullet lists, numbered lists, or section headers in the body.
- DO NOT promise specific revenue / lead numbers you can't back up.
- DO NOT sign off with "Best regards" / "Sincerely" / "Cheers" — use the dash format.
- DO NOT mention "demo" before the link itself appears — the link IS the demo reveal.

═══ FACT WHITELIST ═══
Use only these enrichment fields. If a field is missing, OMIT it — never invent:
businessName, city, state, niche, ownerFirstName, yearsInBusiness, averageRating,
reviewCount, bbbAccreditation, topService, topReview, servicesVerified, demoUrl.

═══ FINAL CHECKLIST (run mentally before returning) ═══
☑ Subject is sentence-case, 4-8 words, contains capitalized business name.
☑ Body opens with "Hi {firstName}," or "Hi there,".
☑ Body contains demoUrl EXACTLY once.
☑ Body contains businessName at least once (correctly capitalized).
☑ City OR a verified service from enrichment appears at least once.
☑ Body is 70-130 words.
☑ One question mark only (the CTA).
☑ Sign-off ends with sender first name on its own line + "Latchly" on the next.
☑ No banned phrase or framing anywhere.

═══ EXAMPLE (target quality) ═══
{
  "subject": "Homepage redesign for Cornerstone Refinishing",
  "body": "Hi Wei,\\n\\nI built a homepage redesign for Cornerstone Refinishing — leaning into the bathtub and tile refinishing work you do across Dallas. Cleaner quote flow, mobile-tightened, and a simple after-hours capture form so you stop missing late-night requests.\\n\\nPreview: https://latchlyai.com/demo/cornerstone-refinishing-dallas-tx\\n\\nWorth 60 seconds?\\n\\n—\\nMatt\\nLatchly"
}`;

// ── Runtime engine ───────────────────────────────────────────────────────────

async function composeColdEmailForLead(lead, enrichment, demoUrl, opts = {}) {
  if (!lead) throw new Error('lead required');
  if (!demoUrl) throw new Error('demoUrl required');

  // Belt-and-suspenders: pattern-guessed emails are permanently off (see
  // scripts/latchly-leads/finders/). If a stale row with pattern_guess
  // provenance somehow reaches us, refuse to compose. The migration
  // (021-purge-guessed-emails.sql) clears historical rows; this throw catches
  // anything mid-flight that bypassed it.
  const provenance = String(
    lead.emailProvenance
    || lead.email_provenance
    || enrichment?.emailProvenance
    || enrichment?.guessedEmailMethod
    || '',
  ).toLowerCase();
  if (/pattern_?guess/.test(provenance)) {
    throw new Error(`refused_pattern_guess_email:${provenance}`);
  }

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

      const structural = validateStructure({ subject, body, demoUrl, businessName: lead.businessName });
      if (structural) {
        lastError = new Error(`structural: ${structural}`);
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

function validateStructure({ subject, body, demoUrl, businessName }) {
  // Subject: not all-lowercase, no exclamation, sensible length, contains business name.
  const subjTrim = String(subject || '').trim();
  if (!subjTrim) return 'subject_empty';
  if (subjTrim === subjTrim.toLowerCase()) return 'subject_all_lowercase';
  if (subjTrim === subjTrim.toUpperCase()) return 'subject_all_caps';
  if (/[!?]{2,}|[!]/.test(subjTrim)) return 'subject_has_exclamation';
  const subjWords = subjTrim.split(/\s+/).filter(Boolean).length;
  if (subjWords < 3 || subjWords > 10) return 'subject_word_count';
  if (businessName && !subjTrim.toLowerCase().includes(String(businessName).toLowerCase())) {
    return 'subject_missing_business_name';
  }

  // Body: greeting, demo link exactly once, sign-off, businessName present.
  const bodyTrim = String(body || '').trim();
  if (!bodyTrim) return 'body_empty';
  if (!/^Hi\s+(there|[A-Z][a-zA-Z]*)\s*[,:—-]/.test(bodyTrim)) return 'body_missing_greeting';

  const demoCount = bodyTrim.split(demoUrl).length - 1;
  if (demoCount !== 1) return `body_demo_link_count:${demoCount}`;

  if (businessName && !bodyTrim.toLowerCase().includes(String(businessName).toLowerCase())) {
    return 'body_missing_business_name';
  }

  // Sign-off: must end with —/Thanks/dash + name on a separate line + Latchly on the next.
  const lastBlock = bodyTrim.split(/\n\s*\n/).pop() || '';
  if (!/Latchly\s*$/i.test(lastBlock)) return 'body_missing_signoff';

  // Word count.
  const words = bodyTrim.split(/\s+/).filter(Boolean).length;
  if (words < 50 || words > 160) return `body_word_count:${words}`;

  return null;
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
  // Match the existing /api/unsubscribe contract: email + token=base64url(email).
  // The route updates both `prospects` and `latchly_leads` rows by email.
  const email = String(lead?.email || '').toLowerCase().trim();
  if (!email) return `${base}/api/unsubscribe`;
  const token = Buffer.from(email).toString('base64url');
  return `${base}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
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
