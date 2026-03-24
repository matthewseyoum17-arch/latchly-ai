#!/usr/bin/env node
/**
 * leadclaw-qualify.js
 * Qualifies raw BBB leads into ONE bucket: businesses with a bad website.
 * Bad = any combination of: outdated, ugly design, weak mobile, no clear CTA,
 * poor trust signals, old branding, broken layout, generic stock look, bad quote flow.
 *
 * Target: 100 qualified bad-website leads per run.
 */

const fs   = require('fs');
const path = require('path');

const ROOT      = path.join(__dirname, '..');
const LEADS_DIR = path.join(ROOT, 'leads', 'leadclaw');
const INPUT      = process.env.LEADCLAW_INPUT  || path.join(LEADS_DIR, 'raw.csv');
const OUTPUT_CSV = path.join(LEADS_DIR, 'qualified.csv');
const OUTPUT_MD  = path.join(LEADS_DIR, 'daily-leads.md');
const MASTER_CSV = process.env.LEADCLAW_MASTER || path.join(LEADS_DIR, 'master.csv');
const TARGET          = parseInt(process.env.LEAD_TARGET    || '90', 10);
const MIN_ISSUES      = parseInt(process.env.MIN_ISSUES      || '4',  10); // 4+ issues floors score at 9/10
const MIN_AFFORDABILITY = parseInt(process.env.MIN_AFFORD   || '2',  10); // must show real budget

// ── CSV helpers ──────────────────────────────────────────────────────────────

function splitCSV(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i+1] === '"') { cur += '"'; i++; } else { q = !q; } continue; }
    if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur); return out;
}

function parseCSV(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCSV(lines[0]);
  return lines.slice(1).map(line => {
    const vals = splitCSV(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  });
}

function csvEscape(v) {
  const s = String(v || '').replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function absoluteUrl(base, href) {
  try { return new URL(href, base).toString(); } catch { return ''; }
}

// ── Fetch ────────────────────────────────────────────────────────────────────

async function fetchText(url, timeoutMs = 20000, hops = 0) {
  if (hops > 5) throw new Error('Too many redirects');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET', redirect: 'manual', signal: ctrl.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
    });
    if ([301,302,303,307,308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error('Redirect without location');
      return fetchText(absoluteUrl(url, loc), timeoutMs, hops + 1);
    }
    const text = await res.text();
    return { ok: res.ok || [401,403,405,429].includes(res.status), status: res.status, text, url: res.url || url };
  } finally { clearTimeout(timer); }
}

