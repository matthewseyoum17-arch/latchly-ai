/**
 * design-engine/index.js
 *
 * Public entry point for per-lead demo generation. Picks a direction, fills a
 * curated template with real per-business enrichment + content, lints the
 * output, and returns either { ok:true, html, direction, qualityScore }
 * or { ok:false, reason, lint }.
 */

const { pickDirection } = require('./directions');
const { loadTemplate, renderTemplate } = require('./render');
const { lintDemoHtml } = require('./lint');

async function buildDemoForLead(lead, { enrichment, content, qualityFloor, slug, siteBase } = {}) {
  if (!lead) throw new Error('lead required');

  const direction = pickDirection(lead, enrichment || {});
  const template = loadTemplate(direction);
  const html = renderTemplate({
    template, lead, enrichment, content: content || {}, direction,
    slug, siteBase,
  });

  const lint = await lintDemoHtml(html, { lead, enrichment });
  const floor = Number(qualityFloor || process.env.LATCHLY_DEMO_QUALITY_FLOOR || 80);
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
