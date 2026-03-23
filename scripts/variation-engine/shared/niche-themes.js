/**
 * Niche-specific design tokens for the variation engine.
 * Each family × niche combo gets distinct colors, patterns, icons, and hero images
 * so a roofing site LOOKS like a roofing site — not just in words but in design.
 */

// ── NICHE-SPECIFIC SERVICE ICONS (inline SVG) ──────────────────────────────
const nicheIcons = {
  roofing: [
    // House/roof
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 21h18M4 21V10l8-7 8 7v11M9 21v-6h6v6"/><path d="M2 12l10-9 10 9" stroke-linecap="round"/></svg>',
    // Shield/protection
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>',
    // Storm/weather
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M19 16.9A5 5 0 0018 7h-1.26A8 8 0 104 15.25"/><path d="M13 11l-4 6h6l-4 6"/></svg>',
    // Inspection/eye
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    // Gutter/drain
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 4h16v4H4zM6 8v10c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V8"/><path d="M10 12v4M14 12v4"/></svg>',
    // Commercial/building
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4M9 9h.01M15 9h.01M9 13h.01M15 13h.01"/></svg>',
  ],
  plumbing: [
    // Water drop
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0L12 2.69z"/></svg>',
    // Wrench
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>',
    // Pipe/flow
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 14h6v6H4zM14 4h6v6h-6z"/><path d="M7 14V9a2 2 0 012-2h2M17 10v5a2 2 0 01-2 2h-2"/></svg>',
    // Thermometer (water heater)
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z"/></svg>',
    // Search/detection
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>',
    // Fixture/faucet
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2v6M5 8h14a2 2 0 012 2v1a2 2 0 01-2 2h-2v4a4 4 0 01-8 0v-4H7a2 2 0 01-2-2v-1a2 2 0 012-2z"/></svg>',
  ],
  hvac: [
    // Snowflake
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/><path d="M12 2l-2 3h4L12 2zM12 22l2-3h-4l2 3zM2 12l3 2v-4l-3 2zM22 12l-3-2v4l3-2z"/></svg>',
    // Flame
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 22c4-3.5 7-7.5 7-11.5C19 5.5 16 2 12 2c1.5 3-2 5-2 8 0 1.5.5 3 2 4-2 0-4-1.5-4-4 0-1 .5-2.5 1-4C5.5 8 4 11 4 14c0 4 3 8 8 8z"/></svg>',
    // Fan/air flow
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 12c-3-3-6-3-7 0s1 7 4 4"/><path d="M12 12c3 3 6 3 7 0s-1-7-4-4"/><path d="M12 12c-3 3-3 6 0 7s7-1 4-4"/><path d="M12 12c3-3 3-6 0-7s-7 1-4 4"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
    // Maintenance/tune-up
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
    // Heat pump
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 14a2 2 0 104 0 2 2 0 00-4 0zM15 10v4M17 10v4"/><path d="M3 10h18"/></svg>',
    // Air quality
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9.59 4.59A2 2 0 1111 8H2"/><path d="M12.59 19.41A2 2 0 1014 16H2"/><path d="M17.73 7.73A2.5 2.5 0 1119.5 12H2"/></svg>',
  ],
};

// ── NICHE-SPECIFIC HERO IMAGES ─────────────────────────────────────────────
// Each family gets a DIFFERENT hero image per niche — no two families share the same photo
const nicheHeroImages = {
  roofing: {
    primary: 'https://images.unsplash.com/photo-1632759145351-1d592919f522?w=900&q=80',    // Roof work
    secondary: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=900&q=80',    // Beautiful home exterior
    project1: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',  // Home exterior
    project2: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',  // House with roof
  },
  plumbing: {
    primary: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=900&q=80',   // Plumber at work
    secondary: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=900&q=80',  // Clean bathroom
    project1: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=80',     // Modern bathroom
    project2: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&q=80',  // Clean kitchen
  },
  hvac: {
    primary: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=900&q=80',   // HVAC unit
    secondary: 'https://images.unsplash.com/photo-1631545806609-45e8497dd5f3?w=900&q=80', // Thermostat
    project1: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',  // Comfortable home
    project2: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',  // Modern interior
  },
};