async function fetchSite(rawUrl) {
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  const variants = [url];
  const noProto = url.replace(/^https?:\/\//i, '');
  if (!/^www\./i.test(noProto)) variants.push(`https://www.${noProto}`);
  if (/^https:/i.test(url)) variants.push(url.replace(/^https:/i, 'http:'));
  for (const v of variants) {
    try {
      const r = await fetchText(v);
      if (r.ok && String(r.text || '').length > 300) return r;
    } catch {}
  }
  return null;
}

// ── Bad-site analysis ────────────────────────────────────────────────────────

const BUILDERS = [
  { re: /wix\.com|wixsite\.com|_wix_browser_sess|X-Wix-/i,         name: 'Wix' },
  { re: /squarespace\.com|squarespace-cdn|static\.squarespace/i,    name: 'Squarespace' },
  { re: /godaddy\.com|secureserver\.net|websites\.godaddy/i,        name: 'GoDaddy Website Builder' },
  { re: /weebly\.com|weebly-link|weeblycloud/i,                     name: 'Weebly' },
  { re: /jimdo\.com|jimdosite\.com/i,                               name: 'Jimdo' },
  { re: /sites\.google\.com/i,                                      name: 'Google Sites' },
  { re: /yola\.com|yolasite\.com/i,                                 name: 'Yola' },
  { re: /doodlekit\.com/i,                                          name: 'DoodleKit' },
  { re: /homestead\.com/i,                                          name: 'Homestead (ancient builder)' },
  { re: /angelfire\.com|tripod\.com|geocities/i,                    name: 'Legacy host (Angelfire/Tripod)' },
];

/**
 * Audit a site's HTML for all 8 bad-site criteria.
 * Returns { issues: string[], issueCount: number, score: number, pitchAngle: string }
 */
// Chatbot / live-chat signatures that indicate the site already has a chat tool
const CHATBOT_SIGNATURES = [
  'intercom', 'drift.com', 'crisp.chat', 'tidio', 'tawk.to', 'freshchat',
  'zendesk', 'hubspot', 'liveagent', 'olark', 'purechat', 'livechat',
  'smartsupp', 'chatra', 'jivochat', 'gorgias', 're.chat', 'helpscout',
  'latchly', 'latchlyai', 'lw-fab', 'lw-panel',  // our own widget
];

// Signals that the site is already professional/modern — not worth redesigning
const GOOD_SITE_SIGNALS = [
  /google-tag-manager|gtm\.js/i,            // Active marketing/analytics
  /netlify|vercel\.app|webflow\.io/i,        // Modern hosting
  /react|vue|angular|next\.js|nuxt/i,       // Modern JS framework
  /graphql|apollo-client/i,                  // Modern API patterns
];

function hasChatbot(html) {
  const lower = html.toLowerCase();
  return CHATBOT_SIGNATURES.some(sig => lower.includes(sig));
}

function siteIsTooGood(html, issueCount) {
  // Fewer than 3 issues = site is fine, skip
  if (issueCount < 3) return true;
  // Has multiple good-site signals = modern professional site
  const matches = GOOD_SITE_SIGNALS.filter(re => re.test(html)).length;
  return matches >= 2;
}

function auditSite(html, resolvedUrl) {
  const issues = [];
  const h = String(html || '');
  const lower = h.toLowerCase();

  // ── 1. Outdated site ─────────────────────────────────────────────────────
  const yearMatch = h.match(/©\s*(\d{4})|copyright\s*(\d{4})/i);
  if (yearMatch) {
    const yr = parseInt(yearMatch[1] || yearMatch[2], 10);
    if (yr <= 2019)      issues.push(`Copyright stuck on ${yr} — site hasn't been touched in years`);
    else if (yr <= 2021) issues.push(`Copyright ${yr} — noticeably out of date`);
  }
  if (/jquery[\/-]1\./i.test(h))                         issues.push('Running jQuery 1.x (from 2014 era)');
  if (/<!--\s*\[if\s+(lt\s+)?IE/i.test(h))               issues.push('IE conditional comments — built for Internet Explorer');
  if (/\.swf["'\s]|<embed[^>]*flash|<object[^>]*flash/i.test(h)) issues.push('Uses Flash (dead since 2020)');
  if (/generator.*wordpress/i.test(h) && /2015|2016|2017|2018/i.test(h)) issues.push('Outdated WordPress (old generator tag)');

  // ── 2. Ugly / generic stock design ───────────────────────────────────────
  let builderDetected = '';
  for (const b of BUILDERS) {
    if (b.re.test(h)) { builderDetected = b.name; break; }
  }
  if (builderDetected) issues.push(`Built on ${builderDetected} — looks like every other template site`);

  const tableCount = (h.match(/<table\b/gi) || []).length;
  if (tableCount >= 4 && !/<table[^>]*role=["']presentation/i.test(h)) {
    issues.push('Table-based layout — screams early 2000s design');
  }

  // No custom fonts = default system / generic look
  if (!/fonts\.googleapis|typekit|fonts\.adobe|fontawesome|font-face/i.test(h)) {
    issues.push('No custom typography — looks generic and unprofessional');
  }

  // ── 3. Weak mobile experience ─────────────────────────────────────────────
  if (!/<meta[^>]*name=["']viewport/i.test(h)) {
    issues.push('No viewport meta tag — site is NOT mobile-responsive');
  }
  if (!/@media\s*\(/i.test(h) && !lower.includes('bootstrap') && !lower.includes('tailwind')) {
    issues.push('No responsive CSS detected — breaks on phones/tablets');
  }

  // ── 4. No clear CTA ───────────────────────────────────────────────────────
  if (!/free.*quote|get.*quote|request.*quote|free.*estimate|get.*estimate|book.*now|schedule.*now|call.*now|get.*started|contact.*us/i.test(h)) {
    issues.push('No clear call-to-action — visitors have no obvious next step');
  }

  // ── 5. Poor trust signals ─────────────────────────────────────────────────
  const hasReviews = /reviews?|testimonials?|rating|stars?|google.*review|what.*clients.*say/i.test(h);
  const hasLicense = /licensed|insured|bonded|certif|background.?check/i.test(h);
  const hasYears   = /\d+\s*years?\s*(of\s*)?(experience|in\s*business|serving)/i.test(h);
  if (!hasReviews) issues.push('No reviews or testimonials — zero social proof');
  if (!hasLicense) issues.push('No license/insurance mention — customers can\'t verify credibility');
  if (!hasReviews && !hasLicense && !hasYears) issues.push('Virtually no trust signals on the page');

  // ── 6. Old branding ───────────────────────────────────────────────────────
  // Check for generic/old logo formats or no logo at all
  if (!/<img[^>]*(logo|brand|header)/i.test(h) && !lower.includes('logo')) {
    issues.push('No visible logo — branding is absent or hidden');
  }
  // All-caps or non-semantic heading abuse = old-school style
  if ((h.match(/<font\b/gi) || []).length > 2) {
    issues.push('Uses <font> tags — HTML from the 90s/early 2000s');
  }

  // ── 7. Broken / poor layout ───────────────────────────────────────────────
  if (h.length < 5000) {
    issues.push('Almost no content — site is basically empty');
  } else if (h.length < 12000) {
    issues.push('Very thin page — looks like a placeholder or half-built site');
  }
  // Unclosed basic tags = broken
  const openDivs  = (h.match(/<div\b/gi)  || []).length;
  const closeDivs = (h.match(/<\/div>/gi) || []).length;
  if (Math.abs(openDivs - closeDivs) > 10 && openDivs > 5) {
    issues.push('Broken HTML structure — mismatched tags causing layout issues');
  }

  // ── 8. Bad quote / contact flow ───────────────────────────────────────────
  if (!/<form\b/i.test(h)) {
    issues.push('No contact or quote form — visitors can\'t reach them easily');
  }
  if (!/href=["']tel:/i.test(h)) {
    issues.push('Phone number isn\'t clickable — mobile users can\'t tap to call');
  }
  if (!/href=["']mailto:/i.test(h) && !/<form\b/i.test(h)) {
    issues.push('No email link and no form — dead end for interested customers');
  }

  // ── Score: 4 issues = 9/10 floor, 5+ issues = 10/10
  // Affordability adds a half-point bump to push borderline leads to 10.
  const issueCount = issues.length;
  let score = Math.min(5 + issueCount, 10);

  // Build a pitch angle from top issues
  const pitchAngle = buildPitchAngle(issues, builderDetected, resolvedUrl);

  const chatbotDetected = hasChatbot(h);
  const tooGood = siteIsTooGood(h, issueCount);

  return { issues, issueCount, score, pitchAngle, builderDetected, chatbotDetected, tooGood };
}

/** Map a raw niche string to a broad category used for opener framing. */
function detectNicheCategory(lead) {
  const n = (lead.Niche || lead['Business Name'] || '').toLowerCase();
  if (/plumb/i.test(n))                                    return 'plumbing';
  if (/roof/i.test(n))                                     return 'roofing';
  if (/hvac|heating|cooling|air.?cond|furnace/i.test(n))   return 'hvac';
  if (/landscap|lawn|garden|turf|sprinkler/i.test(n))      return 'landscaping';
  if (/electri/i.test(n))                                  return 'electrical';
  if (/remodel|renovation|general.*contract|construction/i.test(n)) return 'remodeling';
  if (/water damage|restoration|mold|flood/i.test(n))      return 'restoration';
  if (/pool|spa/i.test(n))                                 return 'pool';
  if (/pest/i.test(n))                                     return 'pest';
  if (/tree|arborist/i.test(n))                            return 'tree';
  if (/garage door/i.test(n))                              return 'garage';
  if (/foundation/i.test(n))                               return 'foundation';
  if (/solar/i.test(n))                                    return 'solar';
  if (/paint/i.test(n))                                    return 'painting';
  if (/floor/i.test(n))                                    return 'flooring';
  if (/fence/i.test(n))                                    return 'fencing';
  if (/concrete|driveway|paving/i.test(n))                 return 'concrete';
  return 'general';
}

/**
 * Niche-specific framing: for each issue type, how does it cost this
 * exact type of business calls, trust, or bookings?
 * Returns a complete 1-sentence opener (≤24 words).
 */
const OPENER_MATRIX = {
  flash: {
    plumbing:    "Your site still runs Flash — when someone's pipe bursts at midnight, a broken site means they call the next plumber.",
    roofing:     "Your site still uses Flash, which died in 2020 — homeowners comparing roofers will skip a broken site instantly.",
    hvac:        "Flash stopped working everywhere in 2020 — an HVAC customer with no heat won't wait for a broken site to load.",
    landscaping: "Your site still runs Flash, and customers browsing landscapers on their phone will just bounce to a competitor.",
    electrical:  "Your site uses Flash, which hasn't worked since 2020 — a broken site kills trust before an electrician even answers.",
    remodeling:  "Flash died in 2020 and your site still uses it — remodeling customers researching on mobile won't stick around.",
    restoration: "Your site still runs Flash — water damage customers calling in a panic can't afford to land on a broken site.",
    general:     "Your site still uses Flash, which stopped working on every browser in 2020 — that's costing you first impressions.",
  },
  ie: {
    plumbing:    "Your site was coded for Internet Explorer — plumbing customers calling from a smartphone see a broken layout and hang up.",
    roofing:     "Your site still has IE code baked in — it breaks on modern browsers right when homeowners are comparing roofing quotes.",
    hvac:        "Your site was built for Internet Explorer, which means it breaks on every modern browser HVAC customers actually use.",
    landscaping: "IE conditional code means your site breaks on modern phones, and most landscaping customers find you on mobile first.",
    general:     "Your site still has Internet Explorer code — it breaks on modern browsers and makes you look out of business.",
  },
  jquery1: {
    plumbing:    "Your site runs jQuery 1.x from 2014, slowing load times — slow sites lose plumbing calls to faster competitors.",
    roofing:     "jQuery 1.x from 2014 is still loading on your site, slowing it down right when homeowners are shopping around for roofers.",
    hvac:        "Your site loads an outdated 2014 script that slows it down — slow HVAC sites lose emergency calls to faster competitors.",
    general:     "Your site runs a JavaScript library from 2014 — it slows load time and loses you ranking against competitors who updated.",
  },
  legacyHost: {
    plumbing:    "Your site is on a legacy host from the early 2000s — plumbing customers on mobile see a broken experience and call someone else.",
    roofing:     "Your site is hosted on an ancient platform — roofing customers researching online will question if you're still even in business.",
    general:     "Your site is on a platform from the early 2000s — it hurts your credibility and your ranking before customers even read a word.",
  },
  tableLayout: {
    plumbing:    "Your site uses a table-based layout from 2002 — it breaks on every phone, and plumbing customers are calling from mobile.",
    roofing:     "Your site has a table-based layout that looks like it's from 2002 — homeowners comparing roofing estimates won't trust it.",
    general:     "Your site uses a table-based layout from the early 2000s — it falls apart on mobile and looks immediately out of date.",
  },
  staleYear: {
    plumbing:    (yr) => `Your copyright still says ${yr} — plumbing customers check fast, and a stale site makes them wonder if you're still open.`,
    roofing:     (yr) => `Copyright ${yr} on your site signals neglect — roofing is a big purchase and homeowners need to trust you're active.`,
    hvac:        (yr) => `Your site hasn't been touched since ${yr} — HVAC customers comparing options online will pick the one that looks current.`,
    landscaping: (yr) => `Copyright ${yr} on your site tells customers it hasn't been updated — landscaping clients want to see fresh work and current pricing.`,
    electrical:  (yr) => `Your site still says copyright ${yr} — electrical customers looking for a licensed pro need to trust you're active and current.`,
    remodeling:  (yr) => `Copyright ${yr} shows your site hasn't been touched in years — remodeling clients research heavily before trusting someone with their home.`,
    restoration: (yr) => `Your copyright reads ${yr} and restoration customers Googling in a panic need to see a business that looks active right now.`,
    general:     (yr) => `Your copyright still says ${yr} — that signals neglect to customers comparing you to competitors with updated sites.`,
  },
  wix: {
    plumbing:    "Your Wix site loads slow on mobile — plumbing customers tap the first number that works fast and yours is in the way.",
    roofing:     "Your Wix site looks like a hundred other contractors — roofing customers comparing bids trust the one that looks established.",
    hvac:        "Wix sites rank poorly in local search — HVAC customers Googling 'AC repair near me' are finding your competitors first.",
    landscaping: "Your Wix site blends in with every other landscaper — customers choose based on visuals, and yours doesn't stand out.",
    electrical:  "Wix sites load slow and rank poorly — electrical customers searching locally are probably landing on a competitor before you.",
    remodeling:  "Your Wix site looks like a template — remodeling customers doing serious research want to see a custom brand, not a cookie-cutter page.",
    general:     "Your Wix site looks like every other contractor in the area — customers can't tell you apart, so they call whoever looks more established.",
  },
  godaddy: {
    plumbing:    "GoDaddy builder sites load slow on mobile — that's a real problem when plumbing customers want to tap and call immediately.",
    roofing:     "Your GoDaddy site ranks poorly in local search — roofing customers Googling for estimates are finding competitors before they reach you.",
    general:     "GoDaddy builder sites tend to load slow and rank poorly in local search — that's directly hurting how many customers find you.",
  },
  squarespace: {
    roofing:     "Your Squarespace site looks like dozens of other contractor sites — roofing customers comparing bids trust the one with a distinct, credible brand.",
    landscaping: "Squarespace templates all look the same — landscaping customers who care about visuals won't be wowed by a generic layout.",
    general:     "Your Squarespace site blends in with hundreds of other contractors — customers can't differentiate you, so they pick whoever looks most established.",
  },
  builderGeneric: {
    plumbing:    (b) => `Your site on ${b} loads slow — plumbing customers need to tap and call fast, and a laggy template is a lost job.`,
    roofing:     (b) => `Your ${b} site looks like every other roofing template — homeowners comparing estimates go with whoever looks more credible.`,
    general:     (b) => `Your ${b} site ranks poorly in local search — customers Googling your niche are landing on competitors with custom sites.`,
  },
  noMobileViewport: {
    plumbing:    "Your site layout breaks on mobile — plumbing customers calling from a phone can't read your number, so they call someone else.",
    roofing:     "I pulled up your site on my phone and it was broken — homeowners comparing roofing quotes on mobile won't stick around.",
    hvac:        "Your site doesn't display on phones — HVAC customers searching during an emergency are on mobile and will just call the next result.",
    landscaping: "Your site breaks on phones and most landscaping customers are browsing on mobile, so they're bouncing before they request a quote.",
    electrical:  "Your site doesn't work on mobile — electrical customers searching for a licensed pro on their phone will just call someone else.",
    remodeling:  "Your site is broken on mobile and remodeling customers do serious research on their phones before they trust anyone with a big job.",
    restoration:  "I pulled it up on mobile and it's broken — water damage customers in a panic need to tap and call immediately.",
    general:     "I pulled up your site on my phone and the layout was completely broken — that's where most customers are finding you.",
  },
  noResponsiveCSS: {
    plumbing:    "Your site doesn't resize on phones, and plumbing customers searching 'plumber near me' are almost always on mobile.",
    roofing:     "Your site doesn't adjust to phones, and that's where most homeowners first look up roofing contractors after a storm.",
    hvac:        "Your site breaks on phones — HVAC customers Google 'AC repair near me' on mobile and won't navigate a broken layout.",
    landscaping: "Your site doesn't resize on phones — landscaping customers browsing on mobile can't see your work or request a quote.",
    general:     "Your site doesn't work on phones, and that's where most customers searching for local contractors are finding you.",
  },
  noFormNoTap: {
    plumbing:    "There's no quote form and the phone isn't tappable — a plumbing customer on mobile hits a dead end and calls someone who made it easy.",
    roofing:     "No quote form and a non-clickable number means homeowners on mobile can't reach you — that's a lost estimate every time.",
    hvac:        "No form and a phone you can't tap means HVAC customers in an emergency bail immediately and call whoever's easier to reach.",
    landscaping: "No quote form and an unclickable phone number means interested customers have no way to convert — they just leave.",
    general:     "There's no quote form and the phone isn't tappable — mobile visitors hit a dead end and call whoever made it easier.",
  },
  noForm: {
    plumbing:    "There's no contact form on your site — plumbing customers who aren't ready to call yet have no way to reach out.",
    roofing:     "There's no quote request form — homeowners ready to get estimates can't take a next step, so they go to a competitor who has one.",
    hvac:        "No contact form means customers who find you after hours have no way to request service — that's lost overnight revenue.",
    landscaping: "No quote form means customers browsing your site can't convert — landscaping buyers want to request a quote right then.",
    electrical:  "No contact form means customers who want to inquire after hours have nowhere to go, and they'll find an electrician who has one.",
    general:     "There's no contact or quote form — visitors who aren't ready to call have no way to reach out, so you lose them.",
  },
  noTapToCall: {
    plumbing:    "Your phone number isn't tappable on mobile — plumbing customers who want to call immediately just move on to the next result.",
    roofing:     "Your number isn't a tap-to-call link — homeowners on mobile ready to book an estimate have to manually dial, and most won't.",
    hvac:        "Your phone isn't clickable on mobile — HVAC customers with an urgent repair need won't manually type your number, they'll just call someone else.",
    general:     "Your phone number isn't tappable on mobile — customers ready to call right now will just click the next result instead.",
  },
  noCTA: {
    plumbing:    "There's no clear call-to-action on your site — plumbing customers who land on it don't know to call or request service.",
    roofing:     "There's no clear next step on your site — homeowners who are ready to get a roofing estimate don't know what to do.",
    hvac:        "No clear CTA means HVAC customers who land on your site during an emergency don't know how to reach you fast.",
    landscaping: "There's no call-to-action — landscaping customers ready to request a quote land on your page and have no obvious path forward.",
    general:     "There's no clear next step on your site — interested visitors don't know what to do and leave without converting.",
  },
  noReviews: {
    plumbing:    "Your site has zero reviews showing — plumbing customers always check trust signals before letting someone into their home.",
    roofing:     "There are no reviews on your site — roofing is a high-trust purchase and homeowners won't choose without seeing social proof.",
    hvac:        "No reviews on your site — HVAC customers comparing options will pick a competitor who shows five-star ratings front and center.",
    landscaping: "Your site shows no reviews — landscaping customers check testimonials before trusting someone with their yard and property.",
    electrical:  "No reviews on your site — customers looking for a licensed electrician need to see proof before they'll pick up the phone.",
    remodeling:  "No testimonials or reviews — remodeling customers spend weeks researching and they'll choose whoever shows the most social proof.",
    general:     "Your site shows no reviews or testimonials — customers comparing local options will always pick the one with visible proof.",
  },
  noLicense: {
    plumbing:    "No licensing or insurance mention on your site — plumbing customers specifically look for that before letting anyone touch their pipes.",
    roofing:     "Your site doesn't mention licensing or insurance — roofing customers won't commit to a big job without seeing that credibility signal.",
    electrical:  "No licensing info on your site — electrical customers specifically need to see you're licensed before they'll hire you.",
    general:     "There's no licensing or insurance mention — customers comparing local contractors look for that first to filter out the risky ones.",
  },
  thinContent: {
    plumbing:    "Your site barely has any content — Google can't rank a plumber with a blank page, and customers won't trust one either.",
    roofing:     "Your site has almost no content — Google won't rank a roofing page that thin, and homeowners researching you won't find anything.",
    hvac:        "Your site is mostly empty — HVAC customers expect service details, and Google won't rank a thin page for local searches.",
    landscaping: "Your site has almost no content — landscaping customers want to see your work and Google won't rank a near-empty page.",
    general:     "Your site barely has any content — Google can't rank it for local searches, and customers who land on it find nothing to trust.",
  },
};

/**
 * Builds a niche-aware, issue-specific cold-call opener.
 * Each sentence: names the issue + ties to how that niche's customers decide + frames as missed revenue.
 */
function buildPersonalizedOpener(issues, builder, lead, html) {
  const h   = String(html || '');
  const cat = detectNicheCategory(lead);

  function pick(map, ...args) {
    const fn = map[cat] || map.general;
    return fn ? (typeof fn === 'function' ? fn(...args) : fn) : null;
  }

  // ── Dead technology (highest specificity) ─────────────────────────────────
  if (issues.some(i => /Flash/i.test(i)))
    return pick(OPENER_MATRIX.flash);

  if (issues.some(i => /Internet Explorer/i.test(i)))
    return pick(OPENER_MATRIX.ie);

  if (issues.some(i => /jQuery 1\./i.test(i)))
    return pick(OPENER_MATRIX.jquery1);

  if (issues.some(i => /legacy host|Angelfire|Tripod/i.test(i)))
    return pick(OPENER_MATRIX.legacyHost);

  if (issues.some(i => /table-based layout/i.test(i)))
    return pick(OPENER_MATRIX.tableLayout);

  // ── Stale copyright year ───────────────────────────────────────────────────
  const yearMatch = h.match(/©\s*(201[0-9]|202[0-1])|copyright\s*(201[0-9]|202[0-1])/i);
  if (yearMatch) {
    const yr = yearMatch[1] || yearMatch[2];
    return pick(OPENER_MATRIX.staleYear, yr);
  }

  // ── Named builder ──────────────────────────────────────────────────────────
  if (builder && /Wix/i.test(builder))    return pick(OPENER_MATRIX.wix);
  if (builder && /GoDaddy/i.test(builder)) return pick(OPENER_MATRIX.godaddy);
  if (builder && /Squarespace/i.test(builder)) return pick(OPENER_MATRIX.squarespace);
  if (builder) return pick(OPENER_MATRIX.builderGeneric, builder);

  // ── Mobile ────────────────────────────────────────────────────────────────
  if (issues.some(i => /NOT mobile-responsive|No viewport/i.test(i)))
    return pick(OPENER_MATRIX.noMobileViewport);

  if (issues.some(i => /No responsive CSS/i.test(i)))
    return pick(OPENER_MATRIX.noResponsiveCSS);

  // ── Contact / conversion ──────────────────────────────────────────────────
  if (issues.some(i => /no contact or quote form/i.test(i)) && issues.some(i => /clickable/i.test(i)))
    return pick(OPENER_MATRIX.noFormNoTap);

  if (issues.some(i => /no contact or quote form/i.test(i)))
    return pick(OPENER_MATRIX.noForm);

  if (issues.some(i => /phone number isn't clickable/i.test(i)))
    return pick(OPENER_MATRIX.noTapToCall);

  if (issues.some(i => /No clear call-to-action/i.test(i)))
    return pick(OPENER_MATRIX.noCTA);

  // ── Trust ─────────────────────────────────────────────────────────────────
  if (issues.some(i => /no reviews|zero social proof/i.test(i)))
    return pick(OPENER_MATRIX.noReviews);

  if (issues.some(i => /no license|can't verify/i.test(i)))
    return pick(OPENER_MATRIX.noLicense);

  // ── Thin content ──────────────────────────────────────────────────────────
  if (issues.some(i => /basically empty|placeholder|thin page/i.test(i)))
    return pick(OPENER_MATRIX.thinContent);

  return 'No strong personalized opener found from public data.';
}

function buildPitchAngle(issues, builder, url) {
  const angles = [];
  if (issues.some(i => /mobile|viewport|responsive/i.test(i))) {
    angles.push('mobile-first redesign (most of their customers are on phones)');
  }
  if (issues.some(i => /CTA|next step|quote|form|contact/i.test(i))) {
    angles.push('clear quote/booking flow to stop losing leads');
  }
  if (issues.some(i => /trust|review|license|social proof/i.test(i))) {
    angles.push('trust signals (reviews, credentials) to close more jobs');
  }
  if (issues.some(i => /template|Wix|Squarespace|GoDaddy|generic/i.test(i))) {
    angles.push('custom design that stands out from competitor template sites');
  }
  if (issues.some(i => /outdated|Flash|jQuery 1|IE|copyright|2018|2019/i.test(i))) {
    angles.push('modern tech stack that actually loads fast on Google');
  }
  if (angles.length === 0) angles.push('professional redesign that converts visitors into calls');
  return 'Pitch: ' + angles.slice(0, 2).join(' + ');
}

// ── Affordability check ──────────────────────────────────────────────────────

const HIGH_VALUE_NICHES = /hvac|plumb|roof|electri|foundation|water damage|restoration|remodel|concrete|garage door|medspa|dentist|solar|pest|landscap|tree|pool/i;

function checkAffordability(lead, html) {
  const signals = [];
  if (lead['BBB Accredited'] === 'Yes') signals.push('BBB accredited');
  const years = parseInt(lead['Years In Business'] || '0', 10);
  if (years >= 3) signals.push(`${years}+ yrs in business`);
  if (HIGH_VALUE_NICHES.test(lead.Niche || lead['Business Name'])) signals.push('High-ticket niche');
  if (html) {
    if (/fleet|truck|van|vehicles/i.test(html)) signals.push('Has fleet');
    if (/team|crew|staff|technician/i.test(html)) signals.push('Has team');
    if (/financing|payment plan/i.test(html))     signals.push('Offers financing');
    if (/google.*ads|googletagmanager/i.test(html)) signals.push('Paying for Google Ads');
    if (/service.*area|cities.*we.*serve/i.test(html)) signals.push('Multi-area business');
  }
  return signals;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Missing input: ${INPUT}`);
    process.exit(1);
  }

  const raw = parseCSV(fs.readFileSync(INPUT, 'utf8'));
  console.log(`\nLoaded ${raw.length} raw leads\n`);

  // Only process leads with a website
  const withSite = raw.filter(r => r.Website && r.Website.trim() && r.Phone);
  console.log(`Has website + phone: ${withSite.length}\n`);

  const qualified = [];
  let checked = 0, skippedOK = 0, skippedUnreachable = 0, skippedFewIssues = 0;

  for (const lead of withSite) {
    if (qualified.length >= TARGET) break;

    checked++;
    const name = lead['Business Name'] || '(unknown)';
    process.stdout.write(`[${checked}/${withSite.length}] ${name}... `);

    let fetchResult;
    try { fetchResult = await fetchSite(lead.Website); } catch {}

    if (!fetchResult || !fetchResult.ok || fetchResult.text.length < 300) {
      console.log('unreachable / empty');
      skippedUnreachable++;
      continue;
    }

    const { issues, issueCount, score, pitchAngle, builderDetected, chatbotDetected, tooGood } = auditSite(fetchResult.text, fetchResult.url);
    const personalizedOpener = buildPersonalizedOpener(issues, builderDetected, lead, fetchResult.text);

    if (chatbotDetected) {
      console.log(`chatbot detected -> skip`);
      skippedOK++;
      continue;
    }

    if (tooGood || issueCount < MIN_ISSUES) {
      console.log(`site OK (${issueCount} issues) -> skip`);
      skippedOK++;
      continue;
    }

    const affordability = checkAffordability(lead, fetchResult.text);
    if (affordability.length < MIN_AFFORDABILITY) {
      console.log(`bad site but only ${affordability.length} affordability signal(s) -> skip`);
      skippedFewIssues++;
      continue;
    }

    console.log(`✅ ${issueCount} issues, score ${score}/10 — ${issues[0]}`);

    qualified.push({
      businessName:       lead['Business Name'],
      niche:              lead.Niche,
      city:               lead.City,
      state:              lead.State,
      phone:              lead.Phone,
      website:            fetchResult.url || lead.Website,
      owner:              lead.Owner || '',
      title:              lead.Title || '',
      issueCount,
      issues:             issues.join(' | '),
      topIssues:          issues.slice(0, 3).join('; '),
      affordability:      affordability.join('; '),
      pitchAngle,
      personalizedOpener,
      score,
    });
  }

  qualified.sort((a, b) => b.issueCount - a.issueCount || b.score - a.score);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Checked:         ${checked}`);
  console.log(`Site OK (skip):  ${skippedOK}`);
  console.log(`Unreachable:     ${skippedUnreachable}`);
  console.log(`No affordability:${skippedFewIssues}`);
  console.log(`✅ QUALIFIED:     ${qualified.length}`);
  console.log(`${'='.repeat(60)}\n`);

  // Write CSV
  const headers = 'Business Name,Niche,City,State,Phone,Website,Owner,Title,Issue Count,Issues,Top Issues,Affordability,Pitch Angle,Personalized Opening Angle,Score';
  const csvRows = qualified.map(l => [
    l.businessName, l.niche, l.city, l.state, l.phone, l.website,
    l.owner, l.title, l.issueCount, l.issues, l.topIssues,
    l.affordability, l.pitchAngle, l.personalizedOpener, l.score,
  ].map(csvEscape).join(','));
  fs.writeFileSync(OUTPUT_CSV, headers + '\n' + csvRows.join('\n') + '\n');

  // Write markdown report
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/New_York',
  });
  const md = [
    `# LeadClaw Daily Report — ${date}`,
    '',
    `**${qualified.length} Bad-Website Leads** | Home Services | Redesign Prospects`,
    '',
  ];
  for (let i = 0; i < qualified.length; i++) {
    const l = qualified[i];
    md.push(`## ${i + 1}. ${l.businessName}`);
    md.push(`- **Niche:** ${l.niche} | **Location:** ${l.city}, ${l.state}`);
    md.push(`- **Phone:** ${l.phone} | **Owner:** ${l.owner || 'Needs lookup'}`);
    md.push(`- **Website:** ${l.website}`);
    md.push(`- **Issues (${l.issueCount}):** ${l.topIssues}`);
    md.push(`- **Budget signals:** ${l.affordability}`);
    md.push(`- **${l.pitchAngle}**`);
    md.push(`- **Personalized Opening Angle:** ${l.personalizedOpener}`);
    md.push(`- **Score:** ${l.score}/10`);
    md.push('');
  }
  fs.writeFileSync(OUTPUT_MD, md.join('\n'));

  // Append to master for dedup
  const masterExists = fs.existsSync(MASTER_CSV) && fs.statSync(MASTER_CSV).size > 0;
  if (!masterExists) fs.writeFileSync(MASTER_CSV, headers + '\n');
  fs.appendFileSync(MASTER_CSV, csvRows.join('\n') + '\n');

  console.log(`Wrote ${path.relative(ROOT, OUTPUT_CSV)}`);
  console.log(`Wrote ${path.relative(ROOT, OUTPUT_MD)}\n`);
}

main().catch(err => {
  console.error('leadclaw-qualify failed:', err.message);
  process.exit(1);
});
