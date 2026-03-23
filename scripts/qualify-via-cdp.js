#!/usr/bin/env node
// Strict browser-verified lead qualifier for the web redesign + AI lead-capture package.
// Requires a Chrome instance exposing CDP on :9222.
// Enforces all 3 gates:
//   1) verified NO chatbot across HTML + scripts/network + desktop UI + mobile UI
//   2) redesign need >= 7
//   3) buyer quality >= 7
// Also requires package-fit >= 8.

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const INPUT = process.env.APOLLO_INPUT || path.join(__dirname, '..', 'leads', 'apollo-leads.csv');
const OUTPUT_JSON = path.join(__dirname, '..', 'leads', 'qualified-leads.json');
const OUTPUT_CSV = path.join(__dirname, '..', 'leads', 'qualified-leads.csv');

const CHATBOT_VENDORS = [
  { label: 'Intercom', tokens: ['intercom.io', 'intercom.com', 'widget.intercom'] },
  { label: 'Drift', tokens: ['drift.com', 'js.drift.com'] },
  { label: 'Zendesk', tokens: ['zendesk.com/embeddable', 'zopim', 'static.zdassets.com'] },
  { label: 'LiveChat', tokens: ['livechat.com', 'livechatinc.com'] },
  { label: 'Tawk', tokens: ['tawk.to', 'embed.tawk'] },
  { label: 'Crisp', tokens: ['crisp.chat', 'client.crisp'] },
  { label: 'HubSpot chat', tokens: ['hubspot.com/conversations', 'hubspot-messages', 'hs-banner', 'hs-scripts.com'] },
  { label: 'Olark', tokens: ['olark.com'] },
  { label: 'Smartsupp', tokens: ['smartsupp.com', 'smartsuppchat'] },
  { label: 'Gorgias', tokens: ['gorgias.chat', 'gorgias.com'] },
  { label: 'Podium', tokens: ['podium.com', 'podium-widget', 'podiumcdn.com'] },
  { label: 'Birdeye', tokens: ['birdeye.com', 'birdeye', 'birdai'] },
  { label: 'Thryv', tokens: ['thryv.com', 'thryv'] },
  { label: 'ServiceTitan', tokens: ['servicetitan', 'scheduleengine', 'schedule engine'] },
  { label: 'Housecall Pro', tokens: ['housecallpro', 'housecall pro'] },
  { label: 'Freshchat', tokens: ['freshchat', 'wchat.freshchat'] },
  { label: 'Userlike', tokens: ['userlike'] },
  { label: 'Chaport', tokens: ['chaport'] },
  { label: 'HelpCrunch', tokens: ['helpcrunch'] },
  { label: 'Chatra', tokens: ['chatra'] },
  { label: 'Kommunicate', tokens: ['kommunicate'] },
  { label: 'JivoChat', tokens: ['jivochat'] },
  { label: 'LeadConnector / HighLevel', tokens: ['leadconnector', 'gohighlevel', 'msgsndr.com'] },
  { label: 'Smith.ai', tokens: ['smith.ai'] },
];

const UI_CHAT_PATTERNS = [
  /message us/i,
  /chat with us/i,
  /live chat/i,
  /chat now/i,
  /need help\?/i,
  /we'?re online/i,
  /support/i,
  /text us/i,
  /sms us/i,
  /send us a message/i,
];

const FRANCHISE_PATTERNS = /one hour|mr\.? rooter|roto-rooter|service experts|ars rescue|home depot|lowe'?s|servpro|servicemaster|terminix|orkin/i;
const HIGH_INTENT_PATTERNS = /emergency|same-day|24\/7|urgent|dispatch|repair/i;

function splitCSV(line) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

function parseCSV(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCSV(lines[0]);
  return lines.slice(1).map(line => {
    const values = splitCSV(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[String(h || '').trim()] = String(values[i] || '').trim();
    });
    return obj;
  });
}

function csvEscape(val) {
  const s = String(val || '').replace(/\r?\n/g, ' ').trim();
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}

