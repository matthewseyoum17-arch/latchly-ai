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
  initialEmailWords: { min: 60, max: 150 },
  subjectLineWords: { min: 3, max: 9 },

  // Hard cap: max 2 em-dashes per body. Em-dash repetition is the single
  // strongest AI cadence tell — humans use them but not 4-5 times in a 100
  // word email. Sign-off em-dash counts.
  maxEmDashesInBody: 2,

  bannedPhrases: [
    // Original ban list ----------------------------------------------------
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
    // Phase C expansion — AI cadence tells -------------------------------
    'delve', 'deep dive', 'dive into', 'in today\'s market',
    'in today\'s fast-paced', 'given that', 'I see that you',
    'navigate', 'in the spirit of', 'spearhead', 'as you may know',
    'I wanted to take a moment', 'I trust this finds you', 'thoughts on',
    'we noticed that', 'I\'d love to', 'empower your business',
    'drive growth', 'scalable solution', 'optimize your',
    'synergize', 'paradigm', 'holistic', 'ecosystem', 'journey',
    'streamline', 'going forward',
  ],

  bannedFramings: [
    // Original list -------------------------------------------------------
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
    // Phase C expansion ---------------------------------------------------
    'your business deserves',
    'time and time again',
    'the perfect partner',
    'turn-key solution',
    'value proposition',
    'mission-critical',
  ],

  // ── Per-lead variation pools (Phase C) ─────────────────────────────────
  // Hashed by lead.id so repeat composes are stable per-lead but vary
  // sharply across leads. Claude is forced to follow the chosen archetype.
  voicePool: [
    { key: 'trades-text-cadence', name: 'Trades-shop-owner-text-cadence',
      directive: 'Write like a contractor texting back: short choppy sentences, plain words, no jargon, no sales polish. Two- to five-word sentence fragments allowed.' },
    { key: 'wry-brand', name: 'Wry-brand-person',
      directive: 'Voice is brand-savvy but slightly self-deprecating. One small wink at the cold-outreach genre is allowed (not required). No agency-speak.' },
    { key: 'sales-engineer-direct', name: 'Sales-engineer-direct',
      directive: 'Numbers + concrete outcome only. Zero adjectives. Read like a one-screen Slack message from a senior engineer.' },
    { key: 'morning-coffee', name: 'Morning-coffee-friendly',
      directive: 'Warm, relaxed, conversational without being chatty. No exclamation points. Read like the second message of an existing thread, not the first.' },
    { key: 'no-bullshit-30s', name: 'No-bullshit-30-seconds',
      directive: 'Punchy: "here\'s the thing, [link], [question]". Three short paragraphs max. Cuts every word that isn\'t earning its place.' },
  ],

  openerPool: [
    { key: 'reference-based',
      directive: 'Open by referencing one specific thing on their site, profile, or service area. Format: "Saw your {detail} — {reaction}." Use a real fact from enrichment, never invented.' },
    { key: 'niche-question',
      directive: 'Open with a focused question for the niche + city. Format: "Quick one for a {niche} op in {city} — {observation}". The question is the bait; the demo is the answer.' },
    { key: 'direct-builder',
      directive: 'Open as the maker delivering work. Format: "Built a draft of a homepage for {businessName} last night — {one detail}". Lead with what was made, not what is wanted.' },
    { key: 'acquaintance',
      directive: 'Open by acknowledging the cold-email risk and earning the read. Format: "Going to risk you not opening this — {specific reason this is worth it}". Use only when there is a strong real-fact hook (review count, years, BBB rating).' },
    { key: 'single-fact-hook',
      directive: 'Open with one concrete real fact, then the implication. Format: "{specific real fact, e.g. \\"187 5★ reviews on Google\\"} — but the homepage doesn\'t say that anywhere yet." Requires a real reviewCount + averageRating in enrichment.' },
  ],

  lengthPool: [
    // Buckets are validator floors/ceilings — Haiku treats the prompt
    // ranges as soft targets, so we keep the lower bounds wider than the
    // directives say. The directives above are what the model actually
    // sees and aims for; the numbers below are what the validator tolerates.
    // Validator floors are wider than the directive ranges because Haiku
    // 4.5 routinely undershoots target word counts by ~15-25%. The
    // directives still create per-lead length variation; the floors only
    // catch truly broken output.
    { key: 'tight',  min: 40, max: 90,  directive: 'Body 50-85 words. Tight. Probably 2 short paragraphs.' },
    { key: 'medium', min: 55, max: 120, directive: 'Body 80-115 words. The default mid-length. Three short paragraphs.' },
    { key: 'long',   min: 80, max: 160, directive: 'Body 110-150 words. Use only when there is enough real detail to justify the room. Three or four paragraphs.' },
  ],

  signoffPool: [
    { key: 'em-matt',          format: '—{first}',                   directive: 'Sign off as a single dash, no space, then your first name. No company line.' },
    { key: 'matt-comma-co',    format: '{first}, Latchly',           directive: 'Sign off as "{first}, Latchly" on a single line.' },
    { key: 'matt-at-co',       format: '{first} @ Latchly',          directive: 'Sign off as "{first} @ Latchly" on a single line.' },
    { key: 'lower-slash',      format: '{lower} / latchly',          directive: 'Sign off as lowercased first name + " / latchly" on a single line.' },
    { key: 'em-founder',       format: '—{lower} (founder, Latchly)', directive: 'Sign off as a single dash, lowercased first name, then "(founder, Latchly)" on the same line.' },
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

  // Cross-lead de-dupe (Phase C) — overlap ratio above this triggers retry.
  dedupeOverlapThreshold: 0.4,
  // 7-gram window: small enough to catch reused phrasing, big enough to
  // ignore incidental token overlap (city names, common words).
  dedupeNgramSize: 7,
  // Compare against this many recent prior bodies.
  dedupeRecentLimit: 30,
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

═══ TONE — PER-LEAD VOICE / OPENER / LENGTH / SIGN-OFF ═══
The input includes a \`variation\` block with four hashed directives. Follow ALL FOUR EXACTLY — they're how we keep ten emails feeling like ten different humans wrote them, not ten outputs of the same prompt.
- variation.voice         — sentence cadence + register
- variation.opener        — the first sentence's shape
- variation.lengthBucket  — body word count (use the bucket's min/max, not the default 70-130)
- variation.signoff       — exact sign-off line, with your first name interpolated

If the chosen voice contradicts the structural rules above (e.g. trades-text-cadence wants two-word fragments), the structural rules still win — but stretch them as far as the voice allows.

═══ ANTI-AI-CADENCE RULES ═══
- Owner-to-owner. You're a builder showing real work, not an agency pitching services.
- Short declarative sentences. Active voice. Concrete nouns over abstract ones.
- Confident, not cute. Specific, not generic. Direct, not pushy.
- Grammar matters: complete sentences, periods, proper capitalization throughout.
- Em-dashes: max TWO across the entire body (sign-off em-dash counts as one). More is an AI tell.
- Never have two consecutive paragraphs both start with "I" — restructure if needed.
- Never reuse the same sentence opening template across the email's three paragraphs.

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
  // Sender first name comes from (in priority): opts.senderFirstName →
  // LATCHLY_SENDER_FIRST_NAME env → from-email local-part. Lets the
  // from-address stay `outreach@latchlyai.com` (good for IP reputation
  // / domain alignment) while the body sign-off still reads "Matt".
  const senderFirstNameRaw = opts.senderFirstName
    || process.env.LATCHLY_SENDER_FIRST_NAME
    || (fromEmail.split('@')[0] || 'matt');
  const senderFirstName = String(senderFirstNameRaw).replace(/[^a-z]/gi, '').toLowerCase() || 'matt';
  const unsubUrl = opts.unsubUrl || buildUnsubLink(lead, opts.siteBase);

  // Per-lead variation seeds — deterministic from lead.id so re-runs for
  // the same lead are stable but every distinct lead picks a different
  // archetype mix. Different bit slices of the seed pick each pool so the
  // four pools vary independently.
  const variation = pickVariation(lead, senderFirstName, enrichment);

  const input = buildComposerInput(lead, enrichment, demoUrl, {
    fromEmail,
    senderFirstName,
    unsubUrl,
    variation,
  });

  // Cross-lead de-dupe corpus (last N sent/queued/draft bodies). The caller
  // can pass these explicitly; otherwise we leave it empty and skip the
  // overlap check. Real production wiring lives in outreach-queue.js.
  const recentBodies = Array.isArray(opts.recentBodies) ? opts.recentBodies : [];
  const recentNgrams = recentBodies
    .map(body => ngramSet(String(body || ''), COLD_EMAIL_RULES.dedupeNgramSize))
    .filter(set => set.size > 0);

  let lastError = null;
  let bannedHit = null;
  let overlapFeedback = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const userContent = overlapFeedback
        ? `Compose the Day-0 email. Return JSON only.\n\n<input>\n${JSON.stringify(input, null, 2)}\n</input>\n\n<retry_feedback>\nThe prior attempt overlapped heavily with a recent send (${(overlapFeedback.ratio * 100).toFixed(0)}% 7-gram overlap). Use a fundamentally different opener, sentence rhythm, and vocabulary. Do NOT echo phrasing from the prior attempt.\n</retry_feedback>`
        : `Compose the Day-0 email. Return JSON only.\n\n<input>\n${JSON.stringify(input, null, 2)}\n</input>`;

      const message = await anthropic.messages.create({
        model: opts.model || 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        // Phase C: bumped 0.6 → 0.85. Haiku 4.5 rejects setting both
        // temperature and top_p ("invalid_request_error"), so we use
        // temperature alone — the variation-seed pools carry the rest of
        // the diversity budget.
        temperature: 0.85,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
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

      const structural = validateStructure({
        subject, body, demoUrl,
        businessName: lead.businessName,
        lengthBucket: variation.lengthBucket,
      });
      if (structural) {
        lastError = new Error(`structural: ${structural}`);
        continue;
      }

      // Cross-lead de-dupe — last gate before accepting the draft. If the
      // new body's 7-grams overlap >= threshold with any prior body, retry
      // with explicit feedback. Skipped when no recent corpus was supplied.
      if (recentNgrams.length) {
        const candidate = ngramSet(body, COLD_EMAIL_RULES.dedupeNgramSize);
        let maxRatio = 0;
        for (const prior of recentNgrams) {
          const ratio = jaccardOverlap(candidate, prior);
          if (ratio > maxRatio) maxRatio = ratio;
        }
        if (maxRatio >= COLD_EMAIL_RULES.dedupeOverlapThreshold) {
          overlapFeedback = { ratio: maxRatio };
          lastError = new Error(`overlap_with_prior_send:${maxRatio.toFixed(2)}`);
          continue;
        }
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
        variation: { voice: variation.voice.key, opener: variation.opener.key, length: variation.lengthBucket.key, signoff: variation.signoff.key },
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
  const variation = opts.variation || null;
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
    // Per-lead variation seed — Claude must follow these directives. See
    // COLD_EMAIL_RULES.{voicePool, openerPool, lengthPool, signoffPool}.
    variation: variation ? {
      voice: variation.voice.directive,
      opener: variation.opener.directive,
      lengthBucket: {
        min: variation.lengthBucket.min,
        max: variation.lengthBucket.max,
        directive: variation.lengthBucket.directive,
      },
      signoff: variation.signoffRendered,
      signoffDirective: variation.signoff.directive,
    } : null,
  };
}

// Pick a variation set deterministically from lead.id. Different bytes of
// a SHA-1 digest pick each pool so voice/opener/length/sign-off vary
// independently — two leads with adjacent ids will not share three of four.
// SHA-1 gives uniform distribution even on tiny inputs (FNV-1a was clumping
// on single-digit ids; observed 2/5 voices across 100 leads).
function pickVariation(lead, senderFirstName, enrichment) {
  const idStr = String(lead?.id ?? lead?.businessKey ?? lead?.businessName ?? Math.random());
  const digest = crypto.createHash('sha1').update(idStr).digest();

  const voice        = COLD_EMAIL_RULES.voicePool  [digest[0] % COLD_EMAIL_RULES.voicePool.length];
  const opener       = COLD_EMAIL_RULES.openerPool [digest[1] % COLD_EMAIL_RULES.openerPool.length];
  let lengthBucket   = COLD_EMAIL_RULES.lengthPool [digest[2] % COLD_EMAIL_RULES.lengthPool.length];
  const signoff      = COLD_EMAIL_RULES.signoffPool[digest[3] % COLD_EMAIL_RULES.signoffPool.length];

  // Content-aware bucket downgrade. Medium/long buckets ask for 80-150
  // words, but Haiku 4.5 refuses to pad — when there's no review/years/
  // services material to draw on, it consistently produces ~50-70 word
  // bodies and the validator hard-fails. Force tight when data is thin
  // so the directive matches the model's honest output. Better to send a
  // short honest email than waste retries chasing word count we can't fill.
  const reviewCount = Number(enrichment?.reviewCount || 0);
  const hasYears = Number(enrichment?.yearsInBusiness || 0) > 0;
  const servicesCount = (enrichment?.servicesVerified || []).length;
  const thinData = reviewCount === 0 && !hasYears && servicesCount === 0;
  if (thinData && lengthBucket.key !== 'tight') {
    lengthBucket = COLD_EMAIL_RULES.lengthPool.find(b => b.key === 'tight') || lengthBucket;
  }

  // Render the sign-off with the actual sender name interpolated, so the
  // prompt directive is a literal target the validator can check against.
  const first = capitalize(senderFirstName);
  const lower = String(senderFirstName || '').toLowerCase();
  const signoffRendered = signoff.format
    .replace('{first}', first)
    .replace('{lower}', lower);

  return { voice, opener, lengthBucket, signoff, signoffRendered };
}

// 7-gram set built from the body's normalized words. Used for overlap-based
// de-dupe against recent prior sends.
function ngramSet(text, n = 7) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < n) return new Set();
  const out = new Set();
  for (let i = 0; i <= words.length - n; i += 1) {
    out.add(words.slice(i, i + n).join(' '));
  }
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

function validateStructure({ subject, body, demoUrl, businessName, lengthBucket }) {
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

  // Sign-off: a non-empty last block with a recognizable Latchly signature.
  // The signoffPool gives the model freedom to drop the dash format ("Matt,
  // Latchly", "matt / latchly", etc.), so we accept any block that ends with
  // a Latchly-shaped token rather than requiring "Latchly\s*$" verbatim.
  const lastBlock = bodyTrim.split(/\n\s*\n/).pop() || '';
  if (!/latchly/i.test(lastBlock)) return 'body_missing_signoff';

  // Word count — honor the chosen length bucket if supplied; fall back to
  // the wide default range otherwise.
  const words = bodyTrim.split(/\s+/).filter(Boolean).length;
  const minW = lengthBucket?.min ?? 50;
  const maxW = lengthBucket?.max ?? 160;
  if (words < minW || words > maxW) return `body_word_count:${words}`;

  // Em-dash cap. AI cadence tells favor 4-5 em-dashes per email; humans
  // rarely use more than one or two. We allow up to maxEmDashesInBody.
  const emDashCount = (bodyTrim.match(/—/g) || []).length;
  if (emDashCount > COLD_EMAIL_RULES.maxEmDashesInBody) {
    return `body_em_dash_overuse:${emDashCount}`;
  }

  // No two consecutive paragraphs may both start with "I". Classic AI tell
  // ("I built…\n\nI'd love…\n\nI think…"). Detected over double-newline
  // splits so genuine intra-paragraph "I" is fine.
  const paragraphs = bodyTrim.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  for (let i = 1; i < paragraphs.length; i += 1) {
    if (/^I\b/.test(paragraphs[i]) && /^I\b/.test(paragraphs[i - 1])) {
      return 'body_consecutive_I_paragraphs';
    }
  }

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
  __test: { buildComposerInput, parseStrictJson, pickVariation, ngramSet, jaccardOverlap, validateStructure },
};
