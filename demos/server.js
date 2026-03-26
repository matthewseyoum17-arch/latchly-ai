const http = require('http');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const PORT = 8765;

const DEFAULT_BUSINESS_INFO = {
  name: 'ProFlow Home Services',
  phone: '(555) 247-0911',
  hours: 'Mon-Fri 7am-10pm, Sat 8am-6pm, Sun Emergency only',
  emergency: '24/7 availability',
  serviceArea: 'Austin and surrounding areas within 30 miles',
  address: 'Austin, TX',
  pricing: [
    'Service Call / Diagnostic: $89 (waived if you proceed with repair)',
    'Drain Cleaning: from $149',
    'Water Heater Repair: $150-$400',
    'Leak Detection: $199',
    'Repipe (whole house): $4,000-$10,000+',
    'AC/Heating Repair: $149-$500'
  ].join('; '),
  services: 'Plumbing repairs, drain cleaning, water heater repair, repiping, HVAC repair, maintenance, installations',
  notes: 'All techs are licensed, insured, background-checked. Workmanship warranty on all jobs. 4.9 stars on Google, 200+ reviews, 12 years in business.',
  offer: ''
};

function normalizeBusinessInfo(info = {}) {
  const normalized = { ...DEFAULT_BUSINESS_INFO, ...info };

  const coerce = (value) => {
    if (Array.isArray(value)) return value.join(', ');
    if (value && typeof value === 'object') return JSON.stringify(value);
    return value || '';
  };

  normalized.pricing = coerce(normalized.pricing);
  normalized.services = coerce(normalized.services);
  normalized.hours = coerce(normalized.hours);
  normalized.notes = coerce(normalized.notes);
  normalized.offer = coerce(normalized.offer);
  normalized.address = coerce(normalized.address);
  normalized.serviceArea = coerce(normalized.serviceArea);
  normalized.emergency = coerce(normalized.emergency);

  return normalized;
}

function buildSystemPrompt(info) {
  return `You are the AI assistant for ${info.name}. You are embedded as a chat widget on their website.

Use ONLY the business information below. Never invent services, prices, credentials, response times, service areas, discounts, or policies.

BUSINESS INFO:
- Name: ${info.name}
- Phone: ${info.phone}
- Hours: ${info.hours || 'Not provided'}
- Emergency: ${info.emergency || 'Not provided'}
- Service Area: ${info.serviceArea || 'Not provided'}
- Address: ${info.address || 'Not provided'}
- Offer: ${info.offer || 'Not provided'}
- Pricing: ${info.pricing || 'Pricing not publicly listed'}
- Services: ${info.services || 'Service details not provided'}
- Additional Notes: ${info.notes || 'None provided'}

RULES:
1. Be conversational, warm, and helpful — like a knowledgeable front desk person, not a robot.
2. Keep responses short: 2-4 sentences max unless listing a few services.
3. Answer questions using ONLY the business info above.
4. If pricing is not specific enough to answer exactly, say that pricing depends on the job and invite the visitor to call ${info.phone} or request a callback.
5. For emergencies, emphasize the emergency availability exactly as listed above and suggest calling ${info.phone} right away.
6. If the user wants to schedule, book, or get a callback, respond with __BOOKING__.
7. Never claim an appointment is confirmed. You only qualify the request and guide the visitor to the next step.
8. Sound human and natural. Use contractions. Avoid long paragraphs.
9. If you do not know something from the business info, say so clearly and suggest calling ${info.phone}.`;
}

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
        const info = normalizeBusinessInfo(parsed.businessInfo || {});

        if (!messages.length) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ reply: 'Missing messages.' }));
          return;
        }

        const apiMessages = messages.map((m) => ({
          role: m.role === 'bot' ? 'assistant' : 'user',
          content: m.text
        }));

        const system = buildSystemPrompt(info);
        const fallbackReply = `Sorry, I'm having trouble right now. Give ${info.name} a call at ${info.phone} and they'll help you out.`;

        if (!API_KEY) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'missing_api_key' }));
          return;
        }

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
            system,
            messages: apiMessages,
          }),
        });

        const data = await resp.json();
        const reply = data.content?.[0]?.text || fallbackReply;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply }));
      } catch (e) {
        console.error('API error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: 'Sorry, I hit a snag. Please call the business directly for help.' }));
      }
    });
    return;
  }

  const filePath = path.join(__dirname, req.url === '/' ? 'plumbing-hvac-demo.html' : req.url);
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
