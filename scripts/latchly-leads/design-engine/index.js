/**
 * design-engine/index.js
 *
 * Public entry point for per-lead demo generation. Two paths:
 *
 *   1. Bespoke (Phase B) — `claude -p` subprocess runs the huashu-design
 *      skill to scan the business and pick 3 directions, then builds 3
 *      candidates in parallel, polishes each via ui-ux-pro-max, and gates
 *      on impeccable + AEO presence + structural-sameness. Highest scoring
 *      candidate wins. Free under the operator's Claude Max plan but
 *      ~3-4 minutes per lead. Triggered when `LATCHLY_DEMO_ENGINE=bespoke`
 *      and the `claude` CLI is available.
 *
 *   2. Template (legacy) — fills `craft-editorial.html` with real per-
 *      business enrichment + content. Fast and free but every demo shares
 *      structure. The fallback path when bespoke is unavailable.
 */

const { pickDirection } = require('./directions');
const { loadTemplate, renderTemplate } = require('./render');
const { lintDemoHtml } = require('./lint');
const { isClaudeCliAvailable } = require('./claude-runner');

async function buildDemoForLead(lead, opts = {}) {
  if (!lead) throw new Error('lead required');

  const enrichment = opts.enrichment || {};
  const content = opts.content || {};
  const slug = opts.slug;
  const siteBase = opts.siteBase;

  // Bespoke path — opt-in via env flag (so the legacy pipeline keeps working
  // unchanged) AND the `claude` CLI must be present in the runtime.
  const wantBespoke = String(process.env.LATCHLY_DEMO_ENGINE || '').toLowerCase() === 'bespoke';
  if (wantBespoke) {
    const cliOk = await isClaudeCliAvailable();
    if (cliOk) {
      // Lazy-require: build-bespoke.js pulls in claude-runner.js + Claude
      // SDK transitively. Avoid the import cost on the legacy path.
      const { buildBespokeDemoForLead } = require('./build-bespoke');
      const bespoke = await buildBespokeDemoForLead(lead, {
        enrichment,
        content: opts.content, // null/undefined = engine generates copy itself
        slug,
        siteBase,
        anthropic: opts.anthropic,
        qualityFloor: opts.qualityFloor,
        recentCopy: opts.recentCopy,
        keepTemp: opts.keepTemp,
      });
      if (bespoke.ok) return bespoke;
      // Fall through to template — log the reason but never crash the run.
      // eslint-disable-next-line no-console
      console.warn(`[design-engine] bespoke failed (${bespoke.reason}); falling back to template`);
    } else {
      // eslint-disable-next-line no-console
      console.warn('[design-engine] LATCHLY_DEMO_ENGINE=bespoke but `claude` CLI unavailable; using template');
    }
  }

  // Template fallback — original engine.
  const direction = pickDirection(lead, enrichment);
  const template = loadTemplate(direction);
  const html = renderTemplate({
    template, lead, enrichment, content, direction,
    slug, siteBase,
  });

  const lint = await lintDemoHtml(html, { lead, enrichment });
  const floor = Number(opts.qualityFloor || process.env.LATCHLY_DEMO_QUALITY_FLOOR || 80);
  if (lint.score < floor) {
    return { ok: false, reason: 'demo_quality_fail', html, direction, lint };
  }
  return { ok: true, html, direction, qualityScore: lint.score, lint };
}

module.exports = {
  buildDemoForLead,
  pickDirection,
  loadTemplate,
  renderTemplate,
  lintDemoHtml,
};
