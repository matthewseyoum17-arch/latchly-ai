#!/usr/bin/env node
// Uses an existing Chrome CDP session (9222) to check each lead's website
// for chatbot presence, then outputs qualified leads.

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const INPUT = process.env.APOLLO_INPUT || path.join(__dirname, '..', 'leads', 'apollo-leads.csv');
const OUTPUT_JSON = path.join(__dirname, '..', 'leads', 'qualified-leads.json');
const OUTPUT_CSV = path.join(__dirname, '..', 'leads', 'qualified-leads.csv');

const CHATBOT_SIGNATURES = [
  'intercom.io','intercom.com','widget.intercom',
  'js.drift.com','drift.com/core','drift.com',
  'code.tidio.co','tidio.com','tidio.co',
  'livechat.com','livechatinc.com',
  'zendesk.com/embeddable','zopim',
  'crisp.chat','client.crisp',
  'tawk.to','embed.tawk',
  'hs-scripts.com','hubspot.com/conversations',
  'freshchat','wchat.freshchat',
  'olark.com','smartsupp.com','userlike.com','chaport.com',
  'botpress','landbot.io','manychat.com','chatbot.com',
  'ada.cx','ada.support','qualified.com',
  'podium.com','birdeye.com','webchat.so',
  'liveperson.com','comm100.com','helpcrunch.com',
  'customerly.io','chatra.com','kommunicate.io','gorgias.com',
  'latchly','latchlyai','smith.ai','chatfuel.com',
];

function splitCSV(line) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

