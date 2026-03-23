/**
 * HIGH-TRUST FAMILY-OWNED AUTHORITY family
 * Warm editorial residential brand with calmer premium spacing and homeowner-first conversion.
 * NOW WITH NICHE-AWARE THEMING: colors, patterns, icons shift per trade.
 */
const { escHtml } = require('../shared/utils');
const { getCopy } = require('../shared/copy');
const { generateWidget } = require('../shared/widget');
const { getTheme } = require('../shared/niche-themes');

const name = 'trust';
const label = 'High-Trust Family-Owned Authority';
const designProfile = {
  layout: 'warm-editorial-proof-rail',
  hero: 'copy-left-visual-stage-right',
  typography: 'fraunces+instrument-sans',
  sectionOrder: 'utility|nav|hero-stage|standards-strip|service-ledger|founder-note|review-editorial|faq-split|contact',
  components: 'editorial-ledger|soft-proof-rail|featured-review|quiet-cta-rails|paper-panels',
  personality: 'warm-residential-neighborly-premium',
  ctaStrategy: 'call-or-request-callback',
  colorScheme: 'niche-adaptive',
  density: 'airy-but-grounded',
  navStyle: 'quiet-premium-local-nav',
};

module.exports = {
  name,
  label,
  designProfile,

  generate(lead, niche) {
    const c = getCopy('trust', niche, lead);
    const t = getTheme('trust', niche);
    const tc = t.colors;
    const biz = escHtml(lead.business_name);
    const phone = escHtml(lead.phone || '(555) 000-0000');
    const phoneHref = (lead.phone || '5550000000').replace(/[^0-9+]/g, '');
    const email = escHtml(lead.email || '');
    const city = escHtml(lead.city || 'Your City');
    const state = escHtml(lead.state || '');
    const heroImg = t.familyHero;
    const goldStarSvg = '<svg class="w-4 h-4" style="color:' + tc.accent + '" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';
    const fiveStars = goldStarSvg.repeat(5);

    const widgetHtml = generateWidget(lead, {
      emoji: c.emoji,
      headBg: `linear-gradient(135deg, ${tc.ink}, ${tc.ink}dd)`,
      avatarBg: `linear-gradient(135deg, ${tc.primary}, ${tc.primaryHover})`,
      fabBg: tc.primary,
      fabRadius: '18px',
      fabSize: '56px',
      panelRadius: '18px',
      bodyFont: "'Instrument Sans', sans-serif",
      headingFont: "'Fraunces', serif",
      userMsgBg: tc.primary,
      sendBg: tc.primary,
      sendHoverBg: tc.primaryHover,
      linkColor: tc.primary,
      inputFocusBorder: tc.primary,
      inputFocusRing: tc.primaryRing,
      qrBorder: tc.primaryRing,
      qrColor: tc.primary,
      qrBg: tc.primaryLight,
      qrHoverBg: tc.primary,
      qrRadius: '16px',
      inputRadius: '14px',
      msgBotRadius: '6px 18px 18px 18px',
      msgUserRadius: '18px 18px 6px 18px',
      chatBg: tc.bg,
      fabShadow: `0 10px 24px ${tc.primaryRing}`,
    }, c.quickReplies, c.serviceOptions);

    const trustSignals = [
      { label: 'Family-owned service', value: `${escHtml(c.stats.years)}+ years`, note: 'Built on reputation, not volume tactics.' },
      { label: 'Customer rating', value: `${escHtml(c.stats.rating)} average`, note: 'Homeowners come back and recommend the team.' },
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
      const icon = t.icons[i % t.icons.length];
      return `
        <article class="reveal border-b py-8 md:py-10 hover-warm" style="border-color:${tc.border}">
          <div class="grid gap-6 lg:grid-cols-[110px_minmax(0,0.9fr)_minmax(0,1.1fr)] items-start">
            <div class="flex flex-col items-center gap-3">
              <div class="w-14 h-14 rounded-2xl flex items-center justify-center" style="background:${tc.primaryLight};color:${tc.primary}">${icon}</div>
              <span class="font-heading text-2xl font-semibold" style="color:${tc.border}">0${i + 1}</span>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.16em] mb-3" style="color:${tc.primary}">${escHtml(t.labels.services)}</p>
              <h3 class="font-heading text-3xl md:text-4xl font-semibold leading-tight" style="color:${tc.ink}">${escHtml(service.title)}</h3>
            </div>
            <div>
              <p class="text-[15px] leading-7 mb-5" style="color:${tc.textMuted}">${escHtml(service.desc)}</p>
              <div class="flex flex-wrap gap-2 mb-5">
                ${details.map(item => `<span class="rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]" style="border-color:${tc.border};background:${tc.tagBg};color:${tc.tagText}">${escHtml(item)}</span>`).join('')}
              </div>
              <a href="#contact" class="inline-flex items-center gap-2 text-sm font-semibold transition-colors" style="color:${tc.primary}">
                Request service
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3"/></svg>
              </a>
            </div>
          </div>
        </article>`;
    }).join('');

    const founderList = c.whyUs.slice(0, 4).map(item => `
      <div class="flex items-start gap-4">
        <div class="mt-1 w-8 h-8 rounded-full flex items-center justify-center" style="background:${tc.primaryLight};color:${tc.primary}"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg></div>
        <div>
          <p class="text-base font-semibold text-ink mb-1">${escHtml(item.title)}</p>
          <p class="text-sm leading-6 text-stone-600">${escHtml(item.desc)}</p>
        </div>
      </div>`).join('');

    const featuredReview = c.testimonials[0];
    const sideReviews = c.testimonials.slice(1, 3).map(review => `
      <article class="reveal rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_10px_40px_rgba(47,38,30,0.04)] hover-warm">
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

    // Build niche-specific SVG pattern CSS
    const patternBg = t.pattern(tc.primary, 0.035);
    const heroDecor = t.heroDecorator(tc.primary);

    return `<!DOCTYPE html>
<!-- DEMO: ${biz} | Family: trust | Niche: ${niche} | Generated by Variation Engine -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${biz} — Trusted ${escHtml(c.nicheLabel)} in ${city}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            paper: '${tc.bg}',
            paper2: '${tc.bgAlt}',
            ink: '${tc.ink}',
            sage: '${tc.primary}',
            sand: '${tc.accent}',
          },
          fontFamily: {
            heading: ['Fraunces', 'serif'],
            body: ['Instrument Sans', 'sans-serif'],
          },
        },
      },
    };
  </script>
  <style>
    html { scroll-behavior: smooth; }
    body { font-family: 'Instrument Sans', sans-serif; background: ${tc.bg}; color: ${tc.ink}; }
    .reveal { opacity: 0; transform: translateY(24px); transition: opacity .55s ease, transform .55s ease; }
    .reveal.visible { opacity: 1; transform: translateY(0); }
    .faq-item.open .faq-content { max-height: 320px; }
    .faq-item.open .faq-icon { transform: rotate(180deg); border-color: ${tc.primaryRing}; color: ${tc.primary}; background: ${tc.primaryLight}; }
    .mobile-panel { transform: translateX(100%); transition: transform .28s ease; }
    .mobile-panel.open { transform: translateX(0); }
    .toast { position: fixed; top: 22px; left: 50%; transform: translate(-50%,-14px); opacity: 0; pointer-events: none; transition: all .3s ease; z-index: 80; background: ${tc.primary}; color: #fff; padding: 14px 22px; border-radius: 999px; font-size: 13px; box-shadow: 0 12px 30px ${tc.primaryRing}; }
    @keyframes warmGlow{0%,100%{opacity:.5}50%{opacity:.8}}
    @keyframes slideReveal{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
    .paper-texture::before{content:'';position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:.025;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
    .warm-glow{position:relative;overflow:hidden;}
    .warm-glow>.glow-orb{position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(circle,${tc.accent}15,transparent 60%);animation:warmGlow 5s ease-in-out infinite;pointer-events:none;z-index:0;}
    .slide-in{animation:slideReveal .8s ease-out forwards;}
    .hover-warm{transition:transform .3s ease,box-shadow .3s ease;}
    .hover-warm:hover{transform:translateY(-3px);box-shadow:0 16px 48px rgba(139,94,60,.12);}
    .svc-icon-box svg { width: 24px; height: 24px; }
    .trust-hero { position: relative; background: ${tc.heroBg || tc.ink}; overflow: hidden; }
    .trust-hero::before { content: ''; position: absolute; inset: 0; background: url('${heroImg}') center/cover no-repeat; opacity: 0.25; }
    .trust-hero::after { content: ''; position: absolute; inset: 0; background: ${tc.gradientHero || `linear-gradient(135deg, ${tc.ink} 0%, ${tc.ink}dd 100%)`}; }
    .trust-hero-inner { position: relative; z-index: 1; }
  </style>
</head>
<body class="paper-texture">

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

<section class="trust-hero">
  <div class="trust-hero-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 lg:py-36">
    <div class="reveal max-w-3xl">
      <div class="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] mb-6" style="background:rgba(212,168,83,0.12);color:${tc.accent}">
        <span class="w-1.5 h-1.5 rounded-full" style="background:${tc.accent}"></span>${escHtml(c.headlineSub)}
      </div>
      <h1 class="font-heading font-semibold text-white mb-6 slide-in" style="font-size:clamp(3rem,5.5vw,5.5rem);line-height:0.94;">${escHtml(c.headline)}</h1>
      <p class="max-w-2xl text-lg leading-8 text-white/70 mb-8">${escHtml(c.subline)}</p>
      <div class="flex flex-col sm:flex-row gap-3 mb-8">
        <a href="#contact" class="inline-flex items-center justify-center rounded-full px-7 py-4 text-sm font-semibold transition-colors" style="background:${tc.accent};color:${tc.heroBg || tc.ink}" onmouseover="this.style.background='#E8BC6A'" onmouseout="this.style.background='${tc.accent}'">${escHtml(c.cta1)}</a>
        <a href="tel:${phoneHref}" class="inline-flex items-center justify-center rounded-full border border-white/20 px-7 py-4 text-sm font-semibold text-white hover:bg-white/10 transition-colors">Call ${phone}</a>
      </div>
      <div class="flex flex-wrap gap-2">
        ${t.badges.map(b => `<span class="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/70" style="background:rgba(255,255,255,0.06)">${escHtml(b)}</span>`).join('\n        ')}
      </div>
    </div>
    <div class="reveal mt-10 grid gap-4 sm:grid-cols-3 max-w-3xl">
      <div class="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 hover-warm">
        <div class="flex items-center gap-1 mb-2">${fiveStars}</div>
        <p class="text-white/90 font-heading text-lg leading-snug">"${escHtml(c.testimonials[0].text.substring(0, 60))}..."</p>
        <p class="text-sm text-white/50 mt-2">— ${escHtml(c.testimonials[0].name)}</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 hover-warm">
        <p class="font-heading text-3xl font-semibold text-white mb-1">${escHtml(c.stats.years)}+</p>
        <p class="text-sm text-white/50">Years serving ${city}</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 hover-warm">
        <p class="font-heading text-3xl font-semibold text-white mb-1">${escHtml(c.stats.jobs)}+</p>
        <p class="text-sm text-white/50">Happy homeowners</p>
      </div>
    </div>
  </div>
</section>

<section class="pt-16 md:pt-20 pb-10 md:pb-12">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 rounded-[34px] border px-6 py-8 md:px-10 md:py-10 shadow-[0_10px_36px_rgba(47,38,30,0.06)] warm-glow" style="border-color:${tc.border};background:${tc.bgAlt}">
    <div class="glow-orb"></div>
    <div class="relative z-[1] grid gap-8 lg:grid-cols-4">
      ${standardsHtml}
    </div>
  </div>
</section>

<section id="services" class="py-16 md:py-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="reveal max-w-2xl mb-10 md:mb-14">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] mb-3" style="color:${tc.primary}">${escHtml(t.labels.services)}</p>
      <h2 class="font-heading text-4xl md:text-5xl font-semibold mb-5" style="color:${tc.ink}">${escHtml(t.labels.servicesDesc)}</h2>
    </div>
    <div>
      ${serviceLedger}
    </div>
  </div>
</section>

<section id="story" class="py-16 md:py-20 text-white" style="background:${tc.ink}">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] items-start">
    <div class="reveal rounded-[34px] border border-white/10 bg-white/5 p-8 md:p-10">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] mb-4" style="color:${tc.accent}">${escHtml(t.labels.about)}</p>
      <h2 class="font-heading text-4xl md:text-5xl font-semibold mb-5">${escHtml(c.whyTitle)}</h2>
      <p class="text-base leading-8 text-white/75 mb-6">${escHtml(c.whySub)}</p>
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
      <div class="rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-600 inline-flex items-center gap-1.5"><svg class="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>${escHtml(c.stats.rating)} average rating</div>
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
