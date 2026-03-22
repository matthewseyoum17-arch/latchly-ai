/**
 * REGIONAL MARKET LEADER family
 * Proof-first command-center layout with market coverage, metrics, and operational authority.
 */
const { escHtml, buildCoverageZones } = require('../shared/utils');
const { getCopy } = require('../shared/copy');
const { generateWidget } = require('../shared/widget');

const name = 'regional';
const label = 'Regional Market Leader';
const designProfile = {
  layout: 'proof-first-command-center',
  hero: 'copy-left-kpi-board-right',
  typography: 'sora+inter',
  sectionOrder: 'utility|nav|hero-command-center|coverage-board|service-lanes|authority-proof|faq|contact',
  components: 'glass-panels|metric-boards|coverage-chips|performance-cards|authority-bands',
  personality: 'market-leading-operational-confident',
  ctaStrategy: 'request-service-with-authority-proof',
  colorScheme: 'navy-slate-electric-blue',
  density: 'structured-high-signal',
  navStyle: 'enterprise-local-utility-nav',
};

module.exports = {
  name,
  label,
  designProfile,

  generate(lead, niche) {
    const c = getCopy('regional', niche, lead);
    const biz = escHtml(lead.business_name);
    const phone = escHtml(lead.phone || '(555) 000-0000');
    const phoneHref = (lead.phone || '5550000000').replace(/[^0-9+]/g, '');
    const email = escHtml(lead.email || '');
    const city = escHtml(lead.city || 'Your City');
    const state = escHtml(lead.state || '');
    const coverageZones = buildCoverageZones(city);

    const widgetHtml = generateWidget(lead, {
      emoji: c.emoji,
      headBg: 'linear-gradient(135deg, #0B1220, #14233A)',
      avatarBg: 'linear-gradient(135deg, #0B1220, #14233A)',
      fabBg: '#2563EB',
      fabRadius: '12px',
      fabSize: '54px',
      panelRadius: '14px',
      bodyFont: "'Inter', sans-serif",
      headingFont: "'Sora', sans-serif",
      userMsgBg: '#2563EB',
      sendBg: '#2563EB',
      sendHoverBg: '#1d4ed8',
      linkColor: '#2563EB',
      inputFocusBorder: '#2563EB',
      inputFocusRing: 'rgba(37, 99, 235, 0.12)',
      qrBorder: 'rgba(37, 99, 235, 0.24)',
      qrColor: '#2563EB',
      qrBg: 'rgba(37, 99, 235, 0.05)',
      qrHoverBg: '#2563EB',
      qrRadius: '14px',
      inputRadius: '12px',
      msgBotRadius: '6px 16px 16px 16px',
      msgUserRadius: '16px 16px 6px 16px',
      chatBg: '#F8FAFC',
      fabShadow: '0 10px 24px rgba(37, 99, 235, 0.28)',
    }, c.quickReplies, c.serviceOptions);

    const metrics = [
      { label: 'Response time', value: `${escHtml(c.stats.avgResponse)} min`, note: 'Average dispatch response' },
      { label: 'Completed jobs', value: `${escHtml(c.stats.jobs)}+`, note: 'Documented service history' },
      { label: 'Average rating', value: `${escHtml(c.stats.rating)}★`, note: 'Local homeowner satisfaction' },
      { label: 'Years active', value: `${escHtml(c.stats.years)}+`, note: 'Operating in the market' },
    ];

    const metricTiles = metrics.map((item, i) => `
      <div class="reveal rounded-[26px] border ${i === 0 ? 'border-blue-400/40 bg-blue-500/10' : 'border-white/10 bg-white/5'} p-5 backdrop-blur-sm">
        <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2">${item.label}</p>
        <p class="font-heading text-3xl font-semibold text-white mb-2">${item.value}</p>
        <p class="text-sm leading-6 text-slate-400">${item.note}</p>
      </div>`).join('');

    const laneColors = ['blue', 'slate', 'indigo', 'cyan'];
    const serviceLanes = c.services.slice(0, 4).map((service, i) => {
      const accent = laneColors[i % laneColors.length];
      const tags = [
        ['Priority scheduling', 'Clear scope'],
        ['Certified crews', 'Quality materials'],
        ['Real-time updates', 'Clean handoff'],
        ['Long-term value', 'Warranty-backed'],
      ][i % 4];
      return `
        <article class="reveal rounded-[30px] border border-slate-200 bg-white p-7 shadow-[0_12px_50px_rgba(15,23,42,0.05)]">
          <div class="flex items-start justify-between gap-5 mb-6">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-${accent}-600 mb-2">Service lane</p>
              <h3 class="font-heading text-2xl font-semibold text-slate-900 leading-tight">${escHtml(service.title)}</h3>
            </div>
            <div class="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Operational</div>
          </div>
          <p class="text-[15px] leading-7 text-slate-600 mb-6">${escHtml(service.desc)}</p>
          <div class="grid gap-3 sm:grid-cols-2">
            ${tags.map(tag => `<div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 border border-slate-200">${escHtml(tag)}</div>`).join('')}
          </div>
        </article>`;
    }).join('');

    const authorityCards = [
      {
        title: 'Coverage confidence',
        body: `Strong operators win when their service area, speed, and proof are visible before the visitor has to dig.`
      },
      {
        title: 'Stronger homeowner confidence',
        body: `This family is built to make the business look established, capable, and operationally sharp — the kind of site that supports a premium offer.`
      },
      {
        title: 'Cleaner trust hierarchy',
        body: `Instead of generic contractor sections, it uses a command-center rhythm: metrics, lanes, coverage, authority, then conversion.`
      },
    ].map((card, i) => `
      <div class="reveal rounded-[28px] border ${i === 1 ? 'border-blue-200 bg-blue-50/70' : 'border-slate-200 bg-white'} p-6 shadow-[0_8px_36px_rgba(15,23,42,0.04)]">
        <p class="font-heading text-2xl font-semibold text-slate-900 mb-3">${card.title}</p>
        <p class="text-[15px] leading-7 text-slate-600">${card.body}</p>
      </div>`).join('');

    const coverageChips = coverageZones.map((zone, i) => `
      <div class="rounded-2xl border ${i % 3 === 0 ? 'border-blue-200 bg-blue-50/70 text-blue-700' : 'border-slate-200 bg-white text-slate-600'} px-4 py-3 text-sm font-medium shadow-[0_4px_24px_rgba(15,23,42,0.03)]">${escHtml(zone)}</div>`).join('');

    const reviewCards = c.testimonials.map((review, i) => `
      <article class="reveal rounded-[28px] border ${i === 0 ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'} p-6 shadow-[0_12px_44px_rgba(15,23,42,0.04)]">
        <div class="flex items-center gap-1 mb-4">${'<svg class="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>'.repeat(review.rating || 5)}</div>
        <p class="text-[15px] leading-7 ${i === 0 ? 'text-white/80' : 'text-slate-600'} mb-5">“${escHtml(review.text)}”</p>
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="font-semibold">${escHtml(review.name)}</p>
            <p class="text-xs uppercase tracking-[0.14em] ${i === 0 ? 'text-white/40' : 'text-slate-400'} mt-1">Verified local customer</p>
          </div>
          <div class="rounded-full ${i === 0 ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-900'} w-11 h-11 flex items-center justify-center font-semibold">${escHtml(review.name.charAt(0).toUpperCase())}</div>
        </div>
      </article>`).join('');

    const faqHtml = c.faqs.map((faq, i) => `
      <div class="faq-item border-b border-slate-200">
        <button class="faq-toggle w-full py-5 text-left flex items-center justify-between gap-6" data-faq="${i}">
          <span class="font-heading text-xl text-slate-900 font-medium">${escHtml(faq.q)}</span>
          <span class="faq-icon w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </span>
        </button>
        <div class="faq-content overflow-hidden max-h-0 transition-all duration-300">
          <p class="pb-5 pr-10 text-[15px] leading-7 text-slate-600">${escHtml(faq.a)}</p>
        </div>
      </div>`).join('');

    const contactOptions = c.serviceOptions.slice(0, 6).map(opt => `<option>${escHtml(opt)}</option>`).join('');

    return `<!DOCTYPE html>
<!-- DEMO: ${biz} | Family: regional | Generated by Variation Engine -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${biz} — Trusted ${escHtml(c.nicheLabel)} Across ${city}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            night: '#0B1220',
            panel: '#111C31',
            slate2: '#1B273B',
          },
          fontFamily: {
            heading: ['Sora', 'sans-serif'],
            body: ['Inter', 'sans-serif'],
          },
        },
      },
    };
  </script>
  <style>
    html { scroll-behavior: smooth; }
    body { font-family: 'Inter', sans-serif; color: #0f172a; background: #F8FAFC; }
    .reveal { opacity: 0; transform: translateY(24px); transition: opacity .55s ease, transform .55s ease; }
    .reveal.visible { opacity: 1; transform: translateY(0); }
    .faq-item.open .faq-content { max-height: 320px; }
    .faq-item.open .faq-icon { transform: rotate(180deg); border-color: rgba(37,99,235,.35); color: #2563EB; background: rgba(37,99,235,.06); }
    .mobile-panel { transform: translateY(-105%); transition: transform .28s ease; }
    .mobile-panel.open { transform: translateY(0); }
    .toast { position: fixed; right: 24px; top: 24px; background: #0B1220; color: #fff; padding: 14px 18px; border-radius: 18px; box-shadow: 0 16px 36px rgba(15,23,42,.18); opacity: 0; transform: translateY(-10px); pointer-events: none; transition: all .3s ease; z-index: 80; }
    .grid-bg { background-image: linear-gradient(rgba(148,163,184,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.12) 1px, transparent 1px); background-size: 36px 36px; }
  </style>
</head>
<body>

<div class="bg-night text-white border-b border-white/10">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-11 flex items-center justify-between text-[11px] sm:text-xs text-slate-300">
    <div class="flex items-center gap-3 sm:gap-6 overflow-x-auto whitespace-nowrap">
      <span class="inline-flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>Serving ${city}${state ? `, ${state}` : ''} and surrounding communities</span>
      <span class="hidden sm:inline">Authority-driven regional service presentation</span>
    </div>
    <a href="tel:${phoneHref}" class="font-semibold text-white hover:text-blue-300 transition-colors">${phone}</a>
  </div>
</div>

<nav class="sticky top-0 z-40 border-b border-slate-200 bg-white/92 backdrop-blur-sm">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
    <a href="#" class="font-heading text-2xl font-semibold text-slate-900 tracking-tight">${biz}</a>
    <div class="hidden lg:flex items-center gap-8 text-sm text-slate-600">
      <a href="#coverage" class="hover:text-slate-900 transition-colors">Coverage</a>
      <a href="#services" class="hover:text-slate-900 transition-colors">Services</a>
      <a href="#authority" class="hover:text-slate-900 transition-colors">Authority</a>
      <a href="#faq" class="hover:text-slate-900 transition-colors">FAQ</a>
      <a href="#contact" class="hover:text-slate-900 transition-colors">Contact</a>
    </div>
    <div class="hidden lg:flex items-center gap-3">
      <a href="tel:${phoneHref}" class="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 hover:border-blue-500 hover:text-blue-600 transition-colors">${phone}</a>
      <a href="#contact" class="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">${escHtml(c.cta1)}</a>
    </div>
    <button id="mobile-toggle" class="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-full border border-slate-300 text-slate-900" aria-label="Menu">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
    </button>
  </div>
  <div id="mobile-menu" class="mobile-panel lg:hidden absolute inset-x-0 top-full border-b border-slate-200 bg-white shadow-sm">
    <div class="px-4 py-4 space-y-2">
      <a href="#coverage" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">Coverage</a>
      <a href="#services" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">Services</a>
      <a href="#authority" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">Authority</a>
      <a href="#faq" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">FAQ</a>
      <a href="#contact" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">Contact</a>
      <div class="grid grid-cols-2 gap-2 pt-2">
        <a href="tel:${phoneHref}" class="rounded-2xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-900">Call</a>
        <a href="#contact" class="rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white">Request</a>
      </div>
    </div>
  </div>
</nav>

<section class="relative overflow-hidden bg-night text-white">
  <div class="absolute inset-0 grid-bg opacity-25"></div>
  <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.22),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.14),transparent_28%)]"></div>
  <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 lg:py-24 grid gap-10 lg:grid-cols-[minmax(0,1fr)_430px] items-start">
    <div class="reveal">
      <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300 mb-6">
        <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>${escHtml(c.headlineSub)}
      </div>
      <h1 class="font-heading font-semibold mb-6 max-w-3xl" style="font-size:clamp(2.8rem,5vw,5rem);line-height:0.98;">${escHtml(c.headline)}</h1>
      <p class="max-w-2xl text-lg leading-8 text-slate-300 mb-8">${escHtml(c.subline)}</p>
      <div class="flex flex-col sm:flex-row gap-3 mb-6">
        <a href="#contact" class="inline-flex items-center justify-center rounded-full bg-blue-600 px-7 py-4 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">${escHtml(c.cta1)}</a>
        <a href="#coverage" class="inline-flex items-center justify-center rounded-full border border-white/15 px-7 py-4 text-sm font-semibold text-white hover:bg-white/5 transition-colors">${escHtml(c.cta2)}</a>
      </div>
      <div class="flex flex-wrap gap-2 mb-10 max-w-2xl">
        <span class="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Licensed & insured</span>
        <span class="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Warranty-backed work</span>
        <span class="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Transparent pricing</span>
        <span class="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Financing available</span>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <div class="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2">Regional positioning</p>
          <p class="font-heading text-2xl leading-tight mb-3">Built to make the business feel like the operator that owns the market.</p>
          <p class="text-sm leading-7 text-slate-400">Less brochure, more command center. Coverage, proof, and capabilities are visible early.</p>
        </div>
        <div class="rounded-[28px] border border-white/10 bg-blue-500/10 p-6 backdrop-blur-sm">
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300 mb-2">Why it feels premium</p>
          <ul class="space-y-3 text-sm leading-6 text-slate-300">
            <li class="flex gap-3"><span class="mt-2 w-1.5 h-1.5 rounded-full bg-blue-400"></span><span>Stronger metric hierarchy than a typical local service site.</span></li>
            <li class="flex gap-3"><span class="mt-2 w-1.5 h-1.5 rounded-full bg-blue-400"></span><span>Coverage and authority are designed like proof assets, not filler text.</span></li>
            <li class="flex gap-3"><span class="mt-2 w-1.5 h-1.5 rounded-full bg-blue-400"></span><span>The whole experience is sharper and more "8k site" than template-local.</span></li>
          </ul>
        </div>
      </div>
    </div>

    <aside class="reveal">
      <div class="rounded-[34px] border border-white/10 bg-white/5 p-5 backdrop-blur-md shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
        <div class="flex items-center justify-between gap-4 mb-5">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-1">Market overview</p>
            <h2 class="font-heading text-2xl font-semibold text-white">Performance board</h2>
          </div>
          <span class="rounded-full bg-blue-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-300">Live-ready</span>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          ${metricTiles}
        </div>
      </div>
    </aside>
  </div>
