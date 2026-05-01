/**
 * design-engine/index.js
 *
 * Public entry point for per-lead demo generation. Bespoke-only:
 *
 *   `claude -p` subprocess runs huashu-design to scan the business and
 *   pick 3 directions from different design philosophies, builds 3
 *   candidates in parallel (each with a different photo treatment),
 *   polishes each via ui-ux-pro-max, and gates on impeccable +
 *   AEO presence + structural-sameness. Highest-scoring candidate wins.
 *
 * No template fallback. The previous craft-editorial.html template made
 * every demo look identical, which is the bug we're fixing. If the CLI
 * is unavailable, we hard-fail loudly so the operator notices and the
 * pipeline never silently degrades.
 *
 * Architecture note: bespoke runs LOCALLY via `npm run leads:funnel:daily`.
 * Vercel cron cannot run bespoke (the `claude` binary isn't on PATH and
 * Max-plan auth is bound to the operator's local login), so the cron
 * stays drain-only.
 */

const { isClaudeCliAvailable } = require('./claude-runner');
const { lintDemoHtml } = require('./lint');
const { appendTrace } = require('../build-trace');

async function buildDemoForLead(lead, opts = {}) {
  if (!lead) throw new Error('lead required');

  const enrichment = opts.enrichment || {};
  const slug = opts.slug;
  const siteBase = opts.siteBase;

  if (!(await isClaudeCliAvailable())) {
    // eslint-disable-next-line no-console
    console.error('[design-engine] HARD FAIL: claude CLI unavailable. Bespoke demo generation requires the Claude Code CLI on PATH (Max-plan auth). Run `which claude` to verify.');
    await appendTrace(slug || 'unknown', {
      businessKey: lead.businessKey || null,
      businessName: lead.businessName || null,
      path: 'failed',
      fallbackReason: 'claude_cli_unavailable_hard',
    }, { storage: opts.storage });
    return { ok: false, reason: 'claude_cli_unavailable_hard' };
  }

  const { buildBespokeDemoForLead } = require('./build-bespoke');
  const bespoke = await buildBespokeDemoForLead(lead, {
    enrichment,
    content: opts.content,
    slug,
    siteBase,
    anthropic: opts.anthropic,
    qualityFloor: opts.qualityFloor,
    recentCopy: opts.recentCopy,
    keepTemp: opts.keepTemp,
    storage: opts.storage,
    candidatesCount: opts.candidatesCount,
  });

  if (!bespoke.ok) {
    // eslint-disable-next-line no-console
    console.error(`[design-engine] bespoke failed (${bespoke.reason})`);
    if (bespoke.scanError) {
      // eslint-disable-next-line no-console
      console.error(`[design-engine] scan stderr/stdout (truncated):\n${String(bespoke.scanError).slice(0, 2000)}`);
    }
    if (bespoke.candidatesScored) {
      // eslint-disable-next-line no-console
      console.error('[design-engine] candidate scores:', JSON.stringify(bespoke.candidatesScored, null, 2));
    }
  }
  return bespoke;
}

module.exports = {
  buildDemoForLead,
  lintDemoHtml,
};
