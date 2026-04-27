const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeSoftDupes } = require('../discovery');

test('cross-city same-name same-state with no phone or domain collapses to one row', () => {
  const a = base({ businessName: 'R. S. & J. Hammer Construction Company', city: 'Cowarts', state: 'AL', phone: '', website: '' });
  const b = base({ businessName: 'R. S. & J. Hammer Construction Company', city: 'Webb', state: 'AL', phone: '', website: '' });

  const merged = mergeSoftDupes([a, b]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].businessName, 'R. S. & J. Hammer Construction Company');
  assert.deepEqual(merged[0].cityVariants, ['Cowarts', 'Webb']);
});

test('cross-city same-name same-state with distinct phones is preserved as two real branches', () => {
  const a = base({ businessName: 'Acme Plumbing', city: 'Houston', state: 'TX', phone: '(713) 555-1111', website: '' });
  const b = base({ businessName: 'Acme Plumbing', city: 'Austin', state: 'TX', phone: '(512) 555-2222', website: '' });

  const merged = mergeSoftDupes([a, b]);

  assert.equal(merged.length, 2);
  assert.ok(!merged[0].cityVariants);
  assert.ok(!merged[1].cityVariants);
});

test('cross-city same-name same-state with distinct domains is preserved as two real branches', () => {
  const a = base({ businessName: 'Acme Plumbing', city: 'Houston', state: 'TX', phone: '', website: 'https://acme-houston.com' });
  const b = base({ businessName: 'Acme Plumbing', city: 'Austin', state: 'TX', phone: '', website: 'https://acme-austin.com' });

  const merged = mergeSoftDupes([a, b]);

  assert.equal(merged.length, 2);
});

test('different states with same name are not merged', () => {
  const a = base({ businessName: 'Brown Roofing', city: 'Camilla', state: 'GA', phone: '', website: '' });
  const b = base({ businessName: 'Brown Roofing', city: 'Mobile', state: 'AL', phone: '', website: '' });

  const merged = mergeSoftDupes([a, b]);

  assert.equal(merged.length, 2);
});

test('single candidate passes through unchanged', () => {
  const a = base({ businessName: 'Solo Co', city: 'Tampa', state: 'FL', phone: '', website: '' });
  const merged = mergeSoftDupes([a]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].businessName, 'Solo Co');
  assert.ok(!merged[0].cityVariants);
});

test('three same-name same-state cities collapse with all three city variants', () => {
  const a = base({ businessName: 'Big Tree Service', city: 'Mobile', state: 'AL', phone: '', website: '' });
  const b = base({ businessName: 'Big Tree Service', city: 'Birmingham', state: 'AL', phone: '', website: '' });
  const c = base({ businessName: 'Big Tree Service', city: 'Montgomery', state: 'AL', phone: '', website: '' });

  const merged = mergeSoftDupes([a, b, c]);

  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].cityVariants, ['Mobile', 'Birmingham', 'Montgomery']);
});

function base(overrides = {}) {
  return {
    sourceName: 'test',
    sourceRecordId: 'rec',
    rawPayload: {},
    businessName: '',
    niche: 'roofing contractor',
    city: '',
    state: '',
    phone: '',
    website: '',
    ...overrides,
  };
}
