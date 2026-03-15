#!/usr/bin/env node
// Connect to Chrome via CDP, attach to an already logged-in Apollo tab,
// and call Apollo's search API using the live browser session.
// Output defaults to leads/apollo-leads.csv so the rest of the pipeline can consume it directly.

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const TARGET = parseInt(process.env.APOLLO_TARGET || '150', 10);
const OUTPUT = process.env.APOLLO_OUTPUT || path.join(__dirname, '..', 'leads', 'apollo-leads.csv');
const SEARCH_BATCHES = [
  { keywords: ['hvac', 'heating and cooling', 'air conditioning'], label: 'HVAC' },
  { keywords: ['plumbing', 'plumber', 'drain'], label: 'Plumbing' },
  { keywords: ['roofing', 'roofer', 'roof repair'], label: 'Roofing' },
  { keywords: ['pest control', 'exterminator', 'termite'], label: 'Pest Control' },
  { keywords: ['garage door', 'overhead door'], label: 'Garage Door' },
  { keywords: ['electrical contractor', 'electrician'], label: 'Electrical' },
  { keywords: ['water damage', 'restoration', 'flood'], label: 'Water Damage' },
  { keywords: ['foundation repair', 'foundation'], label: 'Foundation Repair' },
  { keywords: ['tree service', 'tree removal', 'arborist'], label: 'Tree Service' },
  { keywords: ['remodeling', 'renovation', 'kitchen', 'bath'], label: 'Remodeling' },
  { keywords: ['concrete', 'concrete contractor'], label: 'Concrete' },
  { keywords: ['landscaping', 'lawn care', 'hardscape'], label: 'Landscaping' },
  { keywords: ['pool builder', 'swimming pool', 'pool service'], label: 'Pool' },
  { keywords: ['solar installer', 'solar panel', 'solar'], label: 'Solar' },
  { keywords: ['locksmith', 'lock'], label: 'Locksmith' },
  { keywords: ['moving company', 'movers'], label: 'Moving' },
];

function csv(val) {
  const s = String(val || '').replace(/\r?\n/g, ' ').trim();
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}

function initCSV() {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, 'Name,Title,Company,Industry,Employees,City,State,Email,Phone,LinkedIn,Company Website\n');
}

function writeRow(r) {
  const row = [r.name, r.title, r.company, r.industry, r.employees, r.city, r.state, r.email, r.phone, r.linkedin, r.website]
    .map(csv)
    .join(',') + '\n';
  fs.appendFileSync(OUTPUT, row);
}

