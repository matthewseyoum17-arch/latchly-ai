#!/usr/bin/env node
// Takes a raw Apollo CSV, visits each website, checks for chatbot,
// finds marketing signals, scores, and outputs qualified leads.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const INPUT = process.env.APOLLO_INPUT || path.join(__dirname, '..', 'leads', 'apollo-leads.csv');
const OUTPUT = path.join(__dirname, '..', 'leads', 'qualified-leads.json');
const OUTPUT_CSV = path.join(__dirname, '..', 'leads', 'qualified-leads.csv');

const CHATBOT_SIGNATURES = [
  'intercom.io', 'intercom.com', 'widget.intercom',
  'js.drift.com', 'drift.com/core', 'drift.com',
  'code.tidio.co', 'tidio.com', 'tidio.co',
  'livechat.com', 'livechatinc.com',
  'zendesk.com/embeddable', 'zopim', 'zendesk.com',
  'crisp.chat', 'client.crisp',
  'tawk.to', 'embed.tawk',
  'hs-scripts.com', 'hubspot.com/conversations',
  'freshchat', 'wchat.freshchat',
  'olark.com', 'smartsupp.com', 'userlike.com', 'chaport.com',
  'botpress', 'landbot.io', 'manychat.com', 'chatbot.com',
  'ada.cx', 'ada.support', 'qualified.com',
  'podium.com', 'podium', 'birdeye.com', 'birdeye',
  'webchat.so', 'servicewidget', 'liveperson.com', 'comm100.com',
  'helpcrunch.com', 'customerly.io', 'chatra.com', 'kommunicate.io', 'gorgias.com',
  'joinchat', 'latchly', 'latchlyai', 'smith.ai', 'chatfuel.com',
  'activecampaign.com/conversations', 'servicebot', 'leadbot', 'hellobar',
];

const CHAT_WIDGET_SELECTORS = [
  'iframe[src*="chat"]', 'iframe[src*="widget"]', 'iframe[src*="messenger"]',
  '[class*="chat-widget"]', '[class*="chatWidget"]', '[class*="chat-bubble"]',
  '[class*="chatBubble"]', '[class*="live-chat"]', '[class*="liveChat"]',
  '[id*="chat-widget"]', '[id*="chatWidget"]', '[id*="tidio"]', '[id*="drift"]',
  '[id*="intercom"]', '[id*="tawk"]', '[id*="crisp"]', '[id*="hubspot-messages"]',
  '[id*="podium"]', '[id*="birdeye"]',
];

const MARKETING_SIGNALS = {
  googleAds: [/gads|google.*ads|adwords|gclid|google_ads/i, /googletagmanager/i, /gtag.*conversion/i],
  localServiceAds: [/google.*local.*service|lsa|google.*guarantee/i],
  seo: [/service.*area|serving|we.*serve|locations.*served/i],
  reviews: [/reviews?|testimonials?|rating|stars?|customer.*feedback/i],
  quoteCTA: [/free.*quote|free.*estimate|get.*quote|request.*quote|book.*now|schedule.*now|call.*now|get.*started/i],
  phoneProminent: [/tel:|href="tel:/i],
  formPresent: [/<form/i],
};

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

async function safeGoto(page, url, timeoutMs = 20000) {
  const candidates = [normalizeWebsite(url)];
  if (/^https:\/\//i.test(candidates[0])) candidates.push(candidates[0].replace(/^https:/i, 'http:'));
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const response = await page.goto(candidate, { timeout: timeoutMs, waitUntil: 'domcontentloaded' });
      if (response && response.status() < 400) return { ok: true, url: candidate };
    } catch {}
  }
  return { ok: false, url: candidates[0] || url };
}

