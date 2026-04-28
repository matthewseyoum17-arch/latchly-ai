const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifySourceOpportunity,
  mergeSoftDupes,
  orderCandidatesForAudit,
  parseDbprResults,
  parseYellowPagesSearch,
  sourcePlan,
} = require('../discovery');

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

test('DBPR parser keeps current active DBA rows and extracts city/address metadata', () => {
  const html = `
    <tr height='40'>
      <td colspan='1' width='20%' align='center'><font>Certified Plumbing Contractor</font></td>
      <td colspan='1' align='center'><font><a href='LicenseDetail.asp?id=1'>HEATH PHILLIPS PLUMBING REPAIRS INC</a></font></td>
      <td colspan='1' align='center'><font>DBA</font></td>
      <td colspan='1' align='center'><font>CFC1426766<br/>Cert Plumbing</font></td>
      <td colspan='1' align='center'><font>Current, Active<br/>08/31/2026</font></td>
    <tr height='40'>
      <td colspan='6'><table><tr><td><font><b>Main Address*:</b></font></td>
      <td><font>11809 SW 103RD AVE GAINESVILLE, FL 32608-5851</font></td></tr></table></td>
    </tr>`;

  const rows = parseDbprResults(
    html,
    'plumber',
    { board: '06', licenseType: '0604', label: 'Certified Plumbing Contractor' },
    { city: 'Gainesville', state: 'FL' },
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].businessName, 'HEATH PHILLIPS PLUMBING REPAIRS INC');
  assert.equal(rows[0].city, 'Gainesville');
  assert.equal(rows[0].state, 'FL');
  assert.equal(rows[0].rawPayload.licenseNumber, 'CFC1426766');
});

test('DBPR parser drops inactive rows and individual primary names', () => {
  const html = `
    <tr height='40'><td><font>Certified Plumbing Contractor</font></td>
      <td><font><a>HARPE, CLAUDE EVERETT</a></font></td><td><font>Primary</font></td>
      <td><font>CFC1429559<br/>Cert Plumbing</font></td><td><font>Null and Void, <br/>08/31/2018</font></td></tr>
    <tr height='40'><td><font>Certified Plumbing Contractor</font></td>
      <td><font><a>HATAMI, MOHSEN</a></font></td><td><font>Primary</font></td>
      <td><font>CFC1433640<br/>Cert Plumbing</font></td><td><font>Current, Active<br/>08/31/2026</font></td></tr>`;

  const rows = parseDbprResults(
    html,
    'plumber',
    { board: '06', licenseType: '0604', label: 'Certified Plumbing Contractor' },
    { city: 'Gainesville', state: 'FL' },
  );

  assert.equal(rows.length, 0);
});

test('YellowPages parser handles current result markup without splitting nested rating blocks', () => {
  const html = `
    <div class="search-results-organic">
      <div class="result">
        <div class="v-card">
          <a class="business-name" href="/gainesville-fl/mip/wolfe-plumbing-inc-123">
            <span>Wolfe Plumbing Inc</span>
          </a>
          <div class="result-rating five"><span>5</span></div>
          <a href="https://www.wolfeplumbing.net/" class="track-visit-website">Website</a>
          <div class="phone">(386) 433-3504</div>
        </div>
      </div>
      <div class="result">
        <div class="v-card">
          <a class="business-name" href="/gainesville-fl/mip/compare-roofing-experts-456">
            <span>Compare Roofing Experts</span>
          </a>
          <div class="phone">(888) 906-6670</div>
        </div>
      </div>
    </div>`;

  const rows = parseYellowPagesSearch(
    html,
    'plumber',
    'Gainesville',
    'FL',
    'https://www.yellowpages.com/search?search_terms=plumber',
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].businessName, 'Wolfe Plumbing Inc');
  assert.equal(rows[0].phone, '(386) 433-3504');
  assert.equal(rows[0].website, 'https://www.wolfeplumbing.net');
});

test('source opportunity ordering prioritizes no-website and likely poor-site rows before website-rich BBB', () => {
  const ordered = orderCandidatesForAudit([
    base({
      sourceName: 'bbb',
      businessName: 'Established BBB Plumbing',
      phone: '(352) 555-0001',
      website: 'https://established.example',
      rawPayload: { bbbMember: true, yearsInBusiness: 18 },
    }),
    base({
      sourceName: 'yellowpages',
      businessName: 'No Site YP Plumbing',
      phone: '(352) 555-0002',
      website: '',
    }),
    base({
      sourceName: 'yellowpages',
      businessName: 'Possible Bad Site Plumbing',
      phone: '(352) 555-0003',
      website: 'http://badsite.example',
    }),
  ]);

  assert.deepEqual(ordered.map(row => row.businessName), [
    'No Site YP Plumbing',
    'Possible Bad Site Plumbing',
    'Established BBB Plumbing',
  ]);
  assert.equal(classifySourceOpportunity(ordered[0]), 'no_source_website');
  assert.equal(classifySourceOpportunity(ordered[2]), 'website_rich_low_priority');
});

test('source plan rotates niches inside each market instead of exhausting one niche across all markets', () => {
  const plan = sourcePlan([
    { city: 'Gainesville', state: 'FL' },
    { city: 'Dallas', state: 'TX' },
  ]).slice(0, 6);

  assert.deepEqual(new Set(plan.map(item => item.market.city)), new Set(['Gainesville']));
  assert.ok(new Set(plan.map(item => item.niche)).size > 3);
});

test('website-rich BBB rows are deferred after per-source and per-market caps', () => {
  const bbbRows = Array.from({ length: 6 }, (_, index) => base({
    sourceName: 'bbb',
    businessName: `BBB Roof ${index}`,
    niche: 'roofing contractor',
    city: 'Dallas',
    state: 'TX',
    phone: `(214) 555-10${index}${index}`,
    website: `https://bbb-roof-${index}.example`,
    rawPayload: { bbbMember: true, yearsInBusiness: 12 },
  }));
  const ordered = orderCandidatesForAudit([
    ...bbbRows,
    base({
      sourceName: 'yellowpages',
      businessName: 'YP No Site Roof',
      niche: 'roofing contractor',
      city: 'Dallas',
      state: 'TX',
      phone: '(214) 555-2200',
      website: '',
    }),
    base({
      sourceName: 'yellowpages',
      businessName: 'YP Bad Site Roof',
      niche: 'roofing contractor',
      city: 'Dallas',
      state: 'TX',
      phone: '(214) 555-2201',
      website: 'http://yp-bad-site.example',
    }),
  ], {
    websiteRichSourceCap: 3,
    websiteRichMarketCap: 2,
  });

  assert.deepEqual(ordered.slice(0, 4).map(row => row.businessName), [
    'YP No Site Roof',
    'YP Bad Site Roof',
    'BBB Roof 0',
    'BBB Roof 1',
  ]);
  assert.equal(ordered.slice(0, 5).filter(row => row.sourceName === 'bbb').length, 3);
  assert.deepEqual(ordered.slice(-2).map(row => row.businessName), ['BBB Roof 4', 'BBB Roof 5']);
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
