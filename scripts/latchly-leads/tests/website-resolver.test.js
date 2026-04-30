const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveMissingWebsite,
  scoreProviderIdentity,
  verifyWebsiteCandidate,
} = require('../website-resolver');

test('missing-website resolver finds and verifies a Google Maps website candidate', async () => {
  const lead = {
    businessName: 'Kayco Roofing LLC',
    city: 'Gainesville',
    state: 'FL',
    phone: '(352) 555-1212',
    website: '',
  };

  const result = await resolveMissingWebsite(lead, {
    serpApiKey: 'test-key',
    fetcher: async (url) => {
      if (/serpapi\.com/.test(url)) {
        return {
          ok: true,
          status: 200,
          url,
          text: JSON.stringify({
            local_results: [{
              title: 'Kayco Roofing LLC',
              phone: '(352) 555-1212',
              address: '123 Main St, Gainesville, FL',
              website: 'https://kayco.example',
            }],
          }),
        };
      }
      if (url === 'https://kayco.example') {
        return {
          ok: true,
          status: 200,
          url,
          text: '<html><body><h1>Kayco Roofing LLC</h1><a href="tel:3525551212">Call</a><p>Gainesville roof repair</p></body></html>',
        };
      }
      throw new Error(`unexpected_url:${url}`);
    },
  });

  assert.equal(result.website, 'https://kayco.example');
  assert.equal(result.source, 'serpapi_google_maps');
  assert.ok(result.confidence >= 0.9);
});

test('missing-website resolver is explicit when no lookup provider is configured', async () => {
  const priorSerp = process.env.SERPAPI_API_KEY;
  const priorGoogleMaps = process.env.GOOGLE_MAPS_API_KEY;
  const priorGooglePlaces = process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.SERPAPI_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_PLACES_API_KEY;
  try {
    const result = await resolveMissingWebsite({
      businessName: 'No Provider Plumbing',
      city: 'Gainesville',
      state: 'FL',
      phone: '(352) 555-0000',
      website: '',
    });

    assert.equal(result.website, '');
    assert.equal(result.attempted, false);
    assert.equal(result.reason, 'no_resolver_configured');
  } finally {
    if (priorSerp == null) delete process.env.SERPAPI_API_KEY;
    else process.env.SERPAPI_API_KEY = priorSerp;
    if (priorGoogleMaps == null) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = priorGoogleMaps;
    if (priorGooglePlaces == null) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = priorGooglePlaces;
  }
});

test('missing-website resolver verifies no-site evidence from a matched public directory profile', async () => {
  const priorSerp = process.env.SERPAPI_API_KEY;
  const priorGoogleMaps = process.env.GOOGLE_MAPS_API_KEY;
  const priorGooglePlaces = process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.SERPAPI_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_PLACES_API_KEY;
  try {
    const result = await resolveMissingWebsite({
      businessName: 'Kayco Roofing LLC',
      city: 'Gainesville',
      state: 'FL',
      phone: '(352) 555-1212',
      website: '',
      sourceName: 'yellowpages',
      rawPayload: { profileUrl: 'https://www.yellowpages.com/gainesville-fl/mip/kayco-roofing-123' },
    }, {
      fetcher: async (url) => {
        assert.equal(url, 'https://www.yellowpages.com/gainesville-fl/mip/kayco-roofing-123');
        return {
          ok: true,
          status: 200,
          url,
          text: '<html><body><h1>Kayco Roofing LLC</h1><p>Gainesville, FL</p><div class="phone">(352) 555-1212</div></body></html>',
        };
      },
    });

    assert.equal(result.website, '');
    assert.equal(result.attempted, true);
    assert.equal(result.verifiedNoWebsite, true);
    assert.equal(result.reason, 'directory_verified_no_site');
    assert.ok(result.evidence.some(item => item.source === 'yellowpages_profile'));
  } finally {
    if (priorSerp == null) delete process.env.SERPAPI_API_KEY;
    else process.env.SERPAPI_API_KEY = priorSerp;
    if (priorGoogleMaps == null) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = priorGoogleMaps;
    if (priorGooglePlaces == null) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = priorGooglePlaces;
  }
});

