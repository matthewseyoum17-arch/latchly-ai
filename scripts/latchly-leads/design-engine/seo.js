/**
 * design-engine/seo.js
 *
 * Builds the SEO + AEO (Answer Engine Optimization) scaffolding for a demo
 * page from real per-business enrichment. Output is a small object whose
 * fields are injected via mustache placeholders the template already lists.
 *
 * What this produces:
 *   - <head> meta block: canonical, OG, Twitter, robots, theme-color
 *   - JSON-LD graph: LocalBusiness + AggregateRating + Review[] +
 *     FAQPage + WebPage with speakable. AI Overviews / Perplexity /
 *     ChatGPT cite from these.
 *   - Static FAQ markup. Real questions answered from real facts only —
 *     no inventing.
 *
 * Boundary: every value that lands inside JSON gets escaped via
 * jsonLdSafe (drops  /  + escapes </ to break <script>).
 * Every value that lands inside HTML gets escaped via htmlEscape.
 */

const NICHE_TO_BUSINESS_TYPE = {
  plumbing: 'Plumber',
  plumber: 'Plumber',
  hvac: 'HVACBusiness',
  ac: 'HVACBusiness',
  heating: 'HVACBusiness',
  roofing: 'RoofingContractor',
  roofer: 'RoofingContractor',
  electrician: 'Electrician',
  electrical: 'Electrician',
  contractor: 'GeneralContractor',
  remodeling: 'GeneralContractor',
};

function buildSeo({ lead = {}, enrichment = {}, content = {}, slug, siteBase } = {}) {
  const businessName = lead.businessName || 'Local home services';
  const city = lead.city || '';
  const state = lead.state || '';
  const cityState = [city, state].filter(Boolean).join(', ');
  const phone = lead.phone || null;
  const phoneRaw = phone ? String(phone).replace(/[^0-9+]/g, '') : null;
  const baseUrl = (siteBase || 'https://latchlyai.com').replace(/\/+$/, '');
  const canonical = `${baseUrl}/demo/${slug}`;

  // Photo priority: scraped existing-site image (souped-up leads) >
  // first stock photo (fresh-build leads) > fallback default. Google
  // Places photos are intentionally not used here — see enrichment.js.
  const heroPhoto = pickHeroPhoto({ enrichment, content });
  const ogImage = heroPhoto?.url || `${baseUrl}/og-default.png`;
  const ogImageWidth = heroPhoto?.width || 1600;
  const ogImageHeight = heroPhoto?.height || 900;

  const schemaType = NICHE_TO_BUSINESS_TYPE[String(lead.niche || '').toLowerCase()] || 'LocalBusiness';
  const description = content.heroSubhead
    || (cityState
        ? `${businessName}: owner-led ${humanizeNiche(lead.niche)} in ${cityState}.`
        : `${businessName}: owner-led ${humanizeNiche(lead.niche)} you can actually reach.`);
  const titleTag = cityState
    ? `${businessName} — ${humanizeNiche(lead.niche)} in ${cityState}`
    : `${businessName} — ${humanizeNiche(lead.niche)}`;

  const faqs = buildFaqs({ businessName, cityState, lead, enrichment });
  const allPhotos = collectAllPhotos({ enrichment, content });

  const jsonLd = buildJsonLd({
    schemaType, businessName, canonical, ogImage,
    description, lead, enrichment, content,
    phone, phoneRaw, faqs, allPhotos, baseUrl, cityState,
  });

  return {
    seoHead: renderHead({ titleTag, description, canonical, ogImage, ogImageWidth, ogImageHeight, businessName }),
    seoJsonLd: `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 0)}\n</script>`,
    faqSection: renderFaqSection({ faqs, businessName, cityState }),
    titleTag,
    description,
    canonical,
    heroPhoto,
  };
}

// Resolves the single best photo for hero/og:image use. Order of preference:
//   1. content.stockPhotos[0]      — set by demo-outreach-stage for fresh-build
//   2. enrichment.existingCopy.heroImageUrl — scraped from real site
//   3. enrichment.existingCopy.galleryImageUrls[0]
//   4. null  (caller falls back to og-default.png)
function pickHeroPhoto({ enrichment = {}, content = {} } = {}) {
  const stock = Array.isArray(content.stockPhotos) ? content.stockPhotos : [];
  if (stock[0]?.url) return stock[0];
  const ec = enrichment.existingCopy || {};
  if (ec.heroImageUrl) return { url: ec.heroImageUrl, width: 1600, height: 900, source: 'existing-site' };
  if (Array.isArray(ec.galleryImageUrls) && ec.galleryImageUrls[0]) {
    return { url: ec.galleryImageUrls[0], width: 1600, height: 900, source: 'existing-site' };
  }
  return null;
}

