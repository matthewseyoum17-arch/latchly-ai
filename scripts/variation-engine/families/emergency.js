/**
 * EMERGENCY CONVERSION MACHINE
 * Dense, urgent, conversion-first, high contrast, fast-response energy.
 * Barlow Condensed + Roboto | Near-black bg (#0D0D0D) | Red/orange accents
 * Strongest mobile CTA behavior — built to get calls NOW.
 */

const { escHtml } = require('../shared/utils');
const { getCopy } = require('../shared/copy');
const { generateWidget } = require('../shared/widget');
const { getTheme } = require('../shared/niche-themes');

const name = 'emergency';
const label = 'Emergency Conversion Machine';
const designProfile = {
  layout: 'dense-triage-call-machine',
  hero: 'split-copy-and-response-panel',
  typography: 'barlow-condensed+roboto',
  sectionOrder: 'urgency-bar|sticky-phone-nav|hero-split|response-badges|service-grid|review-strip|faq|mobile-call-bar',
  components: 'sharp-panels|response-chips|call-heavy-cta|triage-list|alert-badges',
  personality: 'urgent-no-nonsense-conversion',
  ctaStrategy: 'call-now-immediate-dispatch',
  colorScheme: 'black-red-orange-white',
  density: 'tight-high-urgency',
  navStyle: 'sticky-phone-visible',
};