// ── PER-FAMILY HERO IMAGES (each family gets a unique photo) ──────────────
const familyHeroImages = {
  trust: {
    hvac: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',     // Warm comfortable living room
    plumbing: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1200&q=80', // Bright clean kitchen
    roofing: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80',  // Cozy home exterior sunset
  },
  modern: {
    hvac: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=1200&q=80',        // Sleek smart home interior
    plumbing: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1200&q=80',    // Modern luxury bathroom
    roofing: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80',  // Modern architecture
  },
  regional: {
    hvac: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80',     // Aerial city/buildings
    plumbing: 'https://images.unsplash.com/photo-1449157291145-7efd050a4d0e?w=1200&q=80', // Urban neighborhood
    roofing: 'https://images.unsplash.com/photo-1448630360428-65456885c650?w=1200&q=80',  // Suburban aerial homes
  },
  emergency: {
    hvac: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1200&q=80',     // HVAC unit close-up
    plumbing: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1200&q=80', // Plumber at work
    roofing: 'https://images.unsplash.com/photo-1632759145351-1d592919f522?w=1200&q=80',  // Storm roof repair
  },
  luxury: {
    hvac: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80',     // Luxury modern interior
    plumbing: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=1200&q=80', // Designer bathroom
    roofing: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1200&q=80',     // Grand home exterior
  },
  craft: {
    hvac: 'https://images.unsplash.com/photo-1631545806609-45e8497dd5f3?w=1200&q=80',     // Close-up thermostat/controls
    plumbing: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1200&q=80', // Craftsman tools detail
    roofing: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80',  // Craftsman at work on roof
  },
};

// ── SVG BACKGROUND PATTERNS (inline, subtle, niche-specific) ────────────────
function getSvgPattern(niche, opacity = 0.04) {
  const patterns = {
    roofing: `<svg width="60" height="30" viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg"><path d="M0 30L30 0l30 30" fill="none" stroke="currentColor" stroke-width="0.5" opacity="${opacity}"/></svg>`,
    plumbing: `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="8" fill="none" stroke="currentColor" stroke-width="0.5" opacity="${opacity}"/><circle cx="20" cy="20" r="3" fill="none" stroke="currentColor" stroke-width="0.5" opacity="${opacity}"/></svg>`,
    hvac: `<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M24 4c0 11-11 20-20 20M24 4c0 11 11 20 20 20M24 44c0-11-11-20-20-20M24 44c0-11 11-20 20-20" fill="none" stroke="currentColor" stroke-width="0.5" opacity="${opacity}"/></svg>`,
  };
  return patterns[niche] || patterns.hvac;
}

