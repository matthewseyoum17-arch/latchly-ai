/**
 * HIGH-TRUST FAMILY-OWNED AUTHORITY family
 * Warm editorial residential brand with calmer premium spacing and homeowner-first conversion.
 */
const { escHtml } = require('../shared/utils');
const { getCopy } = require('../shared/copy');
const { generateWidget } = require('../shared/widget');

const name = 'trust';
const label = 'High-Trust Family-Owned Authority';
const designProfile = {
  layout: 'warm-editorial-proof-rail',
  hero: 'copy-left-visual-stage-right',
  typography: 'fraunces+manrope',
  sectionOrder: 'utility|nav|hero-stage|standards-strip|service-ledger|founder-note|review-editorial|faq-split|contact',
  components: 'editorial-ledger|soft-proof-rail|featured-review|quiet-cta-rails|paper-panels',
  personality: 'warm-residential-neighborly-premium',
  ctaStrategy: 'call-or-request-callback',
  colorScheme: 'bone-ink-sage-amber',
  density: 'airy-but-grounded',
  navStyle: 'quiet-premium-local-nav',
};

const heroImages = {
  hvac: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=900&q=80',
  plumbing: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=900&q=80',
  roofing: 'https://images.unsplash.com/photo-1632759145351-1d592919f522?w=900&q=80',
};