test('public directory resolver prefers an exposed owned website over no-site evidence', async () => {
  const result = await resolveMissingWebsite({
    businessName: 'Kayco Roofing LLC',
    city: 'Gainesville',
    state: 'FL',
    phone: '(352) 555-1212',
    website: '',
    sourceName: 'yellowpages',
    rawPayload: { profileUrl: 'https://www.yellowpages.com/gainesville-fl/mip/kayco-roofing-123' },
  }, {
    fetcher: async (url) => {
      if (url === 'https://www.yellowpages.com/gainesville-fl/mip/kayco-roofing-123') {
        return {
          ok: true,
          status: 200,
          url,
          text: '<html><body><h1>Kayco Roofing LLC</h1><div class="phone">(352) 555-1212</div><a class="track-visit-website" href="https://kayco.example">Website</a></body></html>',
        };
      }
      if (url === 'https://kayco.example') {
        return {
          ok: true,
          status: 200,
          url,
          text: '<html><body><h1>Kayco Roofing LLC</h1><a href="tel:3525551212">Call</a><p>Gainesville roof repair</p></body></html>',
        };
      }
      throw new Error(`unexpected_url:${url}`);
    },
  });

  assert.equal(result.website, 'https://kayco.example');
  assert.equal(result.source, 'yellowpages_profile');
});

test('public directory resolver does not mark no-site when an exposed website fails verification', async () => {
  const result = await resolveMissingWebsite({
    businessName: 'Kayco Roofing LLC',
    city: 'Gainesville',
    state: 'FL',
    phone: '(352) 555-1212',
    website: '',
    sourceName: 'yellowpages',
    rawPayload: { profileUrl: 'https://www.yellowpages.com/gainesville-fl/mip/kayco-roofing-123' },
  }, {
    fetcher: async (url) => {
      if (url === 'https://www.yellowpages.com/gainesville-fl/mip/kayco-roofing-123') {
        return {
          ok: true,
          status: 200,
          url,
          text: '<html><body><h1>Kayco Roofing LLC</h1><div class="phone">(352) 555-1212</div><a class="track-visit-website" href="https://wrong.example">Website</a></body></html>',
        };
      }
      if (url === 'https://wrong.example') {
        return {
          ok: true,
          status: 200,
          url,
          text: '<html><body><h1>Different Electric Company</h1><p>Orlando electrical service</p></body></html>',
        };
      }
      throw new Error(`unexpected_url:${url}`);
    },
  });

  assert.equal(result.website, '');
  assert.notEqual(result.verifiedNoWebsite, true);
});

test('website candidate verification rejects unrelated business content', async () => {
  const verified = await verifyWebsiteCandidate('https://wrong.example', {
    businessName: 'Kayco Roofing LLC',
    city: 'Gainesville',
    state: 'FL',
    phone: '(352) 555-1212',
  }, {
    source: 'test',
    identityScore: 0.4,
    fetcher: async (url) => ({
      ok: true,
      status: 200,
      url,
      text: '<html><body><h1>Different Electric Company</h1><p>Orlando electrical service</p></body></html>',
    }),
  });

  assert.equal(verified.ok, false);
});

test('provider identity scoring accepts phone-backed exact matches', () => {
  const identity = scoreProviderIdentity({
    name: 'Kayco Roofing LLC',
    formatted_phone_number: '(352) 555-1212',
    formatted_address: 'Gainesville, FL',
  }, {
    businessName: 'Kayco Roofing LLC',
    city: 'Gainesville',
    state: 'FL',
    phone: '(352) 555-1212',
  });

  assert.ok(identity.score >= 0.95);
});
