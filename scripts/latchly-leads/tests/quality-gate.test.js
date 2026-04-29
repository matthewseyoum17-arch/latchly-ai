const test = require('node:test');
const assert = require('node:assert/strict');
const { enforcePremiumGate, runQualityGate } = require('../quality-gate');

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

test('quality gate accepts poor-site evidence at the scoring threshold', () => {
  const [lead] = makeBatch(1);
  const result = runQualityGate([{
    ...lead,
    website: 'https://threshold.example',
    websiteStatus: 'poor_website',
    leadType: 'poor_website_redesign',
    audit: {
      verifiedSignals: {
        evidenceIntegrity: { verifiable: true, issues: [] },
        websiteTruth: {
          status: 'real_business_website',
          confidence: 0.9,
          evidence: [{ source: 'test', url: 'https://threshold.example', detail: 'Business website', confidence: 0.9 }],
        },
        websiteQuality: {
          negativeSignals: [
            { reason: 'No mobile viewport detected', weight: 1.2, confidence: 0.9, source: 'test', url: 'https://threshold.example' },
            { reason: 'Weak responsive/mobile implementation signals', weight: 0.9, confidence: 0.9, source: 'test', url: 'https://threshold.example' },
            { reason: 'No clear quote CTA', weight: 0.8, confidence: 0.9, source: 'test', url: 'https://threshold.example' },
          ],
        },
      },
    },
  }], { minimum: 1, localQualified: 1 });

  assert.equal(result.ok, true);
});

test('premium gate accepts score 9+, 3+ signals, website issue, and confident decision maker', () => {
  const result = enforcePremiumGate([premiumLead()]);
  assert.equal(result.ok, true);
  assert.equal(result.leads.length, 1);
  assert.equal(result.leads[0].tier, 'premium');
});

test('premium gate rejects leads with fewer than three signals', () => {
  const result = enforcePremiumGate([premiumLead({ signalCount: 2 })]);
  assert.equal(result.ok, false);
  assert.equal(result.leads.length, 0);
  assert.match(result.rejected[0].reasons.join(' '), /Signal count/);
});

test('premium gate rejects leads below score 9', () => {
  const result = enforcePremiumGate([premiumLead({ score: 8.9 })]);
  assert.equal(result.ok, false);
  assert.equal(result.leads.length, 0);
  assert.match(result.rejected[0].reasons.join(' '), /Score below/);
});

test('premium gate rejects good-site leads', () => {
  const result = enforcePremiumGate([premiumLead({
    website: 'https://modern.example',
    websiteStatus: 'has_website',
    leadType: 'website_review',
    websiteIssue: false,
    audit: goodSiteAudit(),
  })]);
  assert.equal(result.ok, false);
  assert.equal(result.leads.length, 0);
  assert.match(result.rejected[0].reasons.join(' '), /no-website or poor-website/);
});

test('premium gate rejects missing or weak decision-maker confidence', () => {
  const result = enforcePremiumGate([premiumLead({
    decisionMakerConfidence: 0,
    decisionMaker: { name: '', confidence: 0 },
  })]);
  assert.equal(result.ok, false);
  assert.equal(result.leads.length, 0);
  assert.match(result.rejected[0].reasons.join(' '), /Decision-maker confidence/);
});

test('premium gate rejects niche dominance without under-target downgrade', () => {
  const leads = Array.from({ length: 12 }, (_, index) => premiumLead({
    businessName: `Dominant Roof ${index}`,
    niche: 'roofing contractor',
  }));
  const result = enforcePremiumGate(leads, { minimum: 50 });
  assert.equal(result.ok, false);
  const issue = result.issues.find(item => item.code === 'one_niche_dominance');
  assert.equal(issue?.severity, 'reject');
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

function premiumLead(overrides = {}) {
  return {
    ...makeBatch(1)[0],
    businessName: 'Premium Plumbing',
    score: 9.3,
    signalCount: 3,
    websiteIssue: true,
    decisionMaker: { name: 'Alicia Brown', title: 'Owner', confidence: 0.8 },
    decisionMakerConfidence: 0.8,
    ...overrides,
  };
}

function goodSiteAudit() {
  return {
    verifiedSignals: {
      evidenceIntegrity: { verifiable: true, issues: [] },
      websiteTruth: {
        status: 'real_business_website',
        confidence: 0.9,
        evidence: [{ source: 'test', url: 'https://modern.example', detail: 'Modern website', confidence: 0.9 }],
      },
      websiteQuality: {
        positiveSignals: [{ reason: 'Mobile viewport detected', source: 'test', url: 'https://modern.example', confidence: 0.9 }],
        negativeSignals: [],
      },
      signalSummary: { count: 3, websiteIssue: false, decisionMakerConfidence: 0.8 },
    },
  };
}
