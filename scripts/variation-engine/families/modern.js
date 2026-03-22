/**
 * PREMIUM MODERN UTILITY family
 * Service-first, action-rail homepage with geometric clarity.
 * Space Grotesk + Inter. Practical upscale system with a booking / dispatch panel.
 */
const { escHtml } = require('../shared/utils');
const { getCopy } = require('../shared/copy');
const { generateWidget } = require('../shared/widget');

const name = 'modern';
const label = 'Premium Modern Utility';
const designProfile = {
  layout: 'service-first-action-rail',
  hero: 'split-hero-with-booking-panel',
  typography: 'space-grotesk+inter',
  sectionOrder: 'utility|nav|hero-panel|service-matrix|membership-strip|process|compact-reviews|contact-dual',
  components: 'geometric-panels|pill-badges|metric-strips|stacked-action-rail',
  personality: 'practical-premium-clean-fast',
  ctaStrategy: 'request-service-and-call',
  colorScheme: 'white-indigo-slate',
  density: 'compact-structured',
  navStyle: 'utility-bar-plus-clean-nav',
};

module.exports = {
  name,
  label,
  designProfile,

  generate(lead, niche) {
    const c = getCopy('modern', niche, lead);
    const biz = escHtml(lead.business_name);
    const city = escHtml(lead.city || 'Your City');
    const state = escHtml(lead.state || '');
    const phone = escHtml(lead.phone || '(555) 000-0000');
    const phoneHref = (lead.phone || '5550000000').replace(/[^0-9+]/g, '');
    const cityState = [lead.city, lead.state].filter(Boolean).join(', ');

    const widget = generateWidget(lead, {
      emoji: c.emoji,
      headBg: '#4F46E5',
      avatarBg: '#4F46E5',
      fabBg: '#4F46E5',
      fabRadius: '50%',
      fabSize: '48px',
      panelRadius: '16px',
      bodyFont: "'Inter',sans-serif",
      headingFont: "'Space Grotesk',sans-serif",
      userMsgBg: '#4F46E5',
      sendBg: '#4F46E5',
      sendHoverBg: '#4338CA',
      linkColor: '#4F46E5',
      inputFocusBorder: '#4F46E5',
      inputFocusRing: 'rgba(79,70,229,.12)',
      qrBorder: 'rgba(79,70,229,.2)',
      qrColor: '#4F46E5',
      qrBg: 'rgba(79,70,229,.04)',
      qrHoverBg: '#4F46E5',
      qrRadius: '24px',
      inputRadius: '10px',
      msgBotRadius: '4px 14px 14px 14px',
      msgUserRadius: '14px 14px 4px 14px',
      chatBg: '#FAFBFC',
      fabShadow: '0 4px 16px rgba(79,70,229,.25)',
    }, c.quickReplies, c.serviceOptions);

    const serviceIcons = [
      '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z"/></svg>',
      '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>',
      '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0l8.955 8.955M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"/></svg>',
      '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>',
      '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
      '<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg>'
    ];
    const serviceProofs = ['Fast scheduling', 'Arrival alerts', 'Licensed team', 'Transparent pricing', 'Warranty-backed', 'Respectful cleanup'];
    const serviceCards = c.services.map((svc, i) => `
      <article class="reveal rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.03)] hover:border-indigo-200 hover:shadow-xl transition-all duration-300">
        <div class="flex items-start justify-between gap-4 mb-5">
          <div class="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">${serviceIcons[i % serviceIcons.length]}</div>
          <span class="inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>${serviceProofs[i % serviceProofs.length]}
          </span>
        </div>
        <h3 class="font-heading text-lg font-semibold text-gray-900 mb-2">${escHtml(svc.title)}</h3>
        <p class="text-sm leading-relaxed text-gray-500">${escHtml(svc.desc)}</p>
      </article>`).join('\n');

    const reviewCards = c.testimonials.slice(0, 3).map((t, i) => `
      <div class="reveal rounded-3xl border ${i === 1 ? 'border-indigo-200 bg-indigo-50/60' : 'border-gray-200 bg-white'} p-6">
        <div class="flex items-center gap-1 mb-4">${'<svg class="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>'.repeat(t.rating || 5)}</div>
        <p class="text-sm leading-relaxed text-gray-600 mb-5">“${escHtml(t.text)}”</p>
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-sm font-semibold text-gray-900">${escHtml(t.name)}</p>
            <p class="text-xs text-gray-500">Verified local customer</p>
          </div>
          <span class="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-600">Fast reply</span>
        </div>
      </div>`).join('\n');

    const processSteps = [
      { title: 'Request service', desc: 'Call or book online and tell us what is happening.' },
      { title: 'Get clear dispatch details', desc: 'We confirm your window, send updates, and keep you in the loop.' },
      { title: 'Approve the fix', desc: 'You get upfront options before work begins — no surprises.' },
    ].map((step, i) => `
      <div class="reveal rounded-3xl border border-gray-200 bg-white p-6">
        <div class="w-10 h-10 rounded-2xl bg-gray-900 text-white flex items-center justify-center text-sm font-bold mb-5">0${i + 1}</div>
        <h3 class="font-heading text-lg font-semibold text-gray-900 mb-2">${step.title}</h3>
        <p class="text-sm leading-relaxed text-gray-500">${step.desc}</p>
      </div>`).join('\n');

    const serviceOpts = c.serviceOptions.map(o => `                <option>${escHtml(o)}</option>`).join('\n');

    return `<!-- DEMO: ${biz} | Family: modern | Generated by Variation Engine -->
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${biz} — ${c.nicheLabel} | ${escHtml(cityState)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config={theme:{extend:{colors:{indigo:{50:'#EEF2FF',100:'#E0E7FF',200:'#C7D2FE',500:'#6366F1',600:'#4F46E5',700:'#4338CA',800:'#3730A3'}},fontFamily:{heading:['Space Grotesk','sans-serif'],body:['Inter','sans-serif']}}}}
</script>
<style>
body{font-family:'Inter',sans-serif;color:#111827;-webkit-font-smoothing:antialiased;background:linear-gradient(180deg,#ffffff 0%,#f7f8fc 100%);}
h1,h2,h3,h4{font-family:'Space Grotesk',sans-serif;letter-spacing:-0.03em;}
.reveal{opacity:0;transform:translateY(16px);transition:opacity .45s ease,transform .45s ease;}
.reveal.active{opacity:1;transform:translateY(0);}
.mobile-panel{transform:translateY(-105%);transition:transform .28s ease;}
.mobile-panel.open{transform:translateY(0);}
.toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,1rem);opacity:0;pointer-events:none;transition:all .3s ease;z-index:70;background:#111827;color:#fff;padding:12px 18px;border-radius:999px;font-size:13px;box-shadow:0 12px 24px rgba(15,23,42,.18);}
</style>
</head>
<body>

<!-- UTILITY BAR -->
<div class="border-b border-gray-100 bg-white/85 backdrop-blur-sm">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-11 flex items-center justify-between text-[11px] sm:text-xs text-gray-500">
    <div class="flex items-center gap-3 sm:gap-5 overflow-x-auto whitespace-nowrap">
      <span class="inline-flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Serving ${city}</span>
      <span class="hidden sm:inline">Online booking + fast dispatch updates</span>
      <span class="hidden md:inline">Upfront pricing before work begins</span>
    </div>
    <a href="tel:${phoneHref}" class="font-semibold text-indigo-700 hover:text-indigo-800 transition-colors">${phone}</a>
  </div>
</div>

<!-- NAV -->
<nav class="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between py-4">
    <a href="#" class="font-heading text-xl font-bold text-gray-900">${biz}</a>
    <div class="hidden lg:flex items-center gap-2 rounded-full border border-gray-200 bg-white p-1">
      <a href="#services" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-50 transition-colors">Services</a>
      <a href="#process" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-50 transition-colors">Process</a>
      <a href="#reviews" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-50 transition-colors">Reviews</a>
      <a href="#contact" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-50 transition-colors">Contact</a>
    </div>
    <div class="hidden lg:flex items-center gap-3">
      <a href="tel:${phoneHref}" class="inline-flex items-center justify-center rounded-full border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:border-indigo-200 hover:text-indigo-700 transition-colors">Call ${phone}</a>
      <a href="#contact" class="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">${escHtml(c.cta1)}</a>
    </div>
    <button id="mobile-toggle" class="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-2xl border border-gray-200 text-gray-700" aria-label="Menu">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
    </button>
  </div>
  <div id="mobile-menu" class="mobile-panel lg:hidden absolute inset-x-0 top-full border-b border-gray-100 bg-white shadow-sm">
    <div class="px-4 py-4 space-y-2">
      <a href="#services" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">Services</a>
      <a href="#process" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">Process</a>
      <a href="#reviews" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">Reviews</a>
      <a href="#contact" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">Contact</a>
      <div class="grid grid-cols-2 gap-2 pt-2">
        <a href="tel:${phoneHref}" class="rounded-2xl border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-700">Call</a>
        <a href="#contact" class="rounded-2xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white">Book</a>
      </div>
    </div>
  </div>
</nav>

<!-- HERO + ACTION RAIL -->
<section class="pt-10 pb-12 md:pt-16 md:pb-16">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
    <div class="reveal">
      <div class="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700 mb-5">
        <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>${escHtml(c.headlineSub)}
      </div>
      <h1 class="max-w-3xl text-gray-900 font-bold mb-5" style="font-size:clamp(2.4rem,5vw,4.7rem);line-height:0.96;">${escHtml(c.headline)}</h1>
      <p class="max-w-2xl text-lg leading-relaxed text-gray-500 mb-8">${escHtml(c.subline)}</p>
      <div class="grid gap-4 sm:grid-cols-3 mb-10">
        <div class="rounded-3xl border border-gray-200 bg-white p-5">
          <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">Avg response</p>
          <p class="font-heading text-3xl font-bold text-gray-900">${escHtml(c.stats.avgResponse)} min</p>
        </div>
        <div class="rounded-3xl border border-gray-200 bg-white p-5">
          <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">Jobs completed</p>
          <p class="font-heading text-3xl font-bold text-gray-900">${escHtml(c.stats.jobs)}+</p>
        </div>
        <div class="rounded-3xl border border-gray-200 bg-white p-5">
          <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">Customer rating</p>
          <p class="font-heading text-3xl font-bold text-gray-900">${escHtml(c.stats.rating)}★</p>
        </div>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 max-w-2xl">
        <div class="rounded-3xl bg-gray-900 p-6 text-white">
          <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-200 mb-3">What makes this better</p>
          <ul class="space-y-3 text-sm text-white/80">
            <li class="flex gap-3"><span class="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400"></span><span>Service-first UX built to move customers from problem to booking fast.</span></li>
            <li class="flex gap-3"><span class="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400"></span><span>Phone, booking, and after-hours lead capture are all visible immediately.</span></li>
            <li class="flex gap-3"><span class="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400"></span><span>Clean layout, not cluttered — but still built to convert.</span></li>
          </ul>
        </div>
        <div class="rounded-3xl border border-gray-200 bg-white p-6">
          <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-3">Popular requests</p>
          <div class="flex flex-wrap gap-2">
            ${c.serviceOptions.slice(0, 6).map(option => `<span class="rounded-full bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">${escHtml(option)}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <aside class="reveal lg:sticky lg:top-28">
      <div class="rounded-[32px] border border-gray-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div class="flex items-start justify-between gap-4 mb-6">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">Fastest path</p>
            <h2 class="font-heading text-2xl font-bold text-gray-900">Request service</h2>
          </div>
          <span class="rounded-full bg-green-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-green-700">Live schedule</span>
        </div>
        <div class="grid grid-cols-3 gap-2 mb-6">
          <div class="rounded-2xl bg-gray-50 p-3 text-center">
            <p class="text-lg font-bold text-gray-900">1</p>
            <p class="text-[11px] text-gray-500">Choose service</p>
          </div>
          <div class="rounded-2xl bg-gray-50 p-3 text-center">
            <p class="text-lg font-bold text-gray-900">2</p>
            <p class="text-[11px] text-gray-500">Pick timing</p>
          </div>
          <div class="rounded-2xl bg-gray-50 p-3 text-center">
            <p class="text-lg font-bold text-gray-900">3</p>
            <p class="text-[11px] text-gray-500">Get updates</p>
          </div>
        </div>
        <form id="contact-form" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">Service needed</label>
            <select class="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:border-indigo-500 focus:bg-white focus:outline-none">
${serviceOpts}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">Name</label>
              <input type="text" placeholder="Your name" class="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">Phone</label>
              <input type="tel" placeholder="${phone}" class="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none">
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">What’s happening?</label>
            <textarea rows="4" placeholder="Tell us what you need help with" class="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none"></textarea>
          </div>
          <button type="submit" class="w-full rounded-2xl bg-indigo-600 px-5 py-4 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">${escHtml(c.cta1)}</button>
          <div class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600">
            <p class="font-semibold text-gray-900 mb-1">Prefer the phone?</p>
            <a href="tel:${phoneHref}" class="text-indigo-700 font-semibold hover:text-indigo-800">Call ${phone}</a>
          </div>
        </form>
      </div>
    </aside>
  </div>
</section>

<!-- SERVICES -->
<section id="services" class="py-16 md:py-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
      <div class="reveal max-w-2xl">
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700 mb-3">Service matrix</p>
        <h2 class="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-4">Built for fast decision-making</h2>
        <p class="text-base leading-relaxed text-gray-500">Instead of hiding the important stuff, this layout pushes the actual services and trust details up front so customers can pick a path fast.</p>
      </div>
      <div class="reveal inline-flex flex-wrap gap-2">
        <span class="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Service-first UX</span>
        <span class="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Phone + form</span>
        <span class="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Clean hierarchy</span>
      </div>
    </div>
    <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
${serviceCards}
    </div>
  </div>
</section>

<!-- MEMBERSHIP / VALUE STRIP -->
<section class="py-16 md:py-20 bg-gray-900 text-white">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-center">
    <div class="reveal">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-200 mb-3">Premium modern utility</p>
      <h2 class="font-heading text-3xl md:text-4xl font-bold mb-4">The site behaves like a dispatch system, not a brochure.</h2>
      <p class="max-w-2xl text-base leading-relaxed text-white/75">This family is intentionally more operational: fast scannability, clear actions, compact proof, and enough polish to still feel premium.</p>
    </div>
    <div class="reveal grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
      <div class="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p class="text-sm font-semibold mb-2">Fast response expectation</p>
        <p class="text-sm text-white/70">Puts response-time reassurance in the first screen instead of burying it later.</p>
      </div>
      <div class="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p class="text-sm font-semibold mb-2">Clear next action</p>
        <p class="text-sm text-white/70">Phone, booking, and lead capture all stay visible without feeling loud or cheap.</p>
      </div>
      <div class="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p class="text-sm font-semibold mb-2">Practical premium tone</p>
        <p class="text-sm text-white/70">It feels cleaner and more current than a typical contractor template without drifting into SaaS-land.</p>
      </div>
    </div>
  </div>
</section>

<!-- PROCESS -->
<section id="process" class="py-16 md:py-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="reveal max-w-2xl mb-10">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700 mb-3">How it works</p>
      <h2 class="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-4">Simple path from problem to booked job</h2>
      <p class="text-base leading-relaxed text-gray-500">This family uses process clarity as a trust mechanism. It makes the experience feel organized and easy.</p>
    </div>
    <div class="grid gap-5 md:grid-cols-3">
${processSteps}
    </div>
  </div>
</section>

<!-- REVIEWS -->
<section id="reviews" class="py-16 md:py-20 bg-white">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="reveal flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
      <div class="max-w-2xl">
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700 mb-3">Compact proof</p>
        <h2 class="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-4">Operationally sharp. Still trustworthy.</h2>
        <p class="text-base leading-relaxed text-gray-500">Instead of a giant wall of reviews, this family keeps proof compact and high-signal.</p>
      </div>
      <span class="self-start md:self-auto rounded-full bg-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">${escHtml(c.stats.rating)} average rating</span>
    </div>
    <div class="grid gap-5 lg:grid-cols-3">
${reviewCards}
    </div>
  </div>
</section>

<!-- CONTACT -->
<section id="contact" class="py-16 md:py-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
    <div class="reveal rounded-[32px] bg-indigo-600 p-8 md:p-10 text-white">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-100 mb-4">Ready when you are</p>
      <h2 class="font-heading text-3xl md:text-4xl font-bold mb-4">Make it easy to contact the business.</h2>
      <p class="text-base leading-relaxed text-indigo-100/90 mb-8">This closing section stays intentionally simple: call, request service, and let the widget handle after-hours questions.</p>
      <div class="space-y-4 text-sm">
        <div class="rounded-3xl bg-white/10 px-5 py-4">
          <p class="text-indigo-100 text-xs uppercase tracking-[0.12em] mb-1">Call now</p>
          <a href="tel:${phoneHref}" class="text-white font-semibold text-lg">${phone}</a>
        </div>
        <div class="rounded-3xl bg-white/10 px-5 py-4">
          <p class="text-indigo-100 text-xs uppercase tracking-[0.12em] mb-1">Coverage</p>
          <p>${city}${state ? `, ${state}` : ''} and surrounding service area</p>
        </div>
      </div>
    </div>
    <div class="reveal rounded-[32px] border border-gray-200 bg-white p-8 md:p-10">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">Quick request</p>
      <h3 class="font-heading text-2xl md:text-3xl font-bold text-gray-900 mb-4">Tell us what you need.</h3>
      <p class="text-sm leading-relaxed text-gray-500 mb-6">Fast contact form, clear fields, no clutter.</p>
      <form class="grid gap-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <input type="text" placeholder="Your name" class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none">
          <input type="tel" placeholder="Phone number" class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none">
        </div>
        <select class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:border-indigo-500 focus:bg-white focus:outline-none">
${serviceOpts}
        </select>
        <textarea rows="4" placeholder="Describe the issue or project" class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none"></textarea>
        <button type="submit" class="rounded-2xl bg-gray-900 px-5 py-4 text-sm font-semibold text-white hover:bg-black transition-colors">${escHtml(c.cta1)}</button>
      </form>
    </div>
  </div>
</section>

<div id="toast" class="toast">Request captured — this is a concept demo.</div>
${widget}

<script>
(function(){
  var toggle=document.getElementById('mobile-toggle');
  var menu=document.getElementById('mobile-menu');
  toggle.addEventListener('click',function(){menu.classList.toggle('open');});
  document.querySelectorAll('.mobile-link').forEach(function(link){link.addEventListener('click',function(){menu.classList.remove('open');});});

  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click',function(e){
      var target=document.querySelector(this.getAttribute('href'));
      if(target){e.preventDefault();window.scrollTo({top:target.offsetTop-88,behavior:'smooth'});menu.classList.remove('open');}
    });
  });

  var ro=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add('active');ro.unobserve(entry.target);}});},{threshold:0.12,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.reveal').forEach(function(el){ro.observe(el);});

  var forms=document.querySelectorAll('form');
  var toast=document.getElementById('toast');
  forms.forEach(function(form){
    form.addEventListener('submit',function(e){
      e.preventDefault();
      toast.style.opacity='1';
      toast.style.transform='translate(-50%,0)';
      toast.style.pointerEvents='auto';
      form.reset();
      setTimeout(function(){toast.style.opacity='0';toast.style.transform='translate(-50%,1rem)';toast.style.pointerEvents='none';},3200);
    });
  });
})();
</script>
</body>
</html>`;
  }
};
