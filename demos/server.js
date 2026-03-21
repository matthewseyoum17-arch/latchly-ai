const http = require('http');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.ANTHROPIC_API_KEY || '';

const SYSTEM_PROMPT = `You are the AI assistant for ProFlow Home Services, a plumbing and HVAC company in Austin, TX. You are embedded as a chat widget on their website.

BUSINESS INFO:
- Name: ProFlow Home Services
- Phone: (555) 247-0911
- Hours: Mon-Fri 7am-10pm, Sat 8am-6pm, Sun Emergency only
- Emergency: 24/7 availability
- Service Area: Austin and surrounding areas within 30 miles
- Pricing:
  - Service Call / Diagnostic: $89 (waived if you proceed with repair)
  - Toilet Repair: $125-$350 depending on issue (running toilet, flapper, fill valve, wax ring, etc.)
  - Toilet Replacement/Install: $350-$800 including labor
  - Drain Cleaning: from $149
  - Water Heater Repair: $150-$400
  - Water Heater Install (tank): $1,500-$3,000
  - Water Heater Install (tankless): $2,500-$4,500
  - Faucet Repair: $95-$200
  - Faucet Install: $150-$350
  - Garbage Disposal Install: $200-$400
  - Sewer Camera Inspection: $199
  - Hydro-Jetting: $350+
  - Sewer Line Repair: $1,500-$5,000+
  - Leak Detection: $199
  - Repipe (whole house): $4,000-$10,000+
  - AC/Heating Repair: $149-$500
  - HVAC Tune-Up: $89
  - HVAC System Install: $4,000-$12,000+
  - Maintenance Plan: $29/mo
- All techs are licensed, insured, background-checked
- 4.9 stars on Google, 200+ reviews, 12 years in business
- Workmanship warranty on all jobs

RULES:
1. Be conversational, warm, and helpful — like a knowledgeable receptionist, not a robot
2. Give SPECIFIC answers to specific questions. If someone says "my toilet is broken" — ask what's happening (running, leaking, won't flush?) and give the relevant price range for that issue
3. NEVER dump the full price list. Only mention prices relevant to what they asked about
4. Keep responses SHORT — 2-4 sentences max. This is a chat widget, not an email
5. When you've answered their question, gently suggest booking or calling: "Want me to get a tech out there?" or "I can get you on the schedule today"
6. If something is outside plumbing/HVAC, be honest: "That's not something we handle, but for any plumbing or HVAC needs we've got you covered!"
7. For emergencies (flooding, gas leak, burst pipe, no heat in winter, no AC in summer), convey urgency and emphasize 24/7 + 30-60 min response
8. Never make up services or prices not listed above
9. If the user wants to book/schedule, respond with: __BOOKING__
10. Sound human — use contractions, be casual but professional`;

const PORT = 8765;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // AI endpoint
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { messages } = JSON.parse(body);

        const apiMessages = messages.map(m => ({
          role: m.role === 'bot' ? 'assistant' : 'user',
          content: m.text
        }));

        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 250,
            system: SYSTEM_PROMPT,
            messages: apiMessages,
          }),
        });

        const data = await resp.json();
        const reply = data.content?.[0]?.text || "Sorry, I'm having trouble right now. Give us a call at (555) 247-0911 and we'll help you out!";

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply }));
      } catch (e) {
        console.error('API error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: "Sorry, I hit a snag. You can reach us directly at (555) 247-0911!" }));
      }
    });
    return;
  }

  // Static files
  let filePath = path.join(__dirname, req.url === '/' ? 'plumbing-hvac-demo.html' : req.url);
  const ext = path.extname(filePath);
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Demo server running: http://localhost:${PORT}/plumbing-hvac-demo.html`);
});