function parseCSV(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCSV(lines[0]);
  return lines.slice(1).map(line => {
    const values = splitCSV(line);
    const obj = {};
    headers.forEach((h, i) => obj[String(h || '').trim()] = String(values[i] || '').trim());
    return obj;
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Bad JSON from ${url}`)); }
      });
    }).on('error', reject);
  });
}

let _id = 1;
function cdp(ws, method, params = {}, sid = null, timeout = 30000) {
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

function inferNiche(company) {
  const c = String(company || '').toLowerCase();
  if (/hvac|heating.*cool|air condition|heat.*air/i.test(c)) return 'HVAC';
  if (/plumb/i.test(c)) return 'Plumbing';
  if (/roof/i.test(c)) return 'Roofing';
  if (/pest|termite|extermina/i.test(c)) return 'Pest Control';
  if (/garage.*door/i.test(c)) return 'Garage Door';
  if (/electri/i.test(c)) return 'Electrical';
  if (/water.*damage|restor/i.test(c)) return 'Water Damage';
  if (/foundation/i.test(c)) return 'Foundation Repair';
  if (/tree/i.test(c)) return 'Tree Service';
  if (/remodel|kitchen|bath|renov/i.test(c)) return 'Remodeling';
  if (/concrete/i.test(c)) return 'Concrete';
  if (/landscap|lawn/i.test(c)) return 'Landscaping';
  if (/pool|swim/i.test(c)) return 'Pool';
  if (/solar/i.test(c)) return 'Solar';
  if (/lock/i.test(c)) return 'Locksmith';
  if (/mov/i.test(c)) return 'Moving';
  return 'Home Services';
}

function csvEscape(val) {
  const s = String(val || '').replace(/\r?\n/g, ' ').trim();
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}

function normalizeWebsite(url) {
  let s = String(url || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s.replace(/\/$/, '');
}

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Missing Apollo input: ${INPUT}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT, 'utf-8');
  const leads = parseCSV(raw);
  console.log(`\n📊 ${leads.length} raw leads from Apollo\n`);

  const seen = new Set();
  const unique = [];
  for (const l of leads) {
    const website = normalizeWebsite(l['Company Website'] || '');
    if (!website) continue;
    const domain = website.replace(/https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    if (seen.has(domain)) continue;
    seen.add(domain);
    const name = l.Name || '';
    if (!name || name.length <= 3 || name.includes('@')) continue;
    if (/one hour|mr\. rooter|roto-rooter|service experts|ars rescue|home depot/i.test(l.Company || '')) continue;
    unique.push({ ...l, 'Company Website': website });
  }
  console.log(`🔄 ${unique.length} unique companies with decision makers\n`);

  const version = await httpGet('http://127.0.0.1:9222/json/version');
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
  console.log('✅ Connected to Chrome\n');

  const { targetId } = await cdp(ws, 'Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp(ws, 'Target.attachToTarget', { targetId, flatten: true });
  await cdp(ws, 'Page.enable', {}, sessionId);
  await cdp(ws, 'Runtime.enable', {}, sessionId);

  const results = [];
  let checked = 0;

  for (const lead of unique) {
    checked++;
    const company = lead.Company || '';
    const website = lead['Company Website'];
    process.stdout.write(`[${checked}/${unique.length}] ${company}... `);

    try {
      await cdp(ws, 'Page.navigate', { url: website }, sessionId, 20000);
      await new Promise(r => setTimeout(r, 4000));

      const checkScript = `
        (function() {
          try {
            var html = document.documentElement.outerHTML || '';
            var lower = html.toLowerCase();
            var sigs = ${JSON.stringify(CHATBOT_SIGNATURES)};
            var chatbotFound = null;
            for (var i = 0; i < sigs.length; i++) {
              if (lower.indexOf(sigs[i].toLowerCase()) !== -1) {
                chatbotFound = sigs[i];
                break;
              }
            }
            if (!chatbotFound) {
              var chatSelectors = [
                'iframe[src*="chat"]', 'iframe[src*="widget"]', 'iframe[src*="messenger"]',
                '[class*="chat-widget"]', '[class*="chatWidget"]', '[class*="chat-bubble"]',
                '[class*="chatBubble"]', '[class*="live-chat"]', '[class*="liveChat"]',
                '[id*="chat-widget"]', '[id*="chatWidget"]', '[id*="tidio"]', '[id*="drift"]',
                '[id*="intercom"]', '[id*="tawk"]', '[id*="crisp"]', '[id*="hubspot-messages"]',
                '[id*="podium"]', '[id*="birdeye"]'
              ];
              for (var j = 0; j < chatSelectors.length; j++) {
                if (document.querySelector(chatSelectors[j])) { chatbotFound = chatSelectors[j]; break; }
              }
            }
            var signals = [];
            if (/googletagmanager|gtag|gads|google.*ads|adwords|gclid/i.test(html)) signals.push('Google Ads/GTM');
            if (/google.*local.*service|google.*guarantee/i.test(html)) signals.push('Local Service Ads');
            if (/service.*area|serving|we.*serve|locations.*served/i.test(html)) signals.push('Service area pages');
            if (/reviews?|testimonials?|rating|stars?|customer.*feedback/i.test(lower)) signals.push('Reviews/testimonials');
            if (/free.*quote|free.*estimate|get.*quote|request.*quote|book.*now|schedule.*now|call.*now/i.test(html)) signals.push('Quote/estimate CTA');
            if (/tel:/i.test(html)) signals.push('Prominent phone');
            if (/<form/i.test(html)) signals.push('Contact form');
            var phoneMatch = html.match(/href=["']tel:([^"']+)["']/i);
            var phone = phoneMatch ? phoneMatch[1].replace(/[^\\d]/g, '') : '';
            if (phone.length === 11 && phone[0] === '1') phone = phone.slice(1);
            if (phone.length === 10) phone = '(' + phone.slice(0,3) + ') ' + phone.slice(3,6) + '-' + phone.slice(6);
            else phone = '';
            return JSON.stringify({ ok: true, chatbot: chatbotFound, signals: signals, phone: phone });
          } catch(e) {
            return JSON.stringify({ ok: false, error: e.message });
          }
        })()
      `;

      const { result } = await cdp(ws, 'Runtime.evaluate', { expression: checkScript }, sessionId, 15000);
      const data = JSON.parse(result.value || '{}');
      if (!data.ok) {
        console.log('❌ error');
        continue;
      }
      if (data.chatbot) {
        console.log(`❌ CHATBOT (${data.chatbot})`);
        continue;
      }

      const entry = {
        businessName: company,
        niche: lead.Industry || inferNiche(company),
        city: lead.City || '',
        state: lead.State || '',
        website,
        decisionMaker: lead.Name,
        title: lead.Title || '',
        phone: lead.Phone || '',
        businessPhone: data.phone || lead.Phone || '',
        email: lead.Email && !lead.Email.includes('not_unlocked') ? lead.Email : '',
        linkedin: lead.LinkedIn || '',
        chatbot: 'No',
        marketingSignals: data.signals.join('; '),
        signalCount: data.signals.length,
        missedOpportunity: 'No instant engagement; no after-hours capture; visitors must wait for callback',
      };

      let score = 0;
      score++;
      score++;
      if (entry.decisionMaker) score++;
      if (entry.businessPhone || entry.phone) score++;
      score++;
      if (data.signals.length >= 2) score++;
      if (/hvac|plumb|roof|foundation|water damage|electri|remodel|solar|garage door|tree|pest/i.test(company)) score++;
      if (!/one hour|roto-rooter|service experts|ars rescue|mr\./i.test(company)) score++;
      score++;
      const emp = parseInt(lead.Employees) || 0;
      if (emp === 0 || (emp >= 5 && emp <= 50)) score++;
      entry.fitScore = score;

      results.push(entry);
      console.log(`✅ ${score}/10 | ${data.signals.length} signals | phone: ${entry.businessPhone || 'N/A'}`);
    } catch (e) {
      console.log(`❌ ${e.message.slice(0, 50)}`);
    }

    await new Promise(r => setTimeout(r, 1200));
  }

  try { await cdp(ws, 'Target.closeTarget', { targetId }); } catch {}
  ws.close();

  results.sort((a, b) => b.fitScore - a.fitScore || b.signalCount - a.signalCount);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2));
  const headers = 'Business Name,Niche,City,State,Website,Decision Maker,Title,Direct Phone,Business Phone,Email,LinkedIn,Chatbot?,Marketing Signals,Missed-Lead Opportunity,Fit Score';
  const rows = results.map(l => [
    l.businessName, l.niche, l.city, l.state, l.website,
    l.decisionMaker, l.title, l.phone, l.businessPhone,
    l.email, l.linkedin, l.chatbot, l.marketingSignals,
    l.missedOpportunity, l.fitScore,
  ].map(csvEscape).join(','));
  fs.writeFileSync(OUTPUT_CSV, headers + '\n' + rows.join('\n') + '\n');

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 RESULTS');
  console.log(`${'='.repeat(60)}`);
  console.log(`Checked:     ${checked}`);
  console.log(`NO CHATBOT:  ${results.length}`);
  console.log(`Score 8+:    ${results.filter(r => r.fitScore >= 8).length}`);
  console.log(`Score 9+:    ${results.filter(r => r.fitScore >= 9).length}`);
  console.log(`Score 10:    ${results.filter(r => r.fitScore >= 10).length}`);
  console.log(`\n📁 ${OUTPUT_CSV}`);
  console.log(`📁 ${OUTPUT_JSON}\n`);
}

main().catch(err => { console.error(`\n❌ Fatal: ${err.message}`); process.exit(1); });
