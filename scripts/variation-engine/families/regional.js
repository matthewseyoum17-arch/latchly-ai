/**
 * REGIONAL MARKET LEADER family
 * Dark navy hero, wide full-bleed layout, data/proof-heavy.
 * Lexend + Nunito Sans. Stats-forward, service-area prominence.
 * Think: the company that OWNS this market.
 */

const { escHtml } = require('../shared/utils');
const { getCopy } = require('../shared/copy');
const { generateWidget } = require('../shared/widget');

const name = 'regional';
const label = 'Regional Market Leader';

function generate(lead, niche) {
  const c = getCopy('regional', niche, lead);
  const biz = escHtml(lead.business_name);
  const phone = escHtml(lead.phone || '(555) 000-0000');
  const email = escHtml(lead.email || '');
  const city = escHtml(lead.city || 'Your City');
  const state = escHtml(lead.state || '');

  const heroImages = {
    hvac: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=1920&q=80',
    plumbing: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=1920&q=80',
    roofing: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&q=80',
  };
  const heroImg = heroImages[niche] || heroImages.hvac;

  const widgetHtml = generateWidget(lead, {
    emoji: c.emoji,
    headBg: 'linear-gradient(135deg, #0F1B2D, #1a2d47)',
    avatarBg: 'linear-gradient(135deg, #0F1B2D, #1a2d47)',
    fabBg: '#2563EB',
    fabRadius: '10px',
    fabSize: '52px',
    panelRadius: '10px',
    bodyFont: "'Nunito Sans', sans-serif",
    headingFont: "'Lexend', sans-serif",
    userMsgBg: '#2563EB',
    sendBg: '#2563EB',
    sendHoverBg: '#1d4ed8',
    linkColor: '#2563EB',
    inputFocusBorder: '#2563EB',
    inputFocusRing: 'rgba(37, 99, 235, 0.12)',
    qrBorder: 'rgba(37, 99, 235, 0.3)',
    qrColor: '#2563EB',
    qrBg: 'rgba(37, 99, 235, 0.06)',
    qrHoverBg: '#2563EB',
    qrRadius: '8px',
    inputRadius: '10px',
    msgBotRadius: '4px 14px 14px 14px',
    msgUserRadius: '14px 14px 4px 14px',
    chatBg: '#f8fafc',
    fabShadow: '0 4px 20px rgba(37, 99, 235, 0.35)',
  }, c.quickReplies, c.serviceOptions);

  // Service icon SVGs by index
  const serviceIcons = [
    '<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17l-5.384 3.183 1.03-5.996L2.34 7.86l6.027-.876L11.42 1.5l3.053 5.484 6.027.876-4.726 4.497 1.03 5.996z"/></svg>',
    '<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z"/></svg>',
    '<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0l8.955 8.955M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"/></svg>',
    '<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>',
    '<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>',
    '<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  ];

  // Services grid HTML
  const servicesHtml = c.services.map((s, i) => `
              <div class="bg-white rounded-[10px] shadow-sm hover:shadow-md transition-shadow p-6 group">
                <div class="w-14 h-14 rounded-[10px] bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  ${serviceIcons[i] || serviceIcons[0]}
                </div>
                <h3 class="font-heading text-navy text-lg font-semibold mb-2">${escHtml(s.title)}</h3>
                <p class="text-slate-500 text-sm leading-relaxed">${escHtml(s.desc)}</p>
              </div>`).join('');

  // Testimonials grid
  const starSvg = '<svg class="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';
  const fiveStars = `${starSvg}${starSvg}${starSvg}${starSvg}${starSvg}`;
  const testimonialsHtml = c.testimonials.map(t => `
              <div class="bg-white rounded-[10px] shadow-sm p-6">
                <div class="flex items-center gap-1 mb-3">${fiveStars}</div>
                <p class="text-slate-600 text-sm leading-relaxed mb-4">&ldquo;${escHtml(t.text)}&rdquo;</p>
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold">${escHtml(t.name.charAt(0))}</div>
                  <span class="text-navy text-sm font-semibold">${escHtml(t.name)}</span>
                </div>
              </div>`).join('');

  // Why Us 4-col grid
  const whyIcons = [
    '<svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    '<svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg>',
    '<svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>',
    '<svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z"/></svg>',
  ];
  const whyUsHtml = c.whyUs.map((w, i) => `
              <div class="text-center">
                <div class="w-14 h-14 mx-auto rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                  ${whyIcons[i] || whyIcons[0]}
                </div>
                <h4 class="font-heading text-navy text-base font-semibold mb-2">${escHtml(w.title)}</h4>
                <p class="text-slate-500 text-sm leading-relaxed">${escHtml(w.desc)}</p>
              </div>`).join('');

  // FAQ accordion
  const faqHtml = c.faqs.map((f, i) => `
              <div class="faq-item border-b border-slate-200">
                <button class="faq-toggle w-full text-left py-5 flex items-center justify-between group" data-faq="${i}">
                  <span class="font-heading text-navy font-semibold text-sm pr-8">${escHtml(f.q)}</span>
                  <svg class="faq-icon w-5 h-5 text-slate-400 transition-transform duration-300 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </button>
                <div class="faq-content overflow-hidden max-h-0 transition-all duration-300">
                  <p class="text-slate-500 text-sm leading-relaxed pb-5">${escHtml(f.a)}</p>
                </div>
              </div>`).join('');

  // Surrounding city names for service area
  const areaCities = [
    city, 'Downtown ' + city, 'North ' + city, 'South ' + city,
    'East ' + city, 'West ' + city, city + ' Heights', city + ' Park',
    city + ' Hills', 'Greater ' + city + ' Metro',
    city + ' Springs', city + ' Valley',
  ];
  const areaCitiesHtml = areaCities.map(c => `<li class="text-slate-300 text-sm py-1">${escHtml(c)}</li>`).join('');

  return `<!DOCTYPE html>
<!-- DEMO: ${biz} | Family: regional | Generated by Variation Engine -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${biz} — #1 Rated ${escHtml(c.nicheLabel)} in ${city}</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&family=Nunito+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            navy: '#0F1B2D',
            'navy-light': '#162236',
            'navy-mid': '#1a2d47',
            blue: { 600: '#2563EB', 700: '#1d4ed8' },
            'light-bg': '#F8FAFC',
          },
          fontFamily: {
            heading: ['"Lexend"', 'sans-serif'],
            body: ['"Nunito Sans"', 'sans-serif'],
          },
        },
      },
    };
  <\/script>
  <style>
    html { scroll-behavior: smooth; }
    body { font-family: 'Nunito Sans', sans-serif; color: #334155; }

    .reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.7s ease, transform 0.7s ease; }
    .reveal.visible { opacity: 1; transform: translateY(0); }

    .faq-item .faq-content { max-height: 0; }
    .faq-item.open .faq-content { max-height: 400px; }
    .faq-item.open .faq-icon { transform: rotate(180deg); }

    #mobile-menu { transform: translateX(100%); transition: transform 0.3s ease; }
    #mobile-menu.open { transform: translateX(0); }

    .toast { position: fixed; top: 24px; right: 24px; background: #0F1B2D; color: #fff; padding: 16px 24px; border-radius: 10px; font-size: 14px; z-index: 9998; opacity: 0; transform: translateY(-12px); transition: opacity 0.3s, transform 0.3s; }
    .toast.show { opacity: 1; transform: translateY(0); }

    .booking-popup { position: fixed; bottom: 100px; left: 24px; background: #fff; border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); border: 1px solid #e2e8f0; padding: 14px 18px; z-index: 9997; opacity: 0; transform: translateY(12px); transition: opacity 0.4s, transform 0.4s; max-width: 280px; }
    .booking-popup.show { opacity: 1; transform: translateY(0); }

    .nav-scrolled { background: rgba(255,255,255,0.97) !important; box-shadow: 0 1px 8px rgba(0,0,0,0.06); }
    .nav-scrolled .nav-main-link { color: #0F1B2D; }
    .nav-scrolled .nav-main-logo { color: #0F1B2D; }

    ::selection { background: rgba(37, 99, 235, 0.15); }
  </style>
</head>
<body class="bg-white antialiased">

  <!-- UTILITY BAR -->
  <div class="bg-navy text-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between text-xs">
      <div class="flex items-center gap-4 sm:gap-6">
        <span class="flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
          Serving ${city} Metro
        </span>
        <span class="hidden sm:flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Mon-Sat: 7AM - 8PM &middot; Sun: Emergency Only
        </span>
      </div>
      <a href="tel:${phone.replace(/[^\d+]/g, '')}" class="flex items-center gap-1.5 font-bold hover:text-blue-300 transition-colors">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
        ${phone}
      </a>
    </div>
  </div>

  <!-- MAIN NAV -->
  <nav id="main-nav" class="sticky top-0 z-50 bg-white border-b border-slate-100 transition-all duration-300">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
      <a href="#" class="nav-main-logo font-heading text-navy text-xl font-bold tracking-tight">${biz}</a>
      <div class="hidden lg:flex items-center gap-8">
        <a href="#service-area" class="nav-main-link text-slate-600 text-sm font-medium hover:text-navy transition-colors">Service Area</a>
        <a href="#services" class="nav-main-link text-slate-600 text-sm font-medium hover:text-navy transition-colors">Services</a>
        <a href="#reviews" class="nav-main-link text-slate-600 text-sm font-medium hover:text-navy transition-colors">Reviews</a>
        <a href="#why-us" class="nav-main-link text-slate-600 text-sm font-medium hover:text-navy transition-colors">Why Us</a>
        <a href="#faq" class="nav-main-link text-slate-600 text-sm font-medium hover:text-navy transition-colors">FAQ</a>
      </div>
      <div class="flex items-center gap-3">
        <a href="#contact" class="hidden sm:inline-flex items-center px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-[10px] hover:bg-blue-700 transition-colors shadow-sm">${escHtml(c.cta1)}</a>
        <button id="menu-btn" class="lg:hidden text-navy p-1" aria-label="Menu">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg>
        </button>
      </div>
    </div>
    <!-- Mobile menu -->
    <div id="mobile-menu" class="lg:hidden fixed inset-0 top-0 bg-white z-[60] flex flex-col">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <span class="font-heading text-navy text-xl font-bold">${biz}</span>
        <button id="menu-close" class="text-navy p-1" aria-label="Close">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center gap-8">
        <a href="#service-area" class="mobile-nav-link font-heading text-2xl text-navy font-semibold">Service Area</a>
        <a href="#services" class="mobile-nav-link font-heading text-2xl text-navy font-semibold">Services</a>
        <a href="#reviews" class="mobile-nav-link font-heading text-2xl text-navy font-semibold">Reviews</a>
        <a href="#why-us" class="mobile-nav-link font-heading text-2xl text-navy font-semibold">Why Us</a>
        <a href="#faq" class="mobile-nav-link font-heading text-2xl text-navy font-semibold">FAQ</a>
        <a href="#contact" class="mobile-nav-link mt-4 inline-flex items-center px-8 py-3 bg-blue-600 text-white text-base font-bold rounded-[10px]">${escHtml(c.cta1)}</a>
      </div>
    </div>
  </nav>

  <!-- HERO with full-width image + stats overlay -->
  <section class="relative">
    <div class="relative h-[600px] sm:h-[650px] lg:h-[700px] overflow-hidden">
      <img src="${heroImg}" alt="${escHtml(c.nicheLabel)} in ${city}" class="absolute inset-0 w-full h-full object-cover" loading="eager">
      <div class="absolute inset-0 bg-gradient-to-b from-navy/80 via-navy/60 to-navy/90"></div>
      <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center pb-28">
        <p class="text-blue-300 text-xs sm:text-sm tracking-[0.15em] uppercase font-bold mb-4 reveal">${escHtml(c.headlineSub)}</p>
        <h1 class="font-heading text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight max-w-3xl mb-6 reveal" style="transition-delay:0.1s">${escHtml(c.headline)}</h1>
        <p class="text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl mb-8 reveal" style="transition-delay:0.2s">${escHtml(c.subline)}</p>
        <div class="flex flex-col sm:flex-row items-start gap-3 reveal" style="transition-delay:0.3s">
          <a href="#contact" class="inline-flex items-center px-7 py-3 bg-blue-600 text-white text-sm font-bold rounded-[10px] hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25">${escHtml(c.cta1)}</a>
          <a href="#service-area" class="inline-flex items-center px-7 py-3 border-2 border-white/30 text-white text-sm font-bold rounded-[10px] hover:bg-white/10 transition-colors">${escHtml(c.cta2)}</a>
        </div>
      </div>
    </div>
    <!-- STATS OVERLAY BAR — overlaps hero into next section -->
    <div class="relative z-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20">
      <div class="bg-white rounded-[10px] shadow-xl shadow-slate-200/50 border border-slate-100 grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100">
        <div class="p-6 sm:p-8 text-center">
          <div class="font-heading text-navy text-3xl sm:text-4xl font-extrabold">${escHtml(c.stats.avgResponse)}<span class="text-blue-600">min</span></div>
          <p class="text-slate-400 text-xs sm:text-sm font-medium mt-1">Avg Response Time</p>
        </div>
        <div class="p-6 sm:p-8 text-center">
          <div class="font-heading text-navy text-3xl sm:text-4xl font-extrabold">${escHtml(c.stats.jobs)}<span class="text-blue-600">+</span></div>
          <p class="text-slate-400 text-xs sm:text-sm font-medium mt-1">Jobs Completed</p>
        </div>
        <div class="p-6 sm:p-8 text-center">
          <div class="font-heading text-navy text-3xl sm:text-4xl font-extrabold">${escHtml(c.stats.rating)}<span class="text-amber-400">&#9733;</span></div>
          <p class="text-slate-400 text-xs sm:text-sm font-medium mt-1">Google Rating</p>
        </div>
        <div class="p-6 sm:p-8 text-center">
          <div class="font-heading text-navy text-3xl sm:text-4xl font-extrabold">${escHtml(c.stats.years)}<span class="text-blue-600">yr</span></div>
          <p class="text-slate-400 text-xs sm:text-sm font-medium mt-1">Years in Business</p>
        </div>
      </div>
    </div>
  </section>

  <!-- SERVICE AREA -->
  <section id="service-area" class="pt-28 pb-20 bg-navy text-white mt-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12 reveal">
        <p class="text-blue-400 text-xs tracking-[0.2em] uppercase font-bold mb-3">Coverage Area</p>
        <h2 class="font-heading text-white text-2xl sm:text-3xl lg:text-4xl font-bold">Proudly Serving the Greater ${city} Metro</h2>
        <p class="text-slate-400 text-base mt-3 max-w-xl mx-auto">Full-service ${escHtml(c.nicheLabel.toLowerCase())} coverage across the entire ${city} metropolitan area and surrounding communities.</p>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-1 max-w-3xl mx-auto reveal" style="transition-delay:0.1s">
        <ul>${areaCitiesHtml}</ul>
      </div>
      <div class="text-center mt-10 reveal" style="transition-delay:0.2s">
        <a href="#contact" class="inline-flex items-center gap-2 text-blue-400 text-sm font-bold hover:text-blue-300 transition-colors group">
          Don't see your area? Contact us
          <svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3"/></svg>
        </a>
      </div>
    </div>
  </section>

  <!-- SERVICES -->
  <section id="services" class="py-20 bg-light-bg">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-14 reveal">
        <p class="text-blue-600 text-xs tracking-[0.2em] uppercase font-bold mb-3">What We Do</p>
        <h2 class="font-heading text-navy text-2xl sm:text-3xl lg:text-4xl font-bold">Our ${escHtml(c.nicheLabel)} Solutions</h2>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 reveal" style="transition-delay:0.1s">
        ${servicesHtml}
      </div>
    </div>
  </section>

  <!-- REVIEWS -->
  <section id="reviews" class="py-20 bg-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-14 reveal">
        <p class="text-blue-600 text-xs tracking-[0.2em] uppercase font-bold mb-3">Customer Reviews</p>
        <h2 class="font-heading text-navy text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">What ${city} Homeowners Say</h2>
        <!-- Google badge -->
        <div class="inline-flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-full px-5 py-2.5">
          <div class="flex items-center gap-0.5">${fiveStars}</div>
          <span class="font-heading text-navy font-bold text-sm">${escHtml(c.stats.rating)}</span>
          <span class="text-slate-400 text-xs">on Google</span>
          <span class="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">200+ 5-Star Reviews</span>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 reveal" style="transition-delay:0.1s">
        ${testimonialsHtml}
      </div>
    </div>
  </section>

  <!-- WHY CHOOSE US -->
  <section id="why-us" class="py-20 bg-light-bg">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-14 reveal">
        <p class="text-blue-600 text-xs tracking-[0.2em] uppercase font-bold mb-3">Why Choose Us</p>
        <h2 class="font-heading text-navy text-2xl sm:text-3xl lg:text-4xl font-bold">${escHtml(c.whyTitle)}</h2>
        <p class="text-slate-500 text-base mt-3 max-w-lg mx-auto">${escHtml(c.whySub)}</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 reveal" style="transition-delay:0.1s">
        ${whyUsHtml}
      </div>
    </div>
  </section>

  <!-- FAQ -->
  <section id="faq" class="py-20 bg-white">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-14 reveal">
        <p class="text-blue-600 text-xs tracking-[0.2em] uppercase font-bold mb-3">FAQ</p>
        <h2 class="font-heading text-navy text-2xl sm:text-3xl font-bold">Frequently Asked Questions</h2>
      </div>
      <div class="reveal" style="transition-delay:0.1s">
        ${faqHtml}
      </div>
    </div>
  </section>

  <!-- CONTACT -->
  <section id="contact" class="py-20 bg-navy">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12 reveal">
        <p class="text-blue-400 text-xs tracking-[0.2em] uppercase font-bold mb-3">Get Started</p>
        <h2 class="font-heading text-white text-2xl sm:text-3xl lg:text-4xl font-bold mb-3">Request Service Today</h2>
        <p class="text-slate-400 text-base">Fill out the form below or call <a href="tel:${phone.replace(/[^\d+]/g, '')}" class="text-blue-400 font-bold hover:underline">${phone}</a></p>
      </div>
      <form id="contact-form" class="bg-white rounded-[10px] p-6 sm:p-8 shadow-xl reveal" style="transition-delay:0.1s">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label class="block text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Full Name *</label>
            <input type="text" required class="w-full border border-slate-200 rounded-[10px] px-4 py-3 text-sm text-navy outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition font-body" placeholder="John Smith">
          </div>
          <div>
            <label class="block text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Phone *</label>
            <input type="tel" required class="w-full border border-slate-200 rounded-[10px] px-4 py-3 text-sm text-navy outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition font-body" placeholder="(555) 123-4567">
          </div>
        </div>
        <div class="mb-5">
          <label class="block text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Email</label>
          <input type="email" class="w-full border border-slate-200 rounded-[10px] px-4 py-3 text-sm text-navy outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition font-body" placeholder="john@email.com">
        </div>
        <div class="mb-5">
          <label class="block text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Service Needed *</label>
          <select required class="w-full border border-slate-200 rounded-[10px] px-4 py-3 text-sm text-navy outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition font-body appearance-none cursor-pointer bg-white">
            <option value="">Select a service</option>
            ${c.serviceOptions.map(o => `<option value="${escHtml(o)}">${escHtml(o)}</option>`).join('')}
          </select>
        </div>
        <div class="mb-6">
          <label class="block text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Tell Us More</label>
          <textarea rows="3" class="w-full border border-slate-200 rounded-[10px] px-4 py-3 text-sm text-navy outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition font-body resize-none" placeholder="Describe your issue or project"></textarea>
        </div>
        <button type="submit" class="w-full py-3.5 bg-blue-600 text-white text-sm font-bold rounded-[10px] hover:bg-blue-700 transition-colors shadow-sm">${escHtml(c.cta1)}</button>
      </form>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="bg-navy border-t border-white/10 py-16">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
        <div>
          <h3 class="font-heading text-white text-lg font-bold mb-3">${biz}</h3>
          <p class="text-slate-400 text-sm leading-relaxed">${city}${state ? ', ' + state : ''}'s most trusted ${escHtml(c.nicheLabel.toLowerCase())} provider. Licensed, bonded, and insured.</p>
          <p class="text-slate-400 text-sm mt-3">
            <a href="tel:${phone.replace(/[^\d+]/g, '')}" class="text-blue-400 font-bold hover:text-blue-300 transition-colors">${phone}</a>
          </p>
        </div>
        <div>
          <h4 class="font-heading text-white text-sm font-bold uppercase tracking-wider mb-3">Quick Links</h4>
          <ul class="space-y-2">
            <li><a href="#services" class="text-slate-400 text-sm hover:text-white transition-colors">Services</a></li>
            <li><a href="#reviews" class="text-slate-400 text-sm hover:text-white transition-colors">Reviews</a></li>
            <li><a href="#why-us" class="text-slate-400 text-sm hover:text-white transition-colors">Why Us</a></li>
            <li><a href="#contact" class="text-slate-400 text-sm hover:text-white transition-colors">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-heading text-white text-sm font-bold uppercase tracking-wider mb-3">Service Areas</h4>
          <ul class="grid grid-cols-2 gap-x-4 gap-y-1">
            ${areaCities.slice(0, 8).map(ac => `<li class="text-slate-400 text-sm">${escHtml(ac)}</li>`).join('')}
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10 pt-8 text-center">
        <p class="text-slate-500 text-xs">&copy; ${new Date().getFullYear()} ${biz}. All rights reserved.</p>
      </div>
    </div>
  </footer>

  <!-- Toast notification -->
  <div id="toast" class="toast">Your request has been submitted! We'll contact you shortly.</div>

  <!-- Booking notification popup -->
  <div id="booking-popup" class="booking-popup">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
      </div>
      <div>
        <p class="text-navy text-xs font-bold">Someone in ${city} just booked</p>
        <p class="text-slate-400 text-[11px]">AC Repair &middot; 2 minutes ago</p>
      </div>
    </div>
  </div>

  ${widgetHtml}

  <script>
  (function() {
    // Mobile menu
    var menuBtn = document.getElementById('menu-btn');
    var menuClose = document.getElementById('menu-close');
    var mobileMenu = document.getElementById('mobile-menu');
    function openMenu() { mobileMenu.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function closeMenu() { mobileMenu.classList.remove('open'); document.body.style.overflow = ''; }
    menuBtn.addEventListener('click', openMenu);
    menuClose.addEventListener('click', closeMenu);
    document.querySelectorAll('.mobile-nav-link').forEach(function(a) {
      a.addEventListener('click', closeMenu);
    });

    // Nav scroll behavior
    var mainNav = document.getElementById('main-nav');
    window.addEventListener('scroll', function() {
      if (window.scrollY > 60) {
        mainNav.classList.add('nav-scrolled');
      } else {
        mainNav.classList.remove('nav-scrolled');
      }
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

    // Contact form
    var form = document.getElementById('contact-form');
    var toast = document.getElementById('toast');
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      toast.classList.add('show');
      form.reset();
      setTimeout(function() { toast.classList.remove('show'); }, 3500);
    });

    // Scroll reveal
    var reveals = document.querySelectorAll('.reveal');
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
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

    // Booking notification popup
    var popup = document.getElementById('booking-popup');
    var services = ${JSON.stringify(c.serviceOptions.slice(0, 5))};
    function showBooking() {
      var svc = services[Math.floor(Math.random() * services.length)];
      var mins = Math.floor(Math.random() * 10) + 1;
      popup.querySelector('p:last-child').textContent = svc + ' \\u00b7 ' + mins + ' minute' + (mins > 1 ? 's' : '') + ' ago';
      popup.classList.add('show');
      setTimeout(function() { popup.classList.remove('show'); }, 4000);
    }
    setTimeout(showBooking, 8000);
    setInterval(showBooking, 25000);
  })();
  <\/script>
</body>
</html>`;
}

module.exports = { name, label, generate };
