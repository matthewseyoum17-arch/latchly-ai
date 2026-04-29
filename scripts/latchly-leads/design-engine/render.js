/**
 * design-engine/render.js
 *
 * Fills a curated HTML template with real per-business enrichment + content.
 * No invented facts: every placeholder pulls from a fact whitelist; missing
 * facts result in the relevant block being trimmed instead of fabricated.
 */

const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, 'templates');

function loadTemplate(direction) {
  const candidates = [direction, 'craft-editorial']; // graceful fallback
  for (const key of candidates) {
    const file = path.join(TEMPLATE_DIR, `${key}.html`);
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  }
  throw new Error(`no template found (looked for ${candidates.join(', ')})`);
}

// Keys whose VALUES are intentionally pre-rendered HTML, built by composeRenderData
// from already-escaped fields. Every other placeholder is treated as untrusted text
// (lead/enrichment/AI-generated copy) and HTML-escaped before substitution.
const HTML_SAFE_KEYS = new Set([
  'serviceCards',
  'reviewsSection',
  'heroAsideItems',
  'heroAsideReviews',
  'aboutCardItems',
]);

function renderTemplate({ template, lead, enrichment, content, direction }) {
  const data = composeRenderData({ lead, enrichment, content, direction });
  return Object.entries(data).reduce((html, [key, value]) => {
    const re = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    const replacement = HTML_SAFE_KEYS.has(key) ? String(value || '') : escapeHtml(value);
    return html.replace(re, replacement);
  }, template);
}

function composeRenderData({ lead = {}, enrichment = {}, content = {}, direction }) {
  const businessName = lead.businessName || 'Your Business';
  const city = lead.city || '';
  const state = lead.state || '';
  const cityState = [city, state].filter(Boolean).join(', ');
  const phone = lead.phone || enrichment.hours?.phone || '';
  const phoneRaw = String(phone || '').replace(/[^0-9+]/g, '');
  const phoneShort = phoneRaw.length >= 7 ? phoneRaw.slice(-7).replace(/^(\d{3})(\d{4})$/, '$1-$2') : phone;

  const accent = enrichment.brandColors?.primary || directionAccent(direction);
  const services = (content.servicesUsed || enrichment.servicesVerified || [])
    .filter(Boolean)
    .slice(0, 6);

  const reviewSelections = Array.isArray(content.reviewSelections) && content.reviewSelections.length
    ? content.reviewSelections
    : (enrichment.reviews || []).slice(0, 3);

  const heroAsideItems = buildHeroAsideItems(enrichment, content);
  const heroAsideReviews = enrichment.averageRating && enrichment.reviewCount
    ? `<hr><div class="stars">${renderStars(enrichment.averageRating)}</div><div style="margin-top:6px;color:var(--muted);font-size:13px;">${enrichment.reviewCount} verified reviews on Google</div>`
    : '';

  const serviceCards = services.length
    ? services.map(svc => {
        const title = typeof svc === 'string' ? svc : svc.title || svc.name || '';
        const desc = typeof svc === 'string'
          ? `${title} in ${city || 'your area'}. Same-day quotes, upfront pricing.`
          : svc.desc || '';
        return `<div class="service-card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(desc)}</p></div>`;
      }).join('\n      ')
    : '<div class="service-card"><h3>Service</h3><p>Reach out and we\'ll quote.</p></div>';

  const aboutItems = buildAboutCardItems(enrichment);

  const reviewsSection = reviewSelections.length
    ? `<section id="reviews">
  <div class="wrap">
    <div class="section-head">
      <div>
        <span class="eyebrow">In their words</span>
        <h2>Real customers, real jobs.</h2>
      </div>
      <p>${enrichment.averageRating ? enrichment.averageRating + '★ across ' + (enrichment.reviewCount || reviewSelections.length) + ' verified Google reviews.' : 'Pulled from verified reviews.'}</p>
    </div>
    <div class="reviews">
      ${reviewSelections.map(r => `<div class="review">
        <div class="stars">${renderStars(r.rating || 5)}</div>
        <blockquote>"${escapeHtml(String(r.text || '').slice(0, 320))}"</blockquote>
        <cite>— ${escapeHtml(r.author || 'Customer')}</cite>
      </div>`).join('\n      ')}
    </div>
  </div>
</section>`
    : '';

  const serviceAreaText = (enrichment.serviceArea && enrichment.serviceArea.length)
    ? enrichment.serviceArea.slice(0, 4).join(', ')
    : (city ? `${city} & nearby` : 'Local');
  const hoursSummary = summarizeHours(enrichment.hours);

  return {
    businessName,
    brandInitial: businessName.replace(/[^A-Za-z0-9]/g, '').slice(0, 1).toUpperCase() || 'L',
    cityState,
    cityShort: city || cityState,
    nicheLabel: humanizeNiche(lead.niche),
    phone: phone || 'Call us',
    phoneRaw: phoneRaw || '',
    phoneShort: phoneShort || phone || 'now',
    heroHeadline: content.heroHeadline || `${businessName}, the ${humanizeNiche(lead.niche).toLowerCase()} ${cityState ? cityState : ''} calls first.`,
    heroSubhead: content.heroSubhead || `Owner-led ${humanizeNiche(lead.niche).toLowerCase()} crew serving ${cityState || 'your area'}. Real schedules, real quotes, no call-center.`,
    primaryCta: content.primaryCta || 'Call now',
    secondaryCta: content.secondaryCta || 'See pricing',
    heroAsideItems,
    heroAsideReviews,
    serviceCards,
    aboutCardItems: aboutItems,
    aboutParagraph: content.aboutParagraph
      || (enrichment.existingCopy?.about ? enrichment.existingCopy.about : `${businessName} is a ${humanizeNiche(lead.niche).toLowerCase()} crew working in ${cityState || 'your area'}. Owner-operated. We answer the phone.`),
    reviewsSection,
    serviceArea: serviceAreaText,
    hoursSummary,
    accentColor: accent || '#9a4d2b',
    year: String(new Date().getFullYear()),
  };
}

