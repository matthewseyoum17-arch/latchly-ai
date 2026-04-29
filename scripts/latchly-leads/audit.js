const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { absoluteUrl, fetchText, normalizePhone, normalizeWebsite, sleep } = require('./utils');
const {
  extractHtmlSignals,
  isChainBusiness,
  isHomeService,
  isLocalMarket,
  siteIssueFindings,
} = require('./scoring');
const { extractDecisionMaker } = require('./decision-maker');

const NAV_TIMEOUT_MS = Math.max(3000, parseInt(process.env.LATCHLY_AUDIT_NAV_TIMEOUT_MS || '12000', 10));
const FETCH_TIMEOUT_MS = Math.max(3000, parseInt(process.env.LATCHLY_AUDIT_FETCH_TIMEOUT_MS || '8000', 10));
const PAGE_SETTLE_MS = Math.max(0, parseInt(process.env.LATCHLY_AUDIT_PAGE_SETTLE_MS || '300', 10));

const AUDIT_JS = `
(() => {
  const html = document.documentElement.outerHTML || '';
  const text = (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').trim();
  const phoneLink = document.querySelector('a[href^="tel:"]');
  let phone = '';
  if (phoneLink) {
    const digits = (phoneLink.getAttribute('href') || '').replace(/\\D/g, '');
    const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits.slice(0, 10);
    if (ten.length === 10) phone = '(' + ten.slice(0,3) + ') ' + ten.slice(3,6) + '-' + ten.slice(6);
  }
  const links = Array.from(document.querySelectorAll('a[href]')).map(a => ({
    href: a.href,
    text: (a.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80)
  })).slice(0, 200);
  const emails = Array.from(new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/ig) || []).map(e => e.toLowerCase())));
  return JSON.stringify({ html, text: text.slice(0, 4000), title: document.title || '', url: location.href, phone, links, emails });
})()
`;