// All photos that the demo can render (and that we want indexed as
// ImageObject in the JSON-LD graph). Stock is appended after existing-site
// images so souped-up demos primarily showcase the real business.
function collectAllPhotos({ enrichment = {}, content = {} } = {}) {
  const out = [];
  const ec = enrichment.existingCopy || {};
  if (ec.heroImageUrl) out.push({ url: ec.heroImageUrl, width: 1600, height: 900, source: 'existing-site', alt: 'Hero photo' });
  for (const url of Array.isArray(ec.galleryImageUrls) ? ec.galleryImageUrls : []) {
    if (!url) continue;
    if (out.some(p => p.url === url)) continue;
    out.push({ url, width: 1600, height: 900, source: 'existing-site', alt: 'Site photo' });
  }
  for (const sp of Array.isArray(content.stockPhotos) ? content.stockPhotos : []) {
    if (!sp?.url) continue;
    if (out.some(p => p.url === sp.url)) continue;
    out.push(sp);
  }
  return out.slice(0, 8);
}

function renderHead({ titleTag, description, canonical, ogImage, ogImageWidth, ogImageHeight, businessName }) {
  // Returned as raw HTML — injected into the template via the seoHead
  // HTML_SAFE_KEY. All interpolated values are escaped here.
  return [
    `<title>${htmlEscape(titleTag)}</title>`,
    `<meta name="description" content="${htmlEscape(description)}">`,
    `<link rel="canonical" href="${htmlEscape(canonical)}">`,
    `<meta name="robots" content="index,follow,max-image-preview:large">`,
    `<meta name="theme-color" content="#14110f">`,

    // Open Graph
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${htmlEscape(titleTag)}">`,
    `<meta property="og:description" content="${htmlEscape(description)}">`,
    `<meta property="og:url" content="${htmlEscape(canonical)}">`,
    `<meta property="og:image" content="${htmlEscape(ogImage)}">`,
    `<meta property="og:image:width" content="${htmlEscape(ogImageWidth || 1600)}">`,
    `<meta property="og:image:height" content="${htmlEscape(ogImageHeight || 900)}">`,
    `<meta property="og:site_name" content="${htmlEscape(businessName)}">`,
    `<meta property="og:locale" content="en_US">`,

    // Twitter
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${htmlEscape(titleTag)}">`,
    `<meta name="twitter:description" content="${htmlEscape(description)}">`,
    `<meta name="twitter:image" content="${htmlEscape(ogImage)}">`,
  ].join('\n');
}

