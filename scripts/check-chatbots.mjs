import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Common chatbot/live chat indicators
const CHATBOT_SIGNATURES = [
  // Script sources / iframes
  'intercom', 'drift', 'livechat', 'tidio', 'zendesk', 'hubspot',
  'crisp.chat', 'olark', 'tawk.to', 'freshchat', 'chatwoot',
  'podium', 'birdeye', 'webchat', 'chatwidget', 'liveperson',
  'smartsupp', 'purechat', 'chatra', 'jivochat', 'kommunicate',
  'botpress', 'manychat', 'messenger', 'fb-customerchat',
  'gorgias', 'helpscout', 'front.com', 'kayako', 'acquire',
  'servicebell', 'qualified.com', 'callrail',
  // Generic patterns
  'chat-widget', 'chat-bubble', 'chat-button', 'live-chat',
  'chatbot', 'chat-container', 'chat-launcher', 'chat-frame',
  'widget-chat', 'lc-chat', 'chat_widget',
];

async function checkSite(page, url, timeout = 25000) {
  // Try https first, then fall back to http
  const httpsUrl = url.replace(/^http:\/\//, 'https://');
  const urls = [httpsUrl, url];
  let loaded = false;
  for (const tryUrl of urls) {
    try {
      await page.goto(tryUrl, { waitUntil: 'domcontentloaded', timeout });
      loaded = true;
      url = tryUrl;
      break;
    } catch(e) {
      // try next
    }
  }
  if (!loaded) {
    return { url, hasChatbot: null, signals: [], error: 'Could not load (http or https)' };
  }
  try {
    // Wait a bit for chat widgets to load (they often load lazily)
    await page.waitForTimeout(4000);

    const result = await page.evaluate((signatures) => {
      const found = [];

      // Check all script tags
      document.querySelectorAll('script[src]').forEach(s => {
        const src = s.src.toLowerCase();
        signatures.forEach(sig => {
          if (src.includes(sig)) found.push(`script: ${sig} (${s.src})`);
        });
      });

      // Check inline scripts
      document.querySelectorAll('script:not([src])').forEach(s => {
        const text = s.textContent.toLowerCase();
        signatures.forEach(sig => {
          if (text.includes(sig) && !found.some(f => f.includes(sig))) {
            found.push(`inline-script: ${sig}`);
          }
        });
      });

      // Check iframes
      document.querySelectorAll('iframe').forEach(iframe => {
        const src = (iframe.src || '').toLowerCase();
        signatures.forEach(sig => {
          if (src.includes(sig)) found.push(`iframe: ${sig} (${iframe.src})`);
        });
      });

      // Check for chat-like elements visible on page
      const chatSelectors = [
        '[class*="chat" i]', '[id*="chat" i]',
        '[class*="livechat" i]', '[id*="livechat" i]',
        '[class*="messenger" i]', '[id*="messenger" i]',
        '[class*="widget" i][class*="chat" i]',
      ];
      chatSelectors.forEach(sel => {
        try {
          const els = document.querySelectorAll(sel);
          els.forEach(el => {
            const rect = el.getBoundingClientRect();
            // Only flag visible elements that look like floating widgets
            if (rect.width > 30 && rect.height > 30 && rect.width < 500) {
              const id = el.id ? `#${el.id}` : '';
              const cls = el.className ? `.${String(el.className).slice(0, 60)}` : '';
              found.push(`element: ${id || cls}`);
            }
          });
        } catch(e) {}
      });

      return [...new Set(found)];
    }, CHATBOT_SIGNATURES);

    return { url, hasChatbot: result.length > 0, signals: result, error: null };
  } catch (err) {
    return { url, hasChatbot: null, signals: [], error: err.message.slice(0, 100) };
  }
}

async function main() {
  // Extract URLs from CSVs
  const urls = new Set();

  const apollo = parse(readFileSync('/home/matthewseyoum17/leadpilot-ai/leads/apollo-leads.csv'), { columns: true });
  apollo.forEach(r => { if (r['Company Website']) urls.add(r['Company Website'].trim()); });

  const qualified = parse(readFileSync('/home/matthewseyoum17/leadpilot-ai/leads/qualified-leads.csv'), { columns: true });
  qualified.forEach(r => { if (r['Website']) urls.add(r['Website'].trim()); });

  const siteList = [...urls].filter(u => u.length > 0);
  console.log(`Checking ${siteList.length} sites for chatbots/live chat...\n`);

  const browser = await chromium.launch({ headless: true });
  const CONCURRENCY = 5;
  const results = [];

  for (let i = 0; i < siteList.length; i += CONCURRENCY) {
    const batch = siteList.slice(i, i + CONCURRENCY);
    const batchNum = Math.floor(i / CONCURRENCY) + 1;
    const totalBatches = Math.ceil(siteList.length / CONCURRENCY);
    console.log(`Batch ${batchNum}/${totalBatches}: ${batch.map(u => new URL(u).hostname).join(', ')}`);

    const promises = batch.map(async (url) => {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      const page = await context.newPage();
      const result = await checkSite(page, url);
      await context.close();
      return result;
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  }

  await browser.close();

  // Summary
  const withChat = results.filter(r => r.hasChatbot === true);
  const noChat = results.filter(r => r.hasChatbot === false);
  const errors = results.filter(r => r.error);

  console.log('\n========== RESULTS ==========\n');
  console.log(`Total sites checked: ${results.length}`);
  console.log(`NO chatbot/live chat: ${noChat.length}`);
  console.log(`HAS chatbot/live chat: ${withChat.length}`);
  console.log(`Errors (couldn't load): ${errors.length}`);

  if (withChat.length > 0) {
    console.log('\n--- SITES WITH CHATBOT/LIVE CHAT ---');
    withChat.forEach(r => {
      console.log(`  ${r.url}`);
      r.signals.forEach(s => console.log(`    -> ${s}`));
    });
  }

  if (errors.length > 0) {
    console.log('\n--- ERRORS (site down or blocked) ---');
    errors.forEach(r => {
      console.log(`  ${r.url} -- ${r.error}`);
    });
  }

  // Save full results as JSON
  writeFileSync('/home/matthewseyoum17/leadpilot-ai/leads/chatbot-check-results.json', JSON.stringify(results, null, 2));
  console.log('\nFull results saved to leads/chatbot-check-results.json');
}

main().catch(console.error);
