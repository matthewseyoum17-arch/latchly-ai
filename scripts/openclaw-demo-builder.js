#!/usr/bin/env node
/**
 * openclaw-demo-builder.js  (Agent 3 — Demo Builder)
 *
 * For each qualified lead, generates a personalized demo website by:
 *   1. Loading the appropriate industry template (hvac/plumbing/roofing)
 *   2. Injecting business name, phone, city, services, reviews into the base HTML
 *   3. Writing to demos/prospects/[slug].html
 *   4. Updating the prospect record with demo_url + demo_slug
 *
 * Input:  leads/openclaw/audited.json  (or --input flag)
 * Output: demos/prospects/[slug].html  per lead
 *
 * Usage:
 *   node scripts/openclaw-demo-builder.js
 *   node scripts/openclaw-demo-builder.js --input leads/openclaw/audited.json
 *   DRY_RUN=true node scripts/openclaw-demo-builder.js
 */

const fs   = require('fs');
const path = require('path');
const config = require('./openclaw.config');
const { createLogger } = require('./openclaw-logger');

const log = createLogger('demo-builder');
const { ROOT, DEMOS_DIR, TEMPLATES_DIR, DRY_RUN, SITE_BASE, BOOKING_LINK } = config;
const VARIANCE = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, 'variance.json'), 'utf8'));

// ── Site content scraper — extract real data from prospect's site ──────────

const SCRAPE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
};

/**
 * Scrape the prospect's actual website and extract their branding,
 * services, testimonials, and content for a tailored demo.
 */
async function scrapeSiteContent(url) {
  if (!url) return null;

  try {
    const resp = await fetch(url, { headers: SCRAPE_HEADERS, signal: AbortSignal.timeout(12000), redirect: 'follow' });
    if (!resp.ok) return null;
    const html = await resp.text();

    const result = {
      scraped: true,
      logoUrl: null,
      ogImage: null,
      colors: [],
      services: [],
      testimonials: [],
      aboutText: '',
      tagline: '',
      yearsInBusiness: null,
      certifications: [],
    };

    // ── Extract logo ──
    const logoM = html.match(/<img[^>]+(?:class|id|alt)="[^"]*logo[^"]*"[^>]*src="([^"]+)"/i)
      || html.match(/<img[^>]*src="([^"]+)"[^>]*(?:class|id|alt)="[^"]*logo[^"]*"/i)
      || html.match(/<link[^>]+rel="icon"[^>]+href="([^"]+)"/i);
    if (logoM) {
      try {
        result.logoUrl = new URL(logoM[1], url).href;
      } catch { result.logoUrl = logoM[1]; }
    }

    // ── Extract og:image ──
    const ogM = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
    if (ogM) result.ogImage = ogM[1];

    // ── Extract brand colors from inline CSS ──
    const colorMatches = html.match(/#[0-9a-f]{6}/gi) || [];
    const colorCounts = {};
    colorMatches.forEach(c => {
      const cl = c.toLowerCase();
      if (cl !== '#000000' && cl !== '#ffffff' && cl !== '#333333' && cl !== '#666666' && cl !== '#999999') {
        colorCounts[cl] = (colorCounts[cl] || 0) + 1;
      }
    });
    result.colors = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([color]) => color);

    // ── Extract services from headings and list items ──
    const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');

    // Look for service-like headings (h2, h3 near service keywords)
    const serviceMatches = stripped.match(/<h[2-3][^>]*>([^<]{3,60})<\/h[2-3]>/gi) || [];
    const serviceKeywords = /repair|install|replace|maintain|service|clean|inspect|emergency|drain|leak|heat|cool|roof|gutter|siding|insulation|water heater|duct|furnace|ac\b|a\/c|plumb/i;
    for (const match of serviceMatches) {
      const text = match.replace(/<[^>]+>/g, '').trim();
      if (serviceKeywords.test(text) && text.length < 60 && result.services.length < 8) {
        result.services.push(text);
      }
    }

    // Fallback: nav links that look like services
    if (result.services.length < 3) {
      const navLinks = stripped.match(/<a[^>]+href="[^"]*(?:service|what-we-do)[^"]*"[^>]*>([^<]+)</gi) || [];
      for (const link of navLinks) {
        const text = link.replace(/<[^>]+>/g, '').trim();
        if (text.length > 2 && text.length < 50 && result.services.length < 8) {
          result.services.push(text);
        }
      }
    }

    // ── Extract testimonials / reviews ──
    const reviewBlocks = stripped.match(/"[^"]{30,300}"\s*[-–—]\s*[A-Z][a-z]+/g) || [];
    for (const block of reviewBlocks.slice(0, 3)) {
      const parts = block.match(/"([^"]+)"\s*[-–—]\s*([A-Z][a-zA-Z\s.]+)/);
      if (parts) {
        result.testimonials.push({ text: parts[1].trim(), name: parts[2].trim(), rating: 5 });
      }
    }

    // Also look for blockquote/review-class content
    if (result.testimonials.length === 0) {
      const quoteMatches = stripped.match(/<(?:blockquote|div[^>]+(?:review|testimonial))[^>]*>([\s\S]{20,300}?)<\//gi) || [];
      for (const q of quoteMatches.slice(0, 3)) {
        const text = q.replace(/<[^>]+>/g, '').trim();
        if (text.length > 20 && text.length < 300) {
          result.testimonials.push({ text, name: 'Customer', rating: 5 });
        }
      }
    }

    // ── Extract about/tagline text ──
    const descM = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
    if (descM) result.aboutText = descM[1].trim();

    const titleM = html.match(/<title>([^<]+)<\/title>/i);
    if (titleM) result.tagline = titleM[1].replace(/\s*[-|–].*$/, '').trim();

    // ── Extract years in business ──
    const yearM = stripped.match(/(?:since|established|serving.*since)\s*((?:19|20)\d{2})/i)
      || stripped.match(/([\d]+)\+?\s*years?\s*(?:of\s+)?(?:experience|in business|serving)/i);
    if (yearM) {
      const num = parseInt(yearM[1], 10);
      result.yearsInBusiness = num > 100 ? new Date().getFullYear() - num : num;
    }

    // ── Extract certifications ──
    const certPatterns = [
      /licensed/i, /bonded/i, /insured/i, /bbb.*accredited/i,
      /epa.*certified/i, /nate.*certified/i, /home.*advisor/i,
    ];
    for (const pat of certPatterns) {
      if (pat.test(stripped) && result.certifications.length < 4) {
        const label = pat.source.replace(/\.\*/g, ' ').replace(/\\s\*/g, ' ').replace(/\/i/g, '')
          .replace(/[\\^$]/g, '').trim();
        result.certifications.push(label.charAt(0).toUpperCase() + label.slice(1));
      }
    }

    log.info('site_scraped', {
      url,
      services: result.services.length,
      testimonials: result.testimonials.length,
      hasLogo: !!result.logoUrl,
      hasColors: result.colors.length,
      yearsInBusiness: result.yearsInBusiness,
    });

    return result;
  } catch (err) {
    log.catch('scrape_failed', err, { url });
    return null;
  }
}

/**
 * Merge scraped site content into template data.
 * Scraped data takes priority — template fills gaps.
 */
function mergeScrapedContent(template, scraped, lead) {
  if (!scraped || !scraped.scraped) return template;

  // Override services with real ones from their site
  if (scraped.services.length >= 2) {
    template.services = scraped.services.slice(0, 6).map(s => ({
      title: s,
      desc: `Professional ${s.toLowerCase()} services for ${lead.city || 'your area'}. Fast response, upfront pricing, satisfaction guaranteed.`,
    }));
  }

  // Override testimonials with real ones
  if (scraped.testimonials.length > 0) {
    template.testimonials = scraped.testimonials;
  }

  // Inject brand colors if found
  if (scraped.colors.length > 0) {
    const primary = scraped.colors[0];
    // Darken the primary for hover states
    const darken = (hex) => {
      const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 30);
      const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 30);
      const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 30);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };
    template.colors = {
      ...template.colors,
      primary,
      primaryDark: scraped.colors.length > 1 ? scraped.colors[1] : darken(primary),
      starColor: '#f59e0b',
      name: 'scraped-brand',
    };
  }

  // Override stats with real data
  if (scraped.yearsInBusiness) {
    const yrs = scraped.yearsInBusiness;
    if (template.stats) {
      template.stats = template.stats.map(s => {
        if (/year/i.test(s.label)) return { ...s, value: `${yrs}+` };
        return s;
      });
    }
  }

  // Add certifications to about/why-us
  if (scraped.certifications.length > 0 && template.whyUs) {
    const certItem = {
      title: scraped.certifications.join(' • '),
      desc: `Verified credentials you can trust — we stand behind every job.`,
    };
    if (template.whyUs.length < 5) {
      template.whyUs.push(certItem);
    }
  }

  // Use their tagline if available
  if (scraped.tagline && scraped.tagline.length > 5 && scraped.tagline.length < 80) {
    template.originalTagline = scraped.tagline;
  }

  // Store logo for use in HTML
  template.scrapedLogo = scraped.logoUrl || scraped.ogImage || null;

  return template;
}