async function checkWebsite(page, url, timeoutMs = 20000) {
  const result = {
    accessible: false,
    resolvedUrl: normalizeWebsite(url),
    hasChatbot: false,
    chatbotName: null,
    marketingSignals: [],
    hasQuoteCTA: false,
    hasPhoneProminent: false,
    hasForm: false,
    hasReviews: false,
    hasGoogleAds: false,
    hasSEOPages: false,
    ownerNameFromSite: null,
    phoneFromSite: null,
    missedLeadOpportunity: '',
  };

  const navigation = await safeGoto(page, url, timeoutMs);
  if (!navigation.ok) return result;
  result.accessible = true;
  result.resolvedUrl = navigation.url;

  try {
    await page.waitForTimeout(2500);
    const html = await page.content();
    const lower = html.toLowerCase();

    for (const sig of CHATBOT_SIGNATURES) {
      if (lower.includes(sig.toLowerCase())) {
        result.hasChatbot = true;
        result.chatbotName = sig;
        return result;
      }
    }

    for (const sel of CHAT_WIDGET_SELECTORS) {
      try {
        const el = await page.$(sel);
        if (el) {
          const visible = await el.isVisible().catch(() => false);
          if (visible) {
            result.hasChatbot = true;
            result.chatbotName = sel;
            return result;
          }
        }
      } catch {}
    }

    if (MARKETING_SIGNALS.googleAds.some(p => p.test(html))) {
      result.hasGoogleAds = true;
      result.marketingSignals.push('Google Ads/GTM detected');
    }
    if (MARKETING_SIGNALS.localServiceAds.some(p => p.test(html))) result.marketingSignals.push('Local Service Ads');
    if (MARKETING_SIGNALS.seo.some(p => p.test(html))) {
      result.hasSEOPages = true;
      result.marketingSignals.push('Service area / SEO pages');
    }
    if (MARKETING_SIGNALS.reviews.some(p => p.test(html))) {
      result.hasReviews = true;
      result.marketingSignals.push('Reviews/testimonials on site');
    }
    if (MARKETING_SIGNALS.quoteCTA.some(p => p.test(html))) {
      result.hasQuoteCTA = true;
      result.marketingSignals.push('Quote/estimate CTA');
    }
    if (MARKETING_SIGNALS.phoneProminent.some(p => p.test(html))) {
      result.hasPhoneProminent = true;
      result.marketingSignals.push('Prominent phone number');
    }
    if (MARKETING_SIGNALS.formPresent.some(p => p.test(html))) {
      result.hasForm = true;
      result.marketingSignals.push('Contact form present');
    }

    try {
      const navLinks = await page.$$eval('nav a, .menu a, .nav a, header a', links =>
        links.map(a => (a.textContent || '').trim()).filter(Boolean)
      );
      if (navLinks.length > 5) result.marketingSignals.push(`${navLinks.length} nav links (multi-page site)`);
    } catch {}

    const telHrefMatch = html.match(/href=["']tel:([^"']+)["']/i);
    const rawPhone = telHrefMatch ? telHrefMatch[1] : (html.match(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/) || [])[0] || '';
    const digits = String(rawPhone).replace(/\D/g, '');
    if (digits.length >= 10) {
      const ten = digits.slice(-10);
      result.phoneFromSite = `(${ten.slice(0,3)}) ${ten.slice(3,6)}-${ten.slice(6)}`;
    }

    const aboutLinks = await page.$$eval('a', links => links
      .map(a => a.href)
      .filter(href => /about|team|staff|our-team/i.test(href))
      .slice(0, 2)
    ).catch(() => []);

    for (const aboutUrl of aboutLinks) {
      try {
        await page.goto(aboutUrl, { timeout: 10000, waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);
        const aboutHtml = await page.content();
        const ownerPatterns = [
          /(?:owner|founder|president|ceo|proprietor)[^<\w]{1,30}([A-Z][a-z]{1,20}\s[A-Z][a-z]{1,20})/gi,
          /([A-Z][a-z]{1,20}\s[A-Z][a-z]{1,20})[^<\w]{1,30}(?:owner|founder|president|ceo|proprietor)/gi,
        ];
        for (const pattern of ownerPatterns) {
          pattern.lastIndex = 0;
          const match = pattern.exec(aboutHtml);
          if (match) {
            result.ownerNameFromSite = match[1].trim();
            break;
          }
        }
        if (result.ownerNameFromSite) break;
      } catch {}
    }

    const opportunities = [];
    if (!result.hasForm && !result.hasQuoteCTA) opportunities.push('No lead capture form or CTA');
    else if (result.hasForm && !result.hasQuoteCTA) opportunities.push('Form exists but no strong CTA to drive action');
    if (!result.hasPhoneProminent) opportunities.push('Phone not prominently displayed');
    if (result.hasGoogleAds) opportunities.push('Paying for traffic but weak conversion path');
    if (!result.hasChatbot) opportunities.push('No instant engagement — visitors must wait for callback');
    opportunities.push('No after-hours lead capture');
    result.missedLeadOpportunity = opportunities.slice(0, 3).join('; ');
  } catch {}

  return result;
}

function scoreLead(lead, siteData) {
  let score = 0;
  const reasons = [];
  score++; reasons.push('Good niche');
  if (siteData.accessible) { score++; reasons.push('Active website'); }
  const hasOwnerName = lead.Name && lead.Name.length > 3 && !lead.Name.includes('@');
  if (hasOwnerName) { score++; reasons.push('Decision maker identified'); }
  const hasPhone = (lead.Phone && lead.Phone.length > 5) || siteData.phoneFromSite;
  if (hasPhone) { score++; reasons.push('Phone number available'); }
  if (!siteData.hasChatbot) { score++; reasons.push('No chatbot/AI chat'); }
  if (siteData.marketingSignals.length >= 2) { score++; reasons.push(`${siteData.marketingSignals.length} marketing signals`); }
  const highTicket = /hvac|plumb|roof|foundation|water damage|restoration|electri|remodel|solar|garage door|tree|pest/i;
  if (highTicket.test(lead.Company) || highTicket.test(lead.Industry)) { score++; reasons.push('High-ticket service'); }
  const franchise = /one hour|mr\. rooter|roto-rooter|service experts|ars rescue|comfort systems|lennox|carrier|trane|home depot|lowe/i;
  if (!franchise.test(lead.Company)) { score++; reasons.push('Independent operator'); }
  if (siteData.missedLeadOpportunity && siteData.missedLeadOpportunity.length > 10) { score++; reasons.push('Clear missed-lead opportunity'); }
  const emp = parseInt(lead.Employees) || 0;
  if (emp === 0 || (emp >= 5 && emp <= 50)) { score++; reasons.push('Right company size'); }
  return { score, reasons };
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

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Missing Apollo input: ${INPUT}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT, 'utf-8');
  const leads = parseCSV(raw);
  console.log(`\n📊 Loaded ${leads.length} raw leads from ${path.relative(path.join(__dirname, '..'), INPUT)}\n`);

  const withWebsite = leads.filter(l => normalizeWebsite(l['Company Website']));
  console.log(`🌐 ${withWebsite.length} have websites\n`);

  const seen = new Set();
  const unique = [];
  for (const l of withWebsite) {
    const domain = normalizeWebsite(l['Company Website']).replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    if (seen.has(domain)) continue;
    seen.add(domain);
    unique.push(l);
  }
  console.log(`🔄 ${unique.length} unique companies after dedupe\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const qualified = [];
  let checked = 0;
  const rejected = { chatbot: 0, lowScore: 0, noSite: 0, noName: 0, franchise: 0 };

  for (const lead of unique) {
    checked++;
    const name = lead.Name || '';
    const company = lead.Company || '';
    const website = normalizeWebsite(lead['Company Website']);

    process.stdout.write(`[${checked}/${unique.length}] ${company}... `);

    const franchisePattern = /one hour|mr\. rooter|roto-rooter|service experts|ars rescue|comfort systems|home depot|lowe's/i;
    if (franchisePattern.test(company)) {
      console.log('❌ franchise');
      rejected.franchise++;
      continue;
    }

    if (!name || name.length <= 3 || name.includes('@') || name === company) {
      console.log('❌ no decision maker name');
      rejected.noName++;
      continue;
    }

    const siteData = await checkWebsite(page, website);
    if (!siteData.accessible) {
      console.log('❌ site not accessible');
      rejected.noSite++;
      continue;
    }

    if (siteData.hasChatbot) {
      console.log(`❌ has chatbot (${siteData.chatbotName})`);
      rejected.chatbot++;
      continue;
    }

    const { score, reasons } = scoreLead(lead, siteData);
    if (score < 8) {
      console.log(`⚠️ score ${score}/10`);
      rejected.lowScore++;
      continue;
    }

    const qualifiedLead = {
      businessName: company,
      website: siteData.resolvedUrl || website,
      city: lead.City || '',
      state: lead.State || '',
      niche: lead.Industry || inferNiche(company),
      decisionMaker: siteData.ownerNameFromSite || name,
      title: lead.Title || '',
      directPhone: lead.Phone || '',
      businessPhone: siteData.phoneFromSite || lead.Phone || '',
      email: lead.Email && !lead.Email.includes('not_unlocked') ? lead.Email : '',
      linkedin: lead.LinkedIn || '',
      hasChatbot: 'No',
      marketingSignals: siteData.marketingSignals.join('; '),
      missedLeadOpportunity: siteData.missedLeadOpportunity,
      fitScore: score,
      whyItFits: reasons.join('; '),
    };

    qualified.push(qualifiedLead);
    console.log(`✅ ${score}/10 — ${qualifiedLead.decisionMaker} | ${siteData.marketingSignals.length} signals`);
  }

  await browser.close();
  qualified.sort((a, b) => b.fitScore - a.fitScore || a.businessName.localeCompare(b.businessName));

  fs.writeFileSync(OUTPUT, JSON.stringify(qualified, null, 2));
  const csvHeaders = 'Business Name,Niche,City,State,Website,Decision Maker,Title,Direct Phone,Business Phone,Email,LinkedIn,Chatbot?,Marketing Signals,Missed-Lead Opportunity,Fit Score,Why It Fits';
  const csvRows = qualified.map(l => [
    l.businessName, l.niche, l.city, l.state, l.website,
    l.decisionMaker, l.title, l.directPhone, l.businessPhone,
    l.email, l.linkedin, l.hasChatbot, l.marketingSignals,
    l.missedLeadOpportunity, l.fitScore, l.whyItFits,
  ].map(csvEscape).join(','));
  fs.writeFileSync(OUTPUT_CSV, csvHeaders + '\n' + csvRows.join('\n') + '\n');

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 RESULTS');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total checked:       ${checked}`);
  console.log(`Rejected chatbot:    ${rejected.chatbot}`);
  console.log(`Rejected franchise:  ${rejected.franchise}`);
  console.log(`Rejected no name:    ${rejected.noName}`);
  console.log(`Rejected no site:    ${rejected.noSite}`);
  console.log(`Rejected low score:  ${rejected.lowScore}`);
  console.log(`✅ QUALIFIED:         ${qualified.length}`);
  console.log(`\n📁 ${OUTPUT_CSV}`);
  console.log(`📁 ${OUTPUT}\n`);
}

main().catch(err => {
  console.error(`\n❌ Fatal: ${err.message}`);
  process.exit(1);
});
