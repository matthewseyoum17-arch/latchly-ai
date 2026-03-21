#!/usr/bin/env node
/**
 * openclaw-closer.js  (Agent 5 — Closer)
 *
 * Polls AgentMail inbox for replies, classifies intent with Claude Haiku,
 * auto-responds with contextual replies, and escalates warm leads to Matthew.
 *
 * Runs every 30 min via cron.
 * Cap: 200 messages/day to control costs.
 *
 * Usage:
 *   node scripts/openclaw-closer.js
 *   DRY_RUN=true node scripts/openclaw-closer.js
 *   MAX_MESSAGES=50 node scripts/openclaw-closer.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Load .env
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

const DRY_RUN      = process.env.DRY_RUN === 'true';
const MAX_MESSAGES = parseInt(process.env.MAX_MESSAGES || '200', 10);
const ESCALATE_TO  = process.env.NOTIFY_EMAIL || 'matt@latchlyai.com';
const SITE_BASE    = process.env.SITE_BASE || 'https://latchlyai.com';
const BOOKING_LINK = process.env.BOOKING_LINK || 'https://calendly.com/latchlyai/demo';

// ── Objection playbook ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Matthew's AI sales assistant for Latchly AI. You're following up on a personalized demo website and AI chatbot that was built for a home service business.

BOOKING LINK (include this when suggesting a call): ${BOOKING_LINK}

Your job is to:
1. Classify the reply intent: "interested", "objection", "question", "not_interested"
2. Generate a natural, warm response (1-3 short paragraphs max)

Context about the prospect will be provided. Use their specific audit data in your response.

OBJECTION PLAYBOOK:
- "Too expensive" / "What's the price?" → "Totally fair question. Most of our clients see 5-15 extra leads per month from the AI chat alone — the site + chatbot usually pays for itself in the first week. Want me to walk you through the pricing on a quick call? [BOOKING_LINK]"
- "Already have a website" → "I noticed your current site has [specific issues from audit]. This doesn't replace what you have — it adds an AI assistant that captures leads 24/7. Want to see how it works? [BOOKING_LINK]"
- "Not now" / "Bad timing" → "Totally understand! Your demo stays live at [URL]. When the time is right, grab 10 minutes here and I'll walk you through it: [BOOKING_LINK]"
- "Need to think about it" → "Of course! Would a quick 10-minute walkthrough help? Sometimes seeing it live makes the decision easier: [BOOKING_LINK]"
- "How does it work?" → Brief explanation: "The AI chatbot sits on your website 24/7, answers customer questions using your business info, and captures their name + phone. You get notified instantly. Want to see it in action? [BOOKING_LINK]"
- "Unsubscribe" / "Stop emailing" → "Done! You've been removed. Apologies for the inconvenience."

RULES:
- Never be pushy or salesy. Be helpful and genuine.
- Keep responses short and conversational.
- Sign off as "Matthew" (not "AI" or "assistant").
- If the intent is clearly "interested", suggest a call/walkthrough.
- If they ask to unsubscribe, respect it immediately.

Output format (JSON):
{
  "intent": "interested|objection|question|not_interested",
  "response": "Your reply text here",
  "should_escalate": true/false,
  "should_unsubscribe": true/false
}`;

// ── Claude API ───────────────────────────────────────────────────────────────

async function classifyAndRespond(incomingEmail, prospectContext) {
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userMessage = `PROSPECT CONTEXT:
- Business: ${prospectContext.business_name}
- Niche: ${prospectContext.niche || 'home services'}
- City: ${prospectContext.city || 'unknown'}, ${prospectContext.state || ''}
- Demo URL: ${prospectContext.demo_url || 'N/A'}
- Chatbot Score: ${prospectContext.chatbot_score || '?'}/10
- Redesign Score: ${prospectContext.redesign_score || '?'}/10
- Site Issues: ${(prospectContext.report_card?.issues || []).map(i => i.label).join(', ') || 'none detected'}
- Previous outreach step: ${prospectContext.outreach_step || 0}
- Auto-responses so far: ${prospectContext.closer_responses || 0}

THEIR REPLY:
Subject: ${incomingEmail.subject || ''}
Body: ${incomingEmail.body || incomingEmail.text || ''}`;

  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 500,
    temperature: 0.3,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0]?.text || '';

  // Parse JSON response
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}

  // Fallback
  return {
    intent: 'question',
    response: text,
    should_escalate: true,
    should_unsubscribe: false,
  };
}

// ── AgentMail inbox polling ──────────────────────────────────────────────────

async function pollInbox() {
  const AgentMail = require('agentmail');
  const client = new AgentMail({ apiKey: process.env.AGENTMAIL_API_KEY });

  const inboxId = process.env.AGENTMAIL_INBOX_ID;
  if (!inboxId) {
    console.error('AGENTMAIL_INBOX_ID not set');
    return [];
  }

  try {
    const response = await client.inboxes.messages.list(inboxId);
    // Filter for unread/recent messages
    return (response.messages || response.data || []).filter(m => {
      const age = Date.now() - new Date(m.created_at || m.date).getTime();
      return age < 24 * 60 * 60 * 1000; // Last 24 hours
    });
  } catch (err) {
    console.error(`Inbox poll error: ${err.message}`);
    return [];
  }
}

// ── Send reply via AgentMail ─────────────────────────────────────────────────

async function sendReply(toEmail, subject, body) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would reply to ${toEmail}: "${subject}"`);
    return true;
  }

  const AgentMail = require('agentmail');
  const client = new AgentMail({ apiKey: process.env.AGENTMAIL_API_KEY });

  try {
    await client.inboxes.messages.send(process.env.AGENTMAIL_INBOX_ID, {
      to: toEmail,
      subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
      body,
    });
    return true;
  } catch (err) {
    console.error(`  Reply send error: ${err.message}`);
    return false;
  }
}

// ── Escalation email ─────────────────────────────────────────────────────────

async function escalateToMatthew(prospect, incomingEmail, classification) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would escalate ${prospect.business_name} to Matthew`);
    return;
  }

  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: 'Latchly Closer <notifications@latchlyai.com>',
    to: ESCALATE_TO,
    subject: `🔥 Warm lead: ${prospect.business_name} (${classification.intent})`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:580px;margin:0 auto;">
<div style="background:#0f172a;color:#fff;padding:20px;border-radius:12px 12px 0 0;">
<h2 style="margin:0;font-size:18px;">Warm Lead Alert</h2>
</div>
<div style="padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
<p><strong>Business:</strong> ${prospect.business_name}</p>
<p><strong>Email:</strong> ${prospect.email}</p>
<p><strong>Phone:</strong> ${prospect.phone || 'N/A'}</p>
<p><strong>Intent:</strong> ${classification.intent}</p>
<p><strong>Demo:</strong> <a href="${prospect.demo_url}">${prospect.demo_url}</a></p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
<p><strong>Their reply:</strong></p>
<blockquote style="margin:8px 0;padding:12px;background:#f8fafc;border-left:3px solid #1B5FA8;border-radius:4px;">${(incomingEmail.body || incomingEmail.text || '').replace(/\n/g, '<br>')}</blockquote>
<p><strong>AI suggested response:</strong></p>
<blockquote style="margin:8px 0;padding:12px;background:#f0fdf4;border-left:3px solid #10b981;border-radius:4px;">${classification.response.replace(/\n/g, '<br>')}</blockquote>
</div></div>`,
  });
}

// ── Match reply to prospect ──────────────────────────────────────────────────

async function findProspect(fromEmail) {
  // Try DB first
  if (process.env.DATABASE_URL) {
    try {
      const { neon } = require('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);
      const [row] = await sql`SELECT * FROM prospects WHERE email = ${fromEmail} LIMIT 1`;
      if (row) return row;
    } catch {}
  }

  // Fall back to file
  const auditedPath = path.join(ROOT, 'leads', 'openclaw', 'audited.json');
  if (fs.existsSync(auditedPath)) {
    const leads = JSON.parse(fs.readFileSync(auditedPath, 'utf8'));
    return leads.find(l => l.email && l.email.toLowerCase() === fromEmail.toLowerCase());
  }

  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('OpenClaw Closer starting...');

  const messages = await pollInbox();
  console.log(`Found ${messages.length} recent messages`);

  let processed = 0;
  let escalated = 0;

  for (const msg of messages) {
    if (processed >= MAX_MESSAGES) break;

    const fromEmail = msg.from_email || msg.from?.email || msg.from || '';
    if (!fromEmail) continue;

    // Skip system/notification emails
    if (fromEmail.includes('noreply') || fromEmail.includes('mailer-daemon')) continue;

    // Find matching prospect
    const prospect = await findProspect(fromEmail);
    if (!prospect) {
      console.log(`  No prospect match for ${fromEmail}, skipping`);
      continue;
    }

    // Check auto-response cap
    if ((prospect.closer_responses || 0) >= 2 && !prospect.escalated) {
      console.log(`  ${prospect.business_name}: auto-response cap reached, escalating`);
      await escalateToMatthew(prospect, msg, { intent: 'question', response: 'Escalated after 2 auto-responses' });
      escalated++;
      continue;
    }

    console.log(`  Processing reply from ${prospect.business_name}...`);

    // Classify + generate response
    const classification = await classifyAndRespond(msg, prospect);
    console.log(`    Intent: ${classification.intent}`);

    // Handle unsubscribe
    if (classification.should_unsubscribe) {
      if (!DRY_RUN && process.env.DATABASE_URL) {
        const { neon } = require('@neondatabase/serverless');
        const sql = neon(process.env.DATABASE_URL);
        await sql`UPDATE prospects SET unsubscribed = TRUE, updated_at = NOW() WHERE email = ${fromEmail}`;
      }
      await sendReply(fromEmail, msg.subject || 'Re: Latchly', classification.response);
      console.log(`    Unsubscribed ${fromEmail}`);
      processed++;
      continue;
    }

    // Send auto-response
    if (classification.response) {
      await sendReply(fromEmail, msg.subject || 'Re: Latchly', classification.response);
      processed++;
    }

    // Update closer_responses count
    if (!DRY_RUN && process.env.DATABASE_URL) {
      try {
        const { neon } = require('@neondatabase/serverless');
        const sql = neon(process.env.DATABASE_URL);
        await sql`UPDATE prospects SET
          closer_responses = COALESCE(closer_responses, 0) + 1,
          updated_at = NOW()
        WHERE email = ${fromEmail}`;
      } catch {}
    }

    // Escalate if needed
    if (classification.should_escalate || classification.intent === 'interested') {
      await escalateToMatthew(prospect, msg, classification);
      escalated++;

      if (!DRY_RUN && process.env.DATABASE_URL) {
        try {
          const { neon } = require('@neondatabase/serverless');
          const sql = neon(process.env.DATABASE_URL);
          await sql`UPDATE prospects SET escalated = TRUE, updated_at = NOW() WHERE email = ${fromEmail}`;
        } catch {}
      }
    }
  }

  console.log(`\nCloser complete: ${processed} messages processed, ${escalated} escalated`);
  return { processed, escalated };
}

module.exports = { main, classifyAndRespond };

if (require.main === module) {
  main().catch(err => { console.error('Closer failed:', err); process.exit(1); });
}