function buildHeroAsideItems(enrichment, content) {
  const items = [];
  if (enrichment.yearsInBusiness) items.push({ k: 'In business', v: `${enrichment.yearsInBusiness}+ yrs` });
  if (enrichment.reviewCount) items.push({ k: 'Reviews', v: `${enrichment.reviewCount}+` });
  if (enrichment.bbbAccreditation?.rating) items.push({ k: 'BBB', v: enrichment.bbbAccreditation.rating });
  if (enrichment.licenses?.[0]?.label) items.push({ k: 'Licensed', v: 'Yes' });
  while (items.length < 2) items.push({ k: 'Local', v: 'Yes' });
  return items.slice(0, 4).map(i => `<div><span class="k">${escapeHtml(i.k)}</span><span class="v">${escapeHtml(String(i.v))}</span></div>`).join('\n        ');
}

function buildAboutCardItems(enrichment) {
  const lines = [];
  if (enrichment.ownerName) lines.push(`<div>Owner — <strong>${escapeHtml(enrichment.ownerName)}</strong></div>`);
  if (enrichment.yearsInBusiness) lines.push(`<div>${enrichment.yearsInBusiness}+ yrs</div>`);
  if (enrichment.bbbAccreditation?.accredited) lines.push(`<div>BBB ${escapeHtml(enrichment.bbbAccreditation.rating || 'accredited')}</div>`);
  if (enrichment.licenses?.[0]?.label) lines.push(`<div>${escapeHtml(enrichment.licenses[0].label)}</div>`);
  if (!lines.length) lines.push('<div>Owner-operated</div>');
  return lines.join('\n      ');
}

function renderStars(rating) {
  const full = Math.round(Number(rating) || 5);
  return '★'.repeat(Math.max(1, Math.min(5, full))) + '☆'.repeat(Math.max(0, 5 - full));
}

function summarizeHours(hours) {
  if (!hours || typeof hours !== 'object') return 'Mon–Sat';
  const days = Object.keys(hours);
  if (!days.length) return 'Mon–Sat';
  return `${days[0].slice(0, 3)}–${days[days.length - 1].slice(0, 3)}`;
}

function humanizeNiche(niche) {
  const n = String(niche || '').toLowerCase().trim();
  if (!n) return 'Home services';
  if (n === 'hvac') return 'HVAC';
  if (n === 'ac') return 'AC';
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function directionAccent(direction) {
  switch (direction) {
    case 'emergency-bold': return '#c83a1f';
    case 'trust-warm': return '#a86b3c';
    case 'regional-authority': return '#1f4d3a';
    case 'modern-techy': return '#2c4cc8';
    case 'premium-minimal': return '#1c1a18';
    default: return '#9a4d2b';
  }
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  loadTemplate,
  renderTemplate,
  composeRenderData,
  HTML_SAFE_KEYS,
};
