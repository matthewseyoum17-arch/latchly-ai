const test = require('node:test');
const assert = require('node:assert/strict');
const { decorateAudit } = require('../audit');
const { scoreLead, extractHtmlSignals, isChainBusiness, isLocalMarket, pickDecisionMaker } = require('../scoring');
const { leadBucket, selectDailyLeads, summarizeSelection } = require('../pipeline');

test('no-website independent home service lead qualifies with phone and no owner', () => {
  const lead = {
    businessName: 'Gator Roof Repair LLC',
    niche: 'roofing contractor',
    city: 'Gainesville',
    state: 'FL',
    phone: '(352) 555-1212',
    website: '',
  };

  const scored = scoreLead(lead, noWebsiteAudit(lead));
  assert.equal(scored.qualified, true);
  assert.ok(scored.score >= 8);
  assert.ok(scored.reasons.some(reason => /no website/.test(reason)));
  assert.equal(scored.isLocalMarket, true);
  assert.equal(scored.websiteStatus, 'no_website');
  assert.equal(scored.leadType, 'no_website_creation');
  assert.match(scored.pitch.angle, /website/i);
});

test('skipped or empty website audit does not qualify as a poor website', () => {
  const lead = {
    businessName: 'Skipped Audit Roofing',
    niche: 'roofing contractor',
    city: 'Tampa',
    state: 'FL',
    phone: '(813) 555-1111',
    ownerName: 'Devon Lee',
    ownerTitle: 'Owner',
    website: 'https://skipped-audit.example',
    sourceScore: 10,
    sourceIssues: 'No mobile viewport; No contact form; Stale copyright',
  };

  const scored = scoreLead(lead, decorateAudit(lead, {
    status: 'skipped',
    finalUrl: lead.website,
    html: '',
    signals: {},
    pagesChecked: [],
    auditor: 'skipped',
  }));

  assert.equal(scored.qualified, false);
  assert.equal(scored.websiteStatus, 'has_website');
  assert.ok(scored.score < 8);
  assert.ok(scored.blockers.some(reason => /verifiable page evidence/.test(reason)));
});

test('empty no-website audit cannot qualify', () => {
  const lead = {
    businessName: 'Unverified No Site Plumbing',
    niche: 'plumber',
    city: 'Gainesville',
    state: 'FL',
    phone: '(352) 555-3333',
    website: '',
  };

  const scored = scoreLead(lead, {});
  assert.equal(scored.qualified, false);
  assert.ok(scored.blockers.some(reason => /no-website audit evidence/.test(reason)));
});

test('good modern website stays below qualification threshold', () => {
  const lead = {
    businessName: 'Modern Flow Plumbing',
    niche: 'plumber',
    city: 'Tampa',
    state: 'FL',
    phone: '(813) 555-1212',
    ownerName: 'Devon Lee',
    ownerTitle: 'Owner',
    website: 'https://modernflow.example',
  };
  const richText = 'Plumbing repair service reviews licensed insured warranty free estimate '.repeat(80);
  const audit = structuredWebsiteAudit(lead, {
    status: 'audited',
    html: `<html><head><meta name="viewport" content="width=device-width"><script>window.React=true</script><style>@media(max-width:600px){body{display:flex}} @font-face{font-family:x}</style><script type="application/ld+json">{}</script></head><body><h1>Plumbing repair</h1><a href="tel:8135551212">Call now</a><form></form><p>${richText}</p></body></html>`,
    finalUrl: lead.website,
  });

  const scored = scoreLead(lead, audit);
  assert.equal(scored.qualified, false);
  assert.ok(scored.score < 8);
  assert.ok(scored.blockers.some(reason => /bad-site evidence/.test(reason)));
});

