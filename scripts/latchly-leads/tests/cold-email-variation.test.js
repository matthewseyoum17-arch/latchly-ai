const test = require('node:test');
const assert = require('node:assert/strict');
const { COLD_EMAIL_RULES, __test } = require('../cold-email-engine');

const { pickVariation, ngramSet, jaccardOverlap, validateStructure } = __test;

test('pickVariation is deterministic for the same lead.id', () => {
  const a = pickVariation({ id: 12345 }, 'matt');
  const b = pickVariation({ id: 12345 }, 'matt');
  assert.equal(a.voice.key, b.voice.key);
  assert.equal(a.opener.key, b.opener.key);
  assert.equal(a.lengthBucket.key, b.lengthBucket.key);
  assert.equal(a.signoff.key, b.signoff.key);
});

test('pickVariation distributes across pools — 100 leads should hit ≥ 4 voice archetypes', () => {
  const seen = new Set();
  for (let i = 1; i <= 100; i += 1) seen.add(pickVariation({ id: i }, 'matt').voice.key);
  assert.ok(seen.size >= 4, `expected ≥4 distinct voices, got ${seen.size}`);
});

test('pickVariation interpolates the sender name into the chosen sign-off form', () => {
  // Force every signoff form by sweeping ids until we hit each.
  const formsHit = new Set();
  for (let i = 1; i <= 200 && formsHit.size < COLD_EMAIL_RULES.signoffPool.length; i += 1) {
    const v = pickVariation({ id: i }, 'matt');
    formsHit.add(v.signoff.key);
    // Sign-off must contain the first name (any case).
    assert.match(v.signoffRendered.toLowerCase(), /matt/);
  }
});

test('ngramSet generates 7-gram windows from normalized text', () => {
  const s = ngramSet('hi there I built a homepage redesign for cornerstone today', 7);
  assert.ok(s.size >= 1);
  // Spot-check one expected gram is present.
  const grams = Array.from(s);
  assert.ok(grams.some(g => /built a homepage/.test(g)), 'expected a 7-gram covering "built a homepage"');
});

test('jaccardOverlap returns 0 for disjoint, 1 for identical', () => {
  const a = ngramSet('alpha bravo charlie delta echo foxtrot golf hotel india', 7);
  const b = ngramSet('zulu yankee xray whiskey victor uniform tango sierra romeo', 7);
  assert.equal(jaccardOverlap(a, b), 0);
  assert.equal(jaccardOverlap(a, a), 1);
});

test('jaccardOverlap detects partial reuse above threshold', () => {
  const orig =
    'Hi Wei, I built a homepage redesign for Cornerstone. Cleaner quote flow, mobile-tightened, and an after-hours capture form. Preview link soon.';
  const reused =
    'Hi Jane, I built a homepage redesign for Cornerstone. Cleaner quote flow, mobile-tightened, and an after-hours capture form for late-night calls.';
  const a = ngramSet(orig, 7);
  const b = ngramSet(reused, 7);
  assert.ok(jaccardOverlap(a, b) >= COLD_EMAIL_RULES.dedupeOverlapThreshold,
    `expected overlap ≥ ${COLD_EMAIL_RULES.dedupeOverlapThreshold}, got ${jaccardOverlap(a, b)}`);
});

test('validateStructure rejects bodies with > 2 em-dashes', () => {
  const body = `Hi Wei,

I built a homepage redesign for Cornerstone — leaning into Dallas — bathtub work — refinishing — quote flow.

Preview: https://example.com/demo

Worth 60 seconds?

—
Matt
Latchly`;
  const reason = validateStructure({
    subject: 'Homepage redesign for Cornerstone',
    body,
    demoUrl: 'https://example.com/demo',
    businessName: 'Cornerstone',
    lengthBucket: { min: 20, max: 500 },
  });
  assert.match(String(reason), /em_dash_overuse/);
});

test('validateStructure rejects two consecutive paragraphs starting with I', () => {
  const body = `Hi Wei,

I built a homepage redesign for Cornerstone, focused on the Dallas service area and bathtub refinishing work. Streamlined the quote flow.

I think it'll improve mobile capture rates and reduce missed late-night calls. Tighter typography too.

Preview: https://example.com/demo

Worth 60 seconds?

—
Matt
Latchly`;
  const reason = validateStructure({
    subject: 'Homepage redesign for Cornerstone',
    body,
    demoUrl: 'https://example.com/demo',
    businessName: 'Cornerstone',
    lengthBucket: { min: 20, max: 500 },
  });
  assert.equal(reason, 'body_consecutive_I_paragraphs');
});

test('validateStructure accepts a clean draft', () => {
  const body = `Hi Wei,

I built a homepage redesign for Cornerstone, focused on the bathtub and tile refinishing work you do across Dallas. Cleaner quote flow, mobile-tightened, and a simple after-hours capture form.

Preview: https://example.com/demo

Worth 60 seconds?

Matt, Latchly`;
  const reason = validateStructure({
    subject: 'Homepage redesign for Cornerstone',
    body,
    demoUrl: 'https://example.com/demo',
    businessName: 'Cornerstone',
    lengthBucket: { min: 20, max: 500 },
  });
  assert.equal(reason, null);
});
