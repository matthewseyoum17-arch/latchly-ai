const test = require('node:test');
const assert = require('node:assert/strict');
const { decorateAudit, evaluatePromising } = require('../audit');
const { extractHtmlSignals } = require('../scoring');

test('no-site candidate is verified separately from unreachable website', () => {
  const noSiteLead = baseLead({ website: '' });
  const noSiteAudit = decorateAudit(noSiteLead, {
    status: 'no_website',
    finalUrl: '',
    html: '',
    signals: {},
    pagesChecked: [],
    auditor: 'none',
  });

  assert.equal(noSiteAudit.verifiedSignals.websiteTruth.status, 'no_site');
  assert.equal(noSiteAudit.verifiedSignals.evidenceIntegrity.verifiable, true);

  const unreachableLead = baseLead({ website: 'https://down.example' });
  const unreachableAudit = decorateAudit(unreachableLead, {
    status: 'unreachable',
    finalUrl: unreachableLead.website,
    html: '',
    signals: {},
    pagesChecked: [],
    auditor: 'fetch',
  });

  assert.equal(unreachableAudit.verifiedSignals.websiteTruth.status, 'unreachable');
  assert.equal(unreachableAudit.verifiedSignals.evidenceIntegrity.verifiable, false);
});

test('good modern site produces positive evidence and no score-driving poor-site evidence', () => {
  const lead = baseLead({ website: 'https://modern.example' });
  const html = `<html><head><meta name="viewport" content="width=device-width"><style>@media(max-width:600px){main{display:flex}} @font-face{font-family:x}</style><script type="application/ld+json">{}</script></head><body><main><a href="tel:3525551212">Call now</a><form></form><p>${'licensed insured reviews free estimate '.repeat(100)}</p></main></body></html>`;
  const audit = decorateAudit(lead, {
    status: 'audited',
    finalUrl: lead.website,
    html,
    signals: extractHtmlSignals(html, lead.website),
    pagesChecked: [lead.website],
    auditor: 'test',
  });

  assert.equal(audit.verifiedSignals.websiteTruth.status, 'real_business_website');
  assert.ok(audit.verifiedSignals.websiteQuality.positiveSignals.length >= 5);
  assert.equal(audit.verifiedSignals.websiteQuality.hasScoreDrivingEvidence, false);
});

function baseLead(overrides = {}) {
  return {
    businessName: 'Audit Test Roofing',
    niche: 'roofing contractor',
    city: 'Gainesville',
    state: 'FL',
    phone: '(352) 555-1212',
    ...overrides,
  };
}

test('promising gate auto-passes non-real-site statuses (no_site, unreachable, parked, directory)', () => {
  const noSiteAudit = decorateAudit(baseLead({ website: '' }), {
    status: 'no_website', finalUrl: '', html: '', signals: {}, pagesChecked: [], auditor: 'none',
  });
  assert.equal(evaluatePromising(noSiteAudit, {}).notPromising, false);
  assert.match(evaluatePromising(noSiteAudit, {}).reason, /^auto:no_site/);

  const unreachableAudit = decorateAudit(baseLead({ website: 'https://down.example' }), {
    status: 'unreachable', finalUrl: 'https://down.example', html: '', signals: {}, pagesChecked: [], auditor: 'fetch',
  });
  assert.equal(evaluatePromising(unreachableAudit, {}).notPromising, false);
  assert.match(evaluatePromising(unreachableAudit, {}).reason, /^auto:unreachable/);
});

test('promising gate rejects modern real site with no negatives', () => {
  const lead = baseLead({ website: 'https://modern.example' });
  const html = `<html><head><meta name="viewport" content="width=device-width"><style>@media(max-width:600px){main{display:flex}} @font-face{font-family:x}</style><script type="application/ld+json">{}</script></head><body><main><a href="tel:3525551212">Call now</a><form></form><p>${'licensed insured reviews free estimate '.repeat(100)}</p><footer>© 2026 Modern Co</footer></main></body></html>`;
  const signals = extractHtmlSignals(html, lead.website);
  const audit = decorateAudit(lead, {
    status: 'audited', finalUrl: lead.website, html, signals, pagesChecked: [lead.website], auditor: 'test',
  });
  const verdict = evaluatePromising(audit, signals);
  assert.equal(verdict.notPromising, true, 'modern site should NOT be promising for redesign');
  assert.deepEqual(verdict.negatives, []);
});

test('promising gate accepts real site with >=2 negatives', () => {
  const lead = baseLead({ website: 'http://stale.example' });
  // http (notHttps), no form, no tel, no CTA, stale copyright, thin content
  const html = `<html><head><title>Stale Site</title></head><body><h1>Welcome</h1><p>Stale copy 2018</p><footer>Copyright 2019</footer></body></html>`;
  const signals = extractHtmlSignals(html, lead.website);
  const audit = decorateAudit(lead, {
    status: 'audited', finalUrl: lead.website, html, signals, pagesChecked: [lead.website], auditor: 'test',
  });
  const verdict = evaluatePromising(audit, signals);
  assert.equal(verdict.notPromising, false, 'stale site SHOULD be promising for redesign');
  assert.ok(verdict.negatives.length >= 2, `expected >=2 negatives, got ${verdict.negatives.length}: ${verdict.negatives.join(', ')}`);
});

test('promising gate threshold respects LATCHLY_PROMISING_NEG_THRESHOLD env override', () => {
  const lead = baseLead({ website: 'http://onenegative.example' });
  // Build a site with exactly ONE negative: not-https only.
  const html = `<html><head><meta name="viewport" content="width=device-width"></head><body><a href="tel:3525551212">Call</a><form></form><p>Free estimate ${'reviews testimonials licensed bonded warranty insured '.repeat(100)}</p><footer>© ${new Date().getFullYear()} Co</footer></body></html>`;
  const signals = extractHtmlSignals(html, lead.website);
  const audit = decorateAudit(lead, {
    status: 'audited', finalUrl: lead.website, html, signals, pagesChecked: [lead.website], auditor: 'test',
  });

  // Default threshold (2): one negative is NOT promising for redesign
  delete process.env.LATCHLY_PROMISING_NEG_THRESHOLD;
  assert.equal(evaluatePromising(audit, signals).notPromising, true);

  // Override threshold to 1: one negative IS promising
  process.env.LATCHLY_PROMISING_NEG_THRESHOLD = '1';
  try {
    assert.equal(evaluatePromising(audit, signals).notPromising, false);
  } finally {
    delete process.env.LATCHLY_PROMISING_NEG_THRESHOLD;
  }
});
