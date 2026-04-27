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
  // TX
  { city: 'Dallas', state: 'TX' },
  { city: 'Houston', state: 'TX' },
  { city: 'San Antonio', state: 'TX' },
  { city: 'Austin', state: 'TX' },
  { city: 'Fort Worth', state: 'TX' },
  { city: 'El Paso', state: 'TX' },
  { city: 'Corpus Christi', state: 'TX' },
  { city: 'Lubbock', state: 'TX' },
  { city: 'McAllen', state: 'TX' },
  // FL
  { city: 'Jacksonville', state: 'FL' },
  { city: 'Miami', state: 'FL' },
  { city: 'Tampa', state: 'FL' },
  { city: 'Orlando', state: 'FL' },
  { city: 'Fort Lauderdale', state: 'FL' },
  { city: 'Gainesville', state: 'FL' },
  { city: 'Tallahassee', state: 'FL' },
  { city: 'Pensacola', state: 'FL' },
  { city: 'Daytona Beach', state: 'FL' },
  { city: 'Cape Coral', state: 'FL' },
  { city: 'Sarasota', state: 'FL' },
  { city: 'Lakeland', state: 'FL' },
  { city: 'Palm Bay', state: 'FL' },
  { city: 'Naples', state: 'FL' },
  { city: 'Ocala', state: 'FL' },
  { city: 'Panama City', state: 'FL' },
  { city: 'St. Petersburg', state: 'FL' },
  { city: 'Clearwater', state: 'FL' },
  // GA
  { city: 'Atlanta', state: 'GA' },
  { city: 'Savannah', state: 'GA' },
  { city: 'Augusta', state: 'GA' },
  { city: 'Macon', state: 'GA' },
  { city: 'Columbus', state: 'GA' },
  // NC
  { city: 'Charlotte', state: 'NC' },
  { city: 'Raleigh', state: 'NC' },
  { city: 'Greensboro', state: 'NC' },
  { city: 'Wilmington', state: 'NC' },
  { city: 'Asheville', state: 'NC' },
  { city: 'Durham', state: 'NC' },
  // SC
  { city: 'Greenville', state: 'SC' },
  { city: 'Charleston', state: 'SC' },
  { city: 'Columbia', state: 'SC' },
  { city: 'Myrtle Beach', state: 'SC' },
  // TN
  { city: 'Nashville', state: 'TN' },
  { city: 'Memphis', state: 'TN' },
  { city: 'Knoxville', state: 'TN' },
  { city: 'Chattanooga', state: 'TN' },
  // AZ
  { city: 'Phoenix', state: 'AZ' },
  { city: 'Tucson', state: 'AZ' },
  // NV
  { city: 'Las Vegas', state: 'NV' },
  { city: 'Reno', state: 'NV' },
  // CO
  { city: 'Denver', state: 'CO' },
  { city: 'Colorado Springs', state: 'CO' },
  // AL
  { city: 'Birmingham', state: 'AL' },
  { city: 'Mobile', state: 'AL' },
  { city: 'Huntsville', state: 'AL' },
  { city: 'Tuscaloosa', state: 'AL' },
  { city: 'Montgomery', state: 'AL' },
  // MS
  { city: 'Jackson', state: 'MS' },
  // LA
  { city: 'New Orleans', state: 'LA' },
  { city: 'Baton Rouge', state: 'LA' },
  // AR
  { city: 'Little Rock', state: 'AR' },
  // OK
  { city: 'Oklahoma City', state: 'OK' },
  { city: 'Tulsa', state: 'OK' },
  // VA (Sunbelt-adjacent)
  { city: 'Virginia Beach', state: 'VA' },
  { city: 'Norfolk', state: 'VA' },
];

