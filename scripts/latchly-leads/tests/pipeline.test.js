const test = require('node:test');
const assert = require('node:assert/strict');
const { auditAndScoreCandidates, buildAuditWaves } = require('../pipeline');

test('bounded audit batches preserve candidate scoring order', async () => {
  const candidates = [
    fakeCandidate('Slow Plumbing'),
    fakeCandidate('Fast Roofing'),
    fakeCandidate('Next HVAC'),
  ];
  const scoreOrder = [];
  let activeAudits = 0;
  let maxActiveAudits = 0;

  const result = await auditAndScoreCandidates(candidates, new Set(), {
    auditConcurrency: 2,
    maxQualified: 3,
    auditLead: async lead => {
      activeAudits++;
      maxActiveAudits = Math.max(maxActiveAudits, activeAudits);
      await wait(lead.businessName.startsWith('Slow') ? 25 : 1);
      activeAudits--;
      return fakeAudit();
    },
    scoreLead: candidate => {
      scoreOrder.push(candidate.businessName);
      return fakeScore(candidate);
    },
  });

  assert.equal(maxActiveAudits, 2);
  assert.deepEqual(scoreOrder, candidates.map(candidate => candidate.businessName));
  assert.deepEqual(result.qualified.map(lead => lead.businessName), candidates.map(candidate => candidate.businessName));
});

test('audit batching stops after max qualified with only the active batch over-audited', async () => {
  const candidates = Array.from({ length: 5 }, (_, index) => fakeCandidate(`Lead ${index}`));
  const auditCalls = [];
  const scoreCalls = [];

  const result = await auditAndScoreCandidates(candidates, new Set(), {
    auditConcurrency: 3,
    maxQualified: 2,
    auditLead: async lead => {
      auditCalls.push(lead.businessName);
      return fakeAudit();
    },
    scoreLead: candidate => {
      scoreCalls.push(candidate.businessName);
      return fakeScore(candidate);
    },
  });

  assert.equal(result.qualified.length, 2);
  assert.equal(result.auditAttempts, 3);
  assert.equal(result.audited, 0);
  assert.deepEqual(auditCalls, ['Lead 0', 'Lead 1', 'Lead 2']);
  assert.deepEqual(scoreCalls, ['Lead 0', 'Lead 1']);
});

test('audit waves group strongest opportunity buckets before website-rich low priority', () => {
  const waves = buildAuditWaves([
    fakeCandidate('No Site', { sourceOpportunity: 'no_source_website', website: '' }),
    fakeCandidate('Bad Site', { sourceOpportunity: 'possible_poor_site', website: 'http://bad.example' }),
    fakeCandidate('BBB Site', { sourceOpportunity: 'website_rich_low_priority', website: 'https://bbb.example' }),
  ]);

  assert.deepEqual(waves.map(wave => wave.name), [
    'no_source_website',
    'possible_poor_site',
    'website_rich_low_priority',
  ]);
});

test('audit contact email is carried onto qualified lead records', async () => {
  const [candidate] = [fakeCandidate('Email Plumbing', { website: 'https://email.example' })];
  const result = await auditAndScoreCandidates([candidate], new Set(), {
    auditConcurrency: 1,
    maxQualified: 1,
    auditLead: async () => ({
      ...fakeAudit(),
      emails: ['owner@email.example'],
      verifiedSignals: {
        ...fakeAudit().verifiedSignals,
        contactTruth: {
          emails: [{ value: 'owner@email.example', confidence: 0.85, source: 'website', url: 'https://email.example' }],
        },
      },
    }),
    scoreLead: candidate => fakeScore(candidate),
  });

  assert.equal(result.qualified[0].email, 'owner@email.example');
});

test('low-yield possible-poor-site wave stops before grinding through all candidates', async () => {
  const candidates = Array.from({ length: 30 }, (_, index) => fakeCandidate(`Weak ${index}`, {
    website: `https://weak-${index}.example`,
    sourceOpportunity: 'possible_poor_site',
  }));
  const auditCalls = [];

  const result = await auditAndScoreCandidates(candidates, new Set(), {
    auditConcurrency: 5,
    maxQualified: 10,
    maxAuditAttempts: 100,
    auditLead: async lead => {
      auditCalls.push(lead.businessName);
      return { ...fakeAudit(), status: 'audited', promising: true, auditStage: 'stage1-only' };
    },
    scoreLead: candidate => ({
      ...fakeScore(candidate),
      score: 5.4,
      qualified: false,
      blockers: ['Audited website lacks enough verified concrete bad-site evidence'],
    }),
  });

  assert.equal(result.qualified.length, 0);
  assert.equal(result.auditAttempts, 25);
  assert.equal(auditCalls.length, 25);
  assert.equal(result.waveStats[0].stopped, true);
  assert.match(result.waveStats[0].stopReason, /^low_yield:possible_poor_site/);
});

function fakeCandidate(businessName, overrides = {}) {
  return {
    businessName,
    niche: 'plumber',
    city: 'Gainesville',
    state: 'FL',
    phone: '(352) 555-1212',
    website: '',
    sourceName: 'test',
    sourceOpportunity: 'no_source_website',
    ...overrides,
  };
}

function fakeAudit() {
  return {
    status: 'no_website',
    promising: true,
    auditStage: 'test',
    finalUrl: '',
    signals: {},
    verifiedSignals: {
      evidenceIntegrity: { verifiable: true, issues: [] },
      websiteTruth: { status: 'no_site', confidence: 0.95, evidence: [] },
    },
  };
}

function fakeScore(candidate) {
  return {
    phone: candidate.phone,
    website: candidate.website,
    score: 8.5,
    reasons: ['qualified fixture'],
    blockers: [],
    decisionMaker: {},
    pitch: {},
    isLocalMarket: true,
    websiteStatus: 'no_website',
    leadType: 'no_website_creation',
    qualified: true,
  };
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
