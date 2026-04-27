const test = require('node:test');
const assert = require('node:assert/strict');
const { runQualityGate } = require('../quality-gate');

test('quality gate rejects flat score distribution', () => {
  const leads = makeBatch(50).map(lead => ({ ...lead, score: 8.5 }));
  const result = runQualityGate(leads, { minimum: 50, localQualified: 8 });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(issue => issue.code === 'flat_score_distribution'));
});

test('quality gate rejects unverifiable score reasons', () => {
  const leads = makeBatch(50);
  leads[0] = { ...leads[0], audit: { verifiedSignals: { evidenceIntegrity: { verifiable: false, issues: ['missing evidence'] } } } };
  const result = runQualityGate(leads, { minimum: 50, localQualified: 8 });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(issue => issue.code === 'unverifiable_audit_evidence'));
});

test('quality gate rejects all-good-site batches', () => {
  const leads = makeBatch(50).map(lead => ({
    ...lead,
    website: 'https://good-site.example',
    websiteStatus: 'has_website',
    leadType: 'website_review',
  }));
  const result = runQualityGate(leads, { minimum: 50, localQualified: 8 });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(issue => issue.code === 'all_good_sites'));
});

test('quality gate rejects one-niche dominance', () => {
  const leads = makeBatch(50).map(lead => ({ ...lead, niche: 'roofing contractor' }));
  const result = runQualityGate(leads, { minimum: 50, localQualified: 8 });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(issue => issue.code === 'one_niche_dominance'));
});

test('quality gate accepts 50+ verified score 8+ leads and preserves descending ranking', () => {
  const leads = makeBatch(55);
  const result = runQualityGate(leads.reverse(), { minimum: 50, localQualified: 8 });
  assert.equal(result.ok, true);
  assert.equal(result.underTarget, false);
  assert.equal(result.leads.length, 55);
  for (let i = 1; i < result.leads.length; i++) {
    assert.ok(result.leads[i - 1].score >= result.leads[i].score);
  }
});

function makeBatch(count) {
  const niches = ['roofing contractor', 'hvac contractor', 'plumber', 'electrician', 'tree service', 'pest control'];
  return Array.from({ length: count }, (_, index) => {
    const noSite = index % 2 === 0;
    const score = 9.9 - ((index % 17) * 0.1);
    return {
      businessName: `Verified Lead ${index}`,
      niche: niches[index % niches.length],
      city: index < 10 ? (index % 2 ? 'Tallahassee' : 'Gainesville') : 'Dallas',
      state: index < 10 ? 'FL' : 'TX',
      phone: `(555) 555-${String(1000 + index).slice(-4)}`,
      score,
      isLocalMarket: index < 10,
      website: noSite ? '' : `https://poor-site-${index}.example`,
      websiteStatus: noSite ? 'no_website' : 'poor_website',
      leadType: noSite ? 'no_website_creation' : 'poor_website_redesign',
      audit: noSite ? noSiteAudit() : poorSiteAudit(index),
    };
  });
}

function noSiteAudit() {
  return {
    verifiedSignals: {
      evidenceIntegrity: { verifiable: true, issues: [] },
      websiteTruth: {
        status: 'no_site',
        confidence: 0.95,
        evidence: [{ source: 'source_candidate', url: '', detail: 'No website URL', confidence: 0.95 }],
      },
      websiteQuality: { negativeSignals: [] },
    },
  };
}

function poorSiteAudit(index) {
  const url = `https://poor-site-${index}.example`;
  return {
    verifiedSignals: {
      evidenceIntegrity: { verifiable: true, issues: [] },
      websiteTruth: {
        status: 'real_business_website',
        confidence: 0.9,
        evidence: [{ source: 'test', url, detail: 'Business website returned usable evidence', confidence: 0.9 }],
      },
      websiteQuality: {
        negativeSignals: [
          { reason: 'No mobile viewport detected', weight: 1.2, confidence: 0.9, source: 'test', url },
          { reason: 'Weak responsive/mobile implementation signals', weight: 0.9, confidence: 0.9, source: 'test', url },
          { reason: 'Outdated front-end technology detected', weight: 1.2, confidence: 0.9, source: 'test', url },
          { reason: 'Stale copyright year: 2018', weight: 1, confidence: 0.9, source: 'test', url },
        ],
      },
    },
  };
}
