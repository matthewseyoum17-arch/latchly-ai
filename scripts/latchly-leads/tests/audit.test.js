const test = require('node:test');
const assert = require('node:assert/strict');
const { decorateAudit } = require('../audit');
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