function buildJsonLd({ schemaType, businessName, canonical, ogImage, description, lead, enrichment, content, phone, phoneRaw, faqs = [], allPhotos = [], baseUrl, cityState }) {
  const node = {
    '@context': 'https://schema.org',
    '@graph': [],
  };

  // LocalBusiness root node
  const lb = {
    '@type': schemaType,
    '@id': `${canonical}#business`,
    name: businessName,
    description,
    url: canonical,
    image: ogImage,
  };
  if (phone) lb.telephone = phone;
  if (enrichment.formattedAddress) {
    lb.address = parsePostalAddress(enrichment.formattedAddress, lead);
  } else if (lead.city || lead.state) {
    lb.address = parsePostalAddress(null, lead);
  }
  if (enrichment.coordinates) {
    lb.geo = {
      '@type': 'GeoCoordinates',
      latitude: enrichment.coordinates.lat,
      longitude: enrichment.coordinates.lng,
    };
  }
  if (Array.isArray(enrichment.serviceArea) && enrichment.serviceArea.length) {
    lb.areaServed = enrichment.serviceArea.map(name => ({
      '@type': 'City',
      name,
    }));
  }
  if (Array.isArray(enrichment.servicesVerified) && enrichment.servicesVerified.length) {
    lb.makesOffer = enrichment.servicesVerified.slice(0, 8).map(svc => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: svc },
    }));
  }
  if (typeof enrichment.averageRating === 'number' && (enrichment.reviewCount || 0) > 0) {
    lb.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: enrichment.averageRating,
      reviewCount: enrichment.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }
  if (Array.isArray(enrichment.reviews) && enrichment.reviews.length) {
    lb.review = enrichment.reviews.slice(0, 5).map(r => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.rating || 5,
        bestRating: 5,
      },
      author: { '@type': 'Person', name: r.author || 'Customer' },
      reviewBody: String(r.text || '').slice(0, 600),
    }));
  }
  if (enrichment.hours) {
    const oh = openingHoursSpec(enrichment.hours);
    if (oh.length) lb.openingHoursSpecification = oh;
  }
  if (enrichment.googleMapsUrl) {
    lb.hasMap = enrichment.googleMapsUrl;
  }
  if (Array.isArray(enrichment.licenses) && enrichment.licenses.length) {
    lb.identifier = enrichment.licenses.slice(0, 3).map(l => ({
      '@type': 'PropertyValue',
      name: l.type || 'license',
      value: l.label || l.number || '',
    }));
  }
  node['@graph'].push(lb);

  // WebPage with speakable specification — voice assistants + AI search
  // engines use this to know which parts of the page are answer-worthy.
  // Speakable selectors expanded so AI search engines pull from the
  // services list and FAQ summaries, not just hero/heading prose.
  node['@graph'].push({
    '@type': 'WebPage',
    '@id': canonical,
    url: canonical,
    name: `${businessName} — ${lead.city || 'home services'}`,
    description,
    primaryImageOfPage: ogImage,
    about: { '@id': `${canonical}#business` },
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '.hero p', '.section-head h2', '.review blockquote', '#services li', '.faq-item summary'],
    },
  });

  // FAQPage — moved from a separate <script> at the bottom of faqSection
  // into the same @graph so AI Overviews / Perplexity see one cohesive
  // structured-data block instead of two disconnected ones.
  if (Array.isArray(faqs) && faqs.length) {
    node['@graph'].push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  // BreadcrumbList — Home → {city} services → {businessName}. Helps AI
  // search engines place the business inside a hierarchy they can cite.
  const crumbs = [{ name: 'Home', url: baseUrl || 'https://latchlyai.com' }];
  if (cityState) {
    crumbs.push({
      name: `${humanizeNiche(lead.niche)} in ${cityState}`,
      url: `${baseUrl || 'https://latchlyai.com'}/demo`,
    });
  }
  crumbs.push({ name: businessName, url: canonical });
  node['@graph'].push({
    '@type': 'BreadcrumbList',
    '@id': `${canonical}#breadcrumb`,
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  });

  // HowTo — a verified-service answer the bespoke engine can cite. Only
  // emit when the business has at least one verified service. Steps come
  // from enrichment.howToSteps if present, else 3 sensible defaults
  // anchored to the niche so we never invent details.
  const topService = (enrichment.servicesVerified || [])[0];
  if (topService) {
    const niceService = String(topService).replace(/_/g, ' ');
    const defaultSteps = [
      { name: 'Call to describe the issue', text: `Call ${businessName} and describe what you're seeing — symptoms, when it started, and where it is in the home.` },
      { name: 'On-site diagnosis', text: `${businessName} arrives in ${lead.city || 'your area'} and inspects the system to confirm the cause before doing any work.` },
      { name: 'Repair or estimate', text: `If it's a quick fix you approve on the spot, ${businessName} completes ${niceService} on the same visit. Larger jobs get a written estimate first.` },
    ];
    const steps = Array.isArray(enrichment.howToSteps) && enrichment.howToSteps.length
      ? enrichment.howToSteps
      : defaultSteps;
    node['@graph'].push({
      '@type': 'HowTo',
      '@id': `${canonical}#howto`,
      name: `How ${businessName} handles ${niceService}${cityState ? ' in ' + cityState : ''}`,
      description: `Typical ${niceService} workflow at ${businessName}.`,
      totalTime: 'PT1H',
      step: steps.slice(0, 6).map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: s.name || `Step ${i + 1}`,
        text: s.text || s.name || '',
      })),
    });
  }

  // ImageObject — caption + dims for every rendered photo so AI search
  // engines + Google Image have structured context. Only photos that
  // will actually appear on the page (collected by collectAllPhotos).
  for (const p of (allPhotos || []).slice(0, 6)) {
    if (!p?.url) continue;
    node['@graph'].push({
      '@type': 'ImageObject',
      contentUrl: p.url,
      url: p.url,
      width: p.width || 1600,
      height: p.height || 900,
      caption: p.alt || `${businessName}${cityState ? ' in ' + cityState : ''}`,
      creditText: p.attribution || (p.source === 'pexels' ? 'Pexels' : p.source === 'unsplash' ? 'Unsplash' : 'Business'),
    });
  }

  return node;
}

function parsePostalAddress(formatted, lead) {
  // Full structured PostalAddress when we have a formatted_address from Places.
  const addressLocality = lead.city || '';
  const addressRegion = lead.state || '';
  const out = {
    '@type': 'PostalAddress',
    addressCountry: 'US',
  };
  if (addressLocality) out.addressLocality = addressLocality;
  if (addressRegion) out.addressRegion = addressRegion;

  if (formatted) {
    // Try to peel off street + zip from "Street, City, ST 12345, USA"
    const parts = formatted.split(',').map(s => s.trim());
    if (parts.length >= 4) {
      // [street, city, "ST 12345", "USA"]
      out.streetAddress = parts[0];
      const stZip = parts[2].match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
      if (stZip) {
        out.addressRegion = stZip[1];
        out.postalCode = stZip[2];
      }
    } else if (parts.length === 3) {
      out.streetAddress = parts[0];
    }
  }
  return out;
}

