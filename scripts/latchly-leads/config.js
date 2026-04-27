const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const LEADS_DIR = path.join(ROOT, 'leads', 'latchly');

for (const file of ['.env.local', '.env']) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

const TARGET_DAILY_LEADS = parseInt(process.env.LATCHLY_DAILY_TARGET || '50', 10);
const MIN_DAILY_LEADS = parseInt(process.env.LATCHLY_DAILY_MINIMUM || '50', 10);
const LOCAL_SHARE_MIN = parseFloat(process.env.LATCHLY_LOCAL_SHARE_MIN || '0.20');
const LOCAL_SHARE_MAX = parseFloat(process.env.LATCHLY_LOCAL_SHARE_MAX || '0.30');
const QUALIFIED_SCORE = parseFloat(process.env.LATCHLY_QUALIFIED_SCORE || '8');
const NO_WEBSITE_TARGET = parseInt(process.env.LATCHLY_NO_WEBSITE_TARGET || String(Math.floor(TARGET_DAILY_LEADS / 2)), 10);
const POOR_WEBSITE_TARGET = parseInt(process.env.LATCHLY_POOR_WEBSITE_TARGET || String(TARGET_DAILY_LEADS - NO_WEBSITE_TARGET), 10);
const NO_WEBSITE_MAX_SHARE = Math.min(1, Math.max(0, parseFloat(process.env.LATCHLY_NO_WEBSITE_MAX_SHARE || '0.55')));
const PROMISING_NEG_THRESHOLD = parseInt(process.env.LATCHLY_PROMISING_NEG_THRESHOLD || '2', 10);
const SOURCE_PER_QUERY_LIMIT = parseInt(process.env.LATCHLY_SOURCE_PER_QUERY_LIMIT || '8', 10);

const DIGEST_TO = process.env.LEAD_DIGEST_TO
  || process.env.LATCHLY_LEAD_DIGEST_TO
  || 'matthewseyoum17@gmail.com';
const DIGEST_FROM = process.env.LEAD_DIGEST_FROM
  || process.env.LATCHLY_LEAD_DIGEST_FROM
  || 'Latchly Lead Digest <notifications@latchlyai.com>';

const LOCAL_MARKETS = [
  { city: 'Gainesville', state: 'FL' },
  { city: 'Tallahassee', state: 'FL' },
];

const SUNBELT_MARKETS = [
  { city: 'Dallas', state: 'TX' },
  { city: 'Houston', state: 'TX' },
  { city: 'San Antonio', state: 'TX' },
  { city: 'Austin', state: 'TX' },
  { city: 'Fort Worth', state: 'TX' },
  { city: 'Jacksonville', state: 'FL' },
  { city: 'Miami', state: 'FL' },
  { city: 'Tampa', state: 'FL' },
  { city: 'Orlando', state: 'FL' },
  { city: 'Fort Lauderdale', state: 'FL' },
  { city: 'Gainesville', state: 'FL' },
  { city: 'Tallahassee', state: 'FL' },
  { city: 'Atlanta', state: 'GA' },
  { city: 'Savannah', state: 'GA' },
  { city: 'Charlotte', state: 'NC' },
  { city: 'Raleigh', state: 'NC' },
  { city: 'Greenville', state: 'SC' },
  { city: 'Charleston', state: 'SC' },
  { city: 'Nashville', state: 'TN' },
  { city: 'Memphis', state: 'TN' },
  { city: 'Knoxville', state: 'TN' },
  { city: 'Phoenix', state: 'AZ' },
  { city: 'Tucson', state: 'AZ' },
  { city: 'Las Vegas', state: 'NV' },
  { city: 'Reno', state: 'NV' },
  { city: 'Denver', state: 'CO' },
  { city: 'Colorado Springs', state: 'CO' },
  { city: 'Birmingham', state: 'AL' },
  { city: 'Mobile', state: 'AL' },
  { city: 'Jackson', state: 'MS' },
  { city: 'New Orleans', state: 'LA' },
  { city: 'Baton Rouge', state: 'LA' },
  { city: 'Little Rock', state: 'AR' },
  { city: 'Oklahoma City', state: 'OK' },
  { city: 'Tulsa', state: 'OK' },
];

const ALLOWED_STATES = [...new Set(SUNBELT_MARKETS.map(market => market.state))];

const HOME_SERVICE_NICHES = [
  'roofing contractor',
  'hvac contractor',
  'plumber',
  'electrician',
  'remodeling contractor',
  'water damage restoration',
  'foundation repair',
  'garage door repair',
  'pest control',
  'tree service',
  'landscaping',
  'pool service',
  'fence contractor',
  'concrete contractor',
  'painting contractor',
  'flooring contractor',
  'junk removal',
  'handyman service',
  'pressure washing',
  'gutter cleaning',
  'septic service',
  'insulation contractor',
  'siding contractor',
  'mold remediation',
  'deck builder',
  'appliance repair',
];

const CHAIN_PATTERNS = [
  /1-800/i,
  /ace hardware/i,
  /aire serv/i,
  /angi/i,
  /ars rescue/i,
  /aspen dental/i,
  /benjamin franklin/i,
  /bright now/i,
  /carrier/i,
  /comfort dental/i,
  /comfort systems/i,
  /coolray/i,
  /david gray/i,
  /erie home/i,
  /goettl/i,
  /handy/i,
  /heartland dental/i,
  /hiller/i,
  /home depot/i,
  /homeadvisor/i,
  /horizon services/i,
  /leaf home/i,
  /lennox/i,
  /len the plumber/i,
  /lowe'?s/i,
  /merry maids/i,
  /michael & son/i,
  /mr\.?\s+appliance/i,
  /mr\.?\s+electric/i,
  /mr\.?\s+rooter/i,
  /one hour/i,
  /orkin/i,
  /power home remodeling/i,
  /rescue air/i,
  /roto-?rooter/i,
  /sears/i,
  /servicemaster/i,
  /servpro/i,
  /service experts/i,
  /terminix/i,
  /thumbtack/i,
  /trane/i,
  /trugreen/i,
  /true green/i,
  /western dental/i,
];

const SEED_FILES = [
  path.join(ROOT, 'leads', 'leadclaw', 'master.csv'),
  path.join(ROOT, 'leads', 'leadclaw', 'qualified.csv'),
  path.join(ROOT, 'leads', 'qualified-leads.csv'),
  path.join(ROOT, 'leads', 'latchly-clean-batch.csv'),
];

module.exports = {
  ROOT,
  LEADS_DIR,
  TARGET_DAILY_LEADS,
  MIN_DAILY_LEADS,
  NO_WEBSITE_TARGET,
  POOR_WEBSITE_TARGET,
  NO_WEBSITE_MAX_SHARE,
  PROMISING_NEG_THRESHOLD,
  SOURCE_PER_QUERY_LIMIT,
  LOCAL_SHARE_MIN,
  LOCAL_SHARE_MAX,
  QUALIFIED_SCORE,
  DIGEST_TO,
  DIGEST_FROM,
  LOCAL_MARKETS,
  SUNBELT_MARKETS,
  ALLOWED_STATES,
  HOME_SERVICE_NICHES,
  CHAIN_PATTERNS,
  SEED_FILES,
};
