const test = require('node:test');
const assert = require('node:assert/strict');
const { permute, isPersonName, splitName, findEmail } = require('../email-finder');

test('isPersonName accepts realistic first+last names', () => {
  assert.equal(isPersonName('Jane Smith'), true);
  assert.equal(isPersonName('John A. Doe'), true);
  assert.equal(isPersonName("Maria O'Brien"), true);
  assert.equal(isPersonName('Hans-Peter Mueller'), true);
});

test('isPersonName rejects single tokens', () => {
  assert.equal(isPersonName('Jane'), false);
  assert.equal(isPersonName('Owner'), false);
  assert.equal(isPersonName(''), false);
  assert.equal(isPersonName(null), false);
});

test('isPersonName rejects department / role names', () => {
  assert.equal(isPersonName('Service Department'), false);
  assert.equal(isPersonName('Customer Care'), false);
  assert.equal(isPersonName('Customer Support'), false);
  assert.equal(isPersonName('Sales Office'), false);
  assert.equal(isPersonName('Front Desk'), false);
});

test('isPersonName tolerates name particles like Jr / III', () => {
  assert.equal(isPersonName('John Smith Jr'), true);
  assert.equal(isPersonName('Henry Ford III'), true);
  // ...but not "John Jr" alone — particle stripping leaves a single token.
  assert.equal(isPersonName('John Jr'), false);
});

test('splitName parses standard cases', () => {
  assert.deepEqual(splitName('Jane Smith'), { first: 'jane', last: 'smith' });
  assert.deepEqual(splitName("Mary O'Brien"), { first: 'mary', last: "o'brien" });
  assert.deepEqual(splitName('   '), null);
});

test('permute generates the expected high-priority patterns', () => {
  const candidates = permute('Jane Smith', 'acme.com');
  // First few should be the canonical SMB patterns
  assert.ok(candidates.includes('jane@acme.com'), 'jane@acme.com missing');
  assert.ok(candidates.includes('jane.smith@acme.com'), 'jane.smith@acme.com missing');
  assert.ok(candidates.includes('jsmith@acme.com'), 'jsmith@acme.com missing');
  // No duplicates
  assert.equal(new Set(candidates).size, candidates.length);
});

test('permute returns nothing for unparseable input', () => {
  assert.deepEqual(permute('', 'acme.com'), []);
  assert.deepEqual(permute('Jane Smith', ''), []);
});

test('findEmail refuses non-person owner names', async () => {
  const r = await findEmail({ ownerName: 'Service Department', domain: 'acme.com' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'owner_name_not_person_shaped');
});

test('findEmail refuses single-token names', async () => {
  const r = await findEmail({ ownerName: 'Owner', domain: 'acme.com' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'owner_name_not_person_shaped');
});

test('findEmail refuses confidence below the floor', async () => {
  const r = await findEmail({
    ownerName: 'Jane Smith',
    domain: 'acme.com',
    ownerConfidence: 0.4,
    minConfidence: 0.6,
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /owner_confidence_below_floor/);
});

test('findEmail returns no_domain when both website and domain are empty', async () => {
  const r = await findEmail({ ownerName: 'Jane Smith' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_domain');
});