function normalizeWebsite(url) {
  let s = String(url || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s.replace(/\/$/, '');
}

function inferNiche(company) {
  const c = String(company || '').toLowerCase();
  if (/hvac|heating.*cool|air condition|heat.*air/i.test(c)) return 'HVAC';
  if (/plumb/i.test(c)) return 'Plumbing';
  if (/roof/i.test(c)) return 'Roofing';
  if (/pest|termite|extermina/i.test(c)) return 'Pest Control';
  if (/garage.*door/i.test(c)) return 'Garage Door';
  if (/electri/i.test(c)) return 'Electrical';
  if (/water.*damage|restor/i.test(c)) return 'Water Damage';
  if (/foundation/i.test(c)) return 'Foundation Repair';
  if (/tree/i.test(c)) return 'Tree Service';
  if (/remodel|kitchen|bath|renov/i.test(c)) return 'Remodeling';
  if (/concrete/i.test(c)) return 'Concrete';
  if (/landscap|lawn/i.test(c)) return 'Landscaping';
  if (/pool|swim/i.test(c)) return 'Pool';
  if (/solar/i.test(c)) return 'Solar';
  if (/lock/i.test(c)) return 'Locksmith';
  if (/mov/i.test(c)) return 'Moving';
  return 'Home Services';
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return '';
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function unique(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Bad JSON from ${url}`)); }
      });
    }).on('error', reject);
  });
}

let _id = 1;
function cdp(ws, method, params = {}, sid = null, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const id = _id++;
    const t = setTimeout(() => reject(new Error(`${method} timed out`)), timeout);
    const handler = msg => {
      let data;
      try { data = JSON.parse(msg.toString()); } catch { return; }
      if (data.id === id) {
        ws.removeListener('message', handler);
        clearTimeout(t);
        if (data.error) reject(new Error(`${method}: ${JSON.stringify(data.error)}`));
        else resolve(data.result);
      }
    };
    ws.on('message', handler);
    const payload = { id, method, params };
    if (sid) payload.sessionId = sid;
    ws.send(JSON.stringify(payload));
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildVendorHits(textChunks) {
  const lower = textChunks.join('\n').toLowerCase();
  const hits = [];
  for (const vendor of CHATBOT_VENDORS) {
    if (vendor.tokens.some(token => lower.includes(String(token).toLowerCase()))) hits.push(vendor.label);
  }
  return unique(hits);
}

function scoreRedesign(lead, desktop, mobile) {
  const problems = [];
  let score = 1;
  const add = (condition, points, label) => {
    if (condition && !problems.includes(label)) {
      problems.push(label);
      score += points;
    }
  };

  add(!desktop.h1Text || desktop.h1Text.length < 18, 1, 'Weak hero headline / unclear value proposition');
  add(!desktop.hasPrimaryCtaAboveFold, 2, 'Weak CTA hierarchy above the fold');
  add(!desktop.visiblePhoneAboveFold && !desktop.formVisibleAboveFold, 2, 'No strong above-the-fold conversion path');
  add(desktop.builderHits.length > 0, 2, 'Generic builder / template feel');
  add(desktop.tableLayout || desktop.inlineStyleHeavy, 1, 'Dated front-end implementation');
  add(desktop.navLinkCount >= 9 || desktop.aboveFoldInteractiveCount >= 10, 1, 'Cluttered layout / crowded header');
  add(!desktop.hasReviewsSection && !desktop.hasTrustBlock, 1, 'Poor trust presentation');
  add(desktop.sectionCount < 5, 1, 'Thin page structure');
  add(!desktop.customTypography, 1, 'Weak typography / brand hierarchy');
  add(mobile.hasOverflow || !mobile.hasPrimaryCtaAboveFold || (!mobile.visiblePhoneAboveFold && !mobile.formVisibleAboveFold), 2, 'Bad mobile UX / weak mobile conversion');
  add(!mobile.hasStickyMobileCta && !mobile.visiblePhoneAboveFold, 1, 'Mobile CTA is easy to miss');

  score = clamp(score, 1, 10);
  return { score, problems };
}

function scoreBuyerQuality(lead, desktop, mobile) {
  let score = 0;
  const reasons = [];
  const add = (condition, points, label) => {
    if (condition) {
      score += points;
      reasons.push(label);
    }
  };

  add(!FRANCHISE_PATTERNS.test(lead.businessName), 1, 'Independent / non-chain operator');
  add(desktop.serviceKeywordCount >= 4 || desktop.internalLinkCount >= 12, 2, 'Broad service footprint / mature site');
  add(desktop.hasReviewsSection || desktop.reviewCountMention >= 10 || /4\.[5-9]|5\.0/.test(`${desktop.title} ${desktop.bodySample}`), 2, 'Visible reputation / review proof');
  add(desktop.yearsMention >= 5 || /family owned|since\s+19|since\s+20|locally owned/i.test(desktop.bodySample), 1, 'Longevity / established business');
  add(desktop.hasEmergencyWords || HIGH_INTENT_PATTERNS.test(`${lead.niche} ${lead.businessName}`), 1, 'High-intent / urgent service');
  add(desktop.hasFinancing, 1, 'Financing / promotion capability');
  add(desktop.hasServiceAreaWords || desktop.internalLinkCount >= 16, 1, 'Multiple service areas / SEO footprint');
  add(desktop.phoneLinkCount >= 1 && (desktop.hasAddress || desktop.hasEmail || mobile.phoneLinkCount >= 1), 1, 'Legitimate operating business signals');
  add(desktop.hasQuoteWords || desktop.formCount >= 1, 1, 'Actively trying to capture inbound demand');

  score = clamp(score, 1, 10);
  return { score, reasons };
}

function buildLeadCaptureGaps(desktop, mobile) {
  const gaps = [];
  const add = (condition, label) => { if (condition && !gaps.includes(label)) gaps.push(label); };
  add(!desktop.hasPrimaryCtaAboveFold, 'Primary CTA above the fold is weak or missing');
  add(!desktop.visiblePhoneAboveFold, 'Phone CTA is not visible early on desktop');
  add(!desktop.formVisibleAboveFold && desktop.formCount === 0, 'No visible quote/request form');
  add(!mobile.visiblePhoneAboveFold && !mobile.hasStickyMobileCta, 'Mobile users do not get a strong tap-to-call path');
  add(true, 'No instant website engagement or after-hours capture path');
  add(desktop.hasPrimaryCtaAboveFold && !desktop.hasQuoteWords && desktop.formCount === 0, 'CTA hierarchy does not clearly push estimate / service requests');
  return gaps;
}

function scorePackageFit(lead, noChatResult, redesign, buyer, gaps, desktop) {
  let score = 0;
  if (noChatResult.verified) score += 2;
  if (redesign.score >= 8) score += 2;
  else if (redesign.score >= 7) score += 1;
  if (buyer.score >= 8) score += 2;
  else if (buyer.score >= 7) score += 1;
  if (gaps.length >= 3) score += 2;
  else if (gaps.length >= 2) score += 1;
  if (desktop.marketingSignals.length >= 2 || desktop.hasServiceAreaWords) score += 1;
  if (desktop.hasEmergencyWords || HIGH_INTENT_PATTERNS.test(`${lead.niche} ${lead.businessName}`)) score += 1;
  return clamp(score, 1, 10);
}

function buildComboReason(lead, redesign, buyer, gaps) {
  const topProblems = redesign.problems.slice(0, 2).join('; ');
  const topGaps = gaps.slice(0, 2).join('; ');
  return `${lead.businessName} is the right kind of target because the website itself is clearly subpar (${topProblems || 'dated conversion experience'}), there is still no chatbot/live-chat layer in place, and the business is leaving money on the table through lead-capture gaps (${topGaps || 'no instant response path'}) — which makes the redesign + AI lead capture package a strong combo offer.`;
}

function getOwnerNameIfPublic(name, title) {
  if (!name) return '';
  if (/owner|founder|president|ceo|principal|operator|co-owner/i.test(title || '')) return name;
  return '';
}

async function collectAudit(ws, sessionId, website, mode) {
  const isMobile = mode === 'mobile';
  const requestUrls = [];
  const messageHandler = msg => {
    let data;
    try { data = JSON.parse(msg.toString()); } catch { return; }
    if (data.sessionId !== sessionId) return;
    if (data.method === 'Network.requestWillBeSent') {
      const reqUrl = data.params && data.params.request && data.params.request.url;
      if (reqUrl) requestUrls.push(reqUrl);
    }
  };
  ws.on('message', messageHandler);

  try {
    const width = isMobile ? 390 : 1440;
    const height = isMobile ? 844 : 900;
    await cdp(ws, 'Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: isMobile ? 3 : 1,
      mobile: isMobile,
      screenWidth: width,
      screenHeight: height,
    }, sessionId, 15000);

    await cdp(ws, 'Emulation.setUserAgentOverride', {
      userAgent: isMobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      platform: isMobile ? 'iPhone' : 'Windows',
      acceptLanguage: 'en-US,en;q=0.9',
    }, sessionId, 15000);

    await cdp(ws, 'Page.navigate', { url: website }, sessionId, 25000);
    await sleep(isMobile ? 5500 : 4500);

    const expression = `
      (function() {
        try {
          var vendors = ${JSON.stringify(CHATBOT_VENDORS)};
          var uiPatterns = ${JSON.stringify(UI_CHAT_PATTERNS.map(r => r.source))};
          var html = document.documentElement.outerHTML || '';
          var lower = html.toLowerCase();
          var bodyText = (document.body ? (document.body.innerText || '') : '').replace(/\s+/g, ' ').trim();
          var vendorHits = [];
          vendors.forEach(function(v){
            if (v.tokens.some(function(token){ return lower.indexOf(String(token).toLowerCase()) !== -1; })) {
              vendorHits.push(v.label);
            }
          });

          var scripts = Array.from(document.scripts || []).map(function(s){ return s.src || s.innerHTML || ''; }).filter(Boolean);
          var scriptHits = [];
          vendors.forEach(function(v){
            if (v.tokens.some(function(token){
              return scripts.some(function(src){ return String(src).toLowerCase().indexOf(String(token).toLowerCase()) !== -1; });
            })) {
              scriptHits.push(v.label);
            }
          });

          function visible(el) {
            if (!el) return false;
            var style = window.getComputedStyle(el);
            if (!style || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            var rect = el.getBoundingClientRect();
            return rect.width > 18 && rect.height > 18;
          }

          var chatSelectors = [
            '[aria-label*="chat" i]',
            '[aria-label*="message us" i]',
            '[class*="chat" i]',
            '[id*="chat" i]',
            '[class*="messenger" i]',
            '[id*="messenger" i]',
            '[class*="podium" i]',
            '[class*="intercom" i]',
            '[class*="drift" i]',
            '[class*="crisp" i]',
            '[class*="tawk" i]',
            'iframe[src*="chat" i]',
            'iframe[src*="messenger" i]',
            'iframe[src*="widget" i]'
          ];
          var uiSignals = [];
          var seenUi = new Set();
          chatSelectors.forEach(function(sel){
            Array.from(document.querySelectorAll(sel)).slice(0, 20).forEach(function(el){
              if (!visible(el)) return;
              var rect = el.getBoundingClientRect();
              var style = window.getComputedStyle(el);
              var fixedish = style.position === 'fixed' || style.position === 'sticky' || rect.bottom > window.innerHeight - 180 || rect.right > window.innerWidth - 180;
              var text = ((el.innerText || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.id || '') + ' ' + (el.className || '')).replace(/\s+/g, ' ').trim().slice(0, 160);
              if (!fixedish && !text) return;
              var looksChat = text ? uiPatterns.some(function(src){ return new RegExp(src, 'i').test(text); }) : true;
              if (looksChat || fixedish) {
                var label = (sel + ' :: ' + text).slice(0, 180);
                if (!seenUi.has(label)) {
                  seenUi.add(label);
                  uiSignals.push(label);
                }
              }
            });
          });

          var interactive = Array.from(document.querySelectorAll('a,button,input[type="submit"],input[type="button"]')).filter(visible);
          var aboveFoldInteractive = interactive.filter(function(el){ return el.getBoundingClientRect().top < window.innerHeight * 0.9; });
          var ctaRegex = /(call|quote|estimate|schedule|book|request|service|inspection|get started|consultation|contact)/i;
          var phoneRegex = /\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}|call now|tap to call/i;
          var hasPrimaryCtaAboveFold = aboveFoldInteractive.some(function(el){
            var text = ((el.innerText || '') + ' ' + (el.value || '') + ' ' + (el.getAttribute('aria-label') || '')).trim();
            return ctaRegex.test(text);
          });
          var visiblePhoneAboveFold = aboveFoldInteractive.some(function(el){
            var text = ((el.innerText || '') + ' ' + (el.getAttribute('href') || '')).trim();
            return /tel:/i.test(text) || phoneRegex.test(text);
          });

          var forms = Array.from(document.querySelectorAll('form')).filter(visible);
          var formVisibleAboveFold = forms.some(function(el){ return el.getBoundingClientRect().top < window.innerHeight * 1.1; });
          var hasStickyMobileCta = Array.from(document.querySelectorAll('a,button')).filter(visible).some(function(el){
            var rect = el.getBoundingClientRect();
            var style = window.getComputedStyle(el);
            var text = (el.innerText || '').trim();
            return style.position === 'fixed' && rect.bottom > window.innerHeight - 120 && ctaRegex.test(text + ' ' + (el.getAttribute('href') || ''));
          });

          var sectionCount = document.querySelectorAll('section').length;
          var navLinkCount = document.querySelectorAll('nav a').length;
          var phoneLinkCount = document.querySelectorAll('a[href^="tel:"]').length;
          var telHref = document.querySelector('a[href^="tel:"]');
          var phoneFromSite = '';
          if (telHref && telHref.getAttribute('href')) {
            var digits = telHref.getAttribute('href').replace(/\D/g, '');
            if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
            if (digits.length === 10) phoneFromSite = '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
          }
          var internalLinkCount = Array.from(document.querySelectorAll('a[href]')).filter(function(a){
            try {
              var u = new URL(a.href, location.href);
              return u.hostname === location.hostname;
            } catch (e) { return false; }
          }).length;

          var builderHits = [];
          [['Wix', /wix/i], ['Squarespace', /squarespace/i], ['Weebly', /weebly/i], ['GoDaddy Website Builder', /godaddy/i]].forEach(function(entry){
            if (entry[1].test(lower)) builderHits.push(entry[0]);
          });

          var reviewCountMention = 0;
          var reviewMatches = bodyText.match(/(\d{2,4})\s*\+?\s*(google|customer|5-star|reviews?)/ig) || [];
          reviewMatches.forEach(function(hit){
            var n = parseInt(hit, 10);
            if (!Number.isNaN(n) && n > reviewCountMention) reviewCountMention = n;
          });
          var yearsMention = 0;
          var yearsMatch = bodyText.match(/(\d{1,3})\s*\+?\s*(years|yrs)/i);
          if (yearsMatch) yearsMention = parseInt(yearsMatch[1], 10) || 0;

          var fontsLinks = Array.from(document.querySelectorAll('link[href*="fonts.googleapis.com"], style')).map(function(el){ return el.outerHTML || ''; }).join('\n').toLowerCase();
          var customTypography = /fonts.googleapis.com|font-family/i.test(fontsLinks);
          var hasReviewsSection = /reviews?|testimonials?|what our customers say|customer stories/i.test(lower);
          var hasTrustBlock = /licensed|insured|bonded|family owned|locally owned|warranty|guarantee|since\s+19|since\s+20/i.test(lower);
          var hasFinancing = /financing|special offer|coupon|save \$|discount/i.test(lower);
          var hasEmergencyWords = /emergency|same-day|24\/7|dispatch now|immediate/i.test(lower);
          var hasServiceAreaWords = /areas we serve|service area|serving |locations/i.test(lower);
          var hasQuoteWords = /free quote|free estimate|get a quote|request service|schedule service|book now|inspection/i.test(lower);
          var hasAddress = /\d+\s+[a-z0-9.#\-\s]+,\s*[a-z .'-]+,\s*[A-Z]{2}\s*\d{5}/.test(bodyText) || /address/i.test(lower);
          var hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(bodyText);
          var tableLayout = /<table\b/i.test(html);
          var inlineStyleHeavy = (html.match(/style=/gi) || []).length >= 25;
          var hasOverflow = document.documentElement.scrollWidth > window.innerWidth + 8;
          var serviceKeywordCount = (bodyText.match(/repair|installation|replacement|maintenance|inspection|service|drain|heater|cooling|roof|remodel|electrical|plumbing/ig) || []).length;
          var marketingSignals = [];
          if (/googletagmanager|gtag|gclid|adwords|google ads/i.test(lower)) marketingSignals.push('Google Ads / GTM');
          if (hasServiceAreaWords || internalLinkCount >= 12) marketingSignals.push('Local SEO / service area footprint');
          if (hasQuoteWords) marketingSignals.push('Estimate / request CTA');
          if (phoneLinkCount >= 1) marketingSignals.push('Prominent phone CTA');
          if (forms.length >= 1) marketingSignals.push('Contact / quote form');
          if (hasReviewsSection) marketingSignals.push('Review proof');
          if (hasFinancing) marketingSignals.push('Financing / promotions');
          if (hasEmergencyWords) marketingSignals.push('High-intent emergency positioning');

          var h1 = document.querySelector('h1');
          var title = document.title || '';
          var bodySample = bodyText.slice(0, 1200);

          return JSON.stringify({
            ok: true,
            finalUrl: location.href,
            title: title,
            h1Text: h1 ? (h1.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160) : '',
            bodySample: bodySample,
            htmlVendorHits: vendorHits,
            scriptVendorHits: scriptHits,
            uiSignals: uiSignals,
            builderHits: builderHits,
            hasPrimaryCtaAboveFold: hasPrimaryCtaAboveFold,
            visiblePhoneAboveFold: visiblePhoneAboveFold,
            formVisibleAboveFold: formVisibleAboveFold,
            hasStickyMobileCta: hasStickyMobileCta,
            navLinkCount: navLinkCount,
            aboveFoldInteractiveCount: aboveFoldInteractive.length,
            sectionCount: sectionCount,
            formCount: forms.length,
            phoneLinkCount: phoneLinkCount,
            phoneFromSite: phoneFromSite,
            internalLinkCount: internalLinkCount,
            customTypography: customTypography,
            hasReviewsSection: hasReviewsSection,
            hasTrustBlock: hasTrustBlock,
            hasFinancing: hasFinancing,
            hasEmergencyWords: hasEmergencyWords,
            hasServiceAreaWords: hasServiceAreaWords,
            hasQuoteWords: hasQuoteWords,
            hasAddress: hasAddress,
            hasEmail: hasEmail,
            tableLayout: tableLayout,
            inlineStyleHeavy: inlineStyleHeavy,
            hasOverflow: hasOverflow,
            reviewCountMention: reviewCountMention,
            yearsMention: yearsMention,
            serviceKeywordCount: serviceKeywordCount,
            marketingSignals: marketingSignals
          });
        } catch (err) {
          return JSON.stringify({ ok: false, error: err && err.message ? err.message : String(err) });
        }
      })();
    `;

    const { result } = await cdp(ws, 'Runtime.evaluate', { expression, returnByValue: true }, sessionId, 25000);
    const payload = JSON.parse(result.value || '{}');
    payload.requestVendorHits = buildVendorHits(requestUrls);
    payload.requestUrls = requestUrls;
    payload.vendorHits = unique([
      ...(payload.htmlVendorHits || []),
      ...(payload.scriptVendorHits || []),
      ...(payload.requestVendorHits || []),
    ]);
    payload.uiSignals = unique(payload.uiSignals || []);
    payload.ok = payload.ok !== false;
    return payload;
  } finally {
    ws.removeListener('message', messageHandler);
  }
}

function buildNoChatResult(desktop, mobile) {
  const allVendorHits = unique([...(desktop.vendorHits || []), ...(mobile.vendorHits || [])]);
  const allUiSignals = unique([...(desktop.uiSignals || []), ...(mobile.uiSignals || [])]);
  const checksCompleted = Boolean(desktop.ok && mobile.ok);
  const verified = checksCompleted && allVendorHits.length === 0 && allUiSignals.length === 0;
  const confidence = !checksCompleted ? 4 : (verified ? 10 : 0);
  return {
    verified,
    confidence,
    signals: unique([
      ...allVendorHits.map(v => `Vendor:${v}`),
      ...allUiSignals.map(v => `UI:${v}`),
    ]),
  };
}

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Missing Apollo input: ${INPUT}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT, 'utf-8');
  const leads = parseCSV(raw);
  console.log(`\n📊 ${leads.length} raw leads\n`);

  const seen = new Set();
  const uniqueLeads = [];
  for (const lead of leads) {
    const website = normalizeWebsite(lead['Company Website'] || lead.Website || '');
    const company = lead.Company || lead['Business Name'] || '';
    if (!website || !company) continue;
    const domain = website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    if (FRANCHISE_PATTERNS.test(company)) continue;
    uniqueLeads.push({
      raw: lead,
      businessName: company,
      website,
      niche: lead.Industry || inferNiche(company),
      city: lead.City || '',
      state: lead.State || '',
      decisionMaker: lead.Name || '',
      title: lead.Title || '',
      email: lead.Email && !/not_unlocked/i.test(lead.Email) ? lead.Email : '',
      phone: normalizePhone(lead.Phone || ''),
      source: lead.Source || 'apollo',
    });
  }

  console.log(`🔄 ${uniqueLeads.length} unique companies with websites\n`);

  let version;
  try {
    version = await httpGet('http://127.0.0.1:9222/json/version');
  } catch (err) {
    console.error('❌ Could not connect to Chrome CDP on http://127.0.0.1:9222');
    console.error('   Start Chrome with remote debugging enabled before running this strict qualifier.');
    console.error(`   Detail: ${err.message}`);
    process.exit(1);
  }

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  const { targetId } = await cdp(ws, 'Target.createTarget', { url: 'about:blank' }, null, 20000);
  const { sessionId } = await cdp(ws, 'Target.attachToTarget', { targetId, flatten: true }, null, 20000);
  await cdp(ws, 'Page.enable', {}, sessionId, 15000);
  await cdp(ws, 'Runtime.enable', {}, sessionId, 15000);
  await cdp(ws, 'Network.enable', {}, sessionId, 15000);

  const qualified = [];
  const rejected = {
    chat: 0,
    ambiguous: 0,
    redesign: 0,
    buyer: 0,
    packageFit: 0,
    navigation: 0,
  };

  for (let i = 0; i < uniqueLeads.length; i++) {
    const lead = uniqueLeads[i];
    process.stdout.write(`[${i + 1}/${uniqueLeads.length}] ${lead.businessName}... `);

    try {
      const desktop = await collectAudit(ws, sessionId, lead.website, 'desktop');
      await sleep(1200);
      const mobile = await collectAudit(ws, sessionId, lead.website, 'mobile');
      await sleep(1200);

      if (!desktop.ok || !mobile.ok) {
        rejected.ambiguous++;
        console.log('❌ could not complete desktop/mobile verification');
        continue;
      }

      const noChat = buildNoChatResult(desktop, mobile);
      if (!noChat.verified) {
        if (noChat.signals.length > 0) rejected.chat++;
        else rejected.ambiguous++;
        console.log(`❌ chat/ambiguous (${noChat.signals.slice(0, 2).join('; ') || 'verification incomplete'})`);
        continue;
      }

      const redesign = scoreRedesign(lead, desktop, mobile);
      if (redesign.score < 7) {
        rejected.redesign++;
        console.log(`❌ redesign ${redesign.score}/10`);
        continue;
      }

      const buyer = scoreBuyerQuality(lead, desktop, mobile);
      if (buyer.score < 7) {
        rejected.buyer++;
        console.log(`❌ buyer ${buyer.score}/10`);
        continue;
      }

      const leadCaptureGaps = buildLeadCaptureGaps(desktop, mobile);
      const packageFit = scorePackageFit(lead, noChat, redesign, buyer, leadCaptureGaps, desktop);
      if (packageFit < 8) {
        rejected.packageFit++;
        console.log(`❌ package-fit ${packageFit}/10`);
        continue;
      }

      const overallScore = noChat.confidence + redesign.score + buyer.score + packageFit;
      const ownerNameIfPublic = getOwnerNameIfPublic(lead.decisionMaker, lead.title);
      const redesignProblems = redesign.problems;
      const comboReason = buildComboReason(lead, redesign, buyer, leadCaptureGaps);
      const marketingSignals = unique([...(desktop.marketingSignals || []), ...(mobile.marketingSignals || [])]);

      qualified.push({
        businessName: lead.businessName,
        niche: lead.niche,
        city: lead.city,
        state: lead.state,
        website: mobile.finalUrl || desktop.finalUrl || lead.website,
        phone: lead.phone || desktop.phoneFromSite || mobile.phoneFromSite || normalizePhone(''),
        ownerNameIfPublic,
        decisionMaker: lead.decisionMaker,
        title: lead.title,
        email: lead.email,
        verifiedNoChatbot: 'Yes',
        noChatConfidence: noChat.confidence,
        redesignNeedScore: redesign.score,
        buyerQualityScore: buyer.score,
        packageFitScore: packageFit,
        overallScore,
        exactRedesignProblems: redesignProblems,
        exactLeadCaptureGaps: leadCaptureGaps,
        whyStrongComboOfferLead: comboReason,
        marketingSignals,
        chatSignalsFound: 'None',
        verificationNotes: 'HTML checked; script/vendor sources checked; rendered desktop UI checked; rendered mobile UI checked.',
        chatbot: 'No',
        missedLeadOpportunity: leadCaptureGaps.join('; '),
        fitScore: overallScore,
        whyItFits: comboReason,
        source: lead.source,
      });

      console.log(`✅ ${overallScore}/40 | redesign ${redesign.score} | buyer ${buyer.score} | pkg ${packageFit}`);
    } catch (err) {
      rejected.navigation++;
      console.log(`❌ ${String(err.message || err).slice(0, 80)}`);
    }
  }

  try { await cdp(ws, 'Target.closeTarget', { targetId }, null, 15000); } catch {}
  ws.close();

  qualified.sort((a, b) => (
    b.overallScore - a.overallScore ||
    b.packageFitScore - a.packageFitScore ||
    b.redesignNeedScore - a.redesignNeedScore ||
    a.businessName.localeCompare(b.businessName)
  ));

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(qualified, null, 2));
  const headers = [
    'Business Name', 'Niche', 'City', 'State', 'Website', 'Phone', 'Owner Name if public', 'Decision Maker', 'Title', 'Email',
    'Verified No Chatbot', 'No-Chat Confidence', 'Redesign Need Score', 'Buyer Quality Score', 'Package-Fit Score', 'Overall Score',
    'Exact Redesign Problems', 'Exact Lead-Capture Gaps', 'Why This Is A Strong Combo-Offer Lead', 'Marketing Signals', 'Chat Signals Found',
    'Verification Notes', 'Chatbot?', 'Missed-Lead Opportunity', 'Fit Score', 'Why It Fits', 'Source'
  ];
  const csvRows = qualified.map(row => [
    row.businessName,
    row.niche,
    row.city,
    row.state,
    row.website,
    row.phone,
    row.ownerNameIfPublic,
    row.decisionMaker,
    row.title,
    row.email,
    row.verifiedNoChatbot,
    row.noChatConfidence,
    row.redesignNeedScore,
    row.buyerQualityScore,
    row.packageFitScore,
    row.overallScore,
    row.exactRedesignProblems.join('; '),
    row.exactLeadCaptureGaps.join('; '),
    row.whyStrongComboOfferLead,
    row.marketingSignals.join('; '),
    row.chatSignalsFound,
    row.verificationNotes,
    row.chatbot,
    row.missedLeadOpportunity,
    row.fitScore,
    row.whyItFits,
    row.source,
  ].map(csvEscape).join(','));
  fs.writeFileSync(OUTPUT_CSV, headers.join(',') + '\n' + csvRows.join('\n') + '\n');

  console.log(`\n${'='.repeat(72)}`);
  console.log('STRICT QUALIFIER RESULTS');
  console.log(`${'='.repeat(72)}`);
  console.log(`Checked:                ${uniqueLeads.length}`);
  console.log(`Rejected chat:          ${rejected.chat}`);
  console.log(`Rejected ambiguous:     ${rejected.ambiguous}`);
  console.log(`Rejected redesign:      ${rejected.redesign}`);
  console.log(`Rejected buyer quality: ${rejected.buyer}`);
  console.log(`Rejected package-fit:   ${rejected.packageFit}`);
  console.log(`Navigation/runtime err: ${rejected.navigation}`);
  console.log(`✅ Qualified:           ${qualified.length}`);
  console.log(`\n📁 ${OUTPUT_CSV}`);
  console.log(`📁 ${OUTPUT_JSON}\n`);
}

main().catch(err => {
  console.error(`\n❌ Fatal: ${err.message}`);
  process.exit(1);
});