function hasBrowserUse() {
  try {
    execFileSync('browser-use', ['--help'], { stdio: 'ignore', timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

function createAuditSession(options = {}) {
  const chromiumInstance = options.chromiumInstance || chromium;
  let browserPromise = null;
  return {
    async newContext(contextOptions = {}) {
      if (!browserPromise) {
        browserPromise = chromiumInstance.launch({ headless: true });
      }
      const browser = await browserPromise;
      return browser.newContext(contextOptions);
    },
    async close() {
      if (!browserPromise) return;
      const browser = await browserPromise.catch(() => null);
      if (browser) await browser.close().catch(() => {});
      browserPromise = null;
    },
  };
}

// Two-stage audit:
//   Stage 1 (browser-use → playwright fallback) — single-page initial read
//      ↓ extract signals from homepage
//   Promising gate — deterministic rule on Stage 1 signals
//      ↓ if not promising for redesign and site is real, reject early
//   Stage 2 (playwright multi-page) — only on promising real-site candidates
async function auditLead(lead, options = {}) {
  const website = normalizeWebsite(lead.website);
  if (!website) {
    const audit = decorateAudit(lead, await attachDecisionMaker(lead, {
      status: 'no_website',
      finalUrl: '',
      html: '',
      signals: {},
      pagesChecked: [],
      auditor: 'none',
    }));
    return { ...audit, promising: true, promisingReason: 'no_site', auditStage: 'skip-no-site' };
  }

  if (process.env.LATCHLY_SKIP_WEBSITE_FETCH === '1') {
    const audit = decorateAudit(lead, await attachDecisionMaker(lead, {
      status: 'skipped',
      finalUrl: website,
      html: '',
      signals: {},
      pagesChecked: [],
      auditor: 'skipped',
    }));
    return { ...audit, promising: false, promisingReason: 'skipped', auditStage: 'skipped' };
  }

  if (process.env.LATCHLY_SKIP_BROWSER_AUDIT === '1') {
    const audit = await auditByFetch(website, lead);
    const verdict = evaluatePromising(audit, audit.signals || {});
    return { ...audit, promising: !verdict.notPromising, promisingReason: verdict.reason, promisingNegatives: verdict.negatives, auditStage: 'fetch-only' };
  }

  // Stage 1
  let stage1Raw;
  try {
    stage1Raw = await initialReadStage1(website, options);
  } catch (err) {
    if (process.env.LATCHLY_BROWSER_AUDIT_STRICT === '1') throw err;
    const audit = await auditByFetch(website, lead);
    const verdict = evaluatePromising(audit, audit.signals || {});
    return { ...audit, promising: !verdict.notPromising, promisingReason: verdict.reason, promisingNegatives: verdict.negatives, auditStage: 'fetch-fallback' };
  }
  stage1Raw = await attachDecisionMaker(lead, stage1Raw);
  const stage1Audit = decorateAudit(lead, stage1Raw);
  const stage1Signals = stage1Raw.signals || {};
  const verdict = evaluatePromising(stage1Audit, stage1Signals);
  const truthStatus = stage1Audit.verifiedSignals?.websiteTruth?.status;

  // Non-real-site statuses (no_site/unreachable/directory/parked) auto-promote to no-website-creation; no Stage 2 needed.
  if (truthStatus !== 'real_business_website') {
    return {
      ...stage1Audit,
      promising: true,
      promisingReason: `auto:${truthStatus || 'unknown'}`,
      auditStage: 'stage1-non-real',
    };
  }

  // Real site that fails the promising gate → reject before paying for Stage 2.
  if (verdict.notPromising) {
    return {
      ...stage1Audit,
      promising: false,
      promisingReason: verdict.reason,
      promisingNegatives: verdict.negatives,
      auditStage: 'stage1-rejected',
    };
  }

  const plausible = evaluatePlausibleStage2(stage1Audit, stage1Signals);
  if (!plausible.plausible) {
    return {
      ...stage1Audit,
      promising: false,
      promisingReason: plausible.reason,
      promisingNegatives: verdict.negatives,
      auditStage: 'stage1-rejected',
    };
  }

  // Stage 2: full multi-page playwright audit on promising real-site candidates.
  let stage2Raw;
  try {
    stage2Raw = await auditWithPlaywright(website, {
      auditSession: options.auditSession,
      links: stage1Raw.links || [],
    });
  } catch {
    return {
      ...stage1Audit,
      promising: true,
      promisingReason: verdict.reason,
      promisingNegatives: verdict.negatives,
      auditStage: 'stage1-only',
    };
  }
  stage2Raw = await attachDecisionMaker(lead, stage2Raw);
  const stage2Audit = decorateAudit(lead, stage2Raw);
  return {
    ...stage2Audit,
    promising: true,
    promisingReason: verdict.reason,
    promisingNegatives: verdict.negatives,
    auditStage: 'stage2',
    initialRead: { signals: stage1Signals, finalUrl: stage1Raw.finalUrl },
  };
}

async function initialReadStage1(website, options = {}) {
  const wantBU = process.env.LATCHLY_USE_BROWSER_USE === '1'
    && hasBrowserUse()
    && process.env.LATCHLY_DISABLE_BROWSER_USE !== '1';
  if (wantBU) {
    try {
      return await readSinglePageBrowserUse(website);
    } catch {
      // fall through to playwright
    }
  }
  return await readSinglePagePlaywright(website, options);
}

async function readSinglePageBrowserUse(website) {
  const session = `latchly-s1-${process.pid}`;
  const url = normalizeWebsite(website);
  execFileSync('browser-use', ['--session', session, 'open', url], {
    encoding: 'utf8',
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await sleep(400);
  const raw = execFileSync('browser-use', ['--session', session, 'eval', AUDIT_JS], {
    encoding: 'utf8',
    timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    execFileSync('browser-use', ['--session', session, 'close'], { stdio: 'ignore', timeout: 5000 });
  } catch {}
  const parsed = parseBrowserUseJson(raw);
  return mergePageAudits([parsed], 'browser-use');
}

async function readSinglePagePlaywright(website, options = {}) {
  const ownsSession = !options.auditSession;
  const auditSession = options.auditSession || createAuditSession();
  try {
    const context = await auditSession.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1',
    });
    const page = await context.newPage();
    try {
      await page.goto(website, { timeout: NAV_TIMEOUT_MS, waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(PAGE_SETTLE_MS);
      const parsed = JSON.parse(await page.evaluate(AUDIT_JS));
      return mergePageAudits([parsed], 'playwright');
    } finally {
      await context.close().catch(() => {});
    }
  } finally {
    if (ownsSession) await auditSession.close();
  }
}

function evaluatePromising(audit, signals = {}) {
  const truth = audit?.verifiedSignals?.websiteTruth?.status;
  if (truth === 'no_site' || truth === 'unreachable' || truth === 'directory_or_social_only' || truth === 'parked_domain') {
    return { notPromising: false, reason: `auto:${truth}`, negatives: [] };
  }

  const negList = [];
  if (signals.notHttps) negList.push('not-https');
  if (signals.staleCopyrightYear) negList.push(`stale-copyright-${signals.staleCopyrightYear}`);
  if (!signals.hasTel) negList.push('no-tel-link');
  if (!signals.hasForm) negList.push('no-form');
  if (!signals.hasQuoteCta) negList.push('no-cta');
  if (!signals.hasReviews) negList.push('no-reviews-keyword');
  if (signals.builder) negList.push(`builder-${String(signals.builder).toLowerCase()}`);
  if (Number(signals.visibleLength || 0) < 500) negList.push('thin-content');
  if (!signals.hasViewport) negList.push('no-viewport');

  const threshold = parseInt(process.env.LATCHLY_PROMISING_NEG_THRESHOLD || '2', 10);
  const negatives = negList.length;
  if (negatives >= threshold) {
    return { notPromising: false, reason: `negatives=${negatives}>=${threshold}`, negatives: negList };
  }
  return { notPromising: true, reason: `negatives=${negatives}<${threshold}`, negatives: negList };
}

function evaluatePlausibleStage2(audit, signals = {}) {
  const findings = siteIssueFindings(signals);
  const concrete = findings.filter(finding => finding.weight >= 0.6);
  const severe = findings.filter(finding => finding.weight >= 0.9);
  const weight = concrete.reduce((sum, finding) => sum + finding.weight, 0);
  // Loosened from concrete>=4 AND severe>=2 AND weight>=4.2 — that floor was
  // producing zero poor-site qualifiers in real runs (id=15 audited 27 sites
  // and qualified zero). Either path below is enough to send a candidate to
  // Stage 2: 3 concrete + 1 severe at moderate weight, OR 2 severe issues.
  if ((concrete.length >= 3 && severe.length >= 1 && weight >= 2.8)
      || (severe.length >= 2 && weight >= 2.5)) {
    return { plausible: true, reason: `stage1_weight=${weight.toFixed(1)}` };
  }
  return {
    plausible: false,
    reason: `stage1_insufficient_evidence:${concrete.length}_concrete:${severe.length}_severe:${weight.toFixed(1)}_weight`,
  };
}

async function auditWithBrowserUse(website) {
  const session = `latchly-${process.pid}`;
  const pages = await candidatePages(website);
  const pageAudits = [];

  for (const url of pages) {
    execFileSync('browser-use', ['--session', session, 'open', url], {
      encoding: 'utf8',
      timeout: 45000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await sleep(600);
    const raw = execFileSync('browser-use', ['--session', session, 'eval', AUDIT_JS], {
      encoding: 'utf8',
      timeout: 45000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const parsed = parseBrowserUseJson(raw);
    pageAudits.push(parsed);
  }

  try {
    execFileSync('browser-use', ['--session', session, 'close'], { stdio: 'ignore', timeout: 10000 });
  } catch {}

  return mergePageAudits(pageAudits, 'browser-use');
}

async function auditWithPlaywright(website, options = {}) {
  const ownsSession = !options.auditSession;
  const auditSession = options.auditSession || createAuditSession();
  const pages = await candidatePages(website, { links: options.links });
  const pageAudits = [];
  try {
    for (const url of pages) {
      const context = await auditSession.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1',
      });
      const page = await context.newPage();
      try {
        await page.goto(url, { timeout: NAV_TIMEOUT_MS, waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(PAGE_SETTLE_MS);
        const parsed = await page.evaluate(AUDIT_JS);
        pageAudits.push(JSON.parse(parsed));
      } finally {
        await context.close().catch(() => {});
      }
    }
  } finally {
    if (ownsSession) await auditSession.close();
  }
  return mergePageAudits(pageAudits, 'playwright');
}

async function auditByFetch(website, lead = {}) {
  const pages = await candidatePages(website);
  const pageAudits = [];
  for (const url of pages) {
    try {
      const res = await fetchText(url, FETCH_TIMEOUT_MS);
      if (!res.ok || !res.text) continue;
      pageAudits.push({
        html: res.text,
        text: '',
        title: '',
        url: res.url,
        phone: '',
        links: [],
        emails: extractEmails(res.text),
      });
    } catch {}
  }
  return decorateAudit(lead, await attachDecisionMaker(lead, mergePageAudits(pageAudits, 'fetch')));
}

async function candidatePages(website, options = {}) {
  const base = normalizeWebsite(website);
  const maxPages = Math.max(1, parseInt(process.env.LATCHLY_STAGE2_MAX_PAGES || '3', 10));
  return uniqueUrls([
    base,
    ...relevantInternalLinks(base, options.links || []),
    absoluteUrl(base, '/contact'),
    absoluteUrl(base, '/contact-us'),
    absoluteUrl(base, '/services'),
  ]).slice(0, maxPages);
}

function relevantInternalLinks(base, links = []) {
  const baseHost = hostOf(base);
  return links
    .map(link => ({
      href: normalizeWebsite(link.href || ''),
      text: String(link.text || ''),
    }))
    .filter(link => link.href && hostOf(link.href) === baseHost)
    .filter(link => /contact|quote|estimate|service|repair|about/i.test(`${link.href} ${link.text}`))
    .sort((a, b) => linkPriority(a) - linkPriority(b))
    .map(link => link.href);
}

function linkPriority(link) {
  const text = `${link.href} ${link.text}`;
  if (/quote|estimate|request/i.test(text)) return 0;
  if (/contact/i.test(text)) return 1;
  if (/service|repair/i.test(text)) return 2;
  if (/about/i.test(text)) return 3;
  return 4;
}

function hostOf(url) {
  try {
    return new URL(normalizeWebsite(url)).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function uniqueUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const url of urls.filter(Boolean)) {
    const key = url.replace(/\/+$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function parseBrowserUseJson(raw) {
  const text = String(raw || '').trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1) throw new Error('browser-use eval did not return JSON');
  const parsed = JSON.parse(text.slice(first, last + 1));
  if (typeof parsed === 'string') return JSON.parse(parsed);
  return parsed;
}

function mergePageAudits(pageAudits, auditor) {
  const usable = pageAudits.filter(Boolean);
  const html = usable.map(p => p.html || '').join('\n');
  const text = usable.map(p => p.text || '').join('\n');
  const first = usable[0] || {};
  const phone = normalizePhone(usable.map(p => p.phone || '').find(Boolean) || '');
  const contact = extractContact(html, text);
  const emails = [...new Set(usable.flatMap(p => p.emails || []))];
  const links = usable.flatMap(p => p.links || []);
  return {
    status: usable.length ? 'audited' : 'unreachable',
    finalUrl: first.url || '',
    html,
    title: first.title || '',
    phone,
    contactName: contact.name,
    contactTitle: contact.title,
    emails,
    links,
    signals: extractHtmlSignals(html, first.url || ''),
    pagesChecked: usable.map(p => p.url).filter(Boolean),
    auditor,
  };
}

async function attachDecisionMaker(lead, audit) {
  const urls = audit.pagesChecked?.length
    ? audit.pagesChecked
    : [audit.finalUrl || normalizeWebsite(lead.website)].filter(Boolean);
  const decisionMaker = await extractDecisionMaker(lead, audit.html || '', urls);
  return {
    ...audit,
    decisionMaker,
    contactName: decisionMaker.name || audit.contactName || '',
    contactTitle: decisionMaker.title || audit.contactTitle || '',
  };
}

function decorateAudit(lead = {}, audit = {}) {
  const status = audit.status || 'skipped';
  const signals = audit.signals || {};
  const pagesChecked = audit.pagesChecked || [];
  const finalUrl = audit.finalUrl || normalizeWebsite(lead.website);
  const websiteTruth = buildWebsiteTruth(lead, audit, signals, finalUrl);
  const negativeSignals = buildNegativeSignalEvidence(signals, audit, pagesChecked);
  const positiveSignals = buildPositiveSignalEvidence(signals, audit, pagesChecked);
  const contactTruth = buildContactTruth(lead, audit, pagesChecked);
  const businessTruth = buildBusinessTruth(lead);
  const signalSummary = buildSignalSummary(lead, audit, contactTruth, websiteTruth, negativeSignals);
  const integrityIssues = [];

  if (status === 'skipped') integrityIssues.push('Website fetch/audit was skipped');
  if (status === 'unreachable') integrityIssues.push('Website could not be reached');
  if (websiteTruth.status === 'real_business_website' && !negativeSignals.length && !positiveSignals.length) {
    integrityIssues.push('No verifiable website quality evidence was extracted');
  }
  if (negativeSignals.some(signal => signal.weight >= 0.6 && (!signal.url || signal.confidence < 0.7))) {
    integrityIssues.push('One or more negative website signals lacks page-level evidence');
  }

  return {
    ...audit,
    status,
    finalUrl,
    signals,
    pagesChecked,
    verifiedSignals: {
      schemaVersion: 1,
      auditedAt: new Date().toISOString(),
      auditSource: audit.auditor || 'unknown',
      websiteTruth,
      websiteQuality: {
        positiveSignals,
        negativeSignals,
        hasScoreDrivingEvidence: negativeSignals.filter(signal => signal.weight >= 0.6 && signal.confidence >= 0.7).length >= 4,
      },
      contactTruth,
      businessTruth,
      signalSummary,
      evidenceIntegrity: {
        verifiable: integrityIssues.length === 0,
        issues: integrityIssues,
      },
    },
    decisionMaker: audit.decisionMaker || { name: contactTruth.contactName.value, title: contactTruth.contactName.title, confidence: contactTruth.contactName.confidence, sources: [] },
    signalCount: signalSummary.count,
    noWebsite: signalSummary.noWebsite,
    poorWebsite: signalSummary.poorWebsite,
    websiteIssue: signalSummary.websiteIssue,
    decisionMakerConfidence: signalSummary.decisionMakerConfidence,
  };
}

function buildWebsiteTruth(lead, audit, signals, finalUrl) {
  const requested = normalizeWebsite(lead.website);
  if (!requested) {
    return {
      status: 'no_site',
      url: '',
      confidence: 0.95,
      evidence: [evidence('source_candidate', '', 'Candidate has no website URL after normalization', 0.95)],
    };
  }
  if (audit.status === 'unreachable') {
    return {
      status: 'unreachable',
      url: finalUrl || requested,
      confidence: 0.85,
      evidence: [evidence(audit.auditor || 'fetch', finalUrl || requested, 'No checked page returned usable HTML', 0.85)],
    };
  }
  if (audit.status !== 'audited') {
    return {
      status: 'unknown',
      url: finalUrl || requested,
      confidence: 0.2,
      evidence: [evidence(audit.auditor || 'skipped', finalUrl || requested, `Audit status is ${audit.status || 'missing'}`, 0.2)],
    };
  }
  if (isDirectoryOrSocialOnly(finalUrl, audit.html)) {
    return {
      status: 'directory_or_social_only',
      url: finalUrl || requested,
      confidence: 0.8,
      evidence: [evidence(audit.auditor || 'fetch', finalUrl || requested, 'Resolved URL is a directory, social, or hosted profile page', 0.8)],
    };
  }
  if (isParkedDomain(audit.html)) {
    return {
      status: 'parked_domain',
      url: finalUrl || requested,
      confidence: 0.82,
      evidence: [evidence(audit.auditor || 'fetch', finalUrl || requested, 'Parked-domain or domain-sale copy detected', 0.82)],
    };
  }
  return {
    status: 'real_business_website',
    url: finalUrl || requested,
    confidence: hasUsableSignals(signals) ? 0.9 : 0.65,
    evidence: [evidence(audit.auditor || 'fetch', finalUrl || requested, 'Business website returned usable page evidence', hasUsableSignals(signals) ? 0.9 : 0.65)],
  };
}

function buildNegativeSignalEvidence(signals, audit, pagesChecked) {
  if (!hasUsableSignals(signals)) return [];
  const url = pagesChecked[0] || audit.finalUrl || '';
  return siteIssueFindings(signals).map(finding => ({
    key: signalKey(finding.reason),
    reason: finding.reason,
    weight: finding.weight,
    confidence: confidenceForFinding(finding, signals),
    source: audit.auditor || 'unknown',
    url,
    pagesChecked,
  }));
}

function buildPositiveSignalEvidence(signals, audit, pagesChecked) {
  if (!hasUsableSignals(signals)) return [];
  const url = pagesChecked[0] || audit.finalUrl || '';
  const candidates = [
    ['hasViewport', signals.hasViewport, 'Mobile viewport detected'],
    ['hasResponsiveCss', signals.hasResponsiveCss, 'Responsive layout/CSS signal detected'],
    ['hasQuoteCta', signals.hasQuoteCta, 'Quote, estimate, or service CTA detected'],
    ['hasForm', signals.hasForm, 'Contact or quote form detected'],
    ['hasTel', signals.hasTel, 'Clickable phone link detected'],
    ['hasReviews', signals.hasReviews, 'Reviews or testimonials detected'],
    ['hasTrust', signals.hasTrust, 'Trust signal detected'],
    ['hasSchema', signals.hasSchema, 'Structured data detected'],
  ];
  return candidates
    .filter(([, present]) => present)
    .map(([key, , label]) => ({ key, reason: label, confidence: 0.85, source: audit.auditor || 'unknown', url, pagesChecked }));
}

function buildContactTruth(lead, audit, pagesChecked) {
  const leadPhone = normalizePhone(lead.phone);
  const auditPhone = normalizePhone(audit.phone);
  const phone = leadPhone || auditPhone;
  const decisionMaker = audit.decisionMaker || {};
  const decisionMakerName = decisionMaker.name || audit.contactName || lead.ownerName || lead.contactName || '';
  const decisionMakerTitle = decisionMaker.title || audit.contactTitle || lead.ownerTitle || lead.contactTitle || '';
  const decisionMakerConfidence = Number(decisionMaker.confidence || 0)
    || (audit.contactName ? 0.75 : lead.ownerName ? 0.65 : 0);
  return {
    phone: {
      value: phone,
      normalized: phone,
      confidence: phone ? (leadPhone && auditPhone && leadPhone !== auditPhone ? 0.65 : 0.9) : 0,
      evidence: phone ? [evidence(auditPhone ? audit.auditor || 'website' : 'source_candidate', pagesChecked[0] || audit.finalUrl || '', 'Phone number normalized from source or audited page', 0.9)] : [],
    },
    emails: (audit.emails || []).map(email => ({ value: email, confidence: 0.85, source: audit.auditor || 'website', url: pagesChecked[0] || audit.finalUrl || '' })),
    contactName: {
      value: decisionMakerName,
      title: decisionMakerTitle,
      confidence: decisionMakerConfidence,
      sources: decisionMaker.sources || [],
    },
  };
}

function buildSignalSummary(lead, audit, contactTruth, websiteTruth, negativeSignals = []) {
  const flags = {
    phonePresent: Boolean(contactTruth.phone?.value),
    emailPresent: Boolean((contactTruth.emails || []).length || lead.email || lead.rawPayload?.email || lead.rawPayload?.Email),
    socialProfile: hasSocialProfile(lead, audit),
    gbpPhotos: googleBusinessPhotoCount(lead) >= 3,
    recentReview: hasRecentReview(lead),
    decisionMaker: Boolean(contactTruth.contactName?.value && Number(contactTruth.contactName?.confidence || 0) > 0),
    businessHours: hasBusinessHours(lead),
    latLngAccuracy: hasLatLng(lead),
  };
  const count = Object.values(flags).filter(Boolean).length;
  const noWebsite = websiteTruth.status === 'no_site';
  const poorWebsite = websiteTruth.status === 'real_business_website'
    && negativeSignals.filter(signal => signal.weight >= 0.6 && Number(signal.confidence || 0) >= 0.7).length >= 4;
  return {
    count,
    flags,
    noWebsite,
    poorWebsite,
    websiteIssue: noWebsite || poorWebsite,
    decisionMakerConfidence: Number(contactTruth.contactName?.confidence || 0),
  };
}

function hasSocialProfile(lead, audit) {
  const values = [
    lead.facebook,
    lead.instagram,
    lead.linkedin,
    lead.social,
    lead.socialUrl,
    lead.rawPayload?.facebook,
    lead.rawPayload?.instagram,
    ...(audit.links || []).map(link => link.href || ''),
  ];
  return values.some(value => /facebook\.com|instagram\.com|linkedin\.com|x\.com|twitter\.com|youtube\.com/i.test(String(value || '')));
}

function googleBusinessPhotoCount(lead) {
  const raw = lead.rawPayload || {};
  const value =
    lead.gbpPhotoCount
      || lead.googlePhotoCount
      || lead.photoCount
      || raw.gbpPhotoCount
      || raw.googlePhotoCount
      || raw.photo_count
      || raw.photos
      || raw.images
      || 0;
  if (Array.isArray(value)) return value.length;
  return Number(value || 0);
}

function hasRecentReview(lead) {
  const raw = lead.rawPayload || {};
  const latestReview = Array.isArray(raw.reviews) ? raw.reviews[0] : null;
  const value = lead.latestReviewDate
    || lead.recentReviewDate
    || lead.lastReviewDate
    || raw.latestReviewDate
    || raw.recentReviewDate
    || raw.last_review_date
    || latestReview?.date
    || latestReview?.iso_date;
  if (!value) return Boolean(lead.hasRecentReview || raw.hasRecentReview);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= 60 * 24 * 60 * 60 * 1000;
}

function hasBusinessHours(lead) {
  const raw = lead.rawPayload || {};
  return Boolean(
    lead.businessHours
      || lead.hours
      || lead.openingHours
      || raw.businessHours
      || raw.hours
      || raw.opening_hours
      || raw.operating_hours
      || raw.open_state
  );
}

function hasLatLng(lead) {
  const raw = lead.rawPayload || {};
  const lat = lead.lat ?? lead.latitude ?? raw.lat ?? raw.latitude ?? raw.gps_coordinates?.latitude;
  const lng = lead.lng ?? lead.lon ?? lead.longitude ?? raw.lng ?? raw.lon ?? raw.longitude ?? raw.gps_coordinates?.longitude;
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

function buildBusinessTruth(lead) {
  const local = isLocalMarket(lead);
  const homeService = isHomeService(lead);
  const chain = isChainBusiness(lead.businessName);
  return {
    homeService: { value: homeService, confidence: homeService ? 0.85 : 0.35, evidence: [evidence('source_candidate', '', `Niche/business name: ${lead.niche || lead.businessName || 'unknown'}`, homeService ? 0.85 : 0.35)] },
    localMarket: { value: local, confidence: lead.city && lead.state ? 0.9 : 0.2, evidence: [evidence('source_candidate', '', `${lead.city || ''}, ${lead.state || ''}`.trim(), lead.city && lead.state ? 0.9 : 0.2)] },
    chainRisk: { value: chain, confidence: chain ? 0.9 : 0.75, evidence: [evidence('source_candidate', '', chain ? 'Business name matches chain/franchise exclusion pattern' : 'No configured chain/franchise pattern matched', chain ? 0.9 : 0.75)] },
    niche: { value: lead.niche || '', confidence: lead.niche ? 0.8 : 0.2, evidence: [evidence('source_candidate', '', lead.niche || 'Missing niche label', lead.niche ? 0.8 : 0.2)] },
  };
}

function evidence(source, url, detail, confidence) {
  return { source, url, detail, confidence };
}

function signalKey(reason) {
  return String(reason || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function confidenceForFinding(finding, signals) {
  if (/stale copyright|outdated|table-based|not using HTTPS/i.test(finding.reason)) return 0.9;
  if (/Very thin|No mobile viewport|Weak responsive|clickable|form|CTA/i.test(finding.reason)) return 0.82;
  if (signals.htmlLength > 1000 || signals.visibleLength > 500) return 0.78;
  return 0.68;
}

function hasUsableSignals(signals = {}) {
  return Number(signals.htmlLength || 0) > 100 || Number(signals.visibleLength || 0) > 80;
}

function isDirectoryOrSocialOnly(url, html) {
  const host = (() => {
    try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
  })();
  return /facebook\.com|instagram\.com|linkedin\.com|yelp\.com|yellowpages\.com|bbb\.org|angi\.com|thumbtack\.com|sites\.google\.com/.test(host)
    || /claim this business|write a review|find similar businesses/i.test(String(html || '').slice(0, 5000));
}

function isParkedDomain(html) {
  return /domain is for sale|buy this domain|parked free|related searches|sedo parking|afternic|namecheap parking/i.test(String(html || '').slice(0, 8000));
}

function extractContact(html, text) {
  const combined = `${stripTags(html)}\n${text || ''}`.replace(/\s+/g, ' ');
  const patterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*[-,|]\s*(Owner|Founder|President|CEO|General Manager|Operations Manager|Office Manager)/,
    /(Owner|Founder|President|CEO|General Manager|Operations Manager|Office Manager)\s*[-:]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/,
    /meet\s+(?:the\s+owner\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i,
  ];
  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (!match) continue;
    if (/owner|founder|president|ceo|manager/i.test(match[1])) {
      return { title: match[1], name: match[2] };
    }
    return { name: match[1], title: match[2] || 'Owner' };
  }
  return { name: '', title: '' };
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function extractEmails(text) {
  return [...new Set((String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig) || [])
    .map(email => email.toLowerCase()))];
}

module.exports = {
  auditLead,
  createAuditSession,
  hasBrowserUse,
  auditByFetch,
  auditWithBrowserUse,
  auditWithPlaywright,
  candidatePages,
  extractContact,
  decorateAudit,
  evaluatePromising,
  evaluatePlausibleStage2,
  initialReadStage1,
  readSinglePagePlaywright,
};