</section>

<section id="coverage" class="py-16 md:py-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start">
    <div class="reveal rounded-[32px] bg-slate-900 text-white p-8 md:p-10 shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300 mb-4">Coverage board</p>
      <h2 class="font-heading text-4xl md:text-5xl font-semibold mb-5">Service area shown like a strength, not a footnote.</h2>
      <p class="text-base leading-8 text-slate-300 mb-8">Regional operators look stronger when their footprint is visible early. This family treats coverage as proof of operational maturity.</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-[24px] bg-white/5 px-5 py-5 border border-white/10">
          <p class="text-[11px] uppercase tracking-[0.14em] text-slate-400 mb-2">Primary market</p>
          <p class="font-heading text-2xl text-white">${city}${state ? `, ${state}` : ''}</p>
        </div>
        <div class="rounded-[24px] bg-white/5 px-5 py-5 border border-white/10">
          <p class="text-[11px] uppercase tracking-[0.14em] text-slate-400 mb-2">Lead path</p>
          <p class="font-heading text-2xl text-white">Coverage → authority → request</p>
        </div>
      </div>
    </div>
    <div class="reveal grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      ${coverageChips}
    </div>
  </div>
</section>

<section id="services" class="py-16 md:py-20 bg-white border-y border-slate-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="reveal max-w-2xl mb-10 md:mb-14">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 mb-3">Capability lanes</p>
      <h2 class="font-heading text-4xl md:text-5xl font-semibold text-slate-900 mb-5">A service system that feels organized and scalable.</h2>
      <p class="text-base leading-8 text-slate-600">This family presents services like operational lanes rather than generic feature cards — cleaner, stronger, and more premium.</p>
    </div>
    <div class="grid gap-6 lg:grid-cols-2">
      ${serviceLanes}
    </div>
  </div>