test('source-only poor website claim is rejected when audit evidence disagrees', () => {
  const lead = {
    businessName: 'Source Claimed Bad Site HVAC',
    niche: 'hvac contractor',
    city: 'Dallas',
    state: 'TX',
    phone: '(214) 555-4444',
    website: 'https://source-claimed.example',
    sourceScore: 10,
    sourceIssues: 'Poor website; No contact form; Outdated design',
  };
  const html = `<html><head><meta name="viewport" content="width=device-width"><style>@media(max-width:600px){main{display:grid}} @font-face{font-family:x}</style><script type="application/ld+json">{}</script></head><body><main><h1>HVAC service</h1><a href="tel:2145554444">Call now</a><form></form><p>${'licensed insured reviews free estimate service warranty '.repeat(90)}</p></main></body></html>`;

  const scored = scoreLead(lead, structuredWebsiteAudit(lead, {
    status: 'audited',
    finalUrl: lead.website,
    html,
  }));

  assert.equal(scored.qualified, false);
  assert.ok(scored.score < 8);
  assert.ok(scored.blockers.some(reason => /verified concrete bad-site evidence/.test(reason)));
});

test('poor audited website qualifies only with concrete audit issues', () => {
  const lead = {
    businessName: 'Old Table Roofing',
    niche: 'roofing contractor',
    city: 'Dallas',
    state: 'TX',
    phone: '(214) 555-2222',
    website: 'http://old-table-roofing.example',
  };
  const audit = structuredWebsiteAudit(lead, {
    status: 'audited',
    finalUrl: lead.website,
    html: '<html><head><title>Old Table Roofing</title></head><body><table><tr><td><table><tr><td>Roof repair reroof leaks emergency service. Copyright 2018.</td></tr></table></td></tr></table><script src="/jquery-1.7.js"></script></body></html>',
  });

  const scored = scoreLead(lead, audit);
  assert.equal(scored.qualified, true);
  assert.ok(scored.score >= 8);
  assert.equal(scored.websiteStatus, 'poor_website');
  assert.equal(scored.leadType, 'poor_website_redesign');
  assert.ok(scored.reasons.some(reason => /concrete redesign issues/.test(reason)));
});

test('poor-site scoring rejects negative signals without page-level verification', () => {
  const lead = {
    businessName: 'Unverified Bad Roofing',
    niche: 'roofing contractor',
    city: 'Dallas',
    state: 'TX',
    phone: '(214) 555-3333',
    website: 'http://unverified-bad.example',
  };
  const audit = structuredWebsiteAudit(lead, {
    status: 'audited',
    finalUrl: lead.website,
    html: '<html><head><title>Unverified Bad Roofing</title></head><body><table><tr><td><table><tr><td>Roof repair leaks. Copyright 2018.</td></tr></table></td></tr></table><script src="/jquery-1.7.js"></script></body></html>',
  });
  audit.verifiedSignals.websiteQuality.negativeSignals = audit.verifiedSignals.websiteQuality.negativeSignals.map(signal => ({
    ...signal,
    url: '',
    confidence: 0.6,
  }));
  audit.verifiedSignals.evidenceIntegrity = {
    verifiable: false,
    issues: ['Negative signals missing page-level evidence'],
  };

  const scored = scoreLead(lead, audit);
  assert.equal(scored.qualified, false);
  assert.ok(scored.score < 8);
  assert.ok(scored.blockers.some(reason => /not verifiable/.test(reason)));
});

test('chain businesses are blocked even with high need', () => {
  const lead = {
    businessName: 'Roto-Rooter Gainesville',
    niche: 'plumber',
    city: 'Gainesville',
    state: 'FL',
    phone: '(352) 555-1212',
    ownerName: 'Office',
    ownerTitle: 'Manager',
  };
  const scored = scoreLead(lead, {});
  assert.equal(isChainBusiness(lead.businessName), true);
  assert.equal(scored.qualified, false);
  assert.ok(scored.blockers.some(reason => /Chain/.test(reason)));
});

test('decision-maker selection prefers owner over office contact', () => {
  const picked = pickDecisionMaker({
    ownerName: 'Alicia Brown',
    ownerTitle: 'Owner',
    contactName: 'Front Desk',
    contactTitle: 'Office Contact',
  });
  assert.equal(picked.name, 'Alicia Brown');
  assert.equal(picked.confidence, 10);
});