function loadTemplate(niche) {
  const nicheRaw = niche.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  const nicheWords = nicheRaw.split(/\s+/);
  const mapping = {
    hvac: 'hvac', heating: 'hvac', cooling: 'hvac', airconditioning: 'hvac',
    plumbing: 'plumbing', plumber: 'plumbing',
    roofing: 'roofing', roofer: 'roofing', roof: 'roofing',
  };
  // Match on any word in the niche string (e.g. "roofing contractor" matches "roofing")
  const templateName = nicheWords.reduce((found, w) => found || mapping[w], null);
  if (!templateName) return null;
  const file = path.join(TEMPLATES_DIR, `${templateName}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ── Seeded random (deterministic per business name) ──────────────────────────

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pick(arr, seed) { return arr[seed % arr.length]; }

function applyVariance(template, lead) {
  const seed = hashStr(lead.business_name + (lead.city || ''));
  const nicheKey = (template.niche || 'hvac').toLowerCase();

  // Pick color scheme
  const colors = pick(VARIANCE.colorSchemes, seed);

  // Pick hero image
  const heroImages = VARIANCE.heroImages[nicheKey] || VARIANCE.heroImages.hvac;
  const heroImg = pick(heroImages, seed + 1);

  // Pick stats
  const stats = pick(VARIANCE.stats, seed + 2);

  // Pick headline — use original tagline if scraped, otherwise template
  const headlines = VARIANCE.heroHeadlines[nicheKey] || VARIANCE.heroHeadlines.hvac;
  const headline = template.originalTagline
    ? template.originalTagline
    : pick(headlines, seed + 3).replace('{city}', lead.city || 'Your City');

  // Pick subline
  const sublines = VARIANCE.sublines[nicheKey] || VARIANCE.sublines.hvac;
  const subline = pick(sublines, seed + 4);

  // Pick CTA labels
  const ctas = pick(VARIANCE.ctaLabels, seed + 5);

  // Pick testimonials
  const testimonials = pick(VARIANCE.testimonials, seed + 6);

  // Pick booking names
  const names = pick(VARIANCE.bookingNames, seed + 7);

  // Pick why us variant
  const whyUs = pick(VARIANCE.whyUsVariants, seed + 8);

  // Build varied bookings using niche-specific actions from template
  const bookingActions = template.bookings.map(b => b.action);
  const bookings = names.map((name, i) => ({
    name,
    action: bookingActions[i % bookingActions.length],
    time: ['just now', '3 min ago', '7 min ago', '12 min ago', '18 min ago', '24 min ago'][i],
  }));

  // Build varied quick replies — mix of template defaults and CTA variation
  const quickReplies = [...template.quickReplies];
  quickReplies[0] = ctas.primary.replace(' — Free Estimate', '').replace('Book Now — ', '');

  return {
    ...template,
    colors,
    heroImage: heroImg.url,
    heroAlt: heroImg.alt,
    stats,
    headline,
    subline,
    ctas,
    testimonials,
    bookings,
    whyUs,
    quickReplies,
  };
}

// ── Slug generation ──────────────────────────────────────────────────────────

function makeSlug(businessName, city, state) {
  return [businessName, city, state]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

// ── HTML generation ──────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildServiceCards(services) {
  const icons = [
    '<svg class="w-6 h-6 text-orange" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>',
    '<svg class="w-6 h-6 text-orange" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"/></svg>',
    '<svg class="w-6 h-6 text-orange" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3"/></svg>',
    '<svg class="w-6 h-6 text-orange" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25"/></svg>',
    '<svg class="w-6 h-6 text-orange" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z"/></svg>',
    '<svg class="w-6 h-6 text-orange" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>',
  ];
  return services.map((svc, i) => `
      <div class="service-card reveal">
        <div class="service-icon">${icons[i % icons.length]}</div>
        <h3 class="font-display font-bold text-[15px] text-navy mb-1.5">${escHtml(svc.title)}</h3>
        <p class="text-slate-400 text-[13px] leading-relaxed">${escHtml(svc.desc)}</p>
      </div>`).join('\n');
}

function buildServiceOptions(options) {
  return options.map(o => `            <option>${escHtml(o)}</option>`).join('\n');
}

function buildFaqItems(faqs) {
  return faqs.map(faq => `
      <div class="faq-item rounded-xl overflow-hidden" style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);">
        <button class="faq-toggle w-full flex items-center justify-between p-6 text-left" aria-expanded="false">
          <span class="font-display font-bold text-[15px] pr-4" style="color:#e2e8f0;">${escHtml(faq.q)}</span>
          <svg class="faq-icon w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div class="faq-answer px-6">
          <p class="pb-6" style="color:#7a8ba6;">${escHtml(faq.a)}</p>
        </div>
      </div>`).join('\n');
}

function buildBookingsArray(bookings) {
  return JSON.stringify(bookings);
}

function buildWhyUsCards(items) {
  const icons = [
    '<svg class="w-4.5 h-4.5" style="width:18px;height:18px;color:#5b9bd5;" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    '<svg class="w-4.5 h-4.5" style="width:18px;height:18px;color:#5b9bd5;" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z"/></svg>',
    '<svg class="w-4.5 h-4.5" style="width:18px;height:18px;color:#5b9bd5;" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>',
    '<svg class="w-4.5 h-4.5" style="width:18px;height:18px;color:#5b9bd5;" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  ];
  return items.map((item, i) => `
        <div class="rounded-xl p-5 flex items-start gap-4" style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);">
          <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgba(27,95,168,0.15);">${icons[i % icons.length]}</div>
          <div>
            <p class="font-display font-bold text-[15px] mb-0.5" style="color:#e2e8f0;">${escHtml(item.title)}</p>
            <p class="text-[13px] leading-relaxed" style="color:#7a8ba6;">${escHtml(item.desc)}</p>
          </div>
        </div>`).join('\n');
}

function buildTestimonialCards(testimonials, colors) {
  if (!testimonials || !testimonials.length) return '';
  return testimonials.map(t => `
      <div class="review-card reveal" style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:24px;">
        <div style="display:flex;gap:2px;margin-bottom:12px;">${'<span style="color:' + (colors.starColor || '#d4a843') + ';font-size:14px;">&#9733;</span>'.repeat(t.rating || 5)}</div>
        <p style="color:#94a3b8;font-size:13.5px;line-height:1.6;margin:0 0 14px;">"${escHtml(t.text)}"</p>
        <p style="color:#e2e8f0;font-weight:700;font-size:13px;margin:0;">${escHtml(t.name)}</p>
      </div>`).join('\n');
}

// ── Audit-based personalization ────────────────────────────────────────────

const ISSUE_MESSAGING = {
  no_mobile:    { fix: 'Mobile-First Design', desc: 'This site is built to look perfect on every phone and tablet — so you never lose a customer who\'s searching on the go.' },
  thin_content: { fix: 'Rich, Detailed Content', desc: 'Every page is loaded with the info your customers need — services, pricing context, and trust signals that convert visitors into calls.' },
  no_phone_cta: { fix: 'Click-to-Call Everywhere', desc: 'Your phone number is front and center on every page, with tap-to-call buttons so mobile visitors can reach you instantly.' },
  no_form:      { fix: 'Smart Lead Capture Forms', desc: 'Built-in contact forms on every key page — plus an AI chat assistant that captures leads 24/7, even while you sleep.' },
  no_reviews:   { fix: 'Social Proof Built In', desc: 'Customer testimonials and ratings are showcased prominently — building trust before a prospect even picks up the phone.' },
  no_schema:    { fix: 'SEO-Ready Structured Data', desc: 'Search engines can read your business info, services, and reviews — helping you rank higher in local searches.' },
  table_layout: { fix: 'Modern, Clean Layout', desc: 'A fresh, professional design that loads fast and looks great — no outdated table layouts or clunky formatting.' },
  slow_builder: { fix: 'Custom-Built (No Cookie Cutter)', desc: 'This isn\'t a Wix or Squarespace template. It\'s a custom site built specifically for your business and your market.' },
  no_https:     { fix: 'Secure HTTPS', desc: 'Full SSL encryption so your visitors see the padlock icon — builds trust and helps with Google rankings.' },
  no_ssl:       { fix: 'Secure Connection', desc: 'Your site runs on HTTPS — no browser warnings scaring off potential customers.' },
};

function buildPersonalizationBanner(lead) {
  const issues = lead.report_card?.issues || [];
  if (issues.length === 0) return '';

  const fixes = issues
    .slice(0, 4)
    .map(i => ISSUE_MESSAGING[i.key])
    .filter(Boolean);

  if (fixes.length === 0) return '';

  const fixCards = fixes.map(f => `
      <div style="flex:1;min-width:200px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="color:#10b981;font-size:16px;">&#10003;</span>
          <span style="color:#e2e8f0;font-weight:700;font-size:14px;">${escHtml(f.fix)}</span>
        </div>
        <p style="color:#7a8ba6;font-size:13px;line-height:1.6;margin:0;">${escHtml(f.desc)}</p>
      </div>`).join('\n');

  const websiteNote = lead.website
    ? `<p style="color:#7a8ba6;font-size:13px;max-width:520px;margin:8px auto 0;">We looked at <a href="${escHtml(lead.website)}" style="color:#93b4d9;text-decoration:underline;" target="_blank">${escHtml(lead.website.replace(/^https?:\/\/(?:www\.)?/, '').replace(/\/$/, ''))}</a> and rebuilt it from the ground up with these upgrades.</p>`
    : '';

  return `