</section>

<section id="authority" class="py-16 md:py-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="reveal flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
      <div class="max-w-2xl">
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 mb-3">Authority proof</p>
        <h2 class="font-heading text-4xl md:text-5xl font-semibold text-slate-900 mb-4">Proof modules with more weight and less fluff.</h2>
        <p class="text-base leading-8 text-slate-600">This section is where the regional family separates itself: more command, less charm, still premium.</p>
      </div>
      <div class="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600">${escHtml(c.stats.jobs)}+ completed jobs</div>
    </div>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] items-start mb-8">
      <div class="grid gap-6 md:grid-cols-3">
        ${reviewCards}
      </div>
      <div class="grid gap-6">
        ${authorityCards}
      </div>
    </div>
  </div>
</section>

<section id="faq" class="py-16 md:py-20 bg-slate-50 border-y border-slate-200">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="reveal text-center max-w-2xl mx-auto mb-10">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 mb-3">Operational clarity</p>
      <h2 class="font-heading text-4xl md:text-5xl font-semibold text-slate-900 mb-4">FAQ built like an executive summary.</h2>
      <p class="text-base leading-8 text-slate-600">Simple answers, clean hierarchy, no filler accordion styling.</p>
    </div>
    <div class="reveal rounded-[30px] border border-slate-200 bg-white px-6 md:px-8 shadow-[0_10px_40px_rgba(15,23,42,0.04)]">
      ${faqHtml}
    </div>
  </div>
