#!/usr/bin/env node
/**
 * debug-sources.js — Minimal diagnostic for each lead source.
 * Tests ONE query per source, captures page title, final URL,
 * HTML snippet around expected results, and screenshots on failure.
 *
 * Usage: node scripts/debug-sources.js [source]
 *   source: yelp | yp | angi | bbb | google | all (default: all)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIAG_DIR = path.join(ROOT, 'leads', 'debug');

// Test query: HVAC in Dallas — should always have results
const TEST = { niche: 'HVAC contractor', city: 'Dallas', state: 'TX' };

async function launchBrowser() {
  return chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
    ],
  });
}

async function diagPage(page, label) {
  const info = {
    label,
    url: page.url(),
    title: await page.title().catch(() => '(error)'),
  };

  // Get full page HTML length and a snippet
  const bodyInfo = await page.evaluate(() => {
    const body = document.body;
    const html = body ? body.innerHTML : '';
    return {
      htmlLength: html.length,
      firstChars: html.slice(0, 500),
      allText: (body?.innerText || '').slice(0, 1000),
    };
  }).catch(() => ({ htmlLength: 0, firstChars: '(evaluate failed)', allText: '' }));

  info.htmlLength = bodyInfo.htmlLength;
  info.snippet = bodyInfo.firstChars;
  info.textPreview = bodyInfo.allText;

  // Screenshot
  const ssPath = path.join(DIAG_DIR, `${label}.png`);
  await page.screenshot({ path: ssPath, fullPage: false }).catch(() => {});
  info.screenshot = ssPath;

  return info;
}

// ── YellowPages ──────────────────────────────────────────────────────────────

async function testYP(browser) {
  console.log('\n━━━ YELLOWPAGES ━━━');
  const url = `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(TEST.niche)}&geo_location_terms=${encodeURIComponent(`${TEST.city}, ${TEST.state}`)}`;
  console.log('URL:', url);

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const diag = await diagPage(page, 'yp');
    console.log('Final URL:', diag.url);
    console.log('Title:', diag.title);
    console.log('HTML length:', diag.htmlLength);
    console.log('Screenshot:', diag.screenshot);

    // Try multiple selector strategies
    const selectorResults = await page.evaluate(() => {
      const tests = {};
      tests['.result'] = document.querySelectorAll('.result').length;
      tests['[class*="result"]'] = document.querySelectorAll('[class*="result"]').length;
      tests['.srp-listing'] = document.querySelectorAll('.srp-listing').length;
      tests['.v-card'] = document.querySelectorAll('.v-card').length;
      tests['.organic .listing'] = document.querySelectorAll('.organic .listing').length;
      tests['[class*="listing"]'] = document.querySelectorAll('[class*="listing"]').length;
      tests['[class*="business"]'] = document.querySelectorAll('[class*="business"]').length;
      tests['.business-name'] = document.querySelectorAll('.business-name').length;
      tests['a[href*="/dallas"]'] = document.querySelectorAll('a[href*="/dallas"]').length;
      tests['h2'] = document.querySelectorAll('h2').length;
      tests['h2 a'] = document.querySelectorAll('h2 a').length;
      tests['.phones'] = document.querySelectorAll('.phones').length;
      tests['a.track-visit-website'] = document.querySelectorAll('a.track-visit-website').length;

      // Grab first few h2 texts to see what's on the page
      const h2s = Array.from(document.querySelectorAll('h2')).slice(0, 5).map(h => h.textContent.trim());
      tests._h2_texts = h2s;

      // Grab first business-name if any
      const bn = document.querySelector('.business-name');
      tests._first_business = bn ? bn.textContent.trim() : '(none)';

      return tests;
    });

    console.log('\nSelector results:');
    for (const [sel, count] of Object.entries(selectorResults)) {
      if (sel.startsWith('_')) {
        console.log(`  ${sel}: ${JSON.stringify(count)}`);
      } else {
        console.log(`  ${sel}: ${count}`);
      }
    }

    // Text preview for context
    console.log('\nPage text (first 500 chars):');
    console.log(diag.textPreview.slice(0, 500));

  } catch (err) {
    console.error('YP ERROR:', err.message);
    await page.screenshot({ path: path.join(DIAG_DIR, 'yp-error.png'), fullPage: false }).catch(() => {});
  } finally {
    await context.close().catch(() => {});
  }
}

// ── Yelp ──────────────────────────────────────────────────────────────────────

async function testYelp(browser) {
  console.log('\n━━━ YELP ━━━');
  const url = `https://www.yelp.com/search?find_desc=${encodeURIComponent(TEST.niche)}&find_loc=${encodeURIComponent(`${TEST.city}, ${TEST.state}`)}`;
  console.log('URL:', url);

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const diag = await diagPage(page, 'yelp');
    console.log('Final URL:', diag.url);
    console.log('Title:', diag.title);
    console.log('HTML length:', diag.htmlLength);
    console.log('Screenshot:', diag.screenshot);

    const selectorResults = await page.evaluate(() => {
      const tests = {};
      tests['a[href*="/biz/"]'] = document.querySelectorAll('a[href*="/biz/"]').length;
      tests['[class*="result"]'] = document.querySelectorAll('[class*="result"]').length;
      tests['[class*="card"]'] = document.querySelectorAll('[class*="card"]').length;
      tests['[class*="businessName"]'] = document.querySelectorAll('[class*="businessName"]').length;
      tests['h3'] = document.querySelectorAll('h3').length;
      tests['h4'] = document.querySelectorAll('h4').length;
      tests['li'] = document.querySelectorAll('li').length;
      tests['a[href*="biz_redir"]'] = document.querySelectorAll('a[href*="biz_redir"]').length;
      tests['a[href^="tel:"]'] = document.querySelectorAll('a[href^="tel:"]').length;

      // Grab first /biz/ link texts
      const bizLinks = Array.from(document.querySelectorAll('a[href*="/biz/"]'))
        .slice(0, 5)
        .map(a => ({ text: a.textContent.trim().slice(0, 60), href: a.getAttribute('href').slice(0, 80) }));
      tests._biz_links = bizLinks;

      // Check for captcha / block indicators
      const bodyText = document.body?.innerText || '';
      tests._has_captcha = /captcha|robot|verify|unusual traffic|blocked/i.test(bodyText);
      tests._has_results = /results|businesses|found/i.test(bodyText);

      return tests;
    });

    console.log('\nSelector results:');
    for (const [sel, count] of Object.entries(selectorResults)) {
      if (sel.startsWith('_')) {
        console.log(`  ${sel}: ${JSON.stringify(count)}`);
      } else {
        console.log(`  ${sel}: ${count}`);
      }
    }

    console.log('\nPage text (first 500 chars):');
    console.log(diag.textPreview.slice(0, 500));

  } catch (err) {
    console.error('YELP ERROR:', err.message);
    await page.screenshot({ path: path.join(DIAG_DIR, 'yelp-error.png'), fullPage: false }).catch(() => {});
  } finally {
    await context.close().catch(() => {});
  }
}

// ── BBB ───────────────────────────────────────────────────────────────────────

async function testBBB(browser) {
  console.log('\n━━━ BBB ━━━');
  const url = `https://www.bbb.org/search?find_text=${encodeURIComponent(TEST.niche)}&find_loc=${encodeURIComponent(`${TEST.city}, ${TEST.state}`)}&page=1`;
  console.log('URL:', url);

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const diag = await diagPage(page, 'bbb');
    console.log('Final URL:', diag.url);
    console.log('Title:', diag.title);
    console.log('HTML length:', diag.htmlLength);
    console.log('Screenshot:', diag.screenshot);

    const selectorResults = await page.evaluate(() => {
      const tests = {};
      tests['[class*="search-result"]'] = document.querySelectorAll('[class*="search-result"]').length;
      tests['[class*="SearchResult"]'] = document.querySelectorAll('[class*="SearchResult"]').length;
      tests['article'] = document.querySelectorAll('article').length;
      tests['[class*="Result"]'] = document.querySelectorAll('[class*="Result"]').length;
      tests['h3'] = document.querySelectorAll('h3').length;
      tests['h4'] = document.querySelectorAll('h4').length;
      tests['a[href^="tel:"]'] = document.querySelectorAll('a[href^="tel:"]').length;
      tests['a[href*="/profile/"]'] = document.querySelectorAll('a[href*="/profile/"]').length;
      tests['[data-testid]'] = document.querySelectorAll('[data-testid]').length;

      const h3s = Array.from(document.querySelectorAll('h3')).slice(0, 5).map(h => h.textContent.trim().slice(0, 60));
      tests._h3_texts = h3s;

      const bodyText = document.body?.innerText || '';
      tests._has_captcha = /captcha|robot|verify|cloudflare|blocked/i.test(bodyText);
      tests._has_results = /results|businesses|found|accredited/i.test(bodyText);

      return tests;
    });

    console.log('\nSelector results:');
    for (const [sel, count] of Object.entries(selectorResults)) {
      if (sel.startsWith('_')) {
        console.log(`  ${sel}: ${JSON.stringify(count)}`);
      } else {
        console.log(`  ${sel}: ${count}`);
      }
    }

    console.log('\nPage text (first 500 chars):');
    console.log(diag.textPreview.slice(0, 500));

  } catch (err) {
    console.error('BBB ERROR:', err.message);
    await page.screenshot({ path: path.join(DIAG_DIR, 'bbb-error.png'), fullPage: false }).catch(() => {});
  } finally {
    await context.close().catch(() => {});
  }
}

// ── Angi ──────────────────────────────────────────────────────────────────────

async function testAngi(browser) {
  console.log('\n━━━ ANGI ━━━');
  const url = `https://www.angi.com/companylist/us/tx/dallas/hvac.htm`;
  console.log('URL:', url);

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const diag = await diagPage(page, 'angi');
    console.log('Final URL:', diag.url);
    console.log('Title:', diag.title);
    console.log('HTML length:', diag.htmlLength);
    console.log('Screenshot:', diag.screenshot);

    const selectorResults = await page.evaluate(() => {
      const tests = {};
      tests['.companyCard'] = document.querySelectorAll('.companyCard').length;
      tests['[class*="ProCard"]'] = document.querySelectorAll('[class*="ProCard"]').length;
      tests['[class*="company-card"]'] = document.querySelectorAll('[class*="company-card"]').length;
      tests['[class*="CompanyCard"]'] = document.querySelectorAll('[class*="CompanyCard"]').length;
      tests['article'] = document.querySelectorAll('article').length;
      tests['[data-testid*="pro"]'] = document.querySelectorAll('[data-testid*="pro"]').length;
      tests['h2'] = document.querySelectorAll('h2').length;
      tests['h3'] = document.querySelectorAll('h3').length;
      tests['a[href^="tel:"]'] = document.querySelectorAll('a[href^="tel:"]').length;
      tests['a[href*="/pros/"]'] = document.querySelectorAll('a[href*="/pros/"]').length;

      const h2s = Array.from(document.querySelectorAll('h2')).slice(0, 5).map(h => h.textContent.trim().slice(0, 60));
      tests._h2_texts = h2s;

      const bodyText = document.body?.innerText || '';
      tests._has_captcha = /captcha|robot|verify|cloudflare|blocked/i.test(bodyText);

      return tests;
    });

    console.log('\nSelector results:');
    for (const [sel, count] of Object.entries(selectorResults)) {
      if (sel.startsWith('_')) {
        console.log(`  ${sel}: ${JSON.stringify(count)}`);
      } else {
        console.log(`  ${sel}: ${count}`);
      }
    }

    console.log('\nPage text (first 500 chars):');
    console.log(diag.textPreview.slice(0, 500));

  } catch (err) {
    console.error('ANGI ERROR:', err.message);
    await page.screenshot({ path: path.join(DIAG_DIR, 'angi-error.png'), fullPage: false }).catch(() => {});
  } finally {
    await context.close().catch(() => {});
  }
}

// ── Google Maps ──────────────────────────────────────────────────────────────

async function testGoogle(browser) {
  console.log('\n━━━ GOOGLE MAPS ━━━');
  const url = `https://www.google.com/maps/search/${encodeURIComponent(`${TEST.niche} in ${TEST.city}, ${TEST.state}`)}`;
  console.log('URL:', url);

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    geolocation: { latitude: 32.7767, longitude: -96.7970 },
    permissions: ['geolocation'],
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const diag = await diagPage(page, 'google-maps');
    console.log('Final URL:', diag.url);
    console.log('Title:', diag.title);
    console.log('HTML length:', diag.htmlLength);
    console.log('Screenshot:', diag.screenshot);

    const selectorResults = await page.evaluate(() => {
      const tests = {};
      // Google Maps result selectors
      tests['[role="feed"]'] = document.querySelectorAll('[role="feed"]').length;
      tests['[role="article"]'] = document.querySelectorAll('[role="article"]').length;
      tests['a[href*="maps/place"]'] = document.querySelectorAll('a[href*="maps/place"]').length;
      tests['[class*="fontHeadlineSmall"]'] = document.querySelectorAll('[class*="fontHeadlineSmall"]').length;
      tests['[class*="result"]'] = document.querySelectorAll('[class*="result"]').length;
      tests['[data-value]'] = document.querySelectorAll('[data-value]').length;
      tests['div[aria-label]'] = document.querySelectorAll('div[aria-label]').length;
      tests['a[aria-label]'] = document.querySelectorAll('a[aria-label]').length;

      // Get aria-label values from feed items (Google Maps result names)
      const feedItems = Array.from(document.querySelectorAll('a[aria-label]'))
        .filter(a => a.getAttribute('href')?.includes('/maps/place/'))
        .slice(0, 5)
        .map(a => a.getAttribute('aria-label')?.slice(0, 60));
      tests._place_names = feedItems;

      const bodyText = document.body?.innerText || '';
      tests._has_consent = /consent|agree|accept|cookie/i.test(bodyText);

      return tests;
    });

    console.log('\nSelector results:');
    for (const [sel, count] of Object.entries(selectorResults)) {
      if (sel.startsWith('_')) {
        console.log(`  ${sel}: ${JSON.stringify(count)}`);
      } else {
        console.log(`  ${sel}: ${count}`);
      }
    }

    console.log('\nPage text (first 500 chars):');
    console.log(diag.textPreview.slice(0, 500));

  } catch (err) {
    console.error('GOOGLE MAPS ERROR:', err.message);
    await page.screenshot({ path: path.join(DIAG_DIR, 'google-maps-error.png'), fullPage: false }).catch(() => {});
  } finally {
    await context.close().catch(() => {});
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(DIAG_DIR, { recursive: true });

  const source = (process.argv[2] || 'all').toLowerCase();
  console.log(`\n══════════════════════════════════════`);
  console.log(` SOURCE DIAGNOSTICS — ${TEST.niche} / ${TEST.city}, ${TEST.state}`);
  console.log(`══════════════════════════════════════`);

  const browser = await launchBrowser();
  console.log('Browser launched OK');

  try {
    if (source === 'all' || source === 'yp') await testYP(browser);
    if (source === 'all' || source === 'yelp') await testYelp(browser);
    if (source === 'all' || source === 'bbb') await testBBB(browser);
    if (source === 'all' || source === 'angi') await testAngi(browser);
    if (source === 'all' || source === 'google') await testGoogle(browser);
  } finally {
    await browser.close().catch(() => {});
    console.log('\nBrowser closed. Screenshots in leads/debug/');
  }
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