<!-- ===== PERSONALIZED: YOUR SITE, UPGRADED ===== -->
<section style="background:linear-gradient(180deg,#0a0f1c 0%,#0f1628 100%);border-bottom:1px solid rgba(255,255,255,0.04);" class="py-12">
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:flex;justify-content:center;margin-bottom:12px;">
        <span style="display:inline-block;background:rgba(16,185,129,0.1);color:#10b981;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;padding:6px 14px;border-radius:6px;border:1px solid rgba(16,185,129,0.2);">Your site, reimagined</span>
      </div>
      <h2 style="color:#e2e8f0;font-size:22px;font-weight:800;margin:0 0 6px;letter-spacing:-0.02em;">What's different about this version</h2>
      <p style="color:#7a8ba6;font-size:14px;max-width:480px;margin:0 auto;">Same business, same services — but a site that actually converts visitors into booked jobs.</p>
      ${websiteNote}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">
${fixCards}
    </div>
  </div>
</section>
`;
}

function generateDemo(lead, template) {
  // Apply variance — gives each business unique colors, stats, content
  template = applyVariance(template, lead);
  const c = template.colors; // color scheme

  const biz = escHtml(lead.business_name);
  const city = escHtml(lead.city || 'Your City');
  const state = escHtml(lead.state || '');
  const phone = escHtml(lead.phone || '(555) 000-0000');
  const cityState = [lead.city, lead.state].filter(Boolean).join(', ');
  const nicheLabel = template.nicheLabel;
  const slug = lead.demo_slug;

  // Build the full HTML
  const rawHtml = `<!-- DEMO: ${biz} | Generated by OpenClaw Demo Builder | Theme: ${c.name} -->
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${biz} — 24/7 ${nicheLabel} | ${escHtml(cityState)}</title>
<meta name="description" content="Fast, reliable ${nicheLabel.toLowerCase()} services in ${city}. 24/7 emergency service, upfront pricing, licensed technicians. Call now!">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Outfit:wght@400;500;600;700;800;900&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  theme: {
    extend: {
      colors: {
        navy: '${c.bodyBg}',
        'navy-light': '${c.sectionBg2}',
        'navy-mid': '${c.sectionBg1}',
        orange: '${c.primary}',
        'orange-dark': '${c.primaryDark}',
        'orange-muted': '#EFF6FF',
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        body: ['DM Sans', 'sans-serif'],
      }
    }
  }
}
</script>
<style>
html { scroll-behavior: auto; }
body { font-family: 'DM Sans', sans-serif; color: #0F172A; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; background: #0a0f1c; }
h1, h2, h3, h4, h5, h6 { font-family: 'Outfit', sans-serif; letter-spacing: -0.025em; }
.label-tag { display: inline-flex; align-items: center; font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #1B5FA8; font-family: 'DM Sans', sans-serif; }
.section-heading { font-size: clamp(1.65rem, 3.8vw, 2.5rem); font-weight: 800; line-height: 1.12; letter-spacing: -0.03em; color: #0C1222; }
.section-sub { font-size: 15px; color: #64748b; line-height: 1.65; max-width: 480px; }
@keyframes pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.5); } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
.pulse-dot { animation: pulse-dot 1.5s ease-in-out infinite; }
.reveal { opacity: 0; transform: translateY(16px); transition: opacity 0.5s cubic-bezier(.25,.46,.45,.94), transform 0.5s cubic-bezier(.25,.46,.45,.94); }
.reveal.active { opacity: 1; transform: translateY(0); }
.mobile-menu { transform: translateX(100%); transition: transform 0.3s ease; }
.mobile-menu.open { transform: translateX(0); }
.faq-answer { max-height: 0; overflow: hidden; transition: max-height 0.35s ease, padding 0.25s ease; }
.faq-answer.open { max-height: 500px; }
.faq-icon { transition: transform 0.25s ease; }
.faq-icon.rotated { transform: rotate(180deg); }
.toast { transform: translateY(100px); opacity: 0; transition: all 0.4s ease; }
.toast.show { transform: translateY(0); opacity: 1; }
.nav-scrolled { background: rgba(12, 18, 34, 0.97); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); box-shadow: 0 1px 0 rgba(255,255,255,0.04); }
.service-card { background: rgba(255,255,255,0.04); border-radius: 12px; padding: 28px 26px; border: 1px solid rgba(255,255,255,0.06); transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease; }
.service-card:hover { border-color: rgba(27,95,168,0.35); box-shadow: 0 12px 40px rgba(0,0,0,0.2); transform: translateY(-3px); }
.service-card h3 { color: #e2e8f0 !important; }
.service-card p { color: #7a8ba6 !important; }
.service-icon { width: 44px; height: 44px; border-radius: 10px; background: rgba(27,95,168,0.15); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
.btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #1B5FA8; color: #fff; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 14.5px; padding: 14px 30px; border-radius: 10px; transition: all 0.2s ease; box-shadow: 0 2px 12px rgba(27,95,168,0.25); letter-spacing: -0.01em; }
.btn-primary:hover { background: #134780; transform: translateY(-1px); box-shadow: 0 4px 18px rgba(27,95,168,0.32); }
.btn-outline-white { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.06); color: #fff; font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 14.5px; padding: 13px 30px; border-radius: 10px; border: 1.5px solid rgba(255,255,255,0.2); transition: all 0.2s ease; letter-spacing: -0.01em; }
.btn-outline-white:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.4); }
:focus-visible { outline: 2px solid #1B5FA8; outline-offset: 2px; }

/* Latchly Widget */
#lw { position:fixed; bottom:24px; right:24px; z-index:9999; font-family:'DM Sans',sans-serif; }
#lw-fab { width:52px; height:52px; border-radius:14px; cursor:pointer; border:none; background:#0a0f1c; color:#fff; box-shadow:0 4px 20px rgba(15,23,42,.35); display:flex; align-items:center; justify-content:center; position:relative; transition:transform .2s,box-shadow .2s; }
#lw-fab:hover { transform:scale(1.06); box-shadow:0 8px 28px rgba(15,23,42,.45); }
#lw-fab svg { width:22px; height:22px; }
#lw-fab-badge { position:absolute; top:-3px; right:-3px; width:16px; height:16px; background:#ef4444; border-radius:50%; border:2px solid #fff; font-size:9px; font-weight:700; color:#fff; display:flex; align-items:center; justify-content:center; }
#lw-nudge { position:absolute; bottom:68px; right:0; width:240px; background:#fff; border-radius:16px; box-shadow:0 8px 30px rgba(0,0,0,.12); border:1px solid #e2e8f0; padding:14px 16px; cursor:pointer; opacity:0; transform:translateY(8px) scale(.95); pointer-events:none; transition:opacity .3s,transform .3s; }
#lw-nudge.show { opacity:1; transform:translateY(0) scale(1); pointer-events:all; }
#lw-nudge p { margin:0; font-size:13px; color:#334155; line-height:1.5; padding-right:16px; }
#lw-nudge b { color:#0f172a; }
#lw-nudge-x { position:absolute; top:6px; right:8px; background:#f1f5f9; border:none; cursor:pointer; width:18px; height:18px; border-radius:50%; font-size:10px; color:#94a3b8; display:flex; align-items:center; justify-content:center; line-height:1; }
#lw-nudge::after { content:''; position:absolute; bottom:-6px; right:22px; width:12px; height:12px; background:#fff; border-right:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; transform:rotate(45deg); }
#lw-panel { position:absolute; bottom:68px; right:0; width:380px; height:600px; background:#fff; border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,.18); border:1px solid #f1f5f9; display:flex; flex-direction:column; overflow:hidden; opacity:0; transform:translateY(16px) scale(.96); pointer-events:none; transition:opacity .25s cubic-bezier(.34,1.56,.64,1),transform .3s cubic-bezier(.34,1.56,.64,1); transform-origin:bottom right; }
#lw-panel.open { opacity:1; transform:translateY(0) scale(1); pointer-events:all; }
@media(max-width:440px) { #lw-panel { position:fixed; inset:0; width:100%; height:100%; border-radius:0; } #lw { bottom:0; right:0; } }
#lw-head { background:${c.headGradient}; color:#fff; padding:16px 18px; display:flex; align-items:center; gap:12px; flex-shrink:0; }
#lw-head-emoji { width:40px; height:40px; border-radius:12px; background:rgba(255,255,255,.18); display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
#lw-head-info { flex:1; min-width:0; }
#lw-head-name { font-family:'Outfit',sans-serif; font-weight:700; font-size:14px; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#lw-head-status { font-size:11px; opacity:.85; margin:2px 0 0; display:flex; align-items:center; gap:6px; }
#lw-head-status .dot { width:6px; height:6px; border-radius:50%; background:#34d399; display:inline-block; flex-shrink:0; }
#lw-close { background:rgba(255,255,255,.15); border:none; color:#fff; cursor:pointer; width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; transition:background .2s; flex-shrink:0; }
#lw-close:hover { background:rgba(255,255,255,.25); }
#lw-messages { flex:1; overflow-y:auto; padding:16px; background:#f8fafc; display:flex; flex-direction:column; gap:10px; }
.lw-msg { display:flex; gap:8px; max-width:88%; animation:lw-fadeIn .25s ease; }
.lw-msg-bot { align-self:flex-start; }
.lw-msg-user { align-self:flex-end; flex-direction:row-reverse; }
.lw-msg-avatar { width:28px; height:28px; border-radius:50%; flex-shrink:0; margin-top:2px; background:${c.headGradient}; display:flex; align-items:center; justify-content:center; font-size:12px; }
.lw-msg-user .lw-msg-avatar { display:none; }
.lw-msg-text { padding:10px 14px; font-size:13.5px; line-height:1.55; white-space:pre-line; }
.lw-msg-bot .lw-msg-text { background:#fff; color:#334155; border-radius:4px 16px 16px 16px; box-shadow:0 1px 3px rgba(0,0,0,.06); }
.lw-msg-user .lw-msg-text { background:#1B5FA8; color:#fff; border-radius:16px 16px 4px 16px; }
.lw-typing { display:flex; gap:4px; align-items:center; padding:12px 14px; }
.lw-typing span { width:7px; height:7px; background:#94a3b8; border-radius:50%; animation:lw-bounce 1.2s ease-in-out infinite; }
.lw-typing span:nth-child(2) { animation-delay:.15s; }
.lw-typing span:nth-child(3) { animation-delay:.3s; }
@keyframes lw-bounce { 0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)} }
@keyframes lw-fadeIn { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
#lw-quick { padding:4px 16px 8px; background:#f8fafc; display:flex; flex-wrap:wrap; gap:6px; }
.lw-qr { padding:7px 14px; border-radius:20px; font-size:12px; font-weight:600; cursor:pointer; border:1px solid rgba(27,95,168,.25); color:#1B5FA8; background:rgba(27,95,168,.05); transition:background .15s,color .15s; }
.lw-qr:hover { background:#1B5FA8; color:#fff; }
#lw-inputbar { padding:12px 16px; border-top:1px solid #f1f5f9; background:#fff; display:flex; align-items:center; gap:8px; flex-shrink:0; }
#lw-input { flex:1; border:1px solid #e2e8f0; border-radius:12px; padding:10px 14px; font-size:13px; color:#0f172a; outline:none; font-family:'DM Sans',sans-serif; transition:border-color .2s; }
#lw-input:focus { border-color:#1B5FA8; }
#lw-send { width:40px; height:40px; border-radius:12px; border:none; cursor:pointer; background:#1B5FA8; color:#fff; display:flex; align-items:center; justify-content:center; transition:background .15s; flex-shrink:0; }
#lw-send:hover { background:#134780; }
#lw-send:disabled { background:#cbd5e1; cursor:default; }
#lw-send svg { width:16px; height:16px; }
#lw-end { padding:0 16px 8px; background:#fff; text-align:right; }
#lw-end button { background:none; border:none; font-size:10px; color:#ef4444; font-weight:600; cursor:pointer; padding:2px 0; }
#lw-end button:hover { text-decoration:underline; }
.lw-phase { display:none; flex-direction:column; flex:1; overflow:hidden; }
.lw-phase.active { display:flex; }
#lw-booking-body { flex:1; overflow-y:auto; padding:20px 18px; background:#f8fafc; }
#lw-booking-body h3 { font-family:'Outfit',sans-serif; font-weight:700; font-size:15px; color:#0f172a; margin:0 0 2px; }
#lw-booking-body .sub { font-size:12px; color:#64748b; margin:0 0 16px; }
.lw-field { margin-bottom:12px; }
.lw-field label { display:block; font-size:11px; font-weight:600; color:#475569; margin-bottom:4px; }
.lw-field input, .lw-field select { width:100%; padding:10px 14px; border:1.5px solid #e2e8f0; border-radius:12px; font-size:13px; color:#0f172a; outline:none; font-family:'DM Sans',sans-serif; box-sizing:border-box; transition:border-color .2s; background:#fff; }
.lw-field input:focus, .lw-field select:focus { border-color:#1B5FA8; box-shadow:0 0 0 3px rgba(27,95,168,.1); }
.lw-btn { width:100%; padding:12px; border:none; border-radius:12px; font-family:'Outfit',sans-serif; font-weight:700; font-size:14px; color:#fff; cursor:pointer; background:#1B5FA8; transition:background .15s,transform .1s; margin-top:6px; }
.lw-btn:hover { background:#134780; transform:scale(1.01); }
.lw-btn:disabled { background:#cbd5e1; cursor:default; transform:none; }
.lw-btn-outline { width:100%; padding:10px; border:none; background:none; font-size:12px; color:#64748b; font-weight:600; cursor:pointer; margin-top:6px; }
.lw-btn-outline:hover { color:#0f172a; }
#lw-rating-body { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px; background:#f8fafc; text-align:center; }
#lw-rating-body .emoji { font-size:48px; margin-bottom:16px; }
#lw-rating-body h3 { font-family:'Outfit',sans-serif; font-weight:700; font-size:18px; color:#0f172a; margin:0 0 6px; }
#lw-rating-body .sub { font-size:13px; color:#64748b; margin:0 0 20px; }
#lw-stars { display:flex; gap:6px; margin-bottom:20px; }
#lw-stars button { background:none; border:none; cursor:pointer; padding:2px; transition:transform .15s; }
#lw-stars button svg { width:28px; height:28px; }
#lw-stars button.active svg { fill:#f59e0b; color:#f59e0b; }
#lw-stars button:not(.active) svg { fill:none; color:#cbd5e1; }
#lw-stars button.active { transform:scale(1.15); }
#lw-lead-body { flex:1; overflow-y:auto; padding:24px 18px; background:#f8fafc; }
#lw-lead-body h3 { font-family:'Outfit',sans-serif; font-weight:700; font-size:17px; color:#0f172a; margin:0 0 4px; }
#lw-lead-body .sub { font-size:13px; color:#64748b; margin:0 0 20px; line-height:1.5; }
#lw-complete-body { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px; background:#f8fafc; text-align:center; }
#lw-complete-body svg { width:56px; height:56px; color:#10b981; margin-bottom:16px; }
#lw-complete-body h3 { font-family:'Outfit',sans-serif; font-weight:700; font-size:18px; color:#0f172a; margin:0 0 8px; }
#lw-complete-body p { font-size:13px; color:#64748b; margin:0; line-height:1.6; max-width:260px; }
#lw-footer { padding:8px 16px; text-align:center; font-size:10px; color:#94a3b8; border-top:1px solid #f1f5f9; flex-shrink:0; background:#fff; }
#lw-footer a { color:#1B5FA8; text-decoration:none; font-weight:600; }
.lw-back-btn { display:block; width:100%; margin-top:8px; padding:10px; border:none; background:none; color:#64748b; font-size:12px; font-weight:600; cursor:pointer; transition:color .15s; font-family:'DM Sans',sans-serif; }
.lw-back-btn:hover { color:#1B5FA8; }
</style>
</head>
<body class="bg-white text-navy font-body">

<!-- ===== EMERGENCY BAR ===== -->
<div id="emergency-bar" style="background:#0a0f1c; border-bottom:1px solid rgba(255,255,255,0.04);" class="text-white py-2.5 px-4 text-center relative z-50">
  <a href="#contact" class="inline-flex items-center gap-2.5 text-xs font-medium tracking-wide hover:opacity-80 transition-opacity">
    <span class="inline-block w-1.5 h-1.5 rounded-full pulse-dot" style="background:#3b82f6;"></span>
    <span style="color:#7a8ba6;">24/7 Emergency Response &middot; ${city} &amp; Surrounding Areas &middot;</span>
    <strong style="color:#93b4d9; font-weight:600;">${phone}</strong>
  </a>
</div>

<!-- ===== NAVBAR ===== -->
<nav id="navbar" class="sticky top-0 z-40 bg-navy transition-all duration-300">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16 md:h-[68px]">
      <a href="#" class="flex items-center gap-2.5">
        ${template.scrapedLogo
          ? `<img src="${escHtml(template.scrapedLogo)}" alt="${biz}" style="height:32px;max-width:140px;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="w-7 h-7 bg-orange rounded-lg items-center justify-center flex-shrink-0" style="display:none;">
          <svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        </div>`
          : `<div class="w-7 h-7 bg-orange rounded-lg flex items-center justify-center flex-shrink-0">
          <svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        </div>`}
        <span class="font-display font-bold text-[17px] text-white" style="letter-spacing:-0.02em;">${biz}<span class="text-orange font-black">.</span></span>
      </a>
      <div class="hidden lg:flex items-center gap-9">
        <a href="#services" class="text-slate-400 hover:text-white transition-colors text-[13px] font-medium">Services</a>
        <a href="#reviews" class="text-slate-400 hover:text-white transition-colors text-[13px] font-medium">Reviews</a>
        <a href="#faq" class="text-slate-400 hover:text-white transition-colors text-[13px] font-medium">FAQ</a>
        <a href="#contact" class="text-slate-400 hover:text-white transition-colors text-[13px] font-medium">Contact</a>
      </div>
      <div class="hidden lg:flex items-center">
        <a href="#contact" class="inline-flex items-center gap-2 text-white font-semibold px-5 py-2 rounded-lg transition-all text-[13px]" style="background:#1B5FA8; box-shadow:0 1px 8px rgba(27,95,168,0.3);" onmouseover="this.style.background='#134780'" onmouseout="this.style.background='#1B5FA8'">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
          ${phone}
        </a>
      </div>
      <button id="mobile-toggle" class="lg:hidden text-white p-2" aria-label="Open menu">
        <svg id="hamburger-icon" class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
        <svg id="close-icon" class="w-7 h-7 hidden" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
  </div>
  <div id="mobile-overlay" class="fixed inset-0 bg-black/50 z-40 hidden lg:hidden"></div>
  <div id="mobile-menu" class="mobile-menu fixed top-0 right-0 w-80 h-full bg-navy z-50 shadow-2xl p-8 lg:hidden">
    <button id="mobile-close" class="absolute top-5 right-5 text-white" aria-label="Close menu">
      <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
    <div class="flex flex-col gap-6 mt-16">
      <a href="#services" class="mobile-link text-xl text-white font-display font-semibold hover:text-orange transition-colors">Services</a>
      <a href="#reviews" class="mobile-link text-xl text-white font-display font-semibold hover:text-orange transition-colors">Reviews</a>
      <a href="#faq" class="mobile-link text-xl text-white font-display font-semibold hover:text-orange transition-colors">FAQ</a>
      <a href="#contact" class="mobile-link text-xl text-white font-display font-semibold hover:text-orange transition-colors">Contact</a>
      <hr class="border-navy-light my-2">
      <a href="#contact" class="inline-flex items-center justify-center gap-2 bg-orange text-white font-semibold px-6 py-3 rounded-xl text-lg">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
        Call Now
      </a>
    </div>
  </div>
</nav>

<!-- ===== HERO ===== -->
<section id="home" class="relative flex items-center justify-center overflow-hidden" style="min-height:92vh;">
  <div class="absolute inset-0">
    <img src="${escHtml(template.heroImage)}" alt="${escHtml(template.heroAlt)}" class="w-full h-full object-cover" style="filter:brightness(0.35) saturate(0.6);">
    <div class="absolute inset-0" style="background:linear-gradient(175deg, rgba(10,14,26,0.6) 0%, rgba(10,14,26,0.45) 50%, rgba(10,14,26,0.75) 100%);"></div>
  </div>
  <div class="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
    <div id="open-status" class="inline-flex items-center gap-2 mb-7" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:6px 14px; backdrop-filter:blur(8px);">
      <span class="w-1.5 h-1.5 rounded-full pulse-dot" style="background:#3b82f6;"></span>
      <span class="text-[10.5px] font-semibold tracking-widest uppercase" style="color:rgba(255,255,255,0.55);" id="open-text">Open Now</span>
    </div>
    <h1 class="font-display font-black text-white leading-none mb-5" style="font-size:clamp(2.4rem, 5.5vw, 3.6rem); letter-spacing:-0.04em;">
      ${escHtml(template.headline)}<br>
      <span style="color:#7ab3e0;">${escHtml(template.headlineService)}</span>
    </h1>
    <p class="mb-9 mx-auto" style="font-size:16px; line-height:1.7; max-width:460px; color:rgba(255,255,255,0.5);">
      ${escHtml(template.subline)}
    </p>
    <div class="flex flex-col sm:flex-row gap-3 justify-center mb-11">
      <a href="#contact" class="btn-primary text-[15px] justify-center">${escHtml(template.ctas.primary)}</a>
      <a href="#services" class="btn-outline-white text-[15px] justify-center">${escHtml(template.ctas.secondary)}</a>
    </div>
    <p class="mx-auto" style="max-width:520px;font-size:12px;line-height:1.7;color:rgba(255,255,255,0.42);">
      Cleaner mobile flow, stronger lead capture, and a clearer path to calls and booked jobs.
    </p>
  </div>
</section>

<!-- ===== TRUST BAR ===== -->
<section style="background:#0d1425; border-bottom:1px solid rgba(255,255,255,0.04);" class="py-5">
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[13px] font-medium" style="color:#7a8ba6;">
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 flex-shrink-0" style="color:#1B5FA8;" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
        Licensed &amp; Insured
      </div>
      <div class="w-px h-3.5 hidden sm:block" style="background:rgba(255,255,255,0.1);"></div>
      <div class="flex items-center gap-2">
        <span style="color:#d4a843; font-size:12px;">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
        <span><strong style="color:#e2e8f0;">${escHtml(template.stats.googleRating)}</strong> on Google</span>
      </div>
      <div class="w-px h-3.5 hidden sm:block" style="background:rgba(255,255,255,0.1);"></div>
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 flex-shrink-0" style="color:#1B5FA8;" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        On-Site in <strong style="color:#e2e8f0;">60 Min</strong>
      </div>
      <div class="w-px h-3.5 hidden sm:block" style="background:rgba(255,255,255,0.1);"></div>
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 flex-shrink-0" style="color:#1B5FA8;" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z"/></svg>
        Upfront Pricing
      </div>
    </div>
  </div>
</section>

${buildPersonalizationBanner(lead)}

<!-- ===== SERVICES ===== -->
<section id="services" class="py-16 md:py-20" style="background:#0f1628;">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-12">
      <div>
        <span class="label-tag mb-3 block" style="color:#5b9bd5;">What We Do</span>
        <h2 class="section-heading" style="color:#e2e8f0;">Services that cover <br class="hidden sm:block">your whole home.</h2>
      </div>
      <p class="md:max-w-xs md:text-right text-sm leading-relaxed" style="color:#7a8ba6;">Professional ${nicheLabel.toLowerCase()} — every job done right the first time.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
${buildServiceCards(template.services)}
    </div>
  </div>
</section>

<!-- ===== STATS ===== -->
<section class="py-12" style="background:#0a0f1c;">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
      <div class="text-center">
        <div class="font-display font-black leading-none mb-1" style="font-size:2.25rem; letter-spacing:-0.03em; color:#7ab3e0;">${escHtml(template.stats.avgResponse)}<span style="font-size:1.1rem; font-weight:700;">min</span></div>
        <div class="text-xs font-medium uppercase tracking-widest mt-1.5" style="color:#546380;">Avg. Response</div>
      </div>
      <div class="text-center">
        <div class="font-display font-black leading-none mb-1" style="font-size:2.25rem; letter-spacing:-0.03em; color:#7ab3e0;">${escHtml(template.stats.jobsCompleted)}<span style="font-size:1.1rem;">+</span></div>
        <div class="text-xs font-medium uppercase tracking-widest mt-1.5" style="color:#546380;">Jobs Completed</div>
      </div>
      <div class="text-center">
        <div class="font-display font-black leading-none mb-1" style="font-size:2.25rem; letter-spacing:-0.03em; color:#7ab3e0;">${escHtml(template.stats.googleRating)}<span style="font-size:1.1rem; color:#d4a843;">&#9733;</span></div>
        <div class="text-xs font-medium uppercase tracking-widest mt-1.5" style="color:#546380;">Google Rating</div>
      </div>
      <div class="text-center">
        <div class="font-display font-black leading-none mb-1" style="font-size:2.25rem; letter-spacing:-0.03em; color:#7ab3e0;">${escHtml(template.stats.yearsInBusiness)}<span style="font-size:1.1rem;">yr</span></div>
        <div class="text-xs font-medium uppercase tracking-widest mt-1.5" style="color:#546380;">In Business</div>
      </div>
    </div>
  </div>
</section>

<!-- ===== WHY CHOOSE US ===== -->
<section class="py-16 md:py-20" style="background:#111827;">
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
      <div class="reveal">
        <span class="label-tag mb-3 block" style="color:#5b9bd5;">Why ${biz}</span>
        <h2 class="section-heading mb-4" style="color:#e2e8f0;">Service that actually<br>earns your trust.</h2>
        <p class="leading-relaxed mb-7 text-[15px]" style="color:#7a8ba6;">We know you have choices. Here's what makes us different — and why ${city} homeowners keep calling us back.</p>
        <a href="#contact" class="btn-primary inline-flex">${escHtml(template.ctas.primary)}</a>
      </div>
      <div class="space-y-3.5 reveal">
${buildWhyUsCards(template.whyUs)}
      </div>
    </div>
  </div>
</section>

<!-- ===== FAQ ===== -->
<section id="faq" class="py-16 md:py-20" style="background:#0f1628;">
  <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-12 reveal">
      <span class="label-tag mb-3 justify-center block" style="color:#5b9bd5;">Common Questions</span>
      <h2 class="section-heading" style="color:#e2e8f0;">Frequently Asked Questions</h2>
    </div>
    <div class="space-y-3">
${buildFaqItems(template.faqs)}
    </div>
  </div>
</section>

<!-- ===== REVIEWS ===== -->
<section id="reviews" class="py-16 md:py-20" style="background:${c.sectionBg3};">
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-12 reveal">
      <span class="label-tag mb-3 justify-center block" style="color:${c.accent};">Customer Reviews</span>
      <h2 class="section-heading" style="color:#e2e8f0;">Don't take our word for it.</h2>
      <p class="section-sub mx-auto mt-3" style="color:#7a8ba6;">See what ${city} homeowners are saying about ${biz}.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
${buildTestimonialCards(template.testimonials, c)}
    </div>
  </div>
</section>

<!-- ===== FINAL CTA ===== -->
<section class="py-16 md:py-20" style="background:#0a0f1c;">
  <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
    <span class="label-tag mb-4 justify-center block" style="color:#5a8ec4;">Ready to Get Started?</span>
    <h2 class="font-display font-black text-white mb-4 reveal" style="font-size:clamp(1.75rem,3.8vw,2.4rem); letter-spacing:-0.035em; line-height:1.12;">
      Fast, honest service.<br>Every time.
    </h2>
    <p class="mb-8 reveal" style="font-size:15px; color:#64748b;">
      Join homeowners in ${city} who trust <strong style="color:#7ab3e0;">${biz}</strong> for their ${nicheLabel.toLowerCase()} needs.
    </p>
    <div class="flex flex-col sm:flex-row gap-3 justify-center reveal">
      <a href="#contact" class="btn-primary text-[15px] justify-center">${escHtml(template.ctas.primary)}</a>
      <a href="#services" class="btn-outline-white text-[15px] justify-center">${escHtml(template.ctas.secondary)}</a>
    </div>
  </div>
</section>

<!-- ===== CONTACT + FOOTER ===== -->
<section id="contact" style="background:#111827;">
  <div class="py-16 md:py-20">
    <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-10 reveal">
        <span class="label-tag mb-3 justify-center block" style="color:#5b9bd5;">Contact Us</span>
        <h2 class="section-heading mb-2.5" style="color:#e2e8f0;">Get Your Free Quote</h2>
        <p class="text-[15px]" style="color:#7a8ba6;">Fill out the form and we'll call you within 15 minutes.</p>
      </div>
      <form id="contact-form" class="rounded-xl p-7 md:p-9 reveal" style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); box-shadow:0 4px 24px rgba(0,0,0,0.15);">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div>
            <label for="form-name" class="block text-[13px] font-semibold mb-1.5" style="color:#cbd5e1;">Your Name</label>
            <input type="text" id="form-name" name="name" required placeholder="John Smith" class="w-full px-4 py-2.5 rounded-lg outline-none transition-all text-[14px]" style="border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:#e2e8f0;">
          </div>
          <div>
            <label for="form-phone" class="block text-[13px] font-semibold mb-1.5" style="color:#cbd5e1;">Phone Number</label>
            <input type="tel" id="form-phone" name="phone" required placeholder="(555) 123-4567" class="w-full px-4 py-2.5 rounded-lg outline-none transition-all text-[14px]" style="border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:#e2e8f0;">
          </div>
        </div>
        <div class="mb-5">
          <label for="form-service" class="block text-[13px] font-semibold mb-1.5" style="color:#cbd5e1;">Service Needed</label>
          <select id="form-service" name="service" required class="w-full px-4 py-2.5 rounded-lg outline-none transition-all text-[14px]" style="border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:#e2e8f0;">
            <option value="" disabled selected>Select a service...</option>
${buildServiceOptions(template.serviceOptions)}
          </select>
        </div>
        <div class="mb-5">
          <label for="form-message" class="block text-[13px] font-semibold mb-1.5" style="color:#cbd5e1;">Message</label>
          <textarea id="form-message" name="message" rows="3" placeholder="Tell us about your issue..." class="w-full px-4 py-2.5 rounded-lg outline-none transition-all resize-none text-[14px]" style="border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:#e2e8f0;"></textarea>
        </div>
        <button type="submit" class="w-full bg-orange hover:bg-orange-dark text-white font-display font-bold py-3.5 rounded-lg text-[15px] transition-all" style="box-shadow:0 2px 12px rgba(27,95,168,0.2);">
          Request Free Quote
        </button>
      </form>
    </div>
  </div>
  <footer style="background:#0a0f1c;">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
        <div>
          <div class="flex items-center gap-2.5 mb-4">
            <div class="w-7 h-7 bg-orange rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <span class="font-display font-bold text-[17px] text-white">${biz}<span class="text-orange font-black">.</span></span>
          </div>
          <p style="color:#546380;" class="text-[13px] mb-2 font-medium">Fast. Reliable. Guaranteed.</p>
          <p style="color:#3d4b63;" class="text-[13px] leading-relaxed">Your trusted ${nicheLabel.toLowerCase()} partner in ${escHtml(cityState)}.</p>
        </div>
        <div>
          <h4 class="font-display font-semibold text-white text-[13px] mb-4 uppercase tracking-wider">Quick Links</h4>
          <ul class="space-y-2">
            <li><a href="#home" style="color:#546380;" class="hover:text-white transition-colors text-[13px]">Home</a></li>
            <li><a href="#services" style="color:#546380;" class="hover:text-white transition-colors text-[13px]">Services</a></li>
            <li><a href="#faq" style="color:#546380;" class="hover:text-white transition-colors text-[13px]">FAQ</a></li>
            <li><a href="#contact" style="color:#546380;" class="hover:text-white transition-colors text-[13px]">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-display font-semibold text-white text-[13px] mb-4 uppercase tracking-wider">Contact Info</h4>
          <ul class="space-y-3">
            <li class="flex items-center gap-2 text-[13px]" style="color:#546380;">
              <svg class="w-4 h-4 flex-shrink-0" style="color:#3d6da8;" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
              <a href="#contact" class="hover:text-white transition-colors">${phone}</a>
            </li>
            <li class="flex items-center gap-2 text-[13px]" style="color:#546380;">
              <svg class="w-4 h-4 flex-shrink-0" style="color:#3d6da8;" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              24/7 Emergency &bull; Office: Mon-Sat 7am-10pm
            </li>
          </ul>
        </div>
      </div>
      <div class="mt-10 pt-7 text-center" style="border-top:1px solid rgba(255,255,255,0.05);">
        <p style="color:#3d4b63;" class="text-[12px]">&copy; 2026 ${biz}. All rights reserved. Licensed &amp; Insured.</p>
      </div>
    </div>
  </footer>
</section>

<!-- Toast -->
<div id="toast" class="toast fixed bottom-6 right-6 text-white px-5 py-3.5 rounded-lg z-50 flex items-center gap-2.5" style="background:#0a0f1c; box-shadow:0 8px 30px rgba(0,0,0,.2);">
  <svg class="w-5 h-5 flex-shrink-0" style="color:#10b981;" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
  <span class="font-semibold text-[14px]">Thanks! We'll call you within 15 minutes.</span>
</div>

<!-- Live Booking Notification -->
<div id="latchly-live-notif" style="position:fixed; bottom:24px; left:24px; z-index:8888; background:#fff; border:1px solid #eef1f6; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,.08); padding:12px 14px; display:flex; align-items:center; gap:10px; max-width:280px; font-family:'DM Sans',sans-serif; transform:translateY(120%); opacity:0; transition:transform .4s cubic-bezier(.34,1.56,.64,1), opacity .3s ease;">
  <div id="lln-avatar" style="width:34px; height:34px; border-radius:50%; flex-shrink:0; background:${c.headGradient}; display:flex; align-items:center; justify-content:center; font-family:'Outfit',sans-serif; font-weight:700; font-size:13px; color:#fff;">J</div>
  <div style="min-width:0;">
    <div style="font-size:11.5px; font-weight:600; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" id="lln-name">Loading...</div>
    <div style="font-size:10.5px; color:#94a3b8; margin-top:1px;" id="lln-meta">via Latchly &middot; ${city} &middot; just now</div>
  </div>
  <div style="flex-shrink:0; width:6px; height:6px; background:#10b981; border-radius:50%;"></div>
</div>

<script>
(function() {
  var BOOKINGS = ${buildBookingsArray(template.bookings)};
  var CITY = ${JSON.stringify(lead.city || 'Your City')};
  var el = document.getElementById('latchly-live-notif');
  var avatar = document.getElementById('lln-avatar');
  var name = document.getElementById('lln-name');
  var meta = document.getElementById('lln-meta');
  var idx = 0;
  function showNotif() {
    var b = BOOKINGS[idx % BOOKINGS.length]; idx++;
    avatar.textContent = b.name.charAt(0);
    name.textContent = b.name + ' ' + b.action;
    meta.textContent = 'via Latchly \\u00b7 ' + CITY + ' \\u00b7 ' + b.time;
    el.style.transform = 'translateY(0)'; el.style.opacity = '1';
    setTimeout(function() { el.style.transform = 'translateY(120%)'; el.style.opacity = '0'; }, 4500);
  }
  setTimeout(function() { showNotif(); setInterval(showNotif, 10000); }, 4000);
})();
</script>

<script>
(function() {
  'use strict';
  var navbar = document.getElementById('navbar');
  window.addEventListener('scroll', function() { navbar.classList.toggle('nav-scrolled', window.scrollY > 50); });

  // Mobile menu
  var mobileToggle = document.getElementById('mobile-toggle');
  var mobileMenu = document.getElementById('mobile-menu');
  var mobileClose = document.getElementById('mobile-close');
  var hamburgerIcon = document.getElementById('hamburger-icon');
  var closeIcon = document.getElementById('close-icon');
  var mobileOverlay = document.getElementById('mobile-overlay');
  function openMenu() { mobileMenu.classList.add('open'); mobileOverlay.classList.remove('hidden'); hamburgerIcon.classList.add('hidden'); closeIcon.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeMenu() { mobileMenu.classList.remove('open'); mobileOverlay.classList.add('hidden'); hamburgerIcon.classList.remove('hidden'); closeIcon.classList.add('hidden'); document.body.style.overflow = ''; }
  mobileToggle.addEventListener('click', openMenu);
  mobileClose.addEventListener('click', closeMenu);
  mobileOverlay.addEventListener('click', closeMenu);
  document.querySelectorAll('.mobile-link').forEach(function(l) { l.addEventListener('click', closeMenu); });

  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(function(a) {
    a.addEventListener('click', function(e) {
      var t = document.querySelector(this.getAttribute('href'));
      if (t) { e.preventDefault(); window.scrollTo({ top: t.getBoundingClientRect().top + window.pageYOffset - 80, behavior: 'smooth' }); }
    });
  });

  // Reveal
  var ro = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) { if (e.isIntersecting) { e.target.classList.add('active'); ro.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.reveal').forEach(function(el) { ro.observe(el); });

  // FAQ
  document.querySelectorAll('.faq-toggle').forEach(function(toggle) {
    toggle.addEventListener('click', function() {
      var answer = this.nextElementSibling; var icon = this.querySelector('.faq-icon'); var isOpen = answer.classList.contains('open');
      document.querySelectorAll('.faq-answer').forEach(function(a) { a.classList.remove('open'); });
      document.querySelectorAll('.faq-icon').forEach(function(i) { i.classList.remove('rotated'); });
      if (!isOpen) { answer.classList.add('open'); icon.classList.add('rotated'); }
    });
  });

  // Open status
  var hour = new Date().getHours();
  var openText = document.getElementById('open-text');
  openText.textContent = (hour >= 7 && hour < 22) ? "We're Open Now" : "24/7 Emergency Line Open";

  // Form toast
  var form = document.getElementById('contact-form');
  var toast = document.getElementById('toast');
  form.addEventListener('submit', function(e) {
    e.preventDefault(); toast.classList.add('show'); form.reset();
    setTimeout(function() { toast.classList.remove('show'); }, 4000);
  });
})();
</script>

<!-- ===== LATCHLY AI CHAT WIDGET ===== -->
<div id="lw">
  <div id="lw-nudge">
    <button id="lw-nudge-x" aria-label="Dismiss">&times;</button>
    <p>Hi! Need help? I can answer questions about <b>${biz}</b> 24/7</p>
  </div>
  <div id="lw-panel">
    <div id="lw-head">
      <div id="lw-head-emoji">${escHtml(template.emoji)}</div>
      <div id="lw-head-info">
        <p id="lw-head-name">${biz}</p>
        <p id="lw-head-status"><span class="dot"></span> Online now &middot; Replies instantly</p>
      </div>
      <button id="lw-close" aria-label="Close chat">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="lw-phase active" id="lw-phase-chat">
      <div id="lw-messages"></div>
      <div id="lw-quick"></div>
      <div id="lw-inputbar">
        <input id="lw-input" type="text" placeholder="Type your message..." autocomplete="off">
        <button id="lw-send" aria-label="Send"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg></button>
      </div>
      <div id="lw-end"><button id="lw-end-btn">End conversation</button></div>
    </div>
    <div class="lw-phase" id="lw-phase-rating">
      <div id="lw-rating-body">
        <div class="emoji">&#128172;</div>
        <h3>How was your experience?</h3>
        <p class="sub">Your feedback helps us improve</p>
        <div id="lw-stars"></div>
        <button class="lw-btn" id="lw-rating-next" disabled style="width:auto;padding:12px 32px;">Continue</button>
        <button class="lw-back-btn" id="lw-rating-back">&#8592; Back to chat</button>
      </div>
    </div>
    <div class="lw-phase" id="lw-phase-lead">
      <div id="lw-lead-body">
        <h3>Stay connected!</h3>
        <p class="sub" id="lw-lead-sub">Leave your info and we'll follow up personally.</p>
        <div class="lw-field"><label>Full Name *</label><input type="text" id="lw-lead-name" placeholder="John Smith"></div>
        <div class="lw-field"><label>Phone Number *</label><input type="tel" id="lw-lead-phone" placeholder="(555) 123-4567"></div>
        <div class="lw-field"><label>Email (optional)</label><input type="email" id="lw-lead-email" placeholder="john@email.com"></div>
        <button class="lw-btn" id="lw-lead-submit">Submit</button>
        <button class="lw-back-btn" id="lw-lead-back">&#8592; Back</button>
      </div>
    </div>
    <div class="lw-phase" id="lw-phase-complete">
      <div id="lw-complete-body">
        <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <h3>You're all set!</h3>
        <p>Thanks for reaching out. Our team will be in touch shortly to confirm everything.</p>
      </div>
    </div>
    <div id="lw-footer">Powered by <a href="https://latchlyai.com">Latchly</a></div>
  </div>
  <button id="lw-fab" aria-label="Open chat">
    <svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z"/></svg>
    <span id="lw-fab-badge">1</span>
  </button>
</div>

<script>
(function(){
  var BIZ_NAME = ${JSON.stringify(lead.business_name)};
  var BIZ_PHONE = ${JSON.stringify(lead.phone || '(555) 000-0000')};
  var BIZ_SERVICES = ${JSON.stringify(template.serviceOptions.join(', '))};
  var QUICK_REPLIES = ${JSON.stringify(template.quickReplies)};
  var BOOKING_KEYWORDS = ['book','schedule','appointment','set up a time','available times','reserve','when can'];

  var isOpen = false, messages = [], isTyping = false, nudgeDismissed = false;
  var fab = document.getElementById('lw-fab'), badge = document.getElementById('lw-fab-badge');
  var panel = document.getElementById('lw-panel'), closeBtn = document.getElementById('lw-close');
  var nudge = document.getElementById('lw-nudge'), nudgeX = document.getElementById('lw-nudge-x');
  var msgArea = document.getElementById('lw-messages'), quickDiv = document.getElementById('lw-quick');
  var input = document.getElementById('lw-input'), sendBtn = document.getElementById('lw-send');
  var endBtn = document.getElementById('lw-end-btn');

  function escH(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>'); }
  function addMsg(role, text) {
    messages.push({ role: role, text: text });
    var w = document.createElement('div'); w.className = 'lw-msg lw-msg-' + role;
    w.innerHTML = role === 'bot' ? '<div class="lw-msg-avatar">${escHtml(template.emoji)}</div><div class="lw-msg-text">' + escH(text) + '</div>' : '<div class="lw-msg-text">' + escH(text) + '</div>';
    msgArea.appendChild(w); msgArea.scrollTop = msgArea.scrollHeight;
  }
  function showTyping() { isTyping = true; sendBtn.disabled = true; var el = document.createElement('div'); el.className = 'lw-msg lw-msg-bot'; el.id = 'lw-typing-indicator'; el.innerHTML = '<div class="lw-msg-avatar">${escHtml(template.emoji)}</div><div class="lw-msg-text lw-typing"><span></span><span></span><span></span></div>'; msgArea.appendChild(el); msgArea.scrollTop = msgArea.scrollHeight; }
  function hideTyping() { isTyping = false; sendBtn.disabled = false; var el = document.getElementById('lw-typing-indicator'); if (el) el.remove(); }
  function setPhase(p) { document.querySelectorAll('.lw-phase').forEach(function(ph) { ph.classList.remove('active'); }); document.getElementById('lw-phase-' + p).classList.add('active'); }
  function renderQR() { quickDiv.innerHTML = ''; QUICK_REPLIES.forEach(function(q) { var b = document.createElement('button'); b.className = 'lw-qr'; b.textContent = q; b.addEventListener('click', function() { handleMsg(q); }); quickDiv.appendChild(b); }); }
  function hideQR() { quickDiv.innerHTML = ''; }

  async function getAI(text) {
    try {
      var r = await fetch('/api/chat', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ messages: messages, businessInfo: { name: BIZ_NAME, phone: BIZ_PHONE, pricing: 'Service Call: $89, Full Repair: starting at $249', hours: 'Mon-Sat 7am-10pm, 24/7 Emergency', pricing: BIZ_SERVICES } }) });
      var d = await r.json(); return d.text || d.reply;
    } catch(e) { return "Sorry, I'm having a moment! Call us at " + BIZ_PHONE; }
  }

  function handleMsg(text) {
    if (!text.trim() || isTyping) return;
    addMsg('user', text.trim()); input.value = ''; hideQR();
    showTyping();
    getAI(text).then(function(resp) { hideTyping(); addMsg('bot', resp); setTimeout(renderQR, 300); });
  }

  function openChat() {
    isOpen = true; panel.classList.add('open'); fab.style.display = 'none'; nudge.classList.remove('show');
    if (messages.length === 0) { setTimeout(function() { addMsg('bot', "Hi there! Welcome to " + BIZ_NAME + ". I can answer questions, get you a quote, and help you book a service. How can I help?"); renderQR(); }, 400); }
    setTimeout(function() { input.focus(); }, 500);
  }
  function closeChat() { isOpen = false; panel.classList.remove('open'); fab.style.display = 'flex'; }

  fab.addEventListener('click', openChat);
  closeBtn.addEventListener('click', closeChat);
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter') handleMsg(input.value); });
  sendBtn.addEventListener('click', function() { handleMsg(input.value); });

  // Rating + lead capture
  endBtn.addEventListener('click', function() { setPhase('rating'); renderStars(); });
  document.getElementById('lw-rating-back').addEventListener('click', function() { setPhase('chat'); renderQR(); });
  document.getElementById('lw-lead-back').addEventListener('click', function() { setPhase('rating'); });

  function renderStars() {
    var c = document.getElementById('lw-stars'); c.innerHTML = '';
    for (var i = 1; i <= 5; i++) {
      (function(v) {
        var b = document.createElement('button');
        b.innerHTML = '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>';
        b.addEventListener('click', function() { c.querySelectorAll('button').forEach(function(x, idx) { x.classList.toggle('active', idx < v); }); document.getElementById('lw-rating-next').disabled = false; });
        c.appendChild(b);
      })(i);
    }
  }
  document.getElementById('lw-rating-next').addEventListener('click', function() { setPhase('lead'); });
  document.getElementById('lw-lead-submit').addEventListener('click', function() {
    var n = document.getElementById('lw-lead-name').value.trim();
    var p = document.getElementById('lw-lead-phone').value.trim();
    if (!n || !p) return;
    this.textContent = 'Submitting...'; this.disabled = true;
    setTimeout(function() { setPhase('complete'); }, 800);
  });

  // Nudge
  function dismissNudge() { nudge.classList.remove('show'); nudgeDismissed = true; }
  nudgeX.addEventListener('click', function(e) { e.stopPropagation(); dismissNudge(); });
  nudge.addEventListener('click', function() { dismissNudge(); openChat(); });
  setTimeout(function() { if (!isOpen && !nudgeDismissed) nudge.classList.add('show'); }, 5000);
  setTimeout(function() { if (!isOpen && !nudgeDismissed) dismissNudge(); }, 11000);
})();
</script>
</body>
</html>`;

  // ── Apply color scheme globally via string replacement ──
  // Replace the default ocean-blue palette with this lead's assigned colors
  let html = rawHtml;
  if (c.name !== 'ocean') {
    const replacements = [
      ['#1B5FA8', c.primary],
      ['#134780', c.primaryDark],
      ['#5b9bd5', c.accent],
      ['#7ab3e0', c.accentLight],
      ['#93b4d9', c.accentMuted],
      ['#5a8ec4', c.accent],
      ['#3d6da8', c.primary],
      ['rgba(27,95,168,', `rgba(${parseInt(c.primary.slice(1,3),16)},${parseInt(c.primary.slice(3,5),16)},${parseInt(c.primary.slice(5,7),16)},`],
    ];
    for (const [from, to] of replacements) {
      html = html.split(from).join(to);
    }
    // Replace background colors
    html = html.split('#0a0f1c').join(c.bodyBg);
    html = html.split('#0f1628').join(c.sectionBg1);
    html = html.split('#111827').join(c.sectionBg2);
    html = html.split('#0d1425').join(c.sectionBg3);
    html = html.split('#d4a843').join(c.starColor);
  }
  return html;
}

async function persistDemoToDb(lead, html) {
  if (!process.env.DATABASE_URL) {
    return { ok: false, reason: 'no_database_url' };
  }

  try {
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);

    let rows = [];
    if (lead.id) {
      rows = await sql`
        UPDATE prospects
        SET demo_slug = ${lead.demo_slug},
            demo_url = ${lead.demo_url},
            demo_html = ${html},
            demo_persisted_at = NOW(),
            updated_at = NOW()
        WHERE id = ${lead.id}
        RETURNING id
      `;
    }

    if (rows.length === 0) {
      rows = await sql`
        UPDATE prospects
        SET demo_slug = ${lead.demo_slug},
            demo_url = ${lead.demo_url},
            demo_html = ${html},
            demo_persisted_at = NOW(),
            updated_at = NOW()
        WHERE business_name = ${lead.business_name}
          AND COALESCE(city, '') = ${lead.city || ''}
          AND COALESCE(state, '') = ${lead.state || ''}
        RETURNING id
      `;
    }

    if (rows.length === 0) {
      return { ok: false, reason: 'no_matching_prospect' };
    }

    return { ok: true, count: rows.length };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const inputFile = process.argv.includes('--input')
    ? process.argv[process.argv.indexOf('--input') + 1]
    : path.join(ROOT, 'leads', 'openclaw', 'audited.json');

  if (!fs.existsSync(inputFile)) {
    log.error('input_not_found', { file: inputFile, detail: 'Run openclaw-audit.js first' });
    process.exit(1);
  }

  const leads = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  log.startRun({ count: leads.length, dry_run: DRY_RUN });

  if (!fs.existsSync(DEMOS_DIR)) fs.mkdirSync(DEMOS_DIR, { recursive: true });

  let built = 0;
  let personalized = 0;
  const results = [];

  for (const lead of leads) {
    if (!lead.business_name) {
      log.warn('skipped_no_name', { lead_id: lead.id || null });
      continue;
    }

    const slug = lead.demo_slug || makeSlug(lead.business_name, lead.city, lead.state);
    lead.demo_slug = slug;
    lead.demo_url = `${SITE_BASE}/demo/${slug}`;

    let template = loadTemplate(lead.niche || '');
    if (!template) {
      log.warn('skipped_unsupported_niche', { business: lead.business_name, niche: lead.niche });
      continue;
    }

    // Scrape their actual site and merge real content into template
    const scraped = await scrapeSiteContent(lead.website);
    if (scraped) {
      template = mergeScrapedContent(template, scraped, lead);
    }

    const html = generateDemo(lead, template);
    const outPath = path.join(DEMOS_DIR, `${slug}.html`);

    // Track which variant was generated
    lead.demo_variant = scraped ? 'tailored' : (lead.report_card?.issues || []).length > 0 ? 'personalized' : 'generic';
    if (lead.demo_variant === 'tailored' || lead.demo_variant === 'personalized') personalized++;

    if (DRY_RUN) {
      lead.demo_persisted = false;
      lead.demo_persist_reason = 'dry_run';
      log.lead('dry_run_build', lead, { slug, variant: lead.demo_variant });
    } else {
      fs.writeFileSync(outPath, html, 'utf8');
      const persisted = await persistDemoToDb(lead, html);
      lead.demo_persisted = persisted.ok;
      lead.demo_persist_reason = persisted.ok ? 'db' : persisted.reason;
      log.lead('built', lead, { slug, variant: lead.demo_variant, persisted: persisted.ok, reason: lead.demo_persist_reason });
    }

    results.push({ slug, demo_url: lead.demo_url, business_name: lead.business_name, variant: lead.demo_variant, persisted: !!lead.demo_persisted });
    built++;

    // Rate limit between demo builds (site scraping)
    await new Promise(r => setTimeout(r, 500));
  }

  // Update audited.json with demo URLs
  if (!DRY_RUN) {
    fs.writeFileSync(inputFile, JSON.stringify(leads, null, 2), 'utf8');
  }

  // Write manifest for quick reference
  if (!DRY_RUN && results.length > 0) {
    const manifestPath = path.join(ROOT, 'leads', 'openclaw', 'demo-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(results, null, 2), 'utf8');
  }

  log.endRun({ built, personalized, generic: built - personalized });
  return results;
}

// Allow require() for pipeline use
module.exports = { main, makeSlug, generateDemo, loadTemplate, scrapeSiteContent, mergeScrapedContent };

if (require.main === module) {
  main().catch(err => { log.catch('fatal', err); process.exit(1); });
}
