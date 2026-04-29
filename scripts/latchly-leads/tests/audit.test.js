const test = require('node:test');
const assert = require('node:assert/strict');
const {
  candidatePages,
  createAuditSession,
  decorateAudit,
  evaluatePromising,
} = require('../audit');
const { extractDecisionMaker } = require('../decision-maker');
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

test('shared Playwright audit session launches one browser for concurrent contexts', async () => {
  let launches = 0;
  let contexts = 0;
  const session = createAuditSession({
    chromiumInstance: {
      async launch() {
        launches++;
        return {
          async newContext() {
            contexts++;
            return { close: async () => {} };
          },
          close: async () => {},
        };
      },
    },
  });

  try {
    await Promise.all([
      session.newContext({}),
      session.newContext({}),
      session.newContext({}),
    ]);
  } finally {
    await session.close();
  }

  assert.equal(launches, 1);
  assert.equal(contexts, 3);
});

test('stage-2 page selection prioritizes /contact + /about over noisy internal links', async () => {
  // Email coverage was leaking when 3 unrelated internal links pushed the
  // explicit /contact and /about URLs past the cap. New ordering puts
  // contact-pages first regardless of how many gallery/portfolio links the
  // homepage advertises.
  const prior = process.env.LATCHLY_STAGE2_MAX_PAGES;
  process.env.LATCHLY_STAGE2_MAX_PAGES = '3';
  try {
    const pages = await candidatePages('https://example.com', {
      links: [
        { href: 'https://example.com/gallery', text: 'Gallery' },
        { href: 'https://example.com/request-estimate', text: 'Request Estimate' },
        { href: 'https://example.com/contact-us', text: 'Contact Us' },
        { href: 'https://other.example.com/services', text: 'Other services' },
      ],
    });

    assert.deepEqual(pages, [
      'https://example.com',
      'https://example.com/contact',
      'https://example.com/contact-us',
    ]);
  } finally {
    if (prior == null) delete process.env.LATCHLY_STAGE2_MAX_PAGES;
    else process.env.LATCHLY_STAGE2_MAX_PAGES = prior;
  }
});

test('stage-2 page selection extends to /about + /team when the cap allows', async () => {
  const prior = process.env.LATCHLY_STAGE2_MAX_PAGES;
  process.env.LATCHLY_STAGE2_MAX_PAGES = '5';
  try {
    const pages = await candidatePages('https://example.com', { links: [] });
    // With cap=5 and reserved slots for /services + (no internal links),
    // we expect base + /contact + /contact-us + /about (head budget=3),
    // then /services (no internal link to add).
    assert.equal(pages[0], 'https://example.com');
    assert.ok(pages.includes('https://example.com/services'), 'services should be preserved');
    assert.ok(pages.length <= 5);
  } finally {
    if (prior == null) delete process.env.LATCHLY_STAGE2_MAX_PAGES;
    else process.env.LATCHLY_STAGE2_MAX_PAGES = prior;
  }
});

test('stage-2 page selection reserves room for /services + top internal link', async () => {
  // Codex review #8: previous order pushed /services and high-signal
  // internal links off the cap when /contact-us / /about / /about-us
  // / /team / /our-team / /staff existed. Verify the reservation works.
  const prior = process.env.LATCHLY_STAGE2_MAX_PAGES;
  process.env.LATCHLY_STAGE2_MAX_PAGES = '5';
  try {
    const pages = await candidatePages('https://example.com', {
      links: [
        { href: 'https://example.com/request-estimate', text: 'Request Estimate' },
        { href: 'https://example.com/gallery', text: 'Gallery' },
      ],
    });
    assert.equal(pages.length, 5);
    assert.equal(pages[0], 'https://example.com');
    assert.ok(pages.includes('https://example.com/services'), 'services reserved');
    assert.ok(
      pages.includes('https://example.com/request-estimate'),
      'top internal link reserved (request-estimate)',
    );
  } finally {
    if (prior == null) delete process.env.LATCHLY_STAGE2_MAX_PAGES;
    else process.env.LATCHLY_STAGE2_MAX_PAGES = prior;
  }
});

test('stage-2 page selection still prioritizes contact when cap is tight', async () => {
  // At cap=3 we can't reserve /services AND /request-estimate AND /contact;
  // contact wins. The reservation kicks in at cap >= 4.
  const prior = process.env.LATCHLY_STAGE2_MAX_PAGES;
  process.env.LATCHLY_STAGE2_MAX_PAGES = '3';
  try {
    const pages = await candidatePages('https://example.com', {
      links: [{ href: 'https://example.com/request-estimate', text: 'Request Estimate' }],
    });
    assert.deepEqual(pages, [
      'https://example.com',
      'https://example.com/contact',
      'https://example.com/contact-us',
    ]);
  } finally {
    if (prior == null) delete process.env.LATCHLY_STAGE2_MAX_PAGES;
    else process.env.LATCHLY_STAGE2_MAX_PAGES = prior;
  }
});

test('decision-maker extraction reads JSON-LD Person schema', async () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    '@type': 'Person',
    name: 'Alicia Brown',
    jobTitle: 'Owner',
  })}</script>`;
  const result = await extractDecisionMaker(baseLead(), html, ['https://example.com'], null, { fetcher: missingFetcher });
  assert.equal(result.name, 'Alicia Brown');
  assert.equal(result.title, 'Owner');
  assert.ok(result.confidence >= 0.9);
});

test('decision-maker extraction reads seeded about page content', async () => {
  const result = await extractDecisionMaker(baseLead(), [
    { url: 'https://example.com', html: '<h1>Audit Test Roofing</h1>' },
    { url: 'https://example.com/about', html: '<main>Meet the owner Jordan Smith. Jordan has repaired roofs for 20 years.</main>' },
  ], [], null, { fetcher: missingFetcher });
  assert.equal(result.name, 'Jordan Smith');
  assert.equal(result.title, 'Owner');
  assert.ok(result.confidence >= 0.65);
});

test('decision-maker extraction uses possessive business-name heuristic', async () => {
  const result = await extractDecisionMaker(baseLead({ businessName: "Smith's Plumbing" }), '', [], null, { fetcher: missingFetcher });
  assert.equal(result.name, 'Smith');
  assert.equal(result.confidence, 0.5);
});

test('decision-maker extraction uses first-last business-name heuristic', async () => {
  const result = await extractDecisionMaker(baseLead({ businessName: 'Chris Taylor Custom Concrete Construction' }), '', [], null, { fetcher: missingFetcher });
  assert.equal(result.name, 'Chris Taylor');
  assert.equal(result.confidence, 0.58);
});

test('decision-maker extraction raises confidence on multi-source agreement', async () => {
  const html = `
    <meta name="author" content="Alicia Brown">
    <script type="application/ld+json">${JSON.stringify({ '@type': 'Person', name: 'Alicia Brown', jobTitle: 'Founder' })}</script>
  `;
  const result = await extractDecisionMaker(baseLead(), html, ['https://example.com'], null, { fetcher: missingFetcher });
  assert.equal(result.name, 'Alicia Brown');
  assert.equal(result.confidence, 0.95);
});

test('decision-maker extraction returns zero confidence when no strategy matches', async () => {
  const result = await extractDecisionMaker(baseLead({ businessName: 'Generic Home Services' }), '<h1>Services</h1>', ['https://example.com'], null, { fetcher: missingFetcher });
  assert.equal(result.name, '');
  assert.equal(result.confidence, 0);
});

async function missingFetcher() {
  return { ok: false, text: '' };
}
