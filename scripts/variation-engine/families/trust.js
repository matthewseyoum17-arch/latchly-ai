/**
 * HIGH-TRUST FAMILY-OWNED AUTHORITY family
 * Warm cream + navy palette, Lora + Source Sans 3, traditional multi-column layout.
 * Think family-owned business that's been serving the community for decades.
 */

const { escHtml } = require('../shared/utils');
const { getCopy } = require('../shared/copy');
const { generateWidget } = require('../shared/widget');

const name = 'trust';
const label = 'High-Trust Family-Owned Authority';

const heroImages = {
  hvac: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80',
  plumbing: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&q=80',
  roofing: 'https://images.unsplash.com/photo-1632759145351-1d592919f522?w=800&q=80',
};

function generate(lead, niche) {
  const c = getCopy('trust', niche, lead);
  const biz = escHtml(lead.business_name);
  const phone = escHtml(lead.phone || '(555) 000-0000');
  const email = escHtml(lead.email || '');
  const city = escHtml(lead.city || 'Your City');
  const state = escHtml(lead.state || '');
  const heroImg = heroImages[niche] || heroImages.hvac;

  const widgetHtml = generateWidget(lead, {
    emoji: c.emoji,
    headBg: 'linear-gradient(135deg, #1B2A4A, #243556)',
    avatarBg: 'linear-gradient(135deg, #1B2A4A, #243556)',
    fabBg: '#0D6E6E',
    fabRadius: '16px',
    fabSize: '56px',
    panelRadius: '16px',
    bodyFont: "'Source Sans 3', sans-serif",
    headingFont: "'Lora', serif",
    userMsgBg: '#0D6E6E',
    sendBg: '#0D6E6E',
    sendHoverBg: '#0a5a5a',
    linkColor: '#0D6E6E',
    inputFocusBorder: '#0D6E6E',
    inputFocusRing: 'rgba(13, 110, 110, 0.12)',
    qrBorder: 'rgba(13, 110, 110, 0.3)',
    qrColor: '#0D6E6E',
    qrBg: 'rgba(13, 110, 110, 0.06)',
    qrHoverBg: '#0D6E6E',
    qrRadius: '12px',
    inputRadius: '12px',
    msgBotRadius: '4px 16px 16px 16px',
    msgUserRadius: '16px 16px 4px 16px',
    chatBg: '#FFF9F0',
    fabShadow: '0 4px 20px rgba(13, 110, 110, 0.3)',
  }, c.quickReplies, c.serviceOptions);

  // Trust badges
  const badges = [
    { icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>', label: 'Licensed & Insured' },
    { icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>', label: 'BBB A+ Rated' },
    { icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/>', label: 'Family Owned' },
    { icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>', label: 'Background Checked' },
  ];

  const badgesHtml = badges.map(b => `
          <div class="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-warm border border-warm-100">
            <div class="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-teal" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">${b.icon}</svg>
            </div>
            <span class="text-navy font-semibold text-sm">${b.label}</span>
          </div>`).join('');

  const serviceIconSvgs = [
    '<svg class="w-9 h-9 text-teal" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z"/></svg>',
    '<svg class="w-9 h-9 text-teal" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>',
    '<svg class="w-9 h-9 text-teal" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0l8.955 8.955M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"/></svg>',
    '<svg class="w-9 h-9 text-teal" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>',
  ];
  const serviceProofs = [
    ['Fast dispatch', 'Upfront pricing', 'Clean work area'],
    ['Licensed technicians', 'Modern tools', 'Workmanship warranty'],
    ['Honest recommendations', 'Clear communication', 'Respect for your home'],
    ['Same-day availability', 'Trusted by neighbors', 'Long-term fixes'],
  ];

  // Alternating service rows (first 4 services)
  const serviceRowsHtml = c.services.slice(0, 4).map((s, i) => {
    const isReversed = i % 2 === 1;
    const bgPattern = i % 2 === 0 ? 'bg-warm' : 'bg-white';
    return `
      <section class="${bgPattern} py-16 md:py-20 reveal">
        <div class="max-w-[1100px] mx-auto px-6">
          <div class="flex flex-col ${isReversed ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-10 md:gap-16">
            <div class="w-full md:w-1/2">
              <div class="rounded-2xl overflow-hidden shadow-warm border border-warm-100 bg-gradient-to-br from-white to-teal/5 p-8 md:p-10">
                <div class="w-16 h-16 rounded-2xl bg-teal/10 flex items-center justify-center mb-6">${serviceIconSvgs[i % serviceIconSvgs.length]}</div>
                <p class="text-teal text-xs font-bold tracking-widest uppercase mb-3">Featured Service</p>
                <p class="font-heading text-navy text-2xl md:text-3xl font-bold mb-3">${escHtml(s.title)}</p>
                <p class="text-warm-700 text-base leading-relaxed mb-6">${escHtml(s.desc)}</p>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  ${serviceProofs[i % serviceProofs.length].map(proof => `<div class="rounded-xl bg-white border border-warm-100 px-4 py-3 text-sm text-warm-700 font-medium">${escHtml(proof)}</div>`).join('')}
                </div>
              </div>
            </div>
            <div class="w-full md:w-1/2">
              <p class="text-teal text-xs font-bold tracking-widest uppercase mb-3">Service</p>
              <h3 class="font-heading text-navy text-2xl md:text-3xl font-bold mb-4">${escHtml(s.title)}</h3>
              <p class="text-warm-700 text-base leading-relaxed mb-6">${escHtml(s.desc)}</p>
              <div class="space-y-3 mb-6">
                ${serviceProofs[i % serviceProofs.length].map(proof => `<div class="flex items-center gap-3 text-sm text-warm-700"><span class="w-6 h-6 rounded-full bg-teal/10 text-teal flex items-center justify-center text-xs font-bold">✓</span><span>${escHtml(proof)}</span></div>`).join('')}
              </div>
              <a href="#contact" class="inline-flex items-center gap-2 text-teal font-semibold text-sm hover:gap-3 transition-all">
                Request Service
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3"/></svg>
              </a>
            </div>
          </div>
        </div>
      </section>`;
  }).join('');

  // Remaining services as smaller cards
  const extraServices = c.services.slice(4);
  const extraServicesHtml = extraServices.length > 0 ? extraServices.map(s => `
            <div class="bg-white rounded-2xl p-6 shadow-warm border border-warm-100 hover:shadow-lg transition-shadow">
              <div class="w-12 h-12 rounded-xl bg-teal/10 flex items-center justify-center text-2xl mb-4">${escHtml(c.emoji)}</div>
              <h4 class="font-heading text-navy text-lg font-bold mb-2">${escHtml(s.title)}</h4>
              <p class="text-warm-600 text-sm leading-relaxed">${escHtml(s.desc)}</p>
            </div>`).join('') : '';

  // Testimonial cards
  const starSvg = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';
  const starsRow = `<div class="flex items-center gap-0.5 text-gold-star">${starSvg}${starSvg}${starSvg}${starSvg}${starSvg}</div>`;

  const testimonialsHtml = c.testimonials.map(t => {
    const initial = t.name.charAt(0).toUpperCase();
    const colors = ['bg-teal', 'bg-navy', 'bg-gold-star'];
    const color = colors[c.testimonials.indexOf(t) % colors.length];
    return `
            <div class="bg-white rounded-2xl p-6 shadow-warm border border-warm-100 flex flex-col">
              ${starsRow}
              <p class="text-warm-700 text-sm leading-relaxed my-4 flex-1">&ldquo;${escHtml(t.text)}&rdquo;</p>
              <div class="flex items-center gap-3 pt-3 border-t border-warm-100">
                <div class="w-10 h-10 rounded-full ${color} text-white flex items-center justify-center font-bold text-sm">${initial}</div>
                <span class="text-navy font-semibold text-sm">${escHtml(t.name)}</span>
              </div>
            </div>`;
  }).join('');

  // FAQ
  const faqHtml = c.faqs.map((f, i) => `
            <div class="faq-item bg-white rounded-2xl shadow-warm border border-warm-100 overflow-hidden mb-3">
              <button class="faq-toggle w-full text-left p-5 flex items-center justify-between" data-faq="${i}">
                <span class="font-heading text-navy font-semibold text-base pr-6">${escHtml(f.q)}</span>
                <div class="faq-icon-wrap w-8 h-8 rounded-lg bg-warm flex items-center justify-center flex-shrink-0 transition-colors">
                  <svg class="faq-icon w-4 h-4 text-navy transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </div>
              </button>
              <div class="faq-content overflow-hidden max-h-0 transition-all duration-300">
                <p class="text-warm-600 text-sm leading-relaxed px-5 pb-5">${escHtml(f.a)}</p>
              </div>
            </div>`).join('');

  // Stats badges
  const statsHtml = `
          <div class="flex flex-wrap justify-center gap-4">
            <div class="bg-teal/10 border border-teal/20 rounded-xl px-5 py-3 text-center">
              <span class="block font-heading text-teal text-xl font-bold">${escHtml(c.stats.years)}+</span>
              <span class="text-warm-600 text-xs font-medium">Years</span>
            </div>
            <div class="bg-teal/10 border border-teal/20 rounded-xl px-5 py-3 text-center">
              <span class="block font-heading text-teal text-xl font-bold">${escHtml(c.stats.jobs)}+</span>
              <span class="text-warm-600 text-xs font-medium">Jobs Done</span>
            </div>
            <div class="bg-gold-star/10 border border-gold-star/20 rounded-xl px-5 py-3 text-center">
              <span class="block font-heading text-gold-star text-xl font-bold">${escHtml(c.stats.rating)}&#9733;</span>
              <span class="text-warm-600 text-xs font-medium">Rating</span>
            </div>
            <div class="bg-teal/10 border border-teal/20 rounded-xl px-5 py-3 text-center">
              <span class="block font-heading text-teal text-xl font-bold">&lt;${escHtml(c.stats.avgResponse)}m</span>
              <span class="text-warm-600 text-xs font-medium">Avg Response</span>
            </div>
          </div>`;

  return `<!DOCTYPE html>
<!-- DEMO: ${biz} | Family: trust | Generated by Variation Engine -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${biz} — Trusted ${escHtml(c.nicheLabel)} in ${city}</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Source+Sans+3:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            warm: { DEFAULT: '#FFF9F0', 100: '#f0e6d3', 600: '#6b5c4c', 700: '#4a3f33' },
            navy: '#1B2A4A',
            teal: '#0D6E6E',
            'teal-dark': '#0a5a5a',
            'gold-star': '#D4A843',
          },
          fontFamily: {
            heading: ['Lora', 'serif'],
            body: ['"Source Sans 3"', 'sans-serif'],
          },
          boxShadow: {
            warm: '0 4px 24px rgba(139, 109, 63, 0.08)',
          },
        },
      },
    };
  <\/script>
  <style>
    html { scroll-behavior: smooth; }
    body { font-family: 'Source Sans 3', sans-serif; background: #FFF9F0; color: #1B2A4A; }

    /* Reveal animation */
    .reveal {
      opacity: 0;
      transform: translateY(28px);
      transition: opacity 0.6s ease, transform 0.6s ease;
    }
    .reveal.visible {
      opacity: 1;
      transform: translateY(0);
    }

    /* FAQ */
    .faq-item .faq-content { max-height: 0; }
    .faq-item.open .faq-content { max-height: 300px; }
    .faq-item.open .faq-icon { transform: rotate(180deg); }
    .faq-item.open .faq-icon-wrap { background: #0D6E6E; }
    .faq-item.open .faq-icon { color: #fff; }

    /* Mobile menu */
    #trust-mobile-menu {
      transform: translateX(100%);
      transition: transform 0.3s ease;
    }
    #trust-mobile-menu.open {
      transform: translateX(0);
    }

    /* Form toast */
    .toast-trust {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(-16px);
      background: #0D6E6E;
      color: #fff;
      padding: 14px 28px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      z-index: 9998;
      opacity: 0;
      transition: opacity 0.3s, transform 0.3s;
      box-shadow: 0 8px 32px rgba(13, 110, 110, 0.25);
    }
    .toast-trust.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    ::selection {
      background: rgba(13, 110, 110, 0.15);
    }
  </style>
</head>
<body class="bg-warm antialiased">

  <!-- NAVIGATION -->
  <nav class="fixed top-0 left-0 right-0 z-50 bg-navy shadow-lg">
    <div class="max-w-[1100px] mx-auto px-6 py-0 flex items-center justify-between h-16">
      <a href="#" class="font-heading text-white text-lg font-bold tracking-tight">${biz}</a>
      <div class="hidden md:flex items-center gap-6">
        <a href="#services" class="text-white/80 text-sm font-medium hover:text-white transition-colors">Services</a>
        <a href="#about" class="text-white/80 text-sm font-medium hover:text-white transition-colors">About</a>
        <a href="#reviews" class="text-white/80 text-sm font-medium hover:text-white transition-colors">Reviews</a>
        <a href="#faq" class="text-white/80 text-sm font-medium hover:text-white transition-colors">FAQ</a>
        <a href="#contact" class="text-white/80 text-sm font-medium hover:text-white transition-colors">Contact</a>
      </div>
      <div class="hidden md:flex items-center gap-2">
        <svg class="w-4 h-4 text-teal" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
        <a href="tel:${phone.replace(/[^\d+]/g, '')}" class="text-white text-sm font-bold hover:text-teal transition-colors">${phone}</a>
      </div>
      <button id="trust-menu-btn" class="md:hidden text-white" aria-label="Menu">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg>
      </button>
    </div>
    <!-- Mobile slide-out -->
    <div id="trust-mobile-menu" class="md:hidden fixed inset-y-0 right-0 w-72 bg-navy shadow-2xl z-50 flex flex-col pt-20 px-8 gap-6">
      <button id="trust-menu-close" class="absolute top-5 right-5 text-white/70">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
      <a href="#services" class="trust-mobile-link text-white text-lg font-heading font-semibold">Services</a>
      <a href="#about" class="trust-mobile-link text-white text-lg font-heading font-semibold">About</a>
      <a href="#reviews" class="trust-mobile-link text-white text-lg font-heading font-semibold">Reviews</a>
      <a href="#faq" class="trust-mobile-link text-white text-lg font-heading font-semibold">FAQ</a>
      <a href="#contact" class="trust-mobile-link text-white text-lg font-heading font-semibold">Contact</a>
      <div class="mt-4 pt-4 border-t border-white/10">
        <a href="tel:${phone.replace(/[^\d+]/g, '')}" class="text-teal text-lg font-bold">${phone}</a>
      </div>
    </div>
  </nav>

  <!-- HERO (Split layout) -->
  <section class="pt-16 bg-warm">
    <div class="max-w-[1100px] mx-auto px-6 py-16 md:py-24">
      <div class="flex flex-col md:flex-row items-center gap-10 md:gap-16">
        <!-- Left: text -->
        <div class="w-full md:w-1/2 reveal">
          <p class="text-teal text-xs font-bold tracking-widest uppercase mb-4">${escHtml(c.headlineSub)}</p>
          <h1 class="font-heading text-navy text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-5">${escHtml(c.headline)}</h1>
          <p class="text-warm-700 text-lg leading-relaxed mb-8">${escHtml(c.subline)}</p>
          <div class="flex flex-col sm:flex-row gap-3 mb-8">
            <a href="#contact" class="inline-flex items-center justify-center px-7 py-3.5 bg-teal text-white font-semibold text-sm rounded-xl hover:bg-teal-dark transition-colors shadow-warm">
              ${escHtml(c.cta1)}
            </a>
            <a href="#reviews" class="inline-flex items-center justify-center px-7 py-3.5 bg-white text-navy font-semibold text-sm rounded-xl border border-warm-100 hover:bg-warm transition-colors">
              ${escHtml(c.cta2)}
            </a>
          </div>
          ${statsHtml}
        </div>
        <!-- Right: hero image -->
        <div class="w-full md:w-1/2 reveal" style="transition-delay: 0.15s;">
          <div class="rounded-2xl overflow-hidden shadow-warm">
            <img src="${escHtml(heroImg)}" alt="${biz} - ${escHtml(c.nicheLabel)}" class="w-full h-auto object-cover aspect-[4/3]" loading="eager">
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- TRUST BADGES BAR -->
  <section class="bg-white py-10 border-y border-warm-100 reveal">
    <div class="max-w-[1100px] mx-auto px-6">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        ${badgesHtml}
      </div>
    </div>
  </section>

  <!-- ALTERNATING SERVICE ROWS -->
  <div id="services">
    ${serviceRowsHtml}
  </div>

  <!-- EXTRA SERVICES (if any) -->
  ${extraServicesHtml ? `
  <section class="bg-warm py-16 md:py-20 reveal">
    <div class="max-w-[1100px] mx-auto px-6">
      <div class="text-center mb-12">
        <p class="text-teal text-xs font-bold tracking-widest uppercase mb-3">More Services</p>
        <h2 class="font-heading text-navy text-2xl md:text-3xl font-bold">We Also Handle</h2>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${extraServicesHtml}
      </div>
    </div>
  </section>` : ''}

  <!-- ABOUT / TEAM -->
  <section id="about" class="bg-navy py-16 md:py-24 reveal">
    <div class="max-w-[1100px] mx-auto px-6">
      <div class="flex flex-col md:flex-row items-center gap-10 md:gap-16">
        <div class="w-full md:w-1/2">
          <div class="rounded-2xl bg-gradient-to-br from-teal/20 to-navy/40 aspect-[4/3] flex items-center justify-center">
            <div class="text-center text-white/80">
              <div class="text-6xl mb-4">${escHtml(c.emoji)}</div>
              <p class="font-heading text-xl font-bold text-white">Serving ${city}</p>
              <p class="text-white/60 text-sm mt-1">for ${escHtml(c.stats.years)}+ years</p>
            </div>
          </div>
        </div>
        <div class="w-full md:w-1/2">
          <p class="text-teal text-xs font-bold tracking-widest uppercase mb-4">About Us</p>
          <h2 class="font-heading text-white text-2xl md:text-3xl font-bold mb-5">${escHtml(c.whyTitle)}</h2>
          <p class="text-white/70 text-base leading-relaxed mb-6">${escHtml(c.whySub)}</p>
          <div class="space-y-4">
            ${c.whyUs.map(w => `
            <div class="flex items-start gap-3">
              <div class="w-6 h-6 rounded-full bg-teal flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
              </div>
              <div>
                <h4 class="text-white font-semibold text-sm">${escHtml(w.title)}</h4>
                <p class="text-white/60 text-sm leading-relaxed">${escHtml(w.desc)}</p>
              </div>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- TESTIMONIALS -->
  <section id="reviews" class="bg-warm py-16 md:py-20 reveal">
    <div class="max-w-[1100px] mx-auto px-6">
      <div class="text-center mb-12">
        <p class="text-teal text-xs font-bold tracking-widest uppercase mb-3">Customer Reviews</p>
        <h2 class="font-heading text-navy text-2xl md:text-3xl font-bold">What Your Neighbors Say</h2>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        ${testimonialsHtml}
      </div>
    </div>
  </section>

  <!-- FAQ -->
  <section id="faq" class="bg-white py-16 md:py-20 reveal">
    <div class="max-w-[700px] mx-auto px-6">
      <div class="text-center mb-12">
        <p class="text-teal text-xs font-bold tracking-widest uppercase mb-3">Common Questions</p>
        <h2 class="font-heading text-navy text-2xl md:text-3xl font-bold">Frequently Asked Questions</h2>
      </div>
      <div>
        ${faqHtml}
      </div>
    </div>
  </section>

  <!-- CONTACT -->
  <section id="contact" class="bg-warm py-16 md:py-20 reveal">
    <div class="max-w-[1100px] mx-auto px-6">
      <div class="flex flex-col md:flex-row gap-10 md:gap-16">
        <!-- Left info -->
        <div class="w-full md:w-5/12">
          <p class="text-teal text-xs font-bold tracking-widest uppercase mb-3">Get In Touch</p>
          <h2 class="font-heading text-navy text-2xl md:text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p class="text-warm-700 text-base leading-relaxed mb-8">Fill out the form and our team will get back to you within ${escHtml(c.stats.avgResponse)} minutes during business hours.</p>
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center">
                <svg class="w-5 h-5 text-teal" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
              </div>
              <div>
                <p class="text-navy font-semibold text-sm">Call Us</p>
                <a href="tel:${phone.replace(/[^\d+]/g, '')}" class="text-teal font-bold text-sm">${phone}</a>
              </div>
            </div>
            ${email ? `
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center">
                <svg class="w-5 h-5 text-teal" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
              </div>
              <div>
                <p class="text-navy font-semibold text-sm">Email</p>
                <a href="mailto:${email}" class="text-teal font-bold text-sm">${email}</a>
              </div>
            </div>` : ''}
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center">
                <svg class="w-5 h-5 text-teal" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
              </div>
              <div>
                <p class="text-navy font-semibold text-sm">Location</p>
                <p class="text-warm-600 text-sm">${city}${state ? ', ' + state : ''}</p>
              </div>
            </div>
          </div>
        </div>
        <!-- Right form -->
        <div class="w-full md:w-7/12">
          <form id="trust-contact-form" class="bg-white rounded-2xl shadow-warm border border-warm-100 p-8">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-navy text-xs font-semibold mb-1.5">Full Name *</label>
                <input type="text" required class="w-full px-4 py-3 rounded-xl border border-warm-100 text-sm text-navy outline-none focus:border-teal focus:ring-2 focus:ring-teal/10 transition-all bg-warm" placeholder="John Smith">
              </div>
              <div>
                <label class="block text-navy text-xs font-semibold mb-1.5">Phone *</label>
                <input type="tel" required class="w-full px-4 py-3 rounded-xl border border-warm-100 text-sm text-navy outline-none focus:border-teal focus:ring-2 focus:ring-teal/10 transition-all bg-warm" placeholder="(555) 123-4567">
              </div>
            </div>
            <div class="mb-4">
              <label class="block text-navy text-xs font-semibold mb-1.5">Email</label>
              <input type="email" class="w-full px-4 py-3 rounded-xl border border-warm-100 text-sm text-navy outline-none focus:border-teal focus:ring-2 focus:ring-teal/10 transition-all bg-warm" placeholder="john@email.com">
            </div>
            <div class="mb-4">
              <label class="block text-navy text-xs font-semibold mb-1.5">Service Needed *</label>
              <select required class="w-full px-4 py-3 rounded-xl border border-warm-100 text-sm text-navy outline-none focus:border-teal focus:ring-2 focus:ring-teal/10 transition-all bg-warm appearance-none cursor-pointer">
                <option value="">Choose a service...</option>
                ${c.serviceOptions.map(o => `<option value="${escHtml(o)}">${escHtml(o)}</option>`).join('')}
              </select>
            </div>
            <div class="mb-6">
              <label class="block text-navy text-xs font-semibold mb-1.5">How Can We Help?</label>
              <textarea rows="3" class="w-full px-4 py-3 rounded-xl border border-warm-100 text-sm text-navy outline-none focus:border-teal focus:ring-2 focus:ring-teal/10 transition-all bg-warm resize-none" placeholder="Describe your issue or project..."></textarea>
            </div>
            <button type="submit" class="w-full py-3.5 bg-teal text-white font-bold text-sm rounded-xl hover:bg-teal-dark transition-colors shadow-warm">
              Request a Callback
            </button>
            <p class="text-center text-warm-600 text-xs mt-3">We typically respond within ${escHtml(c.stats.avgResponse)} minutes</p>
          </form>
        </div>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="bg-navy py-12">
    <div class="max-w-[1100px] mx-auto px-6">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-8 pb-8 border-b border-white/10">
        <div>
          <p class="font-heading text-white text-xl font-bold mb-2">${biz}</p>
          <p class="text-white/50 text-sm">${city}${state ? ', ' + state : ''}</p>
        </div>
        <div class="flex flex-col sm:flex-row gap-4 sm:gap-8">
          <a href="#services" class="text-white/60 text-sm hover:text-white transition-colors">Services</a>
          <a href="#about" class="text-white/60 text-sm hover:text-white transition-colors">About</a>
          <a href="#reviews" class="text-white/60 text-sm hover:text-white transition-colors">Reviews</a>
          <a href="#faq" class="text-white/60 text-sm hover:text-white transition-colors">FAQ</a>
          <a href="#contact" class="text-white/60 text-sm hover:text-white transition-colors">Contact</a>
        </div>
        <div>
          <a href="tel:${phone.replace(/[^\d+]/g, '')}" class="text-teal font-bold text-sm hover:text-white transition-colors">${phone}</a>
        </div>
      </div>
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
        <p class="text-white/30 text-xs">&copy; ${new Date().getFullYear()} ${biz}. All rights reserved.</p>
        <div class="flex items-center gap-1 text-white/30 text-xs">
          <span>Licensed</span>
          <span>&middot;</span>
          <span>Bonded</span>
          <span>&middot;</span>
          <span>Insured</span>
        </div>
      </div>
    </div>
  </footer>

  <!-- Toast notification -->
  <div id="trust-toast" class="toast-trust">Your request has been submitted! We'll call you back soon.</div>

  ${widgetHtml}

  <script>
  (function() {
    // Mobile menu
    var menuBtn = document.getElementById('trust-menu-btn');
    var mobileMenu = document.getElementById('trust-mobile-menu');
    var closeBtn = document.getElementById('trust-menu-close');
    menuBtn.addEventListener('click', function() { mobileMenu.classList.add('open'); });
    closeBtn.addEventListener('click', function() { mobileMenu.classList.remove('open'); });
    document.querySelectorAll('.trust-mobile-link').forEach(function(a) {
      a.addEventListener('click', function() { mobileMenu.classList.remove('open'); });
    });

    // FAQ accordion
    document.querySelectorAll('.faq-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var item = this.closest('.faq-item');
        var wasOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(function(fi) { fi.classList.remove('open'); });
        if (!wasOpen) item.classList.add('open');
      });
    });

    // Contact form toast
    var form = document.getElementById('trust-contact-form');
    var toast = document.getElementById('trust-toast');
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      toast.classList.add('show');
      form.reset();
      setTimeout(function() { toast.classList.remove('show'); }, 4000);
    });

    // Scroll reveal
    var reveals = document.querySelectorAll('.reveal');
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    reveals.forEach(function(el) { observer.observe(el); });

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(function(a) {
      a.addEventListener('click', function(e) {
        var target = document.querySelector(this.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

  })();
  <\/script>
</body>
</html>`;
}

module.exports = { name, label, generate };