module.exports = {
  name,
  label,
  designProfile,

  generate(lead, niche) {
    const c = getCopy('trust', niche, lead);
    const biz = escHtml(lead.business_name);
    const phone = escHtml(lead.phone || '(555) 000-0000');
    const phoneHref = (lead.phone || '5550000000').replace(/[^0-9+]/g, '');
    const email = escHtml(lead.email || '');
    const city = escHtml(lead.city || 'Your City');
    const state = escHtml(lead.state || '');
    const heroImg = heroImages[niche] || heroImages.hvac;

    const widgetHtml = generateWidget(lead, {
      emoji: c.emoji,
      headBg: 'linear-gradient(135deg, #2F261E, #3E3024)',
      avatarBg: 'linear-gradient(135deg, #355D54, #274940)',
      fabBg: '#355D54',
      fabRadius: '18px',
      fabSize: '56px',
      panelRadius: '18px',
      bodyFont: "'Manrope', sans-serif",
      headingFont: "'Fraunces', serif",
      userMsgBg: '#355D54',
      sendBg: '#355D54',
      sendHoverBg: '#274940',
      linkColor: '#355D54',
      inputFocusBorder: '#355D54',
      inputFocusRing: 'rgba(53, 93, 84, 0.12)',
      qrBorder: 'rgba(53, 93, 84, 0.24)',
      qrColor: '#355D54',
      qrBg: 'rgba(53, 93, 84, 0.05)',
      qrHoverBg: '#355D54',
      qrRadius: '16px',
      inputRadius: '14px',
      msgBotRadius: '6px 18px 18px 18px',
      msgUserRadius: '18px 18px 6px 18px',
      chatBg: '#FBF7F0',
      fabShadow: '0 10px 24px rgba(53, 93, 84, 0.28)',
    }, c.quickReplies, c.serviceOptions);

    const trustSignals = [
      { label: 'Family-owned service', value: `${escHtml(c.stats.years)}+ years`, note: 'Built on reputation, not volume tactics.' },
      { label: 'Customer rating', value: `${escHtml(c.stats.rating)}★ average`, note: 'Homeowners come back and recommend the team.' },
      { label: 'Typical response', value: `${escHtml(c.stats.avgResponse)} min`, note: 'Fast follow-up without the pushy feel.' },
      { label: 'Homes helped', value: `${escHtml(c.stats.jobs)}+ jobs`, note: 'Enough experience to feel established and safe.' },
    ];

    const standardsHtml = trustSignals.map((item, i) => `
      <div class="reveal ${i !== 3 ? 'lg:border-r lg:border-stone-200' : ''} lg:pr-8 ${i > 0 ? 'lg:pl-8' : ''}">
        <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400 mb-2">${item.label}</p>
        <p class="font-heading text-3xl font-semibold text-ink mb-2">${item.value}</p>
        <p class="text-sm leading-6 text-stone-600">${item.note}</p>
      </div>`).join('');

    const serviceLedger = c.services.slice(0, 4).map((service, i) => {
      const detailSets = [
        ['Upfront pricing', 'Respectful in-home service', 'Clear next steps'],
        ['Licensed & insured', 'Careful diagnosis', 'Long-term fixes'],
        ['Fast scheduling', 'Phone-first support', 'Warranty-backed work'],
        ['Trusted technicians', 'Clean work area', 'Transparent recommendations'],
      ];
      const details = detailSets[i % detailSets.length];
      return `
        <article class="reveal border-b border-stone-200 py-8 md:py-10">
          <div class="grid gap-6 lg:grid-cols-[110px_minmax(0,0.9fr)_minmax(0,1.1fr)] items-start">
            <div class="font-heading text-4xl md:text-5xl text-stone-300 leading-none">0${i + 1}</div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage mb-3">Residential service</p>
              <h3 class="font-heading text-3xl md:text-4xl font-semibold text-ink leading-tight">${escHtml(service.title)}</h3>
            </div>
            <div>
              <p class="text-[15px] leading-7 text-stone-600 mb-5">${escHtml(service.desc)}</p>
              <div class="flex flex-wrap gap-2 mb-5">
                ${details.map(item => `<span class="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">${escHtml(item)}</span>`).join('')}
              </div>
              <a href="#contact" class="inline-flex items-center gap-2 text-sm font-semibold text-sage hover:text-ink transition-colors">
                Request service
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3"/></svg>
              </a>
            </div>
          </div>
        </article>`;
    }).join('');

    const founderList = c.whyUs.slice(0, 4).map(item => `
      <div class="flex items-start gap-4">
        <div class="mt-1 w-8 h-8 rounded-full bg-sage/12 text-sage flex items-center justify-center text-sm font-bold">✓</div>
        <div>
          <p class="text-base font-semibold text-ink mb-1">${escHtml(item.title)}</p>
          <p class="text-sm leading-6 text-stone-600">${escHtml(item.desc)}</p>
        </div>
      </div>`).join('');

    const featuredReview = c.testimonials[0];
    const sideReviews = c.testimonials.slice(1, 3).map(review => `
      <article class="reveal rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_10px_40px_rgba(47,38,30,0.04)]">
        <div class="flex items-center gap-1 mb-4">${'<svg class="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>'.repeat(review.rating || 5)}</div>
        <p class="text-[15px] leading-7 text-stone-700 mb-5">“${escHtml(review.text)}”</p>
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="font-semibold text-ink">${escHtml(review.name)}</p>
            <p class="text-xs uppercase tracking-[0.14em] text-stone-400 mt-1">Local homeowner</p>
          </div>
          <div class="w-11 h-11 rounded-full bg-ink text-white flex items-center justify-center font-semibold">${escHtml(review.name.charAt(0).toUpperCase())}</div>
        </div>
      </article>`).join('');

    const faqHtml = c.faqs.map((faq, i) => `
      <div class="faq-item border-b border-stone-200">
        <button class="faq-toggle w-full py-5 text-left flex items-center justify-between gap-6" data-faq="${i}">
          <span class="font-heading text-xl text-ink font-medium">${escHtml(faq.q)}</span>
          <span class="faq-icon w-10 h-10 rounded-full border border-stone-200 flex items-center justify-center text-stone-500 transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </span>
        </button>
        <div class="faq-content overflow-hidden max-h-0 transition-all duration-300">
          <p class="pb-5 pr-10 text-[15px] leading-7 text-stone-600">${escHtml(faq.a)}</p>
        </div>
      </div>`).join('');

    const contactOptions = c.serviceOptions.slice(0, 6).map(opt => `<option>${escHtml(opt)}</option>`).join('');

    return `<!DOCTYPE html>
<!-- DEMO: ${biz} | Family: trust | Generated by Variation Engine -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${biz} — Trusted ${escHtml(c.nicheLabel)} in ${city}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            paper: '#FBF7F0',
            paper2: '#F4EDE1',
            ink: '#2F261E',
            sage: '#355D54',
            sand: '#B9905A',
          },
          fontFamily: {
            heading: ['Fraunces', 'serif'],
            body: ['Manrope', 'sans-serif'],
          },
        },
      },
    };
  </script>
  <style>
    html { scroll-behavior: smooth; }
    body { font-family: 'Manrope', sans-serif; background: #FBF7F0; color: #2F261E; }
    .reveal { opacity: 0; transform: translateY(24px); transition: opacity .55s ease, transform .55s ease; }
    .reveal.visible { opacity: 1; transform: translateY(0); }
    .faq-item.open .faq-content { max-height: 320px; }
    .faq-item.open .faq-icon { transform: rotate(180deg); border-color: rgba(53,93,84,.35); color: #355D54; background: rgba(53,93,84,.08); }
    .mobile-panel { transform: translateX(100%); transition: transform .28s ease; }
    .mobile-panel.open { transform: translateX(0); }
    .toast { position: fixed; top: 22px; left: 50%; transform: translate(-50%,-14px); opacity: 0; pointer-events: none; transition: all .3s ease; z-index: 80; background: #355D54; color: #fff; padding: 14px 22px; border-radius: 999px; font-size: 13px; box-shadow: 0 12px 30px rgba(53,93,84,.22); }
    .hero-orb { position: absolute; border-radius: 999px; filter: blur(10px); opacity: .55; }
  </style>
</head>
<body>

<div class="border-b border-stone-200 bg-paper/95 backdrop-blur-sm">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-11 flex items-center justify-between text-[11px] sm:text-xs text-stone-500">
    <div class="flex items-center gap-3 sm:gap-6 overflow-x-auto whitespace-nowrap">
      <span class="inline-flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-sage"></span>Serving homeowners across ${city}${state ? `, ${state}` : ''}</span>
      <span class="hidden sm:inline">Licensed, insured, and known for respectful in-home service</span>
    </div>
    <a href="tel:${phoneHref}" class="font-semibold text-sage hover:text-ink transition-colors">Call ${phone}</a>
  </div>
</div>

<nav class="sticky top-0 z-40 border-b border-stone-200 bg-paper/90 backdrop-blur-sm">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
    <a href="#" class="font-heading text-2xl font-semibold text-ink tracking-tight">${biz}</a>
    <div class="hidden lg:flex items-center gap-8 text-sm text-stone-600">
      <a href="#services" class="hover:text-ink transition-colors">Services</a>
      <a href="#story" class="hover:text-ink transition-colors">Our story</a>
      <a href="#reviews" class="hover:text-ink transition-colors">Reviews</a>
      <a href="#faq" class="hover:text-ink transition-colors">FAQ</a>
      <a href="#contact" class="hover:text-ink transition-colors">Contact</a>
    </div>
    <div class="hidden lg:flex items-center gap-3">
      <a href="tel:${phoneHref}" class="inline-flex items-center justify-center rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-ink hover:border-sage hover:text-sage transition-colors">${phone}</a>
      <a href="#contact" class="inline-flex items-center justify-center rounded-full bg-sage px-5 py-3 text-sm font-semibold text-white hover:bg-ink transition-colors">${escHtml(c.cta1)}</a>
    </div>
    <button id="mobile-toggle" class="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-full border border-stone-300 text-ink" aria-label="Menu">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
    </button>
  </div>
  <div id="mobile-menu" class="mobile-panel lg:hidden absolute inset-x-0 top-full border-b border-stone-200 bg-paper shadow-sm">
    <div class="px-4 py-4 space-y-2">
      <a href="#services" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-ink hover:bg-white">Services</a>
      <a href="#story" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-ink hover:bg-white">Our story</a>
      <a href="#reviews" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-ink hover:bg-white">Reviews</a>
      <a href="#faq" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-ink hover:bg-white">FAQ</a>
      <a href="#contact" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-ink hover:bg-white">Contact</a>
      <div class="grid grid-cols-2 gap-2 pt-2">
        <a href="tel:${phoneHref}" class="rounded-2xl border border-stone-300 px-4 py-3 text-center text-sm font-semibold text-ink">Call</a>
        <a href="#contact" class="rounded-2xl bg-sage px-4 py-3 text-center text-sm font-semibold text-white">Request</a>
      </div>
    </div>
  </div>
</nav>

<section class="relative overflow-hidden">
  <div class="hero-orb bg-sage/20 w-72 h-72 -top-16 -left-16"></div>
  <div class="hero-orb bg-sand/20 w-80 h-80 top-24 right-0"></div>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20 lg:py-24 grid gap-10 lg:grid-cols-[minmax(0,1fr)_460px] items-start">
    <div class="reveal">
      <div class="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sage mb-6">
        <span class="w-1.5 h-1.5 rounded-full bg-sage"></span>${escHtml(c.headlineSub)}
      </div>
      <h1 class="font-heading text-ink font-semibold mb-6 max-w-3xl" style="font-size:clamp(3rem,5vw,5.35rem);line-height:0.96;">${escHtml(c.headline)}</h1>
      <p class="max-w-2xl text-lg leading-8 text-stone-600 mb-8">${escHtml(c.subline)}</p>
      <div class="flex flex-col sm:flex-row gap-3 mb-8">
        <a href="#contact" class="inline-flex items-center justify-center rounded-full bg-sage px-7 py-4 text-sm font-semibold text-white hover:bg-ink transition-colors">${escHtml(c.cta1)}</a>
        <a href="#reviews" class="inline-flex items-center justify-center rounded-full border border-stone-300 px-7 py-4 text-sm font-semibold text-ink hover:border-sage hover:text-sage transition-colors">${escHtml(c.cta2)}</a>
      </div>
      <div class="flex flex-wrap gap-2 max-w-2xl">
        <span class="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Licensed & insured</span>
        <span class="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Upfront pricing</span>
        <span class="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Warranty-backed work</span>
        <span class="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Family-owned</span>
      </div>
    </div>

    <aside class="reveal lg:pt-6">
      <div class="relative rounded-[36px] border border-stone-200 bg-white p-5 shadow-[0_20px_60px_rgba(47,38,30,0.08)]">
        <img src="${escHtml(heroImg)}" alt="${biz} ${escHtml(c.nicheLabel)}" class="w-full h-[370px] object-cover rounded-[28px]">
        <div class="absolute left-8 right-8 -bottom-10 rounded-[28px] border border-stone-200 bg-paper px-6 py-5 shadow-[0_14px_48px_rgba(47,38,30,0.10)]">
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400 mb-2">Homeowner confidence</p>
          <p class="font-heading text-2xl text-ink leading-tight mb-2">The kind of local brand people feel comfortable inviting into their home.</p>
          <p class="text-sm leading-6 text-stone-600">That’s the emotional tone this family is designed to sell.</p>
        </div>
      </div>
    </aside>
  </div>
</section>

<section class="pt-16 md:pt-20 pb-10 md:pb-12">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 rounded-[34px] border border-stone-200 bg-white/80 px-6 py-8 md:px-10 md:py-10 shadow-[0_10px_36px_rgba(47,38,30,0.04)]">
    <div class="grid gap-8 lg:grid-cols-4">
      ${standardsHtml}
    </div>
  </div>
</section>

<section id="services" class="py-16 md:py-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="reveal max-w-2xl mb-10 md:mb-14">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-sage mb-3">Service ledger</p>
      <h2 class="font-heading text-4xl md:text-5xl font-semibold text-ink mb-5">A cleaner, more premium way to show what the business actually does.</h2>
      <p class="text-base leading-8 text-stone-600">Instead of generic feature cards, this family uses an editorial service ledger — quieter, more expensive, and less template-coded.</p>
    </div>
    <div>
      ${serviceLedger}
    </div>
  </div>
</section>

<section id="story" class="py-16 md:py-20 bg-ink text-white">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] items-start">
    <div class="reveal rounded-[34px] border border-white/10 bg-white/5 p-8 md:p-10">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-sand mb-4">Why this feels better</p>
      <h2 class="font-heading text-4xl md:text-5xl font-semibold mb-5">Trust shown through restraint still converts.</h2>
      <p class="text-base leading-8 text-white/75 mb-6">This family intentionally avoids the loud, gimmicky feel a lot of home-service demos fall into. It’s warmer, calmer, and more premium — but still built to get calls and requests.</p>
      <p class="text-base leading-8 text-white/75">That’s exactly the kind of website package that can justify a more serious redesign price.</p>
    </div>
    <div class="reveal grid gap-5 md:grid-cols-2">
      ${founderList}
    </div>
  </div>
</section>

<section id="reviews" class="py-16 md:py-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="reveal flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
      <div class="max-w-2xl">
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-sage mb-3">Homeowner proof</p>
        <h2 class="font-heading text-4xl md:text-5xl font-semibold text-ink mb-4">A review section that feels curated instead of recycled.</h2>
        <p class="text-base leading-8 text-stone-600">One featured testimonial, two support reviews, and less visual repetition.</p>
      </div>
      <div class="rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-600">${escHtml(c.stats.rating)}★ average rating</div>
    </div>
    <div class="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] items-start">
      <article class="reveal rounded-[34px] border border-stone-200 bg-white p-8 md:p-10 shadow-[0_14px_52px_rgba(47,38,30,0.05)]">
        <div class="flex items-center gap-1 mb-5">${'<svg class="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>'.repeat(featuredReview.rating || 5)}</div>
        <p class="font-heading text-3xl md:text-4xl text-ink leading-tight mb-6">“${escHtml(featuredReview.text)}”</p>
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="font-semibold text-ink">${escHtml(featuredReview.name)}</p>
            <p class="text-xs uppercase tracking-[0.14em] text-stone-400 mt-1">Verified local homeowner</p>
          </div>
          <a href="tel:${phoneHref}" class="inline-flex items-center justify-center rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-ink hover:border-sage hover:text-sage transition-colors">${phone}</a>
        </div>
      </article>
      <div class="grid gap-6">
        ${sideReviews}
      </div>
    </div>
  </div>
</section>

<section id="faq" class="py-16 md:py-20 bg-white border-y border-stone-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-[320px_minmax(0,1fr)] items-start">
    <div class="reveal lg:sticky lg:top-28">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-sage mb-3">Common questions</p>
      <h2 class="font-heading text-4xl md:text-5xl font-semibold text-ink mb-4">FAQ that still feels like part of the design.</h2>
      <p class="text-base leading-8 text-stone-600">This family keeps the Q&A simple and elegant rather than tossing in another generic accordion block.</p>
    </div>
    <div class="reveal rounded-[30px] border border-stone-200 bg-paper px-6 md:px-8 shadow-[0_10px_40px_rgba(47,38,30,0.04)]">
      ${faqHtml}
    </div>
  </div>
</section>

<section id="contact" class="py-16 md:py-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
    <div class="reveal rounded-[34px] bg-white border border-stone-200 p-8 md:p-10 shadow-[0_14px_50px_rgba(47,38,30,0.06)]">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-sage mb-4">Request a callback</p>
      <h2 class="font-heading text-4xl font-semibold text-ink mb-4">Keep the close simple and warm.</h2>
      <p class="text-base leading-8 text-stone-600 mb-8">Low-friction contact, visible phone, and a promise of thoughtful follow-up.</p>
      <div class="space-y-4 text-sm text-stone-600">
        <div class="rounded-[24px] bg-paper px-5 py-4 border border-stone-200">
          <p class="text-[11px] uppercase tracking-[0.16em] text-stone-400 mb-1">Call now</p>
          <a href="tel:${phoneHref}" class="font-semibold text-lg text-sage hover:text-ink transition-colors">${phone}</a>
        </div>
        <div class="rounded-[24px] bg-paper px-5 py-4 border border-stone-200">
          <p class="text-[11px] uppercase tracking-[0.16em] text-stone-400 mb-1">Service area</p>
          <p>${city}${state ? `, ${state}` : ''} and surrounding neighborhoods</p>
        </div>
        ${email ? `<div class="rounded-[24px] bg-paper px-5 py-4 border border-stone-200"><p class="text-[11px] uppercase tracking-[0.16em] text-stone-400 mb-1">Email</p><a href="mailto:${email}" class="font-semibold text-sage hover:text-ink transition-colors">${email}</a></div>` : ''}
      </div>
    </div>
    <div class="reveal rounded-[34px] bg-ink text-white p-8 md:p-10 shadow-[0_18px_56px_rgba(47,38,30,0.14)]">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-sand mb-4">Quick request</p>
      <h3 class="font-heading text-3xl md:text-4xl font-semibold mb-4">Tell us what’s going on.</h3>
      <p class="text-sm leading-7 text-white/70 mb-6">Fast form. Clear fields. No clutter.</p>
      <form id="contact-form" class="grid gap-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <input type="text" placeholder="Your name" class="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-sand focus:outline-none">
          <input type="tel" placeholder="Phone number" class="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-sand focus:outline-none">
        </div>
        <select class="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-sand focus:outline-none">
          <option class="text-ink">Choose a service</option>
          ${contactOptions}
        </select>
        <textarea rows="4" placeholder="Describe the issue or project" class="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-sand focus:outline-none"></textarea>
        <button type="submit" class="rounded-full bg-sand px-5 py-4 text-sm font-semibold text-ink hover:bg-white transition-colors">${escHtml(c.cta1)}</button>
        <p class="text-xs text-white/50">We typically respond within ${escHtml(c.stats.avgResponse)} minutes during business hours.</p>
      </form>
    </div>
  </div>
</section>

<div id="toast" class="toast">Request captured — this is a concept demo.</div>
${widgetHtml}

<script>
(function(){
  var toggle=document.getElementById('mobile-toggle');
  var menu=document.getElementById('mobile-menu');
  toggle.addEventListener('click',function(){menu.classList.toggle('open');});
  document.querySelectorAll('.mobile-link').forEach(function(link){link.addEventListener('click',function(){menu.classList.remove('open');});});

  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click',function(e){
      var target=document.querySelector(this.getAttribute('href'));
      if(target){e.preventDefault();window.scrollTo({top:target.offsetTop-90,behavior:'smooth'});menu.classList.remove('open');}
    });
  });

  document.querySelectorAll('.faq-toggle').forEach(function(btn){
    btn.addEventListener('click',function(){
      var item=this.closest('.faq-item');
      var wasOpen=item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(function(el){el.classList.remove('open');});
      if(!wasOpen){item.classList.add('open');}
    });
  });

  var ro=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add('visible');ro.unobserve(entry.target);}});},{threshold:0.1,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.reveal').forEach(function(el){ro.observe(el);});

  var form=document.getElementById('contact-form');
  var toast=document.getElementById('toast');
  form.addEventListener('submit',function(e){
    e.preventDefault();
    toast.style.opacity='1';
    toast.style.transform='translate(-50%,0)';
    toast.style.pointerEvents='auto';
    form.reset();
    setTimeout(function(){toast.style.opacity='0';toast.style.transform='translate(-50%,-14px)';toast.style.pointerEvents='none';},3200);
  });
})();
</script>
</body>
</html>`;
  },
};