function openingHoursSpec(hours) {
  // hours is { mon: '9 AM-5 PM', tue: '9 AM-5 PM', ... } from enrichment
  const dayMap = {
    mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
    thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
  };
  const out = [];
  for (const [k, v] of Object.entries(hours || {})) {
    const day = dayMap[String(k).toLowerCase().slice(0, 3)];
    if (!day) continue;
    const text = String(v || '').toLowerCase();
    if (!text || /closed/.test(text)) continue;
    const m = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[–\-—to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (!m) continue;
    const opens = to24h(m[1], m[2], m[3]);
    const closes = to24h(m[4], m[5], m[6]);
    if (!opens || !closes) continue;
    out.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: day,
      opens,
      closes,
    });
  }
  return out;
}

function to24h(hStr, mStr, ampm) {
  let h = Number(hStr);
  if (!Number.isFinite(h)) return null;
  const m = Number(mStr || 0) || 0;
  const isPm = String(ampm || '').toLowerCase() === 'pm';
  if (isPm && h < 12) h += 12;
  if (!isPm && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildFaqs({ businessName, cityState, lead, enrichment }) {
  // Static FAQ generated from real facts only — answer engines (AI Overviews,
  // ChatGPT, Perplexity) cite from FAQPage + Q&A patterns. No invention.
  const faqs = [];

  if (Array.isArray(enrichment.servicesVerified) && enrichment.servicesVerified.length) {
    faqs.push({
      q: `What services does ${businessName} offer${cityState ? ' in ' + cityState : ''}?`,
      a: `${businessName} offers ${joinList(enrichment.servicesVerified.slice(0, 6))}${cityState ? ' in ' + cityState : ''}.`,
    });
  }

  if (lead.phone) {
    faqs.push({
      q: `How do I contact ${businessName}?`,
      a: `Call ${businessName} at ${lead.phone}${cityState ? ' for service in ' + cityState : ''}.`,
    });
  }

  if (Array.isArray(enrichment.serviceArea) && enrichment.serviceArea.length) {
    faqs.push({
      q: `Where does ${businessName} serve?`,
      a: `${businessName} serves ${joinList(enrichment.serviceArea)}${lead.state ? ', ' + lead.state : ''}.`,
    });
  }

  if (typeof enrichment.averageRating === 'number' && enrichment.reviewCount) {
    faqs.push({
      q: `Is ${businessName} reliable?`,
      a: `${businessName} holds a ${enrichment.averageRating.toFixed(1)}-star rating across ${enrichment.reviewCount} verified Google reviews${enrichment.bbbAccreditation?.rating ? `, with a BBB ${enrichment.bbbAccreditation.rating} rating` : ''}.`,
    });
  }

  if (enrichment.yearsInBusiness) {
    faqs.push({
      q: `How long has ${businessName} been in business?`,
      a: `${businessName} has served${cityState ? ' ' + cityState : ' the area'} for ${enrichment.yearsInBusiness}+ years.`,
    });
  }

  if (Array.isArray(enrichment.licenses) && enrichment.licenses[0]?.label) {
    faqs.push({
      q: `Is ${businessName} licensed?`,
      a: `Yes — ${businessName} holds a ${enrichment.licenses[0].label}${enrichment.licenses[0].number ? ' (#' + enrichment.licenses[0].number + ')' : ''}.`,
    });
  }

  return faqs.slice(0, 6);
}

function renderFaqSection({ faqs, businessName, cityState }) {
  if (!faqs.length) return '';
  // The visible accordion. The FAQPage JSON-LD itself is now folded into
  // the main @graph (see buildJsonLd) so AI search engines see one
  // cohesive structured-data block per page instead of two siblings.
  const items = faqs.map(f => `
        <details class="faq-item">
          <summary>${htmlEscape(f.q)}</summary>
          <p>${htmlEscape(f.a)}</p>
        </details>`).join('');

  return `<section id="faq">
  <div class="wrap">
    <div class="section-head">
      <div>
        <span class="eyebrow">FAQ</span>
        <h2>What people ask about ${htmlEscape(businessName)}.</h2>
      </div>
      <p>Real answers based on what ${htmlEscape(businessName)} actually does${cityState ? ', in ' + htmlEscape(cityState) : ''}.</p>
    </div>
    <div class="faq-list">${items}
    </div>
  </div>
</section>`;
}

function humanizeNiche(niche) {
  const n = String(niche || '').toLowerCase().trim();
  if (!n) return 'home services';
  if (n === 'hvac') return 'HVAC';
  if (n === 'ac') return 'AC repair';
  if (n === 'plumber') return 'plumbing';
  if (n === 'electrician') return 'electrical';
  if (n === 'roofer') return 'roofing';
  return n;
}

function joinList(arr) {
  const items = arr.filter(Boolean).map(s => String(s).trim());
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function htmlEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { buildSeo };