</section>

<section id="contact" class="py-16 md:py-20 bg-night text-white">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
    <div class="reveal rounded-[34px] border border-white/10 bg-white/5 p-8 md:p-10 backdrop-blur-sm">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300 mb-4">Request service</p>
      <h2 class="font-heading text-4xl font-semibold mb-4">Close with confidence, not clutter.</h2>
      <p class="text-base leading-8 text-slate-300 mb-8">The contact module stays structured: phone, coverage, and a clear request path with a more premium operational feel.</p>
      <div class="space-y-4 text-sm text-slate-300">
        <div class="rounded-[24px] bg-white/5 px-5 py-4 border border-white/10">
          <p class="text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">Call now</p>
          <a href="tel:${phoneHref}" class="font-semibold text-lg text-white hover:text-blue-300 transition-colors">${phone}</a>
        </div>
        <div class="rounded-[24px] bg-white/5 px-5 py-4 border border-white/10">
          <p class="text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">Coverage</p>
          <p>${city}${state ? `, ${state}` : ''} plus nearby service area</p>
        </div>
        ${email ? `<div class="rounded-[24px] bg-white/5 px-5 py-4 border border-white/10"><p class="text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">Email</p><a href="mailto:${email}" class="font-semibold text-white hover:text-blue-300 transition-colors">${email}</a></div>` : ''}
      </div>
    </div>
    <div class="reveal rounded-[34px] bg-white text-slate-900 p-8 md:p-10 shadow-[0_20px_56px_rgba(15,23,42,0.16)]">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-4">Service intake</p>
      <h3 class="font-heading text-3xl md:text-4xl font-semibold mb-4">Tell the team what you need.</h3>
      <p class="text-sm leading-7 text-slate-600 mb-6">Strong regional sites should make intake feel organized and reliable.</p>
      <form id="contact-form" class="grid gap-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <input type="text" placeholder="Your name" class="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none">
          <input type="tel" placeholder="Phone number" class="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none">
        </div>
        <select class="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none">
          <option>Choose a service</option>
          ${contactOptions}
        </select>
        <textarea rows="4" placeholder="Describe the issue or project" class="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"></textarea>
        <button type="submit" class="rounded-full bg-blue-600 px-5 py-4 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">${escHtml(c.cta1)}</button>
        <p class="text-xs text-slate-500">Typical response time: ${escHtml(c.stats.avgResponse)} minutes during staffed hours.</p>
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
    toast.style.transform='translateY(0)';
    toast.style.pointerEvents='auto';
    form.reset();
    setTimeout(function(){toast.style.opacity='0';toast.style.transform='translateY(-10px)';toast.style.pointerEvents='none';},3200);
  });
})();
</script>
</body>
</html>`;
  },
};
