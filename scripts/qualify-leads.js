#!/usr/bin/env node
// Fetch-first lead qualification for Apollo/public candidate CSVs.
// Keeps strong companies even when Apollo contact names are noisy.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INPUT = process.env.APOLLO_INPUT || path.join(ROOT, 'leads', 'apollo-leads.csv');
const OUTPUT = path.join(ROOT, 'leads', 'qualified-leads.json');
const OUTPUT_CSV = path.join(ROOT, 'leads', 'qualified-leads.csv');

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
  'podium.com', 'birdeye.com', 'webchat.so', 'liveperson.com', 'comm100.com',
  'helpcrunch.com', 'customerly.io', 'chatra.com', 'kommunicate.io', 'gorgias.com',
  'smith.ai', 'chatfuel.com', 'latchly', 'latchlyai',
  'leadconnector', 'gohighlevel', 'msgsndr.com', 'purechat.com', 'jivochat.com',
  'socialintents.com', 'formilla.com', 'clickdesk.com', 'acquire.io', 'respond.io',
];

const MARKETING_SIGNALS = {
  googleAds: [/gads|google.*ads|adwords|gclid|google_ads/i, /googletagmanager/i, /gtag.*conversion/i],
  localServiceAds: [/google.*local.*service|google.*guarantee|local service ads/i],
  seo: [/service.*area|serving|we.*serve|locations.*served|areas we serve/i],
  reviews: [/reviews?|testimonials?|rating|stars?|customer.*feedback/i],
  quoteCTA: [/free.*quote|free.*estimate|get.*quote|request.*quote|book.*now|schedule.*now|call.*now|get.*started|consultation/i],
  phoneProminent: [/tel:/i],
  formPresent: [/<form\b/i],
  coupons: [/coupon|special offer|financing|save \$|discount/i],
  scheduling: [/service titan|servicetitan|online scheduling|book online|schedule service|request service/i],
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

function get(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function normalizeWebsite(url) {
  let s = String(url || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s.replace(/\/$/, '');
}

function candidateUrls(url) {
  const normalized = normalizeWebsite(url);
  if (!normalized) return [];
  const out = [];
  const push = (v) => { if (v && !out.includes(v)) out.push(v); };
  push(normalized);
  if (/^https:\/\//i.test(normalized)) push(normalized.replace(/^https:/i, 'http:'));
  if (/^http:\/\//i.test(normalized)) push(normalized.replace(/^http:/i, 'https:'));
  const noProto = normalized.replace(/^https?:\/\//i, '');
  if (!/^www\./i.test(noProto)) {
    push(`https://www.${noProto}`);
    push(`http://www.${noProto}`);
  }
  return out;
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return '';
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function absoluteUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return '';
  }
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeBadName(name) {
  const s = String(name || '').trim();
  if (!s) return true;
  if (s.length < 4) return true;
  if (/[@\d]/.test(s)) return true;
  if (/^[A-Z]\s?[A-Z]?$/.test(s)) return true;
  if (/^(admin|owner|contact|team|office|front desk|reception)$/i.test(s)) return true;
  if (/^(from the|is on|can do|of this|should invest|and owner|local business)$/i.test(s)) return true;
  const words = s.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 5) return true;
  const badWords = ['the','and','for','with','from','this','that','your','local','business','owner'];
  const lowered = words.map(w => w.toLowerCase());
  if (lowered.every(w => badWords.includes(w))) return true;
  return false;
}

function normalizeTitle(title) {
  return String(title || '').trim();
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

function normalizeInputLead(row) {
  const businessName = get(row, ['Business Name', 'Company', 'company', 'businessName']);
  const website = normalizeWebsite(get(row, ['Website', 'website', 'Company Website']));
  const decisionMaker = get(row, ['Decision Maker', 'decisionMaker', 'Name', 'person_name']);
  const title = normalizeTitle(get(row, ['Title', 'title']));
  const directPhone = normalizePhone(get(row, ['Direct Phone', 'Phone', 'directPhone']));
  const businessPhone = normalizePhone(get(row, ['Business Phone', 'Main Business Phone', 'businessPhone', 'main_business_phone', 'Phone']));
  const niche = get(row, ['Niche', 'niche', 'Industry']) || inferNiche(businessName);
  const city = get(row, ['City', 'city']);
  const state = get(row, ['State', 'state']);
  const email = get(row, ['Email', 'email']).includes('not_unlocked') ? '' : get(row, ['Email', 'email']);
  const linkedin = get(row, ['LinkedIn', 'linkedin']);
  const employees = parseInt(get(row, ['Employees', 'employees']) || '0', 10) || 0;
  const chatFlag = get(row, ['Chatbot?', 'Chatbot Present', 'chatbot', 'Site has chatbot/live chat']);
  const source = get(row, ['Source', 'source']) || path.basename(INPUT);
  return { businessName, website, decisionMaker, title, directPhone, businessPhone, niche, city, state, email, linkedin, employees, chatFlag, source };
}

async function fetchText(url, timeoutMs = 20000, redirectCount = 0) {
  if (redirectCount > 5) throw new Error('Too many redirects');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
      },
    });

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) throw new Error(`Redirect ${res.status} without location`);
      return fetchText(absoluteUrl(url, location), timeoutMs, redirectCount + 1);
    }

    const text = await res.text();
    return {
      ok: res.ok || [401,403,405,406,409,429].includes(res.status),
      status: res.status,
      url: res.url || url,
      text,
      headers: Object.fromEntries(res.headers.entries()),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSite(url, timeoutMs = 20000) {
  let lastError = '';
  for (const candidate of candidateUrls(url)) {
    try {
      const result = await fetchText(candidate, timeoutMs);
      if (result.ok && String(result.text || '').length > 200) return result;
      lastError = `HTTP ${result.status}`;
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
    }
  }
  return { ok: false, url: normalizeWebsite(url), text: '', status: 0, error: lastError };
}

function extractLinks(html, baseUrl) {
  const links = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    const href = absoluteUrl(baseUrl, match[1]);
    const text = stripTags(match[2]);
    if (href) links.push({ href, text });
  }
  return links;
}

function detectChatbot(html) {
  const lower = String(html || '').toLowerCase();
  for (const sig of CHATBOT_SIGNATURES) {
    if (lower.includes(sig.toLowerCase())) return sig;
  }
  const generic = [
    /class=["'][^"']*(chat-widget|chat-bubble|live-chat|chatbot|chat-container|chat-btn|chat-button|chat-icon|chat-launcher|chat-popup|chat-window|chat-box|chatwidget)[^"']*["']/i,
    /id=["'][^"']*(chat-widget|chatbubble|livechat|chatbot|chat-container|chat-btn|chat-launcher|chat-popup|chat-window|webchat)[^"']*["']/i,
    /aria-label=["'][^"']*(chat|message us|live chat|chat with us|chat now)[^"']*["']/i,
    /data-chat|data-widget-id.*chat/i,
    /<iframe[^>]*(chat|messenger|webchat)/i,
    /window\.(LiveChat|Tawk_API|drift|Intercom|HubSpotConversations|smartsupp|fcWidget|chaport|__lc)/i,
  ];
  for (const re of generic) {
    if (re.test(html)) return re.source;
  }
  return '';
}

function analyzeMarketing(html, links) {
  const text = String(html || '');
  const marketingSignals = [];
  const push = (label) => { if (!marketingSignals.includes(label)) marketingSignals.push(label); };

  if (MARKETING_SIGNALS.googleAds.some(p => p.test(text))) push('Google Ads/GTM detected');
  if (MARKETING_SIGNALS.localServiceAds.some(p => p.test(text))) push('Local Service Ads');
  if (MARKETING_SIGNALS.seo.some(p => p.test(text))) push('Service area / SEO pages');
  if (MARKETING_SIGNALS.reviews.some(p => p.test(text))) push('Reviews/testimonials on site');
  if (MARKETING_SIGNALS.quoteCTA.some(p => p.test(text))) push('Quote/estimate CTA');
  if (MARKETING_SIGNALS.phoneProminent.some(p => p.test(text))) push('Prominent phone number');
  if (MARKETING_SIGNALS.formPresent.some(p => p.test(text))) push('Contact form present');
  if (MARKETING_SIGNALS.coupons.some(p => p.test(text))) push('Coupons/financing offers');
  if (MARKETING_SIGNALS.scheduling.some(p => p.test(text))) push('Scheduling / booking flow');

  const navishLinks = links.filter(l => l.href && new URL(l.href).hostname === new URL(links[0]?.href || 'https://example.com').hostname);
  if (navishLinks.length >= 8) push(`${navishLinks.length} internal links (active multi-page site)`);

  return {
    marketingSignals,
    hasQuoteCTA: marketingSignals.includes('Quote/estimate CTA') || marketingSignals.includes('Scheduling / booking flow'),
    hasPhoneProminent: marketingSignals.includes('Prominent phone number'),
    hasForm: marketingSignals.includes('Contact form present'),
    hasReviews: marketingSignals.includes('Reviews/testimonials on site'),
    hasGoogleAds: marketingSignals.includes('Google Ads/GTM detected'),
    hasSEOPages: marketingSignals.includes('Service area / SEO pages'),
  };
}

function extractPhone(html) {
  const telMatch = String(html || '').match(/href=["']tel:([^"']+)["']/i);
  if (telMatch) return normalizePhone(telMatch[1]);
  const textMatch = String(html || '').match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/);
  return normalizePhone(textMatch ? textMatch[0] : '');
}

function extractSiteDecisionMaker(html, links, homepageUrl) {
  const plain = stripTags(html);
  const ownerPatterns = [
    /(?:owner|founder|president|ceo|co-owner|managing partner)\W{0,30}([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3})/g,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3})\W{0,30}(?:owner|founder|president|ceo|co-owner|managing partner)/g,
  ];
  for (const pattern of ownerPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(plain);
    if (match && !looksLikeBadName(match[1])) return match[1].trim();
  }

  const aboutLinks = links
    .filter(link => /about|team|staff|our team|company/i.test(`${link.text} ${link.href}`))
    .map(link => link.href)
    .filter((href, index, arr) => href && arr.indexOf(href) === index)
    .slice(0, 2);

  return { candidatePages: aboutLinks, homepageUrl };
}

async function checkWebsite(url) {
  const result = {
    accessible: false,
    resolvedUrl: normalizeWebsite(url),
    hasChatbot: false,
    chatbotName: '',
    marketingSignals: [],
    hasQuoteCTA: false,
    hasPhoneProminent: false,
    hasForm: false,
    hasReviews: false,
    hasGoogleAds: false,
    hasSEOPages: false,
    ownerNameFromSite: '',
    phoneFromSite: '',
    missedLeadOpportunity: '',
    accessStatus: 'unreachable',
    accessError: '',
  };

  const fetchResult = await fetchSite(url);
  if (!fetchResult.ok) {
    result.accessError = fetchResult.error || '';
    return result;
  }

  result.accessible = true;
  result.resolvedUrl = fetchResult.url || normalizeWebsite(url);
  result.accessStatus = fetchResult.status ? `http_${fetchResult.status}` : 'ok';

  const html = fetchResult.text || '';
  if (html.length < 200) {
    result.accessible = false;
    result.accessStatus = 'thin_page';
    return result;
  }

  const chatbot = detectChatbot(html);
  if (chatbot) {
    result.hasChatbot = true;
    result.chatbotName = chatbot;
    return result;
  }

  const links = extractLinks(html, result.resolvedUrl);
  const marketing = analyzeMarketing(html, links);
  Object.assign(result, marketing);
  result.phoneFromSite = extractPhone(html);

  const ownerCandidate = extractSiteDecisionMaker(html, links, result.resolvedUrl);
  if (typeof ownerCandidate === 'string') {
    result.ownerNameFromSite = ownerCandidate;
  } else if (ownerCandidate && ownerCandidate.candidatePages) {
    for (const aboutUrl of ownerCandidate.candidatePages) {
      try {
        const about = await fetchText(aboutUrl, 15000);
        const text = stripTags(about.text || '');
        const patterns = [
          /(?:owner|founder|president|ceo|co-owner|managing partner)\W{0,30}([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3})/g,
          /([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3})\W{0,30}(?:owner|founder|president|ceo|co-owner|managing partner)/g,
        ];
        for (const pattern of patterns) {
          pattern.lastIndex = 0;
          const match = pattern.exec(text);
          if (match && !looksLikeBadName(match[1])) {
            result.ownerNameFromSite = match[1].trim();
            break;
          }
        }
        if (result.ownerNameFromSite) break;
      } catch {}
    }
  }

  const opportunities = [];
  if (!result.hasForm && !result.hasQuoteCTA) opportunities.push('No lead capture form or CTA');
  else if (result.hasForm && !result.hasQuoteCTA) opportunities.push('Form exists but no strong CTA to drive action');
  if (!result.hasPhoneProminent) opportunities.push('Phone not prominently displayed');
  if (result.hasGoogleAds) opportunities.push('Paying for traffic but weak conversion path');
  opportunities.push('No instant engagement — visitors must wait for callback');
  opportunities.push('No after-hours lead capture');
  result.missedLeadOpportunity = opportunities.slice(0, 3).join('; ');

  return result;
}

function chooseDecisionMaker(lead, siteData) {
  if (!looksLikeBadName(siteData.ownerNameFromSite)) return siteData.ownerNameFromSite;
  if (!looksLikeBadName(lead.decisionMaker)) return lead.decisionMaker;
  return '';
}

function scoreLead(lead, siteData, decisionMaker) {
  let score = 0;
  const reasons = [];
  score++; reasons.push('Good niche');
  if (siteData.accessible) { score++; reasons.push('Active website'); }
  if (decisionMaker) { score++; reasons.push('Decision maker identified or recovered'); }
  else if (/owner|founder|president|ceo|operator|partner/i.test(lead.title || '')) { score++; reasons.push('Owner-level title present'); }
  const hasPhone = lead.businessPhone || lead.directPhone || siteData.phoneFromSite;
  if (hasPhone) { score++; reasons.push('Phone number available'); }
  if (!siteData.hasChatbot) { score++; reasons.push('No chatbot/AI chat'); }
  if (siteData.marketingSignals.length >= 2) { score++; reasons.push(`${siteData.marketingSignals.length} marketing signals`); }
  const highTicket = /hvac|plumb|roof|foundation|water damage|restoration|electri|remodel|solar|garage door|tree|pest/i;
  if (highTicket.test(lead.businessName) || highTicket.test(lead.niche)) { score++; reasons.push('High-ticket service'); }
  const franchise = /one hour|mr\. rooter|roto-rooter|service experts|ars rescue|comfort systems|lennox|carrier|trane|home depot|lowe/i;
  if (!franchise.test(lead.businessName)) { score++; reasons.push('Independent operator'); }
  if (siteData.missedLeadOpportunity && siteData.missedLeadOpportunity.length > 10) { score++; reasons.push('Clear missed-lead opportunity'); }
  if (lead.employees === 0 || (lead.employees >= 5 && lead.employees <= 75)) { score++; reasons.push('Right company size'); }

  // ── Bonus signals ──────────────────────────────────────────────────────────
  // Bonus 1: Owner directly reachable — name identified AND owner-level title
  if (decisionMaker && /owner|founder|president|proprietor|principal/i.test(lead.title || '')) {
    score++; reasons.push('Owner directly reachable');
  }
  // Bonus 2: Revenue capacity — established business with active marketing investment
  if (siteData.hasReviews && siteData.marketingSignals.length >= 3) {
    score++; reasons.push('Established business with strong marketing signals');
  }
  // Bonus 3: Max conversion gap — running ads but missing lead capture infrastructure
  if (siteData.hasGoogleAds && (!siteData.hasForm || !siteData.hasPhoneProminent)) {
    score++; reasons.push('High-ROI gap: running ads without lead capture');
  }

  score = Math.min(10, score); // cap at 10
  return { score, reasons };
}

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Missing input: ${INPUT}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT, 'utf-8');
  const rows = parseCSV(raw).map(normalizeInputLead);
  console.log(`\n📊 Loaded ${rows.length} raw leads from ${path.relative(ROOT, INPUT)}\n`);

  const withWebsite = rows.filter(l => l.website);
  console.log(`🌐 ${withWebsite.length} have websites\n`);

  const seen = new Set();
  const unique = [];
  for (const lead of withWebsite) {
    const domain = lead.website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
    if (!domain) continue;
    if (seen.has(domain)) continue;
    seen.add(domain);
    unique.push(lead);
  }
  console.log(`🔄 ${unique.length} unique companies after dedupe\n`);

  const qualified = [];
  const rejected = { chatbot: 0, lowScore: 0, noSite: 0, franchise: 0 };
  let checked = 0;

  for (const lead of unique) {
    checked++;
    process.stdout.write(`[${checked}/${unique.length}] ${lead.businessName}... `);

    if (/one hour|mr\. rooter|roto-rooter|service experts|ars rescue|home depot|lowe's/i.test(lead.businessName || '')) {
      console.log('❌ franchise');
      rejected.franchise++;
      continue;
    }

    if (lead.chatFlag && !/^no$/i.test(lead.chatFlag) && !/^no obvious chatbot/i.test(lead.chatFlag)) {
      console.log(`❌ source says chatbot (${lead.chatFlag})`);
      rejected.chatbot++;
      continue;
    }

    const siteData = await checkWebsite(lead.website);
    if (!siteData.accessible) {
      console.log(`❌ site not accessible${siteData.accessError ? ` (${siteData.accessError})` : ''}`);
      rejected.noSite++;
      continue;
    }

    if (siteData.hasChatbot) {
      console.log(`❌ has chatbot (${siteData.chatbotName})`);
      rejected.chatbot++;
      continue;
    }

    const decisionMaker = chooseDecisionMaker(lead, siteData);
    const { score, reasons } = scoreLead(lead, siteData, decisionMaker);
    if (score < 8) {
      console.log(`⚠️ score ${score}/10`);
      rejected.lowScore++;
      continue;
    }

    const qualifiedLead = {
      businessName: lead.businessName,
      website: siteData.resolvedUrl || lead.website,
      city: lead.city,
      state: lead.state,
      niche: lead.niche,
      decisionMaker,
      title: lead.title,
      directPhone: lead.directPhone,
      businessPhone: siteData.phoneFromSite || lead.businessPhone || lead.directPhone,
      email: lead.email,
      linkedin: lead.linkedin,
      hasChatbot: 'No',
      marketingSignals: siteData.marketingSignals.join('; '),
      missedLeadOpportunity: siteData.missedLeadOpportunity,
      fitScore: score,
      whyItFits: reasons.join('; '),
      source: lead.source,
    };

    qualified.push(qualifiedLead);
    console.log(`✅ ${score}/10 — ${decisionMaker || lead.title || 'company-level fit'} | ${siteData.marketingSignals.length} signals`);
  }

  qualified.sort((a, b) => b.fitScore - a.fitScore || a.businessName.localeCompare(b.businessName));

  fs.writeFileSync(OUTPUT, JSON.stringify(qualified, null, 2));
  const csvHeaders = 'Business Name,Niche,City,State,Website,Decision Maker,Title,Direct Phone,Business Phone,Email,LinkedIn,Chatbot?,Marketing Signals,Missed-Lead Opportunity,Fit Score,Why It Fits,Source';
  const csvRows = qualified.map(l => [
    l.businessName, l.niche, l.city, l.state, l.website,
    l.decisionMaker, l.title, l.directPhone, l.businessPhone,
    l.email, l.linkedin, l.hasChatbot, l.marketingSignals,
    l.missedLeadOpportunity, l.fitScore, l.whyItFits, l.source,
  ].map(csvEscape).join(','));
  fs.writeFileSync(OUTPUT_CSV, csvHeaders + '\n' + csvRows.join('\n') + '\n');

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 RESULTS');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total checked:       ${checked}`);
  console.log(`Rejected chatbot:    ${rejected.chatbot}`);
  console.log(`Rejected franchise:  ${rejected.franchise}`);
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
