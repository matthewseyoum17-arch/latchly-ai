const test = require('node:test');
const assert = require('node:assert/strict');
const {
  pickBestEmail,
  rankEmails,
  deriveBusinessDomain,
  isRoleEmail,
  isFreeMailDomain,
  isPersonShapedLocal,
  scoreEmail,
} = require('../email-utils');

test('pickBestEmail prefers person-shaped local part over role mailbox', () => {
  const result = pickBestEmail(['info@acme.com', 'jane.smith@acme.com', 'sales@acme.com']);
  assert.equal(result, 'jane.smith@acme.com');
});

test('pickBestEmail prefers business-domain match over personal mail', () => {
  const result = pickBestEmail(
    ['john@gmail.com', 'jsmith@acme.com'],
    { businessDomain: 'acme.com' },
  );
  assert.equal(result, 'jsmith@acme.com');
});

test('pickBestEmail keeps single role mailbox when nothing better exists', () => {
  const result = pickBestEmail(['info@solo.com']);
  assert.equal(result, 'info@solo.com');
});

test('pickBestEmail drops invalid candidates, keeps the valid one', () => {
  const result = pickBestEmail(['not-an-email', '   ', null, undefined, 'real@x.com']);
  assert.equal(result, 'real@x.com');
});

test('pickBestEmail returns empty string when no valid email exists', () => {
  assert.equal(pickBestEmail([]), '');
  assert.equal(pickBestEmail([null, '', 'bogus']), '');
});

test('rankEmails preserves the full set, sorted best-first', () => {
  const result = rankEmails(['INFO@x.com', 'jane@x.com', 'sales@x.com']);
  assert.deepEqual(result, ['jane@x.com', 'info@x.com', 'sales@x.com']);
});

test('rankEmails dedupes case-insensitively', () => {
  const result = rankEmails(['Jane@X.com', 'jane@x.com', 'JANE@x.com']);
  assert.deepEqual(result, ['jane@x.com']);
});

test('deriveBusinessDomain strips scheme and www', () => {
  assert.equal(deriveBusinessDomain('https://www.acme.com'), 'acme.com');
  assert.equal(deriveBusinessDomain('http://acme.com/contact'), 'acme.com');
  assert.equal(deriveBusinessDomain('acme.com'), 'acme.com');
});

test('deriveBusinessDomain extracts host from an email', () => {
  assert.equal(deriveBusinessDomain('jane@acme.com'), 'acme.com');
});

test('deriveBusinessDomain returns empty string for garbage', () => {
  assert.equal(deriveBusinessDomain(''), '');
  assert.equal(deriveBusinessDomain(null), '');
});

test('isRoleEmail identifies common role addresses and ignores personal ones', () => {
  assert.equal(isRoleEmail('info@x.com'), true);
  assert.equal(isRoleEmail('noreply@x.com'), true);
  assert.equal(isRoleEmail('careers@x.com'), true);
  assert.equal(isRoleEmail('jane@x.com'), false);
  assert.equal(isRoleEmail('john.doe@x.com'), false);
});

test('isFreeMailDomain catches the major personal providers', () => {
  assert.equal(isFreeMailDomain('jane@gmail.com'), true);
  assert.equal(isFreeMailDomain('jane@yahoo.com'), true);
  assert.equal(isFreeMailDomain('jane@acme.com'), false);
});

test('isPersonShapedLocal accepts realistic owner formats only', () => {
  assert.equal(isPersonShapedLocal('jane.smith'), true);
  assert.equal(isPersonShapedLocal('jane_smith'), true);
  assert.equal(isPersonShapedLocal('jsmith'), true);
  assert.equal(isPersonShapedLocal('jane'), true);
  assert.equal(isPersonShapedLocal('info'), false);
  assert.equal(isPersonShapedLocal('hi'), false);
  assert.equal(isPersonShapedLocal(''), false);
});

test('scoreEmail rewards business-domain match', () => {
  const personalDomain = scoreEmail('jane@gmail.com', { businessDomain: 'acme.com' });
  const businessDomain = scoreEmail('jane@acme.com', { businessDomain: 'acme.com' });
  assert.ok(businessDomain > personalDomain, 'expected business-domain match to outscore personal mail');
});

test('scoreEmail penalizes role addresses below personal ones', () => {
  const role = scoreEmail('info@acme.com');
  const person = scoreEmail('jane@acme.com');
  assert.ok(person > role, 'expected person-shaped to outscore role mailbox');
});