// City → {lat, lon} for OSM Overpass bbox queries. Coords are city-center.
// Bbox is built as ±0.18° around these (~12 mi N/S, ~12-15 mi E/W).
const MARKET_COORDS = {
  'Dallas,TX':           { lat: 32.7767, lon: -96.7970 },
  'Houston,TX':          { lat: 29.7604, lon: -95.3698 },
  'San Antonio,TX':      { lat: 29.4241, lon: -98.4936 },
  'Austin,TX':           { lat: 30.2672, lon: -97.7431 },
  'Fort Worth,TX':       { lat: 32.7555, lon: -97.3308 },
  'El Paso,TX':          { lat: 31.7619, lon: -106.4850 },
  'Corpus Christi,TX':   { lat: 27.8006, lon: -97.3964 },
  'Lubbock,TX':          { lat: 33.5779, lon: -101.8552 },
  'McAllen,TX':          { lat: 26.2034, lon: -98.2300 },
  'Jacksonville,FL':     { lat: 30.3322, lon: -81.6557 },
  'Miami,FL':            { lat: 25.7617, lon: -80.1918 },
  'Tampa,FL':            { lat: 27.9506, lon: -82.4572 },
  'Orlando,FL':          { lat: 28.5383, lon: -81.3792 },
  'Fort Lauderdale,FL':  { lat: 26.1224, lon: -80.1373 },
  'Gainesville,FL':      { lat: 29.6516, lon: -82.3248 },
  'Tallahassee,FL':      { lat: 30.4383, lon: -84.2807 },
  'Pensacola,FL':        { lat: 30.4213, lon: -87.2169 },
  'Daytona Beach,FL':    { lat: 29.2108, lon: -81.0228 },
  'Cape Coral,FL':       { lat: 26.5629, lon: -81.9495 },
  'Sarasota,FL':         { lat: 27.3364, lon: -82.5307 },
  'Lakeland,FL':         { lat: 28.0395, lon: -81.9498 },
  'Palm Bay,FL':         { lat: 28.0345, lon: -80.5887 },
  'Naples,FL':           { lat: 26.1420, lon: -81.7948 },
  'Ocala,FL':            { lat: 29.1872, lon: -82.1401 },
  'Panama City,FL':      { lat: 30.1588, lon: -85.6602 },
  'St. Petersburg,FL':   { lat: 27.7676, lon: -82.6403 },
  'Clearwater,FL':       { lat: 27.9659, lon: -82.8001 },
  'Atlanta,GA':          { lat: 33.7490, lon: -84.3880 },
  'Savannah,GA':         { lat: 32.0809, lon: -81.0912 },
  'Augusta,GA':          { lat: 33.4735, lon: -82.0105 },
  'Macon,GA':            { lat: 32.8407, lon: -83.6324 },
  'Columbus,GA':         { lat: 32.4609, lon: -84.9877 },
  'Charlotte,NC':        { lat: 35.2271, lon: -80.8431 },
  'Raleigh,NC':          { lat: 35.7796, lon: -78.6382 },
  'Greensboro,NC':       { lat: 36.0726, lon: -79.7920 },
  'Wilmington,NC':       { lat: 34.2104, lon: -77.8868 },
  'Asheville,NC':        { lat: 35.5951, lon: -82.5515 },
  'Durham,NC':           { lat: 35.9940, lon: -78.8986 },
  'Greenville,SC':       { lat: 34.8526, lon: -82.3940 },
  'Charleston,SC':       { lat: 32.7765, lon: -79.9311 },
  'Columbia,SC':         { lat: 34.0007, lon: -81.0348 },
  'Myrtle Beach,SC':     { lat: 33.6891, lon: -78.8867 },
  'Nashville,TN':        { lat: 36.1627, lon: -86.7816 },
  'Memphis,TN':          { lat: 35.1495, lon: -90.0490 },
  'Knoxville,TN':        { lat: 35.9606, lon: -83.9207 },
  'Chattanooga,TN':      { lat: 35.0456, lon: -85.3097 },
  'Phoenix,AZ':          { lat: 33.4484, lon: -112.0740 },
  'Tucson,AZ':           { lat: 32.2226, lon: -110.9747 },
  'Las Vegas,NV':        { lat: 36.1699, lon: -115.1398 },
  'Reno,NV':             { lat: 39.5296, lon: -119.8138 },
  'Denver,CO':           { lat: 39.7392, lon: -104.9903 },
  'Colorado Springs,CO': { lat: 38.8339, lon: -104.8214 },
  'Birmingham,AL':       { lat: 33.5186, lon: -86.8104 },
  'Mobile,AL':           { lat: 30.6954, lon: -88.0399 },
  'Huntsville,AL':       { lat: 34.7304, lon: -86.5861 },
  'Tuscaloosa,AL':       { lat: 33.2098, lon: -87.5692 },
  'Montgomery,AL':       { lat: 32.3792, lon: -86.3077 },
  'Jackson,MS':          { lat: 32.2988, lon: -90.1848 },
  'New Orleans,LA':      { lat: 29.9511, lon: -90.0715 },
  'Baton Rouge,LA':      { lat: 30.4515, lon: -91.1871 },
  'Little Rock,AR':      { lat: 34.7465, lon: -92.2896 },
  'Oklahoma City,OK':    { lat: 35.4676, lon: -97.5164 },
  'Tulsa,OK':            { lat: 36.1540, lon: -95.9928 },
  'Virginia Beach,VA':   { lat: 36.8529, lon: -75.9780 },
  'Norfolk,VA':          { lat: 36.8508, lon: -76.2859 },
};