test('decision-maker selection ignores object payloads as legacy names', () => {
  const picked = pickDecisionMaker({
    decisionMaker: { name: '', title: '', confidence: 0, sources: [] },
  });
  assert.equal(picked.name, '');
  assert.equal(picked.confidence, 0);
});

test('daily selection keeps Gainesville/Tallahassee near target share when available', () => {
  const leads = [];
  for (let i = 0; i < 20; i++) {
    leads.push(fakeLead(`Local ${i}`, i % 2 ? 'Gainesville' : 'Tallahassee', true, 9.2, i % 2 ? 'noWebsite' : 'poorWebsite', i));
  }
  for (let i = 0; i < 60; i++) {
    leads.push(fakeLead(`Other ${i}`, 'Dallas', false, 9, i % 2 ? 'noWebsite' : 'poorWebsite', i + 100));
  }

  const selected = selectDailyLeads(leads, 50);
  const localCount = selected.filter(lead => lead.isLocalMarket).length;
  assert.equal(selected.length, 50);
  assert.ok(localCount >= 10);
  assert.ok(localCount <= 15);
});

test('daily selection keeps no-website and poor-website buckets in flexible 50/50 range', () => {
  const leads = [];
  for (let i = 0; i < 40; i++) {
    leads.push(fakeLead(`No Site ${i}`, i < 8 ? 'Gainesville' : 'Dallas', i < 8, 9.4, 'noWebsite', i));
    leads.push(fakeLead(`Poor Site ${i}`, i < 8 ? 'Tallahassee' : 'Dallas', i < 8, 9.1, 'poorWebsite', i + 100));
  }

  const selected = selectDailyLeads(leads, 50);
  const summary = summarizeSelection(leads, selected, 50);

  assert.equal(selected.length, 50);
  assert.ok(summary.noWebsiteDelivered >= 20);
  assert.ok(summary.noWebsiteDelivered <= 30);
  assert.ok(summary.poorWebsiteDelivered >= 20);
  assert.ok(summary.poorWebsiteDelivered <= 30);
  assert.equal(summary.noWebsiteShortage, 0);
  assert.equal(summary.poorWebsiteShortage, 0);
  assert.equal(selected.filter(lead => leadBucket(lead) === 'noWebsite').length, summary.noWebsiteDelivered);
});

test('daily selection relaxes no-website ceiling when poor-website qualified supply is short', () => {
  const leads = [];
  for (let i = 0; i < 12; i++) {
    leads.push(fakeLead(`No Site Shortage ${i}`, i < 4 ? 'Gainesville' : 'Dallas', i < 4, 9.2, 'noWebsite', i, i % 2 ? 'plumber' : 'roofing contractor'));
  }
  leads.push(fakeLead('Only Poor Site', 'Dallas', false, 9.1, 'poorWebsite', 99, 'hvac contractor'));

  const selected = selectDailyLeads(leads, 10);
  const summary = summarizeSelection(leads, selected, 10);

  assert.equal(selected.length, 10);
  assert.equal(summary.poorWebsiteShortage, 3);
  assert.ok(summary.noWebsiteDelivered > 5);
});

test('daily selection caps a dominant niche when varied qualified supply exists', () => {
  const leads = [];
  const niches = ['roofing contractor', 'hvac contractor', 'plumber', 'electrician', 'tree service', 'pest control'];
  for (let i = 0; i < 40; i++) {
    leads.push(fakeLead(`Roof ${i}`, 'Dallas', false, 10, i % 2 ? 'noWebsite' : 'poorWebsite', i, 'roofing contractor'));
  }
  for (let nicheIndex = 1; nicheIndex < niches.length; nicheIndex++) {
    for (let i = 0; i < 12; i++) {
      leads.push(fakeLead(`${niches[nicheIndex]} ${i}`, 'Houston', false, 9.2, i % 2 ? 'noWebsite' : 'poorWebsite', nicheIndex * 100 + i, niches[nicheIndex]));
    }
  }

  const selected = selectDailyLeads(leads, 50);
  const counts = selected.reduce((acc, lead) => {
    acc[lead.niche] = (acc[lead.niche] || 0) + 1;
    return acc;
  }, {});

  assert.equal(selected.length, 50);
  assert.ok(counts['roofing contractor'] <= 10);
  assert.ok(Object.keys(counts).length >= 6);
});

