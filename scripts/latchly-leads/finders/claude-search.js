/**
 * scripts/latchly-leads/finders/claude-search.js
 *
 * Verified-source finder of last resort: drive `claude -p` to do open-web
 * owner+email search via the CLI's WebFetch / WebSearch tools. The CLI
 * subprocess runs from the operator's IP, so it gets past Cloudflare /
 * BBB / Yelp bot-walls that defeat plain server-side fetch.
 *
 * Strategy (encoded in the prompt — Claude picks order based on niche):
 *   1. State contractor license board (FL DBPR / CA CSLB / TX TDLR / etc.)
 *      — for licensed trades the license-holder name IS the owner.
 *   2. Google Maps profile — "Response from the owner — Mike S." pattern.
 *   3. Facebook public Page — About section + reviews thanking owner.
 *   4. Business's own website "About" / "Meet the Team" page.
 *   5. Google search for "[business] [city] owner OR founder".
 *
 * Returns the same shape as other finders. Skipped automatically when
 * the `claude` CLI is unavailable (e.g., serverless deployment), so
 * production is unaffected.
 *
 * Wall time: 30-90s per call. Slot LAST in the chain.
 */

const { runClaudeJson, isClaudeCliAvailable } = require('../design-engine/claude-runner');

const LICENSED_NICHE_TOKENS = [
  'plumbing', 'plumber',
  'electrical', 'electrician',
  'hvac', 'heating', 'cooling', 'air condition',
  'general contractor', 'contractor', 'remodel', 'construction',
  'roofing', 'roofer',
  'pest control', 'exterminator',
  'pool', 'spa',
];

function isLicensedTrade(niche) {
  if (!niche) return false;
  const n = String(niche).toLowerCase();
  return LICENSED_NICHE_TOKENS.some(tok => n.includes(tok));
}

const STATE_LICENSE_HINTS = {
  FL: 'myfloridalicense.com (DBPR public license search)',
  CA: 'cslb.ca.gov/onlineservices/checklicenseII',
  TX: 'tdlr.texas.gov/LicenseSearch',
  NY: 'dos.ny.gov/licensing or appext20.dos.ny.gov',
  NJ: 'njconsumeraffairs.gov/lic',
  AZ: 'roc.az.gov/contractor-search',
  GA: 'sos.ga.gov',
  NC: 'nclbgc.org',
  VA: 'dpor.virginia.gov',
  MA: 'license.reg.state.ma.us',
};