function parseResponse(json) {
  const people = json.people || json.contacts || json.mixed_people || [];
  return people.map(p => {
    const org = p.organization || p.account || {};
    return {
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.name || '',
      title: p.title || p.headline || '',
      company: org.name || p.organization_name || '',
      industry: (org.industry_tag_names || org.keywords || []).join(', ') || org.primary_industry || org.industry || '',
      employees: org.estimated_num_employees || org.num_employees || '',
      city: p.city || '',
      state: p.state || '',
      email: p.email || (p.personal_emails && p.personal_emails[0]) || '',
      phone: (p.phone_numbers && p.phone_numbers[0] && p.phone_numbers[0].raw_number) || p.mobile_phone || p.direct_phone || p.sanitized_phone || '',
      linkedin: p.linkedin_url || '',
      website: org.website_url || org.primary_domain || '',
    };
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Bad JSON from ${url}`));
        }
      });
    }).on('error', reject);
  });
}

let _id = 1;
function cdp(ws, method, params = {}, sid = null, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const id = _id++;
    const t = setTimeout(() => reject(new Error(`${method} timed out`)), timeout);
    const handler = msg => {
      const d = JSON.parse(msg.toString());
      if (d.id === id) {
        ws.removeListener('message', handler);
        clearTimeout(t);
        if (d.error) reject(new Error(`${method}: ${JSON.stringify(d.error)}`));
        else resolve(d.result);
      }
    };
    ws.on('message', handler);
    const m = { id, method, params };
    if (sid) m.sessionId = sid;
    ws.send(JSON.stringify(m));
  });
}

async function main() {
  initCSV();
  console.log('\n🚀 Apollo Lead Scraper\n');

  const targets = await httpGet('http://127.0.0.1:9222/json');
  const apolloTarget = targets.find(t => t.type === 'page' && t.url.includes('apollo'));
  if (!apolloTarget) {
    console.log('❌ No Apollo tab found. Open Apollo in Chrome with --remote-debugging-port=9222, log in, and rerun.');
    process.exit(1);
  }

  const version = await httpGet('http://127.0.0.1:9222/json/version');
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  const { sessionId } = await cdp(ws, 'Target.attachToTarget', { targetId: apolloTarget.id, flatten: true });
  try { await cdp(ws, 'Page.enable', {}, sessionId, 10000); } catch {}
  try { await cdp(ws, 'Runtime.enable', {}, sessionId, 10000); } catch {}
  try { await cdp(ws, 'Page.bringToFront', {}, sessionId); } catch {}

  const { result: urlResult } = await cdp(ws, 'Runtime.evaluate', { expression: 'window.location.href' }, sessionId, 10000);
  const currentUrl = urlResult.value || '';
  if (/login|sign_in/i.test(currentUrl)) {
    console.log('❌ Apollo is on a login page. Log in in Chrome first, then rerun.');
    ws.close();
    process.exit(1);
  }

  console.log(`Attached to ${currentUrl}`);
  console.log(`Targeting ${TARGET} leads -> ${OUTPUT}`);

  const leads = [];
  const seen = new Set();
  const titles = JSON.stringify(['Owner', 'Co-Owner', 'Founder', 'Co-Founder', 'CEO', 'President', 'Managing Partner', 'General Manager']);

  for (const batch of SEARCH_BATCHES) {
    if (leads.length >= TARGET) break;
    console.log(`\n🔍 Searching ${batch.label}`);

    for (let pageNum = 1; pageNum <= 3 && leads.length < TARGET; pageNum++) {
      const script = `
        (async () => {
          try {
            var csrf = '';
            var meta = document.querySelector('meta[name="csrf-token"]');
            if (meta) csrf = meta.content;
            if (!csrf) {
              var m = document.cookie.match(/X-CSRF-TOKEN=([^;]+)/i);
              if (m) csrf = decodeURIComponent(m[1]);
            }
            var headers = { 'Content-Type': 'application/json' };
            if (csrf) headers['X-CSRF-Token'] = csrf;
            const res = await fetch('https://app.apollo.io/api/v1/mixed_people/search', {
              method: 'POST',
              headers,
              credentials: 'include',
              body: JSON.stringify({
                page: ${pageNum},
                per_page: 25,
                person_titles: ${titles},
                organization_num_employees_ranges: ['1,10', '11,20', '21,50'],
                person_locations: ['United States'],
                q_organization_keyword_tags: ${JSON.stringify(batch.keywords)},
              }),
            });
            if (!res.ok) {
              var body = await res.text().catch(function() { return ''; });
              return JSON.stringify({ ok: false, status: res.status, body: body.slice(0, 500) });
            }
            const json = await res.json();
            return JSON.stringify({ ok: true, data: json });
          } catch (e) {
            return JSON.stringify({ ok: false, error: e.message });
          }
        })()
      `;

      const { result } = await cdp(ws, 'Runtime.evaluate', { expression: script, awaitPromise: true }, sessionId, 30000);
      let parsed;
      try {
        parsed = JSON.parse(result.value);
      } catch {
        console.log(`  ❌ Unparseable response on page ${pageNum}`);
        break;
      }
      if (!parsed.ok) {
        console.log(`  ❌ API ${parsed.status || ''} ${(parsed.body || parsed.error || '').slice(0, 160)}`);
        break;
      }

      const people = parseResponse(parsed.data);
      console.log(`  page ${pageNum}: ${people.length} candidates`);
      if (!people.length) break;

      for (const r of people) {
        if (!r.name || !r.company) continue;
        const key = `${r.name.toLowerCase()}|${r.company.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        leads.push(r);
        writeRow(r);
        console.log(`  ✅ #${leads.length} ${r.name} | ${r.title} @ ${r.company}`);
        if (leads.length >= TARGET) break;
      }
    }
  }

  ws.close();
  console.log(`\n✅ Done. Wrote ${leads.length} leads to ${OUTPUT}`);
}

main().catch(err => {
  console.error(`\n❌ Fatal: ${err.message}`);
  process.exit(1);
});