test('scoring fixtures produce varied scores instead of one flat value', () => {
  const fixtures = [
    scoreLead({
      businessName: 'Gator Roof Repair LLC',
      niche: 'roofing contractor',
      city: 'Gainesville',
      state: 'FL',
      phone: '(352) 555-1212',
      website: '',
    }, noWebsiteAudit({
      businessName: 'Gator Roof Repair LLC',
      niche: 'roofing contractor',
      city: 'Gainesville',
      state: 'FL',
      phone: '(352) 555-1212',
      website: '',
    })),
    scoreLead({
      businessName: 'Metro Pest Pros',
      niche: 'pest control',
      city: 'Dallas',
      state: 'TX',
      phone: '(214) 555-1212',
      ownerName: 'Casey Morgan',
      ownerTitle: 'Owner',
      website: '',
    }, noWebsiteAudit({
      businessName: 'Metro Pest Pros',
      niche: 'pest control',
      city: 'Dallas',
      state: 'TX',
      phone: '(214) 555-1212',
      ownerName: 'Casey Morgan',
      ownerTitle: 'Owner',
      website: '',
    })),
    scoreLead({
      businessName: 'Old Table Roofing',
      niche: 'roofing contractor',
      city: 'Dallas',
      state: 'TX',
      phone: '(214) 555-2222',
      website: 'http://old-table-roofing.example',
    }, structuredWebsiteAudit({
      businessName: 'Old Table Roofing',
      niche: 'roofing contractor',
      city: 'Dallas',
      state: 'TX',
      phone: '(214) 555-2222',
      website: 'http://old-table-roofing.example',
    }, {
      status: 'audited',
      finalUrl: 'http://old-table-roofing.example',
      html: '<html><head><title>Old Table Roofing</title></head><body><table><tr><td><table><tr><td>Roof repair reroof leaks emergency service. Copyright 2018.</td></tr></table></td></tr></table><script src="/jquery-1.7.js"></script></body></html>',
    })),
  ];

  assert.ok(new Set(fixtures.map(result => result.score)).size > 1);
});

test('local market is only Gainesville and Tallahassee FL', () => {
  assert.equal(isLocalMarket({ city: 'Gainesville', state: 'FL' }), true);
  assert.equal(isLocalMarket({ city: 'Tallahassee', state: 'FL' }), true);
  assert.equal(isLocalMarket({ city: 'Ocala', state: 'FL' }), false);
  assert.equal(isLocalMarket({ city: 'Lake City', state: 'FL' }), false);
});

function fakeLead(name, city, isLocal, score, bucket, offset, niche = 'roofing contractor') {
  const noWebsite = bucket === 'noWebsite';
  return {
    businessName: name,
    niche,
    city,
    state: city === 'Dallas' ? 'TX' : 'FL',
    phone: `(555) 555-${String(1000 + offset).slice(-4)}`,
    ownerName: 'Owner',
    score,
    isLocalMarket: isLocal,
    website: noWebsite ? '' : `https://example-${offset}.test`,
    websiteStatus: noWebsite ? 'no_website' : 'poor_website',
    leadType: noWebsite ? 'no_website_creation' : 'poor_website_redesign',
  };
}

function noWebsiteAudit(lead) {
  return decorateAudit(lead, {
    status: 'no_website',
    finalUrl: '',
    html: '',
    signals: {},
    pagesChecked: [],
    auditor: 'none',
  });
}

function structuredWebsiteAudit(lead, audit) {
  return decorateAudit(lead, {
    pagesChecked: [audit.finalUrl],
    auditor: 'test',
    ...audit,
    signals: audit.signals || extractHtmlSignals(audit.html || '', audit.finalUrl || lead.website || ''),
  });
}