function buildPrompt({ businessName, city, state, website, niche }) {
  const stateHint = state && STATE_LICENSE_HINTS[state.toUpperCase()]
    ? `For ${state}, the contractor license board is at ${STATE_LICENSE_HINTS[state.toUpperCase()]}.`
    : `Look up the state contractor license portal for ${state || 'this state'} (search "[state] contractor license lookup").`;

  const licensedHint = isLicensedTrade(niche)
    ? `This is a LICENSED trade (${niche}). The license-holder / qualifying-party name IS the owner. Check the state license board first — it's the highest-confidence source. ${stateHint}`
    : `This trade (${niche || 'unknown'}) is usually unlicensed. Skip license boards.`;

  const siteHint = website
    ? `The business has a website: ${website}. Try the About / Meet-the-Team / Our-Story / Contact pages — owner names are often on one of these.`
    : `The business has NO website. Don't try to find one — focus on directories and Maps.`;

  return [
    `Find the OWNER NAME (and ideally an email) for a small home-services business.`,
    ``,
    `Business: ${businessName}`,
    `City: ${city || 'unknown'}`,
    `State: ${state || 'unknown'}`,
    `Niche: ${niche || 'unknown'}`,
    `Website: ${website || 'none'}`,
    ``,
    `Use WebSearch and WebFetch to investigate. Try these sources, stop at first verified hit:`,
    ``,
    `1. ${licensedHint}`,
    `2. Google Maps: search Maps for "${businessName} ${city || ''}" and read review-response signatures. "Response from the owner — Mike S." gives a first name + initial — accept that as ownerName if no fuller name surfaces.`,
    `3. ${siteHint}`,
    `4. Facebook public Page (no login required for public Pages). Try "facebook.com/${(businessName || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase()}" or search Google for "facebook.com [business name]".`,
    `5. Google search for the business name + "owner" or "founder" — surfaces local press, podcasts, and "Best of [city]" articles.`,
    ``,
    `RULES — these are firm:`,
    `- Only return an owner name if you have direct, verifiable evidence (a quoted text passage, a license-board record, a Maps owner-response signature).`,
    `- NEVER pattern-guess or infer from email-prefix patterns. If you can't find verifiable evidence, return ok:false.`,
    `- Don't return a generic role string like "Owner" or "Manager" with no person name attached.`,
    `- Full name is best. First name + last initial is acceptable when that's all the source provides.`,
    `- For email: only return one if it appears verbatim on a verified source (license board, FB About, business website Contact page, BBB profile). No pattern-guesses.`,
    ``,
    `Output JSON between these literal fences. No commentary, no code fences, no markdown:`,
    ``,
    `<<<JSON_START>>>`,
    `{`,
    `  "ok": true,`,
    `  "ownerName": "Jane Smith",`,
    `  "ownerTitle": "Owner",`,
    `  "email": "jane@example.com",`,
    `  "source": "florida_license_board",`,
    `  "evidence": "License #CFC1234567 issued to JANE SMITH, viewed at myfloridalicense.com on <date>",`,
    `  "attempted": ["license_board", "google_maps"]`,
    `}`,
    ``,
    `<<<JSON_END>>>`,
    ``,
    `If nothing found:`,
    `<<<JSON_START>>>`,
    `{ "ok": false, "reason": "not_available", "attempted": ["license_board", "google_maps", "facebook", "google_search"] }`,
    `<<<JSON_END>>>`,
  ].join('\n');
}

async function find({ businessName, city, state, website, niche, mode } = {}) {
  if (!businessName) return { ok: false, reason: 'no_business_name', source: 'claude_search' };
  if (!(await isClaudeCliAvailable())) {
    return { ok: false, reason: 'claude_cli_unavailable', source: 'claude_search' };
  }

  const prompt = buildPrompt({ businessName, city, state, website, niche });
  const result = await runClaudeJson({
    prompt,
    // Sonnet is plenty for "find a name" — Opus would burn 2-3x the wall
    // time on a task that doesn't need the extra reasoning.
    model: 'claude-sonnet-4-6',
    effort: 'medium',
    allowedTools: 'WebSearch,WebFetch,Read',
    timeoutMs: 4 * 60 * 1000,
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason || 'claude_cli_failed',
      source: 'claude_search',
      attempted: ['claude_cli'],
    };
  }

  const json = result.json;
  if (!json || typeof json !== 'object') {
    return { ok: false, reason: 'unparsable_response', source: 'claude_search' };
  }
  if (!json.ok || !json.ownerName) {
    return {
      ok: false,
      reason: json.reason || 'not_available',
      source: 'claude_search',
      attempted: Array.isArray(json.attempted) ? json.attempted : [],
    };
  }

  const ownerName = String(json.ownerName).trim();
  // Belt-and-suspenders: even though the prompt forbids it, drop returns
  // that look like a generic role string slipped through.
  if (/^(owner|manager|operator|founder|principal|the team)$/i.test(ownerName)) {
    return { ok: false, reason: 'generic_role_returned', source: 'claude_search' };
  }

  const out = {
    ok: true,
    ownerName,
    ownerTitle: json.ownerTitle ? String(json.ownerTitle).trim() : null,
    source: `claude_search:${json.source || 'web'}`,
    // CLI-reasoned hits are worth less than structured DB hits but more
    // than blind WHOIS. 0.78 puts us above the 0.7 floor with margin.
    confidence: 0.78,
    evidence: { reasoning: json.evidence || '', attempted: json.attempted || [] },
  };
  if (json.email && /@/.test(String(json.email))) {
    out.email = String(json.email).trim().toLowerCase();
  }
  return out;
}

module.exports = { find };
