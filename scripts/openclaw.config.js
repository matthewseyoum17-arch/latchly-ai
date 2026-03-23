/**
 * openclaw.config.js — Shared configuration for all OpenClaw agents
 *
 * All hardcoded values consolidated here. Override via environment variables.
 */

const path = require('path');
const fs   = require('fs');

// Load .env once
const ROOT = path.join(__dirname, '..');
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

// ── Brand / CAN-SPAM ────────────────────────────────────────────────────────

const SITE_BASE       = process.env.SITE_BASE || 'https://latchlyai.com';
const FROM_EMAIL      = process.env.OUTREACH_FROM || 'outreach@latchlyai.com';
const NOTIFY_EMAIL    = process.env.NOTIFY_EMAIL || 'matt@latchlyai.com';
const BOOKING_LINK    = process.env.BOOKING_LINK || 'https://calendly.com/latchlyai/demo';
const STRIPE_LINK     = process.env.STRIPE_PAYMENT_LINK || 'https://buy.stripe.com/your-link';
const PHYSICAL_ADDRESS = process.env.PHYSICAL_ADDRESS || 'Latchly · 123 Main St · Austin, TX 78701';

// ── Scout targeting ─────────────────────────────────────────────────────────

const NICHES = (process.env.SCOUT_NICHES || '').split(',').filter(Boolean).length > 0
  ? process.env.SCOUT_NICHES.split(',').map(s => s.trim())
  : ['HVAC contractor', 'plumber', 'roofing contractor'];

const CITIES = (process.env.SCOUT_CITIES || '').split(';').filter(Boolean).length > 0
  ? process.env.SCOUT_CITIES.split(';').map(s => {
      const [city, state] = s.trim().split(',').map(x => x.trim());
      return { city, state };
    })
  : [
    // Texas
    { city: 'Dallas', state: 'TX' }, { city: 'Houston', state: 'TX' },
    { city: 'San Antonio', state: 'TX' }, { city: 'Austin', state: 'TX' },
    { city: 'Fort Worth', state: 'TX' }, { city: 'El Paso', state: 'TX' },
    { city: 'Arlington', state: 'TX' }, { city: 'Plano', state: 'TX' },
    // Florida
    { city: 'Jacksonville', state: 'FL' }, { city: 'Miami', state: 'FL' },
    { city: 'Tampa', state: 'FL' }, { city: 'Orlando', state: 'FL' },
    { city: 'Fort Lauderdale', state: 'FL' }, { city: 'St Petersburg', state: 'FL' },
    // Arizona
    { city: 'Phoenix', state: 'AZ' }, { city: 'Tucson', state: 'AZ' },
    { city: 'Mesa', state: 'AZ' }, { city: 'Scottsdale', state: 'AZ' },
    // Southeast
    { city: 'Atlanta', state: 'GA' }, { city: 'Savannah', state: 'GA' },
    { city: 'Charlotte', state: 'NC' }, { city: 'Raleigh', state: 'NC' },
    { city: 'Nashville', state: 'TN' }, { city: 'Memphis', state: 'TN' },
    { city: 'Knoxville', state: 'TN' }, { city: 'Chattanooga', state: 'TN' },
    // South
    { city: 'New Orleans', state: 'LA' }, { city: 'Baton Rouge', state: 'LA' },
    { city: 'Birmingham', state: 'AL' }, { city: 'Mobile', state: 'AL' },
    { city: 'Jackson', state: 'MS' }, { city: 'Little Rock', state: 'AR' },
    { city: 'Oklahoma City', state: 'OK' }, { city: 'Tulsa', state: 'OK' },
    // West
    { city: 'Denver', state: 'CO' }, { city: 'Colorado Springs', state: 'CO' },
    { city: 'Las Vegas', state: 'NV' }, { city: 'Reno', state: 'NV' },
    { city: 'Salt Lake City', state: 'UT' }, { city: 'Albuquerque', state: 'NM' },
    // Midwest
    { city: 'Indianapolis', state: 'IN' }, { city: 'Columbus', state: 'OH' },
    { city: 'Cincinnati', state: 'OH' }, { city: 'Kansas City', state: 'MO' },
    { city: 'St Louis', state: 'MO' }, { city: 'Louisville', state: 'KY' },
    // Mid-Atlantic
    { city: 'Richmond', state: 'VA' }, { city: 'Virginia Beach', state: 'VA' },
    { city: 'Wilmington', state: 'DE' }, { city: 'Charleston', state: 'SC' },
  ];

const FRANCHISE_BLACKLIST = [
  '1-hour', 'one hour', 'mr. rooter', 'roto-rooter', 'servicemaster',
  'servpro', '1-800', 'terminix', 'orkin', 'home depot',
];

// ── Rate limits ─────────────────────────────────────────────────────────────

const SCOUT_MAX_PER_NICHE = parseInt(process.env.SCOUT_MAX_PER_NICHE || '150', 10);
const SCOUT_MAX_TOTAL     = parseInt(process.env.SCOUT_MAX_TOTAL || '500', 10);
const AUDIT_MIN_SCORE     = parseInt(process.env.AUDIT_MIN_SCORE || '7', 10);
const MAX_EMAILS          = parseInt(process.env.MAX_EMAILS || '20', 10);
const MAX_MESSAGES        = parseInt(process.env.MAX_MESSAGES || '200', 10);
const DEMO_MAX_AGE_DAYS   = parseInt(process.env.DEMO_MAX_AGE_DAYS || '30', 10);

// ── Feature flags ───────────────────────────────────────────────────────────

const DRY_RUN        = process.env.DRY_RUN === 'true';
const SKIP_DB        = process.env.SKIP_DB === 'true';
const SKIP_SITE_CHECK = process.env.SKIP_SITE_CHECK === 'true';

// ── Paths ───────────────────────────────────────────────────────────────────

const LEADS_DIR   = path.join(ROOT, 'leads', 'openclaw');
const DEMOS_DIR   = path.join(ROOT, 'demos', 'prospects');
const TEMPLATES_DIR = path.join(__dirname, 'templates');

module.exports = {
  ROOT,
  SITE_BASE,
  FROM_EMAIL,
  NOTIFY_EMAIL,
  BOOKING_LINK,
  STRIPE_LINK,
  PHYSICAL_ADDRESS,
  NICHES,
  CITIES,
  FRANCHISE_BLACKLIST,
  SCOUT_MAX_PER_NICHE,
  SCOUT_MAX_TOTAL,
  AUDIT_MIN_SCORE,
  MAX_EMAILS,
  MAX_MESSAGES,
  DEMO_MAX_AGE_DAYS,
  DRY_RUN,
  SKIP_DB,
  SKIP_SITE_CHECK,
  LEADS_DIR,
  DEMOS_DIR,
  TEMPLATES_DIR,
};
