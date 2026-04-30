const test = require('node:test');
const assert = require('node:assert/strict');
const { findEmail, verifyDeliverable } = require('../email-finder');
const { _internals: whoisInternals } = require('../finders/whois');

// The legacy permute/isPersonName/splitName tests were deleted along with
// the pattern-guess code path. Email finding is now verified-only — the
// only way to get an email is for a real public source (BBB/WHOIS/Yelp/
// website scrape) to surface one. The tests below exercise the new
// contract: refusal-to-guess and the verified-source helpers.

test('findEmail returns not_available when nothing is supplied', async () => {
  const r = await findEmail({});
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_business_name_or_domain');
});

test('findEmail never returns a method matching pattern_guess', async () => {
  // Even if someone passes the legacy ownerName/website args, the new
  // findEmail must not surface a guessed email. With no real data it
  // should fall through to not_available.
  const r = await findEmail({
    businessName: '',
    ownerName: 'Jane Smith',
    domain: 'definitely-not-a-real-domain-9eb4.com',
  });
  if (r.ok) {
    assert.doesNotMatch(String(r.method || ''), /pattern_guess/i);
  }
});

test('whois parser strips redacted-for-privacy registrant emails', () => {
  const sample = `
    Domain Name: ACME-EXAMPLE.COM
    Registrant Name: REDACTED FOR PRIVACY
    Registrant Email: redacted-for-privacy@example.com
  `;
  const parsed = whoisInternals.parseWhois(sample);
  assert.equal(parsed.registrantEmail, null);
  assert.equal(parsed.registrantName, null);
});

test('whois parser surfaces a real registrant email', () => {
  const sample = `
    Domain Name: ACME-EXAMPLE.COM
    Registrant Name: Jane Smith
    Registrant Email: jane@acme-example.com
  `;
  const parsed = whoisInternals.parseWhois(sample);
  assert.equal(parsed.registrantEmail, 'jane@acme-example.com');
  assert.equal(parsed.registrantName, 'Jane Smith');
});

test('whois person-name guard rejects entity strings', () => {
  assert.equal(whoisInternals.isPersonShapedName('ACME LLC'), false);
  assert.equal(whoisInternals.isPersonShapedName('Acme Holdings Group'), false);
  assert.equal(whoisInternals.isPersonShapedName('Jane Smith'), true);
  assert.equal(whoisInternals.isPersonShapedName('Jane'), false);
});

test('verifyDeliverable returns invalid_format for malformed input', async () => {
  const r = await verifyDeliverable('not-an-email');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_format');
});
