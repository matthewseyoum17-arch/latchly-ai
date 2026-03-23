/**
 * PREMIUM MODERN UTILITY family
 * Service-first, action-rail homepage with geometric clarity.
 * Bricolage Grotesque + DM Sans. Practical upscale system with a booking / dispatch panel.
 */
const { escHtml } = require('../shared/utils');
const { getCopy } = require('../shared/copy');
const { generateWidget } = require('../shared/widget');
const { getTheme } = require('../shared/niche-themes');

const name = 'modern';
const label = 'Premium Modern Utility';
const designProfile = {
  layout: 'service-first-action-rail',
  hero: 'split-hero-with-booking-panel',
  typography: 'bricolage-grotesque+dm-sans',
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
    const t = getTheme('modern', niche);
    const tc = t.colors;
    const biz = escHtml(lead.business_name);
    const city = escHtml(lead.city || 'Your City');
    const state = escHtml(lead.state || '');
    const phone = escHtml(lead.phone || '(555) 000-0000');
    const phoneHref = (lead.phone || '5550000000').replace(/[^0-9+]/g, '');
    const cityState = [lead.city, lead.state].filter(Boolean).join(', ');

    const widget = generateWidget(lead, {
      emoji: c.emoji,
      headBg: tc.primary,
      avatarBg: tc.primary,
      fabBg: tc.primary,
      fabRadius: '50%',
      fabSize: '48px',
      panelRadius: '16px',
      bodyFont: "'DM Sans',sans-serif",
      headingFont: "'Bricolage Grotesque',sans-serif",
      userMsgBg: tc.primary,
      sendBg: tc.primary,
      sendHoverBg: tc.primaryHover,
      linkColor: tc.primary,
      inputFocusBorder: tc.primary,
      inputFocusRing: tc.primaryRing || 'rgba(79,70,229,.12)',
      qrBorder: (tc.primaryLight || 'rgba(79,70,229,.2)'),
      qrColor: tc.primary,
      qrBg: tc.primaryLight || 'rgba(79,70,229,.04)',
      qrHoverBg: tc.primary,
      qrRadius: '24px',
      inputRadius: '10px',
      msgBotRadius: '4px 14px 14px 14px',
      msgUserRadius: '14px 14px 4px 14px',
      chatBg: '#FAFBFC',
      fabShadow: `0 4px 16px ${tc.primaryRing || 'rgba(79,70,229,.25)'}`,
    }, c.quickReplies, c.serviceOptions);

    const serviceIcons = t.icons.map(svg =>
      svg.replace('<svg ', `<svg class="w-5 h-5" style="color:${tc.primary}" `)
    );
    const serviceProofs = ['Fast scheduling', 'Arrival alerts', 'Licensed team', 'Transparent pricing', 'Warranty-backed', 'Respectful cleanup'];
    const serviceCards = c.services.map((svc, i) => `
      <article class="reveal rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.03)] hover:shadow-xl transition-all duration-300" style="--hover-border:${tc.border || tc.primary}">
        <div class="flex items-start justify-between gap-4 mb-5">
          <div class="w-12 h-12 rounded-2xl flex items-center justify-center" style="background:${tc.tagBg || tc.primaryLight}">${serviceIcons[i % serviceIcons.length]}</div>
          <span class="inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
            <span class="w-1.5 h-1.5 rounded-full" style="background:${tc.primary}"></span>${serviceProofs[i % serviceProofs.length]}
          </span>
        </div>
        <h3 class="font-heading text-lg font-semibold text-gray-900 mb-2">${escHtml(svc.title)}</h3>
        <p class="text-sm leading-relaxed text-gray-500">${escHtml(svc.desc)}</p>
      </article>`).join('\n');

    const reviewCards = c.testimonials.slice(0, 3).map((rev, i) => `
      <div class=”reveal rounded-3xl border p-6” style=”border-color:${i === 1 ? (tc.border || '#C7D2FE') : '#E5E7EB'};background:${i === 1 ? (tc.tagBg || '#EEF2FF') : '#fff'}”>
        <div class=”flex items-center gap-1 mb-4”>${'<svg class=”w-4 h-4 text-amber-400” fill=”currentColor” viewBox=”0 0 20 20”><path d=”M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z”/></svg>'.repeat(rev.rating || 5)}</div>
        <p class=”text-sm leading-relaxed text-gray-600 mb-5”>”${escHtml(rev.text)}”</p>
        <div class=”flex items-center justify-between gap-4”>
          <div>
            <p class=”text-sm font-semibold text-gray-900”>${escHtml(rev.name)}</p>
            <p class=”text-xs text-gray-500”>Verified local customer</p>
          </div>
          <span class=”rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]” style=”color:${tc.primary}”>Fast reply</span>
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
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Bricolage+Grotesque:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config={theme:{extend:{colors:{brand:{50:'${tc.tagBg || '#EEF2FF'}',100:'${tc.bgAlt || '#E0E7FF'}',200:'${tc.border || '#C7D2FE'}',500:'${tc.primary}',600:'${tc.primary}',700:'${tc.primaryHover}',800:'${tc.primaryHover}'}},fontFamily:{heading:['Bricolage Grotesque','sans-serif'],body:['DM Sans','sans-serif']}}}}
</script>
<style>
body{font-family:'DM Sans',sans-serif;color:${tc.ink || '#F8FAFC'};-webkit-font-smoothing:antialiased;background:${tc.heroBg || tc.bg};}
h1,h2,h3,h4{font-family:'Bricolage Grotesque',sans-serif;letter-spacing:-0.03em;}
.reveal{opacity:0;transform:translateY(16px);transition:opacity .45s ease,transform .45s ease;}
.reveal.active{opacity:1;transform:translateY(0);}
.mobile-panel{transform:translateY(-105%);transition:transform .28s ease;}
.mobile-panel.open{transform:translateY(0);}
.toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,1rem);opacity:0;pointer-events:none;transition:all .3s ease;z-index:70;background:${tc.primary};color:#fff;padding:12px 18px;border-radius:999px;font-size:13px;box-shadow:0 12px 24px rgba(20,184,166,.25);}
.modern-hero{position:relative;overflow:hidden;background:${tc.heroGradient || tc.heroBg || '#0B1120'};}
.modern-hero::before{content:'';position:absolute;inset:0;background:url('${t.familyHero}') center/cover no-repeat;opacity:0.15;mix-blend-mode:luminosity;}
.modern-hero::after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 20% 80%,${tc.primary}33,transparent 50%),radial-gradient(ellipse at 80% 20%,${tc.primary}22,transparent 40%),radial-gradient(circle at 60% 60%,rgba(99,102,241,.15),transparent 40%);animation:gradientShift 15s ease infinite;background-size:200% 200%;}
.modern-inner{position:relative;z-index:1;}
@keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes floatUp{0%{transform:translateY(0) scale(1);opacity:.6}50%{transform:translateY(-20px) scale(1.05);opacity:1}100%{transform:translateY(0) scale(1);opacity:.6}}
@keyframes pulse-glow{0%,100%{box-shadow:0 0 20px ${tc.primary}33}50%{box-shadow:0 0 40px ${tc.primary}66,0 0 80px ${tc.primary}22}}
.grain::after{content:'';position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:.035;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
.glow-border{animation:pulse-glow 3s ease-in-out infinite;}
.float-element{animation:floatUp 6s ease-in-out infinite;}
.section-light{background:${tc.bgLight || '#F0FDFA'};color:${tc.inkDark || '#0F172A'};}
.section-dark{background:${tc.bgAlt || '#111827'};color:#F8FAFC;}
</style>
</head>
<body class="grain">

<!-- UTILITY BAR -->
<div class="border-b border-white/5" style="background:${tc.bgAlt || '#111827'}">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-11 flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
    <div class="flex items-center gap-3 sm:gap-5 overflow-x-auto whitespace-nowrap">
      <span class="inline-flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full" style="background:${tc.primary}"></span>Serving ${city}</span>
      <span class="hidden sm:inline">Online booking + fast dispatch updates</span>
      <span class="hidden md:inline">Upfront pricing before work begins</span>
    </div>
    <a href="tel:${phoneHref}" class="font-semibold transition-colors" style="color:${tc.primary}">${phone}</a>
  </div>
</div>

<!-- NAV -->
<nav class="sticky top-0 z-40 border-b border-white/10 backdrop-blur-md" style="background:${tc.heroBg || '#0B1120'}E6">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between py-4">
    <a href="#" class="font-heading text-xl font-bold text-white">${biz}</a>
    <div class="hidden lg:flex items-center gap-2 rounded-full border border-white/10 p-1" style="background:rgba(255,255,255,0.05)">
      <a href="#services" class="px-4 py-2 text-sm text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition-colors">Services</a>
      <a href="#process" class="px-4 py-2 text-sm text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition-colors">Process</a>
      <a href="#reviews" class="px-4 py-2 text-sm text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition-colors">Reviews</a>
      <a href="#contact" class="px-4 py-2 text-sm text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition-colors">Contact</a>
    </div>
    <div class="hidden lg:flex items-center gap-3">
      <a href="tel:${phoneHref}" class="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/5">Call ${phone}</a>
      <a href="#contact" class="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-slate-900 transition-colors" style="background:${tc.primary}" onmouseover="this.style.background='${tc.primaryHover}'" onmouseout="this.style.background='${tc.primary}'">${escHtml(c.cta1)}</a>
    </div>
    <button id="mobile-toggle" class="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-2xl border border-white/15 text-white" aria-label="Menu">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
    </button>
  </div>
  <div id="mobile-menu" class="mobile-panel lg:hidden absolute inset-x-0 top-full border-b border-white/10 shadow-sm" style="background:${tc.bgAlt || '#111827'}">
    <div class="px-4 py-4 space-y-2">
      <a href="#services" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/5">Services</a>
      <a href="#process" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/5">Process</a>
      <a href="#reviews" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/5">Reviews</a>
      <a href="#contact" class="mobile-link block rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/5">Contact</a>
      <div class="grid grid-cols-2 gap-2 pt-2">
        <a href="tel:${phoneHref}" class="rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white">Call</a>
        <a href="#contact" class="rounded-2xl px-4 py-3 text-center text-sm font-semibold text-slate-900" style="background:${tc.primary}">Book</a>
      </div>
    </div>
  </div>
</nav>

<!-- HERO -->
<section class="modern-hero">
  <div class="modern-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 lg:py-36 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_380px] items-center">
    <div class="reveal">
      <div class="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] mb-5" style="background:${tc.tagBg};color:${tc.primary}">
        <span class="w-1.5 h-1.5 rounded-full" style="background:${tc.primary}"></span>${escHtml(c.headlineSub)}
      </div>
      <h1 class="max-w-3xl text-white font-bold mb-5" style="font-size:clamp(2.6rem,5vw,5rem);line-height:0.94;">${escHtml(c.headline)}</h1>
      <p class="max-w-2xl text-lg leading-relaxed text-slate-400 mb-8">${escHtml(c.subline)}</p>
      <div class="flex flex-col sm:flex-row gap-3 mb-10">
        <a href="#contact" class="inline-flex items-center justify-center rounded-full px-7 py-4 text-sm font-semibold text-slate-900 transition-colors" style="background:${tc.primary}" onmouseover="this.style.background=’${tc.primaryHover}’" onmouseout="this.style.background=’${tc.primary}’">${escHtml(c.cta1)}</a>
        <a href="tel:${phoneHref}" class="inline-flex items-center justify-center rounded-full border border-white/15 px-7 py-4 text-sm font-semibold text-white hover:bg-white/5 transition-colors">Call ${phone}</a>
      </div>
      <div class="grid gap-4 sm:grid-cols-3 max-w-xl">
        <div class="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 float-element" style="animation-delay:0s">
          <p class="font-heading text-2xl font-bold text-white">${escHtml(c.stats.avgResponse)} min</p>
          <p class="text-xs text-slate-500">Avg response</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 float-element" style="animation-delay:2s">
          <p class="font-heading text-2xl font-bold text-white">${escHtml(c.stats.jobs)}+</p>
          <p class="text-xs text-slate-500">Jobs completed</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 float-element" style="animation-delay:4s">
          <p class="font-heading text-2xl font-bold text-white inline-flex items-center gap-1">${escHtml(c.stats.rating)}<svg class="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg></p>
          <p class="text-xs text-slate-500">Customer rating</p>
        </div>
      </div>
    </div>

    <aside class="reveal lg:sticky lg:top-28">
      <div class="rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-md p-6 shadow-[0_24px_60px_rgba(0,0,0,0.3)] glow-border">
        <div class="flex items-start justify-between gap-4 mb-5">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">Fastest path</p>
            <h2 class="font-heading text-2xl font-bold text-white">Request service</h2>
          </div>
          <span class="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style="background:${tc.tagBg};color:${tc.primary}">Live</span>
        </div>
        <form id="contact-form" class="space-y-4">
          <div>
            <select class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none" style="--focus-border:${tc.primary}" onfocus="this.style.borderColor=’${tc.primary}’" onblur="this.style.borderColor=’rgba(255,255,255,0.1)’">
${serviceOpts}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Your name" class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none" onfocus="this.style.borderColor=’${tc.primary}’" onblur="this.style.borderColor=’rgba(255,255,255,0.1)’">
            <input type="tel" placeholder="${phone}" class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none" onfocus="this.style.borderColor=’${tc.primary}’" onblur="this.style.borderColor=’rgba(255,255,255,0.1)’">
          </div>
          <textarea rows="3" placeholder="Tell us what you need help with" class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none" onfocus="this.style.borderColor=’${tc.primary}’" onblur="this.style.borderColor=’rgba(255,255,255,0.1)’"></textarea>
          <button type="submit" class="w-full rounded-2xl px-5 py-4 text-sm font-semibold text-slate-900 transition-colors" style="background:${tc.primary}" onmouseover="this.style.background=’${tc.primaryHover}’" onmouseout="this.style.background=’${tc.primary}’">${escHtml(c.cta1)}</button>
          <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
            <p class="font-semibold text-white mb-1">Prefer the phone?</p>
            <a href="tel:${phoneHref}" class="font-semibold" style="color:${tc.primary}">Call ${phone}</a>
          </div>
        </form>
      </div>
    </aside>
  </div>
</section>

<!-- SERVICES -->
<section id="services" class="section-light py-16 md:py-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
      <div class="reveal max-w-2xl">
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] mb-3" style="color:${tc.primary}">${escHtml(t.labels.services)}</p>
        <h2 class="font-heading text-3xl md:text-4xl font-bold mb-4" style="color:${tc.inkDark || '#0F172A'}">Built for fast decision-making</h2>
        <p class="text-base leading-relaxed" style="color:${tc.textMutedDark || '#475569'}">${escHtml(t.labels.servicesDesc)}</p>
      </div>
      <div class="reveal inline-flex flex-wrap gap-2">
        ${t.badges.map(badge => `<span class="rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]" style="border-color:${tc.borderLight || '#D1E7E0'};background:white;color:${tc.textMutedDark || '#475569'}">${escHtml(badge)}</span>`).join('\n        ')}
      </div>
    </div>
    <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
${serviceCards}
    </div>
  </div>
</section>

<!-- MEMBERSHIP / VALUE STRIP -->
<section class="section-dark py-16 md:py-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-center">
    <div class="reveal">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] mb-3" style="color:${tc.primary}">Premium modern utility</p>
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
<section id="process" class="section-light py-16 md:py-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="reveal max-w-2xl mb-10">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] mb-3" style="color:${tc.primary}">${escHtml(t.labels.process)}</p>
      <h2 class="font-heading text-3xl md:text-4xl font-bold mb-4" style="color:${tc.inkDark || '#0F172A'}">Simple path from problem to booked job</h2>
      <p class="text-base leading-relaxed" style="color:${tc.textMutedDark || '#475569'}">This family uses process clarity as a trust mechanism. It makes the experience feel organized and easy.</p>
    </div>
    <div class="grid gap-5 md:grid-cols-3">
${processSteps}
    </div>
  </div>
</section>

<!-- REVIEWS -->
<section id="reviews" class="section-dark py-16 md:py-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="reveal flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
      <div class="max-w-2xl">
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] mb-3" style="color:${tc.primary}">Compact proof</p>
        <h2 class="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-4">Operationally sharp. Still trustworthy.</h2>
        <p class="text-base leading-relaxed text-gray-500">Instead of a giant wall of reviews, this family keeps proof compact and high-signal.</p>
      </div>
      <span class="self-start md:self-auto rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em]" style="background:${tc.tagBg || tc.primaryLight};color:${tc.tagText || tc.primary}">${escHtml(c.stats.rating)} average rating</span>
    </div>
    <div class="grid gap-5 lg:grid-cols-3">
${reviewCards}
    </div>
  </div>
</section>

<!-- CONTACT -->
<section id="contact" class="section-light py-16 md:py-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
    <div class="reveal rounded-[32px] p-8 md:p-10 text-white" style="background:${tc.primary}">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] mb-4" style="color:rgba(255,255,255,0.7)">Ready when you are</p>
      <h2 class="font-heading text-3xl md:text-4xl font-bold mb-4">Make it easy to contact the business.</h2>
      <p class="text-base leading-relaxed mb-8" style="color:rgba(255,255,255,0.75)">This closing section stays intentionally simple: call, request service, and let the widget handle after-hours questions.</p>
      <div class="space-y-4 text-sm">
        <div class="rounded-3xl bg-white/10 px-5 py-4">
          <p class="text-xs uppercase tracking-[0.12em] mb-1" style="color:rgba(255,255,255,0.7)">Call now</p>
          <a href="tel:${phoneHref}" class="text-white font-semibold text-lg">${phone}</a>
        </div>
        <div class="rounded-3xl bg-white/10 px-5 py-4">
          <p class="text-xs uppercase tracking-[0.12em] mb-1" style="color:rgba(255,255,255,0.7)">Coverage</p>
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
          <input type="text" placeholder="Your name" class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:bg-white focus:outline-none" onfocus="this.style.borderColor='${tc.primary}'" onblur="this.style.borderColor=''">
          <input type="tel" placeholder="Phone number" class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:bg-white focus:outline-none" onfocus="this.style.borderColor='${tc.primary}'" onblur="this.style.borderColor=''">
        </div>
        <select class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:bg-white focus:outline-none" onfocus="this.style.borderColor='${tc.primary}'" onblur="this.style.borderColor=''">
${serviceOpts}
        </select>
        <textarea rows="4" placeholder="Describe the issue or project" class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:bg-white focus:outline-none" onfocus="this.style.borderColor='${tc.primary}'" onblur="this.style.borderColor=''"></textarea>
        <button type="submit" class="rounded-2xl px-5 py-4 text-sm font-semibold text-white transition-all hover:scale-[1.02]" style="background:linear-gradient(135deg,${tc.primary},${tc.primaryHover})">${escHtml(c.cta1)}</button>
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