function generate(lead, niche) {
  const c = getCopy(name, niche, lead);
  const t = getTheme('emergency', niche);
  const tc = t.colors;
  const biz = escHtml(lead.business_name);
  const phone = escHtml(lead.phone || '(555) 000-0000');
  const phoneHref = (lead.phone || '5550000000').replace(/[^0-9+]/g, '');
  const city = escHtml(lead.city || 'Your City');
  const state = escHtml(lead.state || '');
  const cityState = [lead.city, lead.state].filter(Boolean).join(', ');

  const widgetHtml = generateWidget(lead, {
    emoji: c.emoji,
    headBg: `linear-gradient(135deg,${tc.bgCard},${tc.bgCard}dd)`,
    avatarBg: `linear-gradient(135deg,${tc.primary},${tc.secondary})`,
    fabBg: tc.primary,
    fabRadius: '4px',
    fabSize: '56px',
    panelRadius: '4px',
    bodyFont: "'Roboto',sans-serif",
    headingFont: "'Barlow Condensed',sans-serif",
    userMsgBg: tc.primary,
    sendBg: tc.primary,
    sendHoverBg: tc.primaryHover,
    linkColor: tc.primary,
    inputFocusBorder: tc.primary,
    inputFocusRing: tc.accentGlow,
    qrBorder: `${tc.primary}4d`,
    qrColor: tc.primary,
    qrBg: `${tc.primary}14`,
    qrHoverBg: tc.primary,
    qrRadius: '4px',
    inputRadius: '4px',
    msgBotRadius: '2px 12px 12px 12px',
    msgUserRadius: '12px 12px 2px 12px',
    chatBg: tc.bgAlt,
    fabShadow: `0 4px 20px ${tc.accentGlow}`,
    fabBottom: '88px',
    emojiRadius: '4px',
    sendRadius: '4px',
  }, c.quickReplies, c.serviceOptions);

  // Build service grid items with niche-specific icons
  const serviceGridHtml = c.services.map((s, i) => `
            <div class="svc-block reveal-el" style="animation-delay:${i * 60}ms">
              <span class="svc-icon">${t.icons[i % t.icons.length] || c.emoji}</span>
              <span class="svc-name">${escHtml(s.title)}</span>
            </div>`).join('');

  // Build testimonial cards
  const testimonialCardsHtml = c.testimonials.map((t, i) => `
              <div class="testi-card reveal-el" style="animation-delay:${i * 80}ms">
                <div class="testi-stars">${'<svg class="testi-star" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>'.repeat(t.rating)}</div>
                <p class="testi-text">"${escHtml(t.text)}"</p>
                <p class="testi-author">— ${escHtml(t.name)}</p>
              </div>`).join('');

  // Build FAQ items
  const faqHtml = c.faqs.map((f, i) => `
              <div class="faq-item reveal-el" style="animation-delay:${i * 60}ms">
                <button class="faq-q" onclick="this.parentElement.classList.toggle('open')" aria-expanded="false">
                  <span>${escHtml(f.q)}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                <div class="faq-a">
                  <p>${escHtml(f.a)}</p>
                </div>
              </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${biz} — Emergency ${escHtml(c.nicheLabel)} in ${city}${state ? ', ' + state : ''}</title>
  <meta name="description" content="${escHtml(c.subline)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    :root {
      --bg-primary: ${tc.bg};
      --bg-secondary: ${tc.bgAlt};
      --bg-card: ${tc.bgCard};
      --red: ${tc.primary};
      --red-hover: ${tc.primaryHover};
      --orange: ${tc.secondary};
      --niche-accent: ${tc.nicheAccent || tc.secondary};
      --white: #FFFFFF;
      --gray-100: #F7F7F7;
      --gray-300: #A0A0A0;
      --gray-500: #6B6B6B;
      --heading-font: 'Barlow Condensed', sans-serif;
      --body-font: 'Roboto', sans-serif;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      font-family: var(--body-font);
      background: var(--bg-primary);
      background-image: ${t.pattern(tc.primary, 0.03)};
      color: var(--white);
      -webkit-font-smoothing: antialiased;
    }

    /* ── URGENCY BAR ── */
    .urgency-bar {
      background: var(--red);
      padding: 6px 16px;
      text-align: center;
      font-family: var(--heading-font);
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      position: relative;
      z-index: 100;
    }
    .urgency-dot {
      width: 8px; height: 8px;
      background: #fff;
      border-radius: 50%;
      animation: pulse-dot 1.2s ease-in-out infinite;
    }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: .4; transform: scale(.7); }
    }

    /* ── STICKY NAV ── */
    .em-nav {
      position: sticky; top: 0; z-index: 90;
      background: ${tc.bg}f7;
      backdrop-filter: blur(8px);
      border-bottom: 1px solid ${tc.primary}33;
      padding: 0 16px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .em-nav-logo {
      font-family: var(--heading-font);
      font-weight: 800;
      font-size: 20px;
      letter-spacing: .5px;
      text-transform: uppercase;
      color: var(--white);
      text-decoration: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
    }
    .em-nav-phone {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--red);
      color: #fff;
      font-family: var(--heading-font);
      font-weight: 700;
      font-size: 15px;
      letter-spacing: .5px;
      padding: 8px 18px;
      border-radius: 4px;
      text-decoration: none;
      transition: background .15s;
    }
    .em-nav-phone:hover { background: var(--red-hover); }
    .em-nav-links {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .em-nav-link {
      font-family: var(--heading-font);
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--gray-300);
      text-decoration: none;
      transition: color .15s;
    }
    .em-nav-link:hover { color: var(--white); }
    @media(max-width:768px) {
      .em-nav-links .em-nav-link { display: none; }
      .em-nav-logo { font-size: 16px; max-width: 140px; }
      .em-nav-phone { font-size: 13px; padding: 7px 14px; }
    }

    /* ── HERO ── */
    .em-hero {
      background: var(--bg-primary);
      padding: 48px 16px 56px;
      border-bottom: 3px solid var(--red);
      position: relative;
      overflow: hidden;
    }
    .em-hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: url('${escHtml(t.heroImages.primary)}');
      background-size: cover;
      background-position: center;
      opacity: 0.07;
      filter: grayscale(100%);
    }
    .em-hero-inner {
      max-width: 1100px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 48px;
      align-items: center;
      position: relative;
      z-index: 1;
    }
    .em-hero-copy h1 {
      font-family: var(--heading-font);
      font-weight: 900;
      font-size: clamp(40px, 6vw, 64px);
      line-height: .95;
      text-transform: uppercase;
      letter-spacing: -1px;
      margin-bottom: 8px;
    }
    .em-hero-copy h1 .red { color: var(--red); }
    .em-hero-sub {
      font-family: var(--heading-font);
      font-weight: 700;
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--orange);
      margin-bottom: 16px;
    }
    .em-hero-desc {
      font-size: 16px;
      line-height: 1.6;
      color: var(--gray-300);
      margin-bottom: 24px;
      max-width: 440px;
    }
    .em-hero-badges {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .em-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .5px;
      color: var(--gray-300);
    }
    .em-badge svg { color: var(--red); flex-shrink: 0; }

    /* Hero inline form */
    .em-hero-form {
      background: var(--bg-card);
      border: 1px solid ${tc.primary}40;
      border-radius: 4px;
      padding: 28px 24px;
    }
    .em-hero-form h3 {
      font-family: var(--heading-font);
      font-weight: 800;
      font-size: 22px;
      text-transform: uppercase;
      letter-spacing: .5px;
      margin-bottom: 4px;
    }
    .em-hero-form .form-sub {
      font-size: 13px;
      color: var(--gray-500);
      margin-bottom: 20px;
    }
    .em-field {
      margin-bottom: 12px;
    }
    .em-field label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--gray-300);
      margin-bottom: 4px;
    }
    .em-field input,
    .em-field select {
      width: 100%;
      padding: 10px 12px;
      background: ${tc.bg};
      border: 1px solid #333;
      border-radius: 4px;
      color: #fff;
      font-family: var(--body-font);
      font-size: 14px;
      outline: none;
      transition: border-color .15s;
    }
    .em-field input:focus,
    .em-field select:focus {
      border-color: var(--red);
    }
    .em-field select option { background: ${tc.bgCard}; }
    .em-submit {
      width: 100%;
      padding: 14px;
      background: var(--red);
      color: #fff;
      border: none;
      border-radius: 4px;
      font-family: var(--heading-font);
      font-weight: 800;
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
      transition: background .15s, transform .1s;
      margin-top: 4px;
    }
    .em-submit:hover { background: var(--red-hover); transform: scale(1.01); }
    .em-form-phone {
      text-align: center;
      margin-top: 12px;
      font-size: 13px;
      color: var(--gray-500);
    }
    .em-form-phone a {
      color: var(--red);
      font-weight: 700;
      text-decoration: none;
    }

    @media(max-width:768px) {
      .em-hero-inner {
        grid-template-columns: 1fr;
        gap: 32px;
      }
      .em-hero { padding: 32px 16px 40px; }
    }

    /* ── RESPONSE STATS BAND ── */
    .em-stats-band {
      background: var(--bg-card);
      border-bottom: 1px solid #222;
      padding: 16px;
    }
    .em-stats-inner {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0;
      flex-wrap: wrap;
    }
    .em-stat-item {
      font-family: var(--heading-font);
      font-weight: 800;
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 2px;
      padding: 4px 24px;
      white-space: nowrap;
    }
    .em-stat-item .num { color: var(--red); }
    .em-stat-divider {
      width: 4px; height: 4px;
      background: var(--red);
      border-radius: 50%;
      flex-shrink: 0;
    }
    @media(max-width:640px) {
      .em-stat-item { font-size: 12px; padding: 4px 12px; letter-spacing: 1px; }
    }

    /* ── SERVICE BLOCKS ── */
    .em-services {
      background: var(--bg-primary);
      padding: 48px 16px;
    }
    .em-services-inner {
      max-width: 1100px;
      margin: 0 auto;
    }
    .em-section-head {
      text-align: center;
      margin-bottom: 32px;
    }
    .em-section-head h2 {
      font-family: var(--heading-font);
      font-weight: 900;
      font-size: clamp(28px, 4vw, 40px);
      text-transform: uppercase;
      letter-spacing: -.5px;
      margin-bottom: 4px;
    }
    .em-section-head p {
      font-size: 14px;
      color: var(--gray-500);
    }
    .svc-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2px;
    }
    .svc-block {
      background: var(--bg-card);
      border: 1px solid #222;
      border-radius: 4px;
      padding: 18px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: border-color .15s, background .15s;
    }
    .svc-block:hover {
      border-color: var(--red);
      background: ${tc.accentGlow};
    }
    .svc-icon {
      font-size: 18px;
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      color: var(--niche-accent);
    }
    .svc-icon svg {
      width: 100%;
      height: 100%;
    }
    .svc-name {
      font-family: var(--heading-font);
      font-weight: 700;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: .5px;
    }
    @media(max-width:768px) {
      .svc-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media(max-width:480px) {
      .svc-grid { grid-template-columns: 1fr 1fr; }
      .svc-block { padding: 14px 12px; }
      .svc-name { font-size: 12px; }
    }

    /* ── WHY US STRIP ── */
    .em-why {
      background: var(--bg-secondary);
      padding: 48px 16px;
      border-top: 1px solid ${tc.bgCard};
      border-bottom: 1px solid ${tc.bgCard};
    }
    .em-why-inner {
      max-width: 1100px;
      margin: 0 auto;
    }
    .em-why-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2px;
    }
    .em-why-card {
      background: var(--bg-card);
      border: 1px solid #222;
      border-radius: 4px;
      padding: 24px 20px;
      border-top: 3px solid var(--red);
    }
    .em-why-card h4 {
      font-family: var(--heading-font);
      font-weight: 800;
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: .5px;
      margin-bottom: 6px;
    }
    .em-why-card p {
      font-size: 13px;
      line-height: 1.5;
      color: var(--gray-300);
    }
    @media(max-width:768px) {
      .em-why-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
    }
    @media(max-width:480px) {
      .em-why-grid { grid-template-columns: 1fr; }
    }

    /* ── TESTIMONIALS HORIZONTAL SCROLL ── */
    .em-testimonials {
      background: var(--bg-primary);
      padding: 48px 16px;
    }
    .em-testi-inner {
      max-width: 1100px;
      margin: 0 auto;
    }
    .testi-scroll {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 12px;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: #333 transparent;
    }
    .testi-scroll::-webkit-scrollbar { height: 4px; }
    .testi-scroll::-webkit-scrollbar-track { background: transparent; }
    .testi-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
    .testi-card {
      background: var(--bg-card);
      border: 1px solid #222;
      border-radius: 4px;
      padding: 20px;
      min-width: 300px;
      max-width: 340px;
      flex-shrink: 0;
    }
    .testi-stars {
      color: #F59E0B;
      display: flex;
      gap: 2px;
      margin-bottom: 8px;
    }
    .testi-star {
      width: 14px;
      height: 14px;
    }
    .testi-text {
      font-size: 13px;
      line-height: 1.55;
      color: var(--gray-300);
      margin-bottom: 10px;
    }
    .testi-author {
      font-family: var(--heading-font);
      font-weight: 700;
      font-size: 13px;
      text-transform: uppercase;
      color: var(--white);
    }

    /* ── FAQ ACCORDION ── */
    .em-faq {
      background: var(--bg-secondary);
      padding: 48px 16px;
      border-top: 1px solid ${tc.bgCard};
    }
    .em-faq-inner {
      max-width: 700px;
      margin: 0 auto;
    }
    .faq-item {
      border-bottom: 1px solid #222;
    }
    .faq-q {
      width: 100%;
      background: none;
      border: none;
      color: var(--white);
      font-family: var(--heading-font);
      font-weight: 700;
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: .5px;
      text-align: left;
      padding: 16px 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      transition: color .15s;
    }
    .faq-q:hover { color: var(--red); }
    .faq-q svg {
      flex-shrink: 0;
      transition: transform .2s;
      color: var(--gray-500);
    }
    .faq-item.open .faq-q svg { transform: rotate(180deg); color: var(--red); }
    .faq-a {
      max-height: 0;
      overflow: hidden;
      transition: max-height .25s ease;
    }
    .faq-item.open .faq-a { max-height: 300px; }
    .faq-a p {
      font-size: 14px;
      line-height: 1.6;
      color: var(--gray-300);
      padding: 0 0 16px;
    }

    /* ── CTA BAND ── */
    .em-cta-band {
      background: var(--red);
      padding: 40px 16px;
      text-align: center;
    }
    .em-cta-band h2 {
      font-family: var(--heading-font);
      font-weight: 900;
      font-size: clamp(28px, 5vw, 48px);
      text-transform: uppercase;
      letter-spacing: -.5px;
      margin-bottom: 8px;
    }
    .em-cta-band p {
      font-size: 14px;
      opacity: .9;
      margin-bottom: 20px;
    }
    .em-cta-phone {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: var(--white);
      color: var(--red);
      font-family: var(--heading-font);
      font-weight: 900;
      font-size: clamp(24px, 4vw, 36px);
      padding: 16px 36px;
      border-radius: 4px;
      text-decoration: none;
      letter-spacing: 1px;
      transition: transform .15s, box-shadow .15s;
    }
    .em-cta-phone:hover {
      transform: scale(1.03);
      box-shadow: 0 8px 32px rgba(0,0,0,.3);
    }

    /* ── FOOTER ── */
    .em-footer {
      background: #080808;
      border-top: 1px solid ${tc.bgCard};
      padding: 32px 16px;
    }
    .em-footer-inner {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .em-footer-brand {
      font-family: var(--heading-font);
      font-weight: 800;
      font-size: 16px;
      text-transform: uppercase;
    }
    .em-footer-links {
      display: flex;
      gap: 20px;
    }
    .em-footer-links a {
      font-size: 12px;
      color: var(--gray-500);
      text-decoration: none;
      transition: color .15s;
    }
    .em-footer-links a:hover { color: var(--white); }
    .em-footer-copy {
      font-size: 11px;
      color: var(--gray-500);
      width: 100%;
      text-align: center;
      margin-top: 8px;
    }
    .em-footer-copy a { color: var(--gray-500); text-decoration: none; }
    .em-footer-copy a:hover { color: var(--white); }

    /* ── STICKY BOTTOM MOBILE CTA ── */
    .em-mobile-bar {
      display: none;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      z-index: 80;
      background: var(--bg-primary);
      border-top: 2px solid var(--red);
      padding: 8px 12px;
    }
    .em-mobile-bar a {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: var(--red);
      color: #fff;
      font-family: var(--heading-font);
      font-weight: 800;
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      padding: 14px;
      border-radius: 4px;
      text-decoration: none;
      transition: background .15s;
    }
    .em-mobile-bar a:hover { background: var(--red-hover); }
    @media(max-width:768px) {
      .em-mobile-bar { display: block; }
      body { padding-bottom: 72px; }
    }

    /* ── REVEAL ANIMATIONS ── */
    .reveal-el {
      opacity: 0;
      transform: translateY(12px);
      transition: opacity .3s ease, transform .3s ease;
    }
    .reveal-el.visible {
      opacity: 1;
      transform: translateY(0);
    }
  </style>
</head>
<body>

  <!-- ═══ SECTION 1: URGENCY BAR ═══ -->
  <section class="urgency-bar" aria-label="Emergency notice">
    <span class="urgency-dot"></span>
    <span>EMERGENCY ${escHtml(c.nicheLabel).toUpperCase()} — ${city.toUpperCase()} — DISPATCHING NOW</span>
    <span class="urgency-dot"></span>
  </section>

  <!-- ═══ SECTION 2: STICKY NAV ═══ -->
  <nav class="em-nav" aria-label="Main navigation">
    <a href="#" class="em-nav-logo">${biz}</a>
    <div class="em-nav-links">
      <a href="#services" class="em-nav-link">Services</a>
      <a href="#reviews" class="em-nav-link">Reviews</a>
      <a href="#faq" class="em-nav-link">FAQ</a>
      <a href="tel:${phoneHref}" class="em-nav-phone">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
        ${phone}
      </a>
    </div>
  </nav>

  <!-- ═══ SECTION 3: HERO WITH INLINE FORM ═══ -->
  <section class="em-hero" id="hero" aria-label="Hero">
    <div class="em-hero-inner">
      <div class="em-hero-copy reveal-el">
        <h1>${escHtml(c.headline)} <span class="red">${city.toUpperCase()}</span></h1>
        <p class="em-hero-sub">${escHtml(c.headlineSub)}</p>
        <p class="em-hero-desc">${escHtml(c.subline)}</p>
        <div class="em-hero-badges">
          ${t.badges.map(badge => `<span class="em-badge">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            ${escHtml(badge)}
          </span>`).join('')}
        </div>
      </div>
      <form id="emergency-form" class="em-hero-form reveal-el" style="animation-delay:100ms">
        <h3>REQUEST EMERGENCY SERVICE</h3>
        <p class="form-sub">We respond in minutes, not hours.</p>
        <div class="em-field">
          <label>Your Name</label>
          <input type="text" placeholder="Full name" autocomplete="name">
        </div>
        <div class="em-field">
          <label>Phone Number</label>
          <input type="tel" placeholder="(555) 123-4567" autocomplete="tel">
        </div>
        <div class="em-field">
          <label>Service Needed</label>
          <select>
            <option value="">Select a service...</option>
            ${c.serviceOptions.map(opt => `<option value="${escHtml(opt)}">${escHtml(opt)}</option>`).join('')}
          </select>
        </div>
        <button class="em-submit" type="submit">${escHtml(c.cta1).toUpperCase()}</button>
        <p class="em-form-phone">Or call now: <a href="tel:${phoneHref}">${phone}</a></p>
      </form>
    </div>
  </section>

  <!-- ═══ SECTION 4: RESPONSE STATS BAND ═══ -->
  <section class="em-stats-band" aria-label="Response statistics">
    <div class="em-stats-inner">
      <div class="em-stat-item reveal-el">&lt; <span class="num">${escHtml(c.stats.avgResponse)} MIN</span> RESPONSE</div>
      <div class="em-stat-divider"></div>
      <div class="em-stat-item reveal-el" style="animation-delay:80ms">24/7 <span class="num">DISPATCH</span></div>
      <div class="em-stat-divider"></div>
      <div class="em-stat-item reveal-el" style="animation-delay:160ms">NO <span class="num">OVERTIME</span> FEES</div>
      <div class="em-stat-divider"></div>
      <div class="em-stat-item reveal-el" style="animation-delay:240ms"><span class="num">${escHtml(c.stats.jobs)}+</span> JOBS DONE</div>
    </div>
  </section>

  <!-- ═══ SECTION 5: WHY US ═══ -->
  <section class="em-why" id="why" aria-label="Why choose us">
    <div class="em-why-inner">
      <div class="em-section-head">
        <h2>${escHtml(c.whyTitle)}</h2>
        <p>${escHtml(c.whySub)}</p>
      </div>
      <div class="em-why-grid">
        ${c.whyUs.map((w, i) => `
        <div class="em-why-card reveal-el" style="animation-delay:${i * 60}ms">
          <h4>${escHtml(w.title)}</h4>
          <p>${escHtml(w.desc)}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <!-- ═══ SECTION 6: DENSE SERVICE BLOCKS ═══ -->
  <section class="em-services" id="services" aria-label="Services">
    <div class="em-services-inner">
      <div class="em-section-head">
        <h2>OUR ${escHtml(c.nicheLabel).toUpperCase()} SERVICES</h2>
        <p>${city}${state ? ', ' + state : ''} &mdash; Licensed, Insured, Warranty-Backed</p>
      </div>
      <div class="svc-grid">
        ${serviceGridHtml}
      </div>
    </div>
  </section>

  <!-- ═══ SECTION 7: TESTIMONIALS SCROLL STRIP ═══ -->
  <section class="em-testimonials" id="reviews" aria-label="Customer reviews">
    <div class="em-testi-inner">
      <div class="em-section-head">
        <h2>${escHtml(c.stats.rating)} RATED — ${escHtml(c.stats.jobs)}+ REVIEWS</h2>
        <p>Real reviews from real ${city} customers</p>
      </div>
      <div class="testi-scroll">
        ${testimonialCardsHtml}
      </div>
    </div>
  </section>

  <!-- ═══ SECTION 8: FAQ ACCORDION ═══ -->
  <section class="em-faq" id="faq" aria-label="Frequently asked questions">
    <div class="em-faq-inner">
      <div class="em-section-head" style="text-align:left">
        <h2>COMMON QUESTIONS</h2>
      </div>
      ${faqHtml}
    </div>
  </section>

  <!-- ═══ SECTION 9: CTA BAND ═══ -->
  <section class="em-cta-band" aria-label="Call to action">
    <h2>DON'T WAIT. CALL NOW.</h2>
    <p>Licensed technicians standing by for ${city}${state ? ', ' + state : ''}</p>
    <a href="tel:${phoneHref}" class="em-cta-phone">
      <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
      ${phone}
    </a>
  </section>

  <!-- ═══ SECTION 10: FOOTER ═══ -->
  <footer class="em-footer" aria-label="Footer">
    <div class="em-footer-inner">
      <div class="em-footer-brand">${biz}</div>
      <div class="em-footer-links">
        <a href="#services">Services</a>
        <a href="#reviews">Reviews</a>
        <a href="#faq">FAQ</a>
        <a href="tel:${phoneHref}">${phone}</a>
      </div>
      <p class="em-footer-copy">&copy; ${new Date().getFullYear()} ${biz}. All rights reserved. Licensed &amp; insured ${escHtml(c.nicheLabel).toLowerCase()} in ${city}${state ? ', ' + state : ''}. Powered by <a href="https://latchlyai.com">Latchly</a>.</p>
    </div>
  </footer>

  <!-- ═══ STICKY MOBILE CTA BAR ═══ -->
  <div class="em-mobile-bar">
    <a href="tel:${phoneHref}">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
      CALL NOW — ${phone}
    </a>
  </div>

  ${widgetHtml}

  <script>
  (function(){
    // Reveal-on-scroll observer (fast, snappy)
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    document.querySelectorAll('.reveal-el').forEach(function(el){ obs.observe(el); });
  })();
  <\/script>

</body>
</html>`;
}

module.exports = { name, label, designProfile, generate };
