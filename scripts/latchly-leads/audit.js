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

async function auditLead(lead, options = {}) {
  const website = normalizeWebsite(lead.website);
  if (!website) {
    return decorateAudit(lead, {
      status: 'no_website',
      finalUrl: '',
      html: '',
      signals: {},
      pagesChecked: [],
      auditor: 'none',
    });
  }

  if (process.env.LATCHLY_SKIP_WEBSITE_FETCH === '1') {
    return decorateAudit(lead, {
      status: 'skipped',
      finalUrl: website,
      html: '',
      signals: {},
      pagesChecked: [],
      auditor: 'skipped',
    });
  }

  if (process.env.LATCHLY_SKIP_BROWSER_AUDIT === '1') {
    return auditByFetch(website, lead);
  }

  if (hasBrowserUse()) {
    try {
      return decorateAudit(lead, await auditWithBrowserUse(website, options));
    } catch (err) {
      if (process.env.LATCHLY_BROWSER_AUDIT_STRICT === '1') throw err;
    }
  }

  try {
    return decorateAudit(lead, await auditWithPlaywright(website));
  } catch {
    return auditByFetch(website, lead);
  }
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

async function auditWithPlaywright(website) {
  const browser = await chromium.launch({ headless: true });
  const pages = await candidatePages(website);
  const pageAudits = [];
  try {
    for (const url of pages) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1',
      });
      const page = await context.newPage();
      try {
        await page.goto(url, { timeout: 25000, waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(800);
        const parsed = await page.evaluate(AUDIT_JS);
        pageAudits.push(JSON.parse(parsed));
      } finally {
        await context.close().catch(() => {});
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
  return mergePageAudits(pageAudits, 'playwright');
}

async function auditByFetch(website, lead = {}) {
  const pages = await candidatePages(website);
  const pageAudits = [];
  for (const url of pages) {
    try {
      const res = await fetchText(url, 18000);
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
  return decorateAudit(lead, mergePageAudits(pageAudits, 'fetch'));
}

async function candidatePages(website) {
  const base = normalizeWebsite(website);
  return [
    base,
    absoluteUrl(base, '/contact'),
    absoluteUrl(base, '/contact-us'),
    absoluteUrl(base, '/about'),
    absoluteUrl(base, '/about-us'),
    absoluteUrl(base, '/services'),
  ].filter(Boolean);
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
      evidenceIntegrity: {
        verifiable: integrityIssues.length === 0,
        issues: integrityIssues,
      },
    },
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
  return {
    phone: {
      value: phone,
      normalized: phone,
      confidence: phone ? (leadPhone && auditPhone && leadPhone !== auditPhone ? 0.65 : 0.9) : 0,
      evidence: phone ? [evidence(auditPhone ? audit.auditor || 'website' : 'source_candidate', pagesChecked[0] || audit.finalUrl || '', 'Phone number normalized from source or audited page', 0.9)] : [],
    },
    emails: (audit.emails || []).map(email => ({ value: email, confidence: 0.85, source: audit.auditor || 'website', url: pagesChecked[0] || audit.finalUrl || '' })),
    contactName: {
      value: audit.contactName || lead.ownerName || lead.contactName || '',
      title: audit.contactTitle || lead.ownerTitle || lead.contactTitle || '',
      confidence: audit.contactName ? 0.75 : lead.ownerName ? 0.65 : 0,
    },
  };
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
  hasBrowserUse,
  auditByFetch,
  auditWithBrowserUse,
  auditWithPlaywright,
  extractContact,
  decorateAudit,
};
