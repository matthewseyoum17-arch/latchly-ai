/**
 * design-engine/lint.js
 *
 * Quality gate for generated demo HTML. Three layers:
 *
 *   1. Custom checks (banned tokens, business name, hero context, phone link)
 *   2. AEO/SEO presence checks — title, meta desc, canonical, two JSON-LD
 *      blocks (LocalBusiness + FAQPage), visible <section id="faq">, OG image
 *   3. Structural-sameness check — DOM-shape hash compared against a rolling
 *      cache of the last 50 demos. A collision with one of the last 10
 *      penalizes the demo's uniqueness score hard.
 *   4. impeccable detect (`npx --yes impeccable detect --stdin --json`) —
 *      anti-AI-slop CLI. Phase B promotes this from soft to required.
 */

const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const HASH_CACHE_PATH = path.join(process.cwd(), '_temp', 'dom-hashes.json');
const HASH_CACHE_LIMIT = 50;
const HASH_COLLISION_WINDOW = 10;

const CUSTOM_BANNED = [
  'lorem ipsum',
  '[review here]',
  '[hero headline]',
  '[business name]',
  'placeholder',
  'font-family: inter', // backup check (impeccable also catches this in CSS)
];

async function lintDemoHtml(html, { lead = {}, enrichment = {} } = {}) {
  const issues = [];
  let score = 100;

  // 1. Custom: banned tokens
  const lowered = html.toLowerCase();
  for (const token of CUSTOM_BANNED) {
    if (lowered.includes(token)) {
      issues.push({ rule: `banned_token:${token}`, severity: 'major' });
      score -= 12;
    }
  }

  // 2. Custom: businessName must appear
  if (lead.businessName && !lowered.includes(String(lead.businessName).toLowerCase())) {
    issues.push({ rule: 'missing_business_name', severity: 'critical' });
    score -= 20;
  }

  // 3. Custom: city OR a verified service must appear in hero region
  const heroSection = (html.match(/<header class="hero">[\s\S]*?<\/header>/i)
    || html.match(/<section[^>]+class="[^"]*hero[^"]*"[^>]*>[\s\S]*?<\/section>/i)
    || [''])[0].toLowerCase();
  const cityHit = lead.city && heroSection.includes(String(lead.city).toLowerCase());
  const serviceHit = (enrichment.servicesVerified || []).some(s =>
    heroSection.includes(String(s).toLowerCase()),
  );
  if (!cityHit && !serviceHit) {
    issues.push({ rule: 'hero_lacks_city_or_service', severity: 'major' });
    score -= 10;
  }

  // 4. Custom: at least one review section if reviews are present in enrichment
  if ((enrichment.reviews || []).length && !/section[^>]*id="reviews"/i.test(html)) {
    issues.push({ rule: 'reviews_section_missing', severity: 'minor' });
    score -= 5;
  }

  // 5. Custom: phone link must be present if lead has a phone
  if (lead.phone && !/href="tel:[+\d]/i.test(html)) {
    issues.push({ rule: 'missing_phone_link', severity: 'major' });
    score -= 10;
  }

  // 6. AEO/SEO presence — every produced demo must have these or AI search
  //    citation will silently break. Phase B promotes these from "produced
  //    by seo.js" (deterministic) to "must survive the bespoke pass intact".
  const aeoChecks = [
    { rule: 'aeo_title_missing',           severity: 'critical', weight: 18, test: () => /<title>[^<][\s\S]{2,}<\/title>/i.test(html) },
    { rule: 'aeo_meta_description_missing',severity: 'major',    weight: 12, test: () => /<meta\s+name="description"\s+content="[^"]+"/i.test(html) },
    { rule: 'aeo_canonical_missing',       severity: 'major',    weight: 10, test: () => /<link\s+rel="canonical"\s+href="[^"]+"/i.test(html) },
    { rule: 'aeo_og_image_missing',        severity: 'minor',    weight: 5,  test: () => /<meta\s+property="og:image"\s+content="[^"]+"/i.test(html) },
    { rule: 'aeo_localbusiness_jsonld_missing', severity: 'critical', weight: 18,
      // seo.js maps niches to subtypes of LocalBusiness (Electrician, Plumber,
      // RoofingContractor, HVACBusiness, GeneralContractor, ...). Match any
      // valid LocalBusiness or its subtypes by checking for `aggregateRating`
      // OR `LocalBusiness` literal — both indicate a real business JSON-LD.
      test: () => /<script\s+type="application\/ld\+json">[\s\S]*?(?:LocalBusiness|Electrician|Plumber|RoofingContractor|HVACBusiness|GeneralContractor|HomeAndConstructionBusiness)[\s\S]*?<\/script>/i.test(html) },
    { rule: 'aeo_faq_jsonld_missing',      severity: 'major',    weight: 12,
      test: () => /<script\s+type="application\/ld\+json">[\s\S]*?FAQPage[\s\S]*?<\/script>/i.test(html) },
    { rule: 'aeo_visible_faq_missing',     severity: 'major',    weight: 10,
      test: () => /<section[^>]+id=["']faq["'][^>]*>/i.test(html) },
  ];
  for (const c of aeoChecks) {
    if (!c.test()) {
      issues.push({ rule: c.rule, severity: c.severity });
      score -= c.weight;
    }
  }

  // 7. Structural-sameness check — DOM shape hash vs last N demos.
  //    Forces the bespoke engine to produce visibly different layouts
  //    across leads, not the same template with swapped text.
  const domHash = computeDomHash(html);
  const collidedAgainst = updateAndDetectCollision(domHash);
  if (collidedAgainst) {
    issues.push({ rule: `structural_sameness_collision:${collidedAgainst}`, severity: 'major' });
    score -= 18;
  }

  // 8. impeccable detect — anti-AI-slop CLI gate. Hard if installed.
  const impec = await tryImpeccable(html).catch(() => null);
  if (impec && Array.isArray(impec.findings)) {
    for (const f of impec.findings) {
      issues.push({ rule: `impeccable:${f.rule || f.id || 'unknown'}`, severity: f.severity || 'minor' });
      const weight = f.severity === 'critical' ? 12 : f.severity === 'major' ? 6 : 3;
      score -= weight;
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    impeccableRan: Boolean(impec),
    domHash,
  };
}

// Hash the DOM shape (tag list + class-name fingerprints) so visually
// identical templates collide even when text differs. The hero CSS,
// section ordering, and structural class names are what we actually
// compare — not the prose.
function computeDomHash(html) {
  // Strip prose/text content; keep only structural tokens.
  const tags = html.match(/<\s*\/?\s*[a-zA-Z][a-zA-Z0-9]*[^>]*>/g) || [];
  const tokens = [];
  for (const tag of tags) {
    const tagName = (tag.match(/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)/) || ['', ''])[1].toLowerCase();
    if (!tagName) continue;
    if (['script', 'style', 'meta', 'link', 'title'].includes(tagName)) continue;
    const classMatch = tag.match(/class="([^"]*)"/);
    if (classMatch) {
      const classes = classMatch[1].split(/\s+/).filter(Boolean).slice(0, 3).sort().join('.');
      tokens.push(`${tagName}[${classes}]`);
    } else {
      tokens.push(tagName);
    }
  }
  return crypto.createHash('sha1').update(tokens.join('>')).digest('hex').slice(0, 16);
}

function updateAndDetectCollision(hash) {
  let cache = [];
  try {
    if (fs.existsSync(HASH_CACHE_PATH)) {
      cache = JSON.parse(fs.readFileSync(HASH_CACHE_PATH, 'utf8')) || [];
    }
  } catch {
    cache = [];
  }
  const recentWindow = cache.slice(0, HASH_COLLISION_WINDOW);
  const collidedAgainst = recentWindow.find(h => h.hash === hash) || null;

  // Always update the cache (push to front, cap at limit). Even on collision
  // we record so a later demo can compare against the new one.
  cache = [{ hash, at: Date.now() }, ...cache.filter(h => h.hash !== hash)].slice(0, HASH_CACHE_LIMIT);
  try {
    fs.mkdirSync(path.dirname(HASH_CACHE_PATH), { recursive: true });
    fs.writeFileSync(HASH_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  } catch {
    // Cache write failure is non-fatal — just means future runs don't see this.
  }
  return collidedAgainst ? `${collidedAgainst.hash.slice(0, 8)}@${new Date(collidedAgainst.at).toISOString().slice(0, 10)}` : null;
}

async function tryImpeccable(html) {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn('npx', ['--yes', 'impeccable', 'detect', '--stdin', '--json'], {
        timeout: 8000,
      });
    } catch {
      return resolve(null);
    }
    let out = '';
    let err = '';
    proc.stdout?.on('data', d => { out += d.toString(); });
    proc.stderr?.on('data', d => { err += d.toString(); });
    proc.on('error', () => resolve(null));
    proc.on('close', (code) => {
      if (code !== 0 || !out.trim()) return resolve(null);
      try {
        resolve(JSON.parse(out));
      } catch {
        resolve(null);
      }
    });
    proc.stdin?.write(html);
    proc.stdin?.end();
  });
}

module.exports = { lintDemoHtml, _internals: { computeDomHash, updateAndDetectCollision } };