function getPatternDataUri(niche, color, opacity) {
  const svg = getSvgPattern(niche, opacity).replace(/currentColor/g, color);
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// ── NICHE-SPECIFIC COLOR PALETTES PER FAMILY ───────────────────────────────
// Each family × niche combo gets a unique palette that still fits the family's personality

const familyNicheColors = {
  trust: {
    hvac: {
      primary: '#8B5E3C',       // Warm walnut — homey, established
      primaryHover: '#6D4A2E',
      primaryLight: 'rgba(139,94,60,0.08)',
      primaryRing: 'rgba(139,94,60,0.14)',
      accent: '#D4A853',        // Rich gold
      accentLight: 'rgba(212,168,83,0.12)',
      bg: '#F5EDE2',            // Warm cream parchment
      bgAlt: '#EDE3D4',
      ink: '#2C1D0E',
      textMuted: '#6B5744',
      border: '#D9CAAF',
      tagBg: '#F0E6D5',
      tagText: '#8B5E3C',
      heroBg: '#2C1D0E',        // Dark walnut for hero
      gradientHero: 'linear-gradient(135deg, #2C1D0E 0%, #4A3422 100%)',
    },
    plumbing: {
      primary: '#2B5C8A',       // Deep reliable blue
      primaryHover: '#1E4A72',
      primaryLight: 'rgba(43,92,138,0.08)',
      primaryRing: 'rgba(43,92,138,0.12)',
      accent: '#C4813D',        // Copper/warm brown
      accentLight: 'rgba(196,129,61,0.10)',
      bg: '#F6F9FC',            // Cool blue tint
      bgAlt: '#EBF2F8',
      ink: '#1A2F42',
      textMuted: '#5A7388',
      border: '#D0DDE8',
      tagBg: '#E3EEF7',
      tagText: '#2B5C8A',
      gradientHero: 'radial-gradient(ellipse at 30% 20%, rgba(43,92,138,0.06) 0%, transparent 70%)',
    },
    roofing: {
      primary: '#6B4C3B',       // Warm brown — earthy, roofing materials
      primaryHover: '#543A2D',
      primaryLight: 'rgba(107,76,59,0.08)',
      primaryRing: 'rgba(107,76,59,0.12)',
      accent: '#C17A3A',        // Terracotta/amber
      accentLight: 'rgba(193,122,58,0.10)',
      bg: '#FBF8F5',            // Warm parchment
      bgAlt: '#F3EDE6',
      ink: '#2D1F15',
      textMuted: '#7A6555',
      border: '#DDD2C6',
      tagBg: '#F0E8DE',
      tagText: '#6B4C3B',
      gradientHero: 'radial-gradient(ellipse at 30% 20%, rgba(107,76,59,0.06) 0%, transparent 70%)',
    },
  },
  luxury: {
    hvac: {
      primary: '#1a1a1a',
      primaryHover: '#333',
      accent: '#6B8E7B',        // Muted sage — calm, quiet luxury
      accentLight: 'rgba(107,142,123,0.10)',
      bg: '#FAFAF7',
      bgAlt: '#F0F0EB',
      ink: '#1a1a1a',
      textMuted: '#7A7A72',
      border: '#E0E0D8',
      divider: '#6B8E7B',
    },
    plumbing: {
      primary: '#1a1a1a',
      primaryHover: '#333',
      accent: '#7A8FA3',        // Steel blue — clean, precise
      accentLight: 'rgba(122,143,163,0.10)',
      bg: '#F8F9FB',
      bgAlt: '#ECEEF2',
      ink: '#1a1a1a',
      textMuted: '#6B7380',
      border: '#D8DCE2',
      divider: '#7A8FA3',
    },
    roofing: {
      primary: '#1a1a1a',
      primaryHover: '#333',
      accent: '#A67C52',        // Warm copper — roofing materials
      accentLight: 'rgba(166,124,82,0.10)',
      bg: '#FAF8F5',
      bgAlt: '#F0ECE6',
      ink: '#1a1a1a',
      textMuted: '#7A7268',
      border: '#E0D8CE',
      divider: '#A67C52',
    },
  },
  emergency: {
    hvac: {
      primary: '#E53E3E',
      primaryHover: '#C53030',
      secondary: '#DD6B20',
      bg: '#0D0D0D',
      bgCard: '#1A1A1A',
      bgAlt: '#111111',
      accentGlow: 'rgba(229,62,62,0.15)',
      nicheAccent: '#38B2AC',   // Teal — cooling/comfort urgency
      nicheAccentBg: 'rgba(56,178,172,0.10)',
    },
    plumbing: {
      primary: '#E53E3E',
      primaryHover: '#C53030',
      secondary: '#3182CE',     // Blue — water/pipe urgency
      bg: '#0A0C10',
      bgCard: '#141820',
      bgAlt: '#0E1117',
      accentGlow: 'rgba(229,62,62,0.15)',
      nicheAccent: '#3182CE',
      nicheAccentBg: 'rgba(49,130,206,0.10)',
    },
    roofing: {
      primary: '#E53E3E',
      primaryHover: '#C53030',
      secondary: '#DD6B20',     // Orange — storm/damage urgency
      bg: '#0D0B08',
      bgCard: '#1A1610',
      bgAlt: '#12100C',
      accentGlow: 'rgba(221,107,32,0.15)',
      nicheAccent: '#DD6B20',
      nicheAccentBg: 'rgba(221,107,32,0.10)',
    },
  },
  modern: {
    hvac: {
      primary: '#14B8A6',       // Bright teal — vibrant, fresh, techy
      primaryHover: '#0D9488',
      primaryLight: 'rgba(20,184,166,0.08)',
      primaryRing: 'rgba(20,184,166,0.15)',
      bg: '#0B1120',            // Deep navy body
      bgAlt: '#111827',
      bgLight: '#F0FDFA',       // Light sections
      ink: '#F8FAFC',           // White text on dark
      inkDark: '#0F172A',       // Dark text for light sections
      textMuted: '#94A3B8',
      textMutedDark: '#475569',
      border: '#1E293B',
      borderLight: '#D1E7E0',
      tagBg: 'rgba(20,184,166,0.12)',
      tagText: '#14B8A6',
      heroBg: '#0B1120',
      heroGradient: 'linear-gradient(135deg, #0B1120 0%, #0F2027 30%, #0B1120 100%)',
    },
    plumbing: {
      primary: '#2563EB',       // True blue — water, clean, trust
      primaryHover: '#1D4ED8',
      primaryLight: 'rgba(37,99,235,0.06)',
      primaryRing: 'rgba(37,99,235,0.12)',
      bg: '#F8FAFF',
      bgAlt: '#EFF4FF',
      ink: '#0F172A',
      textMuted: '#475569',
      border: '#D0DDEE',
      tagBg: '#EFF6FF',
      tagText: '#2563EB',
    },
    roofing: {
      primary: '#64748B',       // Slate — structural, solid, dependable
      primaryHover: '#475569',
      primaryLight: 'rgba(100,116,139,0.06)',
      primaryRing: 'rgba(100,116,139,0.12)',
      bg: '#F8F9FA',
      bgAlt: '#F1F3F5',
      ink: '#0F172A',
      textMuted: '#475569',
      border: '#D1D5DB',
      tagBg: '#F1F5F9',
      tagText: '#475569',
      accentWarm: '#B45309',   // Amber — construction warmth
    },
  },
  regional: {
    hvac: {
      primary: '#F59E0B',       // Bold amber — confident, commanding
      primaryHover: '#D97706',
      primaryLight: 'rgba(245,158,11,0.08)',
      bg: '#1A1A2E',            // Deep navy-purple body
      bgDark: '#0F0F1E',
      bgCard: '#1F1F35',
      bgLight: '#F8F7F4',       // Warm light for alternating sections
      ink: '#F8FAFC',
      inkDark: '#1A1A2E',
      textMuted: '#9CA3AF',
      textMutedLight: '#6B7280',
      border: '#F59E0B33',
      borderLight: '#E5E1D8',
      accentDark: '#292945',
      chipBg: 'rgba(245,158,11,0.10)',
    },
    plumbing: {
      primary: '#2563EB',       // Navy blue — authority, water
      primaryHover: '#1D4ED8',
      primaryLight: 'rgba(37,99,235,0.06)',
      bg: '#F0F4FF',
      bgDark: '#0B1220',
      bgCard: '#14233A',
      ink: '#0B1220',
      textMuted: '#475569',
      border: '#93C5FD',
      accentDark: '#1E3A5F',
      chipBg: 'rgba(37,99,235,0.08)',
    },
    roofing: {
      primary: '#9333EA',       // Purple-gray — architectural authority
      primaryHover: '#7E22CE',
      primaryLight: 'rgba(100,116,139,0.06)',
      bg: '#FAF5FF',
      bgDark: '#1A0D2E',
      bgCard: '#271640',
      ink: '#1A0D2E',
      textMuted: '#6B7280',
      border: '#C4B5FD',
      accentDark: '#2E1065',
      accentWarm: '#B45309',
      chipBg: 'rgba(147,51,234,0.08)',
    },
  },
  craft: {
    hvac: {
      primary: '#1A1A1A',
      accent: '#5B8A72',        // Muted forest — natural, organic
      accentHover: '#4A7561',
      accentLight: 'rgba(91,138,114,0.10)',
      bg: '#1C1C1C',
      bgAlt: '#242424',
      textLight: '#E8E4DE',
      textMuted: '#A09888',
      border: 'rgba(91,138,114,0.20)',
    },
    plumbing: {
      primary: '#1A1A1A',
      accent: '#6B8DA6',        // Steel blue — precision, chrome
      accentHover: '#5A7C95',
      accentLight: 'rgba(107,141,166,0.10)',
      bg: '#1A1C1E',
      bgAlt: '#222426',
      textLight: '#E0E4E8',
      textMuted: '#8A9298',
      border: 'rgba(107,141,166,0.20)',
    },
    roofing: {
      primary: '#1A1A1A',
      accent: '#B87333',        // Copper — roofing, premium materials
      accentHover: '#A06228',
      accentLight: 'rgba(184,115,51,0.10)',
      bg: '#1C1A18',
      bgAlt: '#262220',
      textLight: '#E8E2DA',
      textMuted: '#A0948A',
      border: 'rgba(184,115,51,0.20)',
    },
  },
};

// ── NICHE-SPECIFIC HERO SECTION DECORATORS ──────────────────────────────────
// These are CSS background-image strings that add subtle visual motifs
function getHeroDecorator(niche, color) {
  const decorators = {
    roofing: `
      background-image:
        linear-gradient(135deg, transparent 45%, ${color}06 45%, ${color}06 55%, transparent 55%),
        linear-gradient(225deg, transparent 45%, ${color}04 45%, ${color}04 55%, transparent 55%);
      background-size: 60px 30px;
    `,
    plumbing: `
      background-image:
        radial-gradient(circle at 20% 80%, ${color}08 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, ${color}06 0%, transparent 40%);
    `,
    hvac: `
      background-image:
        radial-gradient(circle at 50% 50%, ${color}06 0%, transparent 60%),
        linear-gradient(0deg, transparent 49%, ${color}03 49%, ${color}03 51%, transparent 51%);
      background-size: 100% 100%, 40px 40px;
    `,
  };
  return decorators[niche] || '';
}

// ── NICHE-SPECIFIC TRUST BADGES ─────────────────────────────────────────────
const nicheBadges = {
  roofing: ['Licensed & insured', 'Storm damage experts', 'Free inspections', 'Warranty-backed'],
  plumbing: ['Licensed & insured', '24/7 emergency service', 'Upfront pricing', 'Background-checked'],
  hvac: ['Licensed & insured', 'Same-day service', 'Energy-efficient', 'Factory-trained techs'],
};

// ── NICHE-SPECIFIC SECTION HEADERS ──────────────────────────────────────────
const nicheSectionLabels = {
  roofing: {
    services: 'Roofing Services',
    servicesDesc: 'From repairs to full replacements — protecting your home from the top down.',
    process: 'Our Roofing Process',
    about: 'Your Local Roofers',
    coverage: 'Areas We Protect',
  },
  plumbing: {
    services: 'Plumbing Services',
    servicesDesc: 'From emergency repairs to installations — keeping your water flowing right.',
    process: 'How We Work',
    about: 'Your Local Plumbers',
    coverage: 'Service Area',
  },
  hvac: {
    services: 'HVAC Services',
    servicesDesc: 'From AC repairs to full system installs — keeping your home comfortable year-round.',
    process: 'Our Service Process',
    about: 'Your Comfort Specialists',
    coverage: 'Areas We Serve',
  },
};

// ── MAIN EXPORTS ────────────────────────────────────────────────────────────

function getTheme(family, niche) {
  const colors = (familyNicheColors[family] || {})[niche]
    || (familyNicheColors[family] || {}).hvac
    || {};
  const familyHero = (familyHeroImages[family] || {})[niche]
    || (familyHeroImages[family] || {}).hvac
    || (nicheHeroImages[niche] || nicheHeroImages.hvac).primary;
  return {
    colors,
    icons: nicheIcons[niche] || nicheIcons.hvac,
    heroImages: nicheHeroImages[niche] || nicheHeroImages.hvac,
    familyHero,
    badges: nicheBadges[niche] || nicheBadges.hvac,
    labels: nicheSectionLabels[niche] || nicheSectionLabels.hvac,
    pattern: (color, opacity) => getPatternDataUri(niche, color, opacity || 0.04),
    heroDecorator: (color) => getHeroDecorator(niche, color),
    svgPattern: (opacity) => getSvgPattern(niche, opacity),
  };
}

module.exports = {
  getTheme,
  nicheIcons,
  nicheHeroImages,
  familyHeroImages,
  familyNicheColors,
  nicheBadges,
  nicheSectionLabels,
  getPatternDataUri,
  getHeroDecorator,
  getSvgPattern,
};