const ALLOWED_STATES = [...new Set(SUNBELT_MARKETS.map(market => market.state))];

// Niche → OpenStreetMap tag mappings for Overpass API. Each value is an array
// of [key, value] pairs that will be OR'd in the Overpass query. Missing
// niches fall back to BBB/YP/etc.
const OSM_NICHE_TAGS = {
  'roofing contractor':         [['craft', 'roofer']],
  'hvac contractor':            [['shop', 'hvac'], ['amenity', 'hvac']],
  'plumber':                    [['shop', 'plumber'], ['amenity', 'plumber'], ['craft', 'plumber']],
  'electrician':                [['craft', 'electrician']],
  'pest control':               [['shop', 'pest_control'], ['amenity', 'pest_control']],
  'tree service':               [['craft', 'arborist'], ['amenity', 'arborist']],
  'landscaping':                [['craft', 'gardener'], ['shop', 'garden_centre']],
  'painting contractor':        [['craft', 'painter']],
  'concrete contractor':        [['craft', 'concrete']],
  'fence contractor':           [['craft', 'fence_installer']],
  'pool service':               [['shop', 'pool'], ['amenity', 'pool_service']],
  'handyman service':           [['shop', 'handyman'], ['amenity', 'handyman']],
  'flooring contractor':        [['craft', 'flooring']],
  'remodeling contractor':      [['craft', 'carpenter']],
  'siding contractor':          [['craft', 'siding']],
  'gutter cleaning':            [['craft', 'gutter']],
};

// Florida DBPR (myfloridalicense.com) license-type codes by niche. Used to
// query the public license search statewide. Multiple types per niche are
// queried sequentially.
const FLORIDA_DBPR_LICENSE_TYPES = {
  'roofing contractor':    ['CCC', 'CGC', 'CRC'],
  'hvac contractor':       ['CMC', 'CAC'],
  'plumber':               ['CFC'],
  'electrician':           ['EC', 'ER', 'ES'],
  'pool service':          ['RP', 'CPC'],
  'pest control':          ['JF', 'JE'],
  'remodeling contractor': ['CGC', 'CRC', 'CBC'],
  'concrete contractor':   ['CGC', 'CRC'],
  'siding contractor':     ['CGC', 'CRC'],
};

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
  MARKET_COORDS,
  ALLOWED_STATES,
  HOME_SERVICE_NICHES,
  OSM_NICHE_TAGS,
  FLORIDA_DBPR_LICENSE_TYPES,
  CHAIN_PATTERNS,
  SEED_FILES,
};
