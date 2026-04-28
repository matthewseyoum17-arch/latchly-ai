import { chromium, devices } from 'playwright';
import { writeFileSync } from 'fs';

const PAGES = [
  { slug: 'menu',  path: '/demos/prospects/moms-og-gainesville-fl-menu.html' },
  { slug: 'story', path: '/demos/prospects/moms-og-gainesville-fl-story.html' },
  { slug: 'visit', path: '/demos/prospects/moms-og-gainesville-fl-visit.html' },
];
const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  { name: 'tablet',  viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPad)' },
  { name: 'mobile',  ...devices['iPhone 13'] },
];
const OUT = '/tmp/moms-og-rebuild/audit';

const browser = await chromium.launch();
const report = {};

for (const page of PAGES) {
  report[page.slug] = {};
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ ...vp });
    const tab = await ctx.newPage();
    const url = `http://localhost:8765${page.path}`;
    const failed = [];
    tab.on('pageerror', err => failed.push({ type: 'pageerror', message: err.message }));
    tab.on('requestfailed', req => failed.push({ type: 'requestfailed', url: req.url(), reason: req.failure()?.errorText }));
    await tab.goto(url, { waitUntil: 'networkidle' });
    await tab.waitForTimeout(800);

    // Fold
    await tab.screenshot({ path: `${OUT}/${page.slug}/${vp.name}-fold.png`, timeout: 60000 });

    // Section scroll captures (every viewport-height, max 8)
    const vh = await tab.evaluate(() => window.innerHeight);
    const total = await tab.evaluate(() => document.documentElement.scrollHeight);
    const steps = Math.min(8, Math.ceil(total / vh));
    for (let i = 1; i < steps; i++) {
      await tab.evaluate(y => window.scrollTo(0, y), i * vh);
      await tab.waitForTimeout(250);
      await tab.screenshot({ path: `${OUT}/${page.slug}/${vp.name}-scroll-${i}.png`, timeout: 60000 });
    }
    await tab.evaluate(() => window.scrollTo(0, 0));
    await tab.waitForTimeout(200);

    // DOM checks
    const data = await tab.evaluate(() => ({
      docW: document.documentElement.scrollWidth,
      vw: window.innerWidth,
      vh: window.innerHeight,
      docH: document.documentElement.scrollHeight,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
      title: document.title,
      h1: [...document.querySelectorAll('h1')].map(h => h.innerText.trim().slice(0, 80)),
      h2Count: document.querySelectorAll('h2').length,
      h3Count: document.querySelectorAll('h3').length,
      sections: [...document.querySelectorAll('section, nav, header, footer, aside, article')].length,
      imgs: document.images.length,
      brokenImgs: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src),
      lazyImgs: document.querySelectorAll('img[loading="lazy"]').length,
      navLinksHrefs: [...document.querySelectorAll('nav.top a')].map(a => a.getAttribute('href')),
      anchorTargets: [...new Set([...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')))]
        .map(href => ({ href, exists: !!document.querySelector(href) })),
      stickyVisible: getComputedStyle(document.querySelector('.stickyMobile')).display,
      folioVisible: getComputedStyle(document.querySelector('.folio')).display,
      navLinksVisible: getComputedStyle(document.querySelector('nav.top .links')).display,
      fontsStatus: document.fonts.status,
      fontsLoaded: document.fonts.size,
      jsonLd: !!document.querySelector('script[type="application/ld+json"]'),
      failedReq: performance.getEntriesByType('resource').filter(r => r.responseStatus >= 400).map(r => `${r.name}:${r.responseStatus}`),
    }));

    report[page.slug][vp.name] = { ...data, errors: failed };
    await ctx.close();
  }
}

writeFileSync(`${OUT}/audit.json`, JSON.stringify(report, null, 2));
console.log('done');
console.log(JSON.stringify(report, null, 2).slice(0, 3000));
await browser.close();
