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
const config = require('./openclaw.config');
const { createLogger } = require('./openclaw-logger');

const log = createLogger('closer');
const { ROOT, DRY_RUN, MAX_MESSAGES, BOOKING_LINK } = config;
const ESCALATE_TO = config.NOTIFY_EMAIL;

// ── Objection playbook ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are replying to prospect emails on behalf of Matt, founder of Latchly AI. Matt sent a custom homepage concept to a local service business owner. They replied. Your job is to write Matt's response.

BOOKING LINK (only include when they ask for a call or show clear interest): ${BOOKING_LINK}

CLASSIFY the reply as one of: "interested", "objection", "question", "not_interested"
Then write a short, plain-text reply (1-2 paragraphs max).

VOICE RULES:
- Write like a sharp, plainspoken founder. Not a sales rep, not an SDR, not an AI.
- Short sentences. No buzzwords. No exclamation points. No fake enthusiasm.
- Sign off as "Matt" only.
- Never say "game changer", "revolutionize", "AI-powered", or any hype language.
- The website/demo is the main value. The AI assistant is a secondary benefit. Do not lead with AI.
- Never fabricate stats, lead counts, or ROI claims.
- Never insult their current website.
- One CTA max per reply. If they seem interested, suggest a call. If they have a question, answer it. Do not stack CTAs.

OBJECTION HANDLING:
- "What's the price?" / "How much?" → Give a straight answer: "The site build is a one-time fee, and the monthly is for hosting and the assistant. Happy to walk through the numbers on a quick call if that's easier." Include booking link.
- "Already have a website" → "The concept I sent is more about the conversion structure and how visitors turn into booked jobs. Worth a look even as a reference point for what a refresh could look like."
- "Not now" / "Bad timing" → "No problem. The concept is yours to reference whenever it makes sense." No booking link. No pressure.
- "Need to think about it" → "Take your time. The demo stays live. If you want a walkthrough later, I'm around."
- "How does it work?" → Answer plainly. The site is built to convert more visitors into calls and booked jobs. It includes an assistant that can handle common questions and capture leads after hours. Keep it brief.
- "Unsubscribe" / "Stop emailing" → "Done. You've been removed. Sorry for the noise."

HARD RULES:
- Never mention "report card", "audit", or "issues we found".
- Never say "just checking in" or "circling back".
- If you don't have enough context to give a good answer, keep it short and offer a call.
- Plain text only. No markdown. No bullet points. No HTML.

Output JSON only:
{
  "intent": "interested|objection|question|not_interested",
  "confidence": 0.0-1.0,
  "response": "Your reply text here",
  "should_escalate": true/false,
  "should_unsubscribe": true/false
}

CONFIDENCE GUIDE:
- 0.9+ = Crystal clear intent (e.g., "yes I want a call" or "stop emailing me")
- 0.7-0.9 = Fairly clear but some ambiguity
- Below 0.7 = Unclear intent, mixed signals, sarcasm, or hard to parse — set should_escalate: true`;

// ── Claude API ───────────────────────────────────────────────────────────────

async function classifyAndRespond(incomingEmail, prospectContext) {
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Determine which outreach step they're replying to
  const stepNum = prospectContext.outreach_step || 0;
  const stepLabels = {
    0: 'Before any outreach was sent',
    1: 'Day 0 — initial email (sent custom homepage concept + demo link)',
    2: 'Day 3 — follow-up (short reminder about the concept)',
    3: 'Day 7 — breakup email (left the door open, no pressure)',
  };
  const lastStepLabel = stepLabels[stepNum] || `Step ${stepNum}`;

  // Try to detect which step from the reply subject line
  const subj = (incomingEmail.subject || '').toLowerCase();
  let triggeredBy = lastStepLabel;
  if (subj.includes('site concept for')) triggeredBy = 'Day 0 — initial email with custom concept';
  else if (subj.includes('re: site concept')) triggeredBy = 'Day 3 — follow-up';
  else if (subj.includes('last note')) triggeredBy = 'Day 7 — breakup email';

  const userMessage = `PROSPECT:
- Business: ${prospectContext.business_name}
- Niche: ${prospectContext.niche || 'home services'}
- City: ${prospectContext.city || 'unknown'}, ${prospectContext.state || ''}
- Demo URL: ${prospectContext.demo_url || 'N/A'}
- Lead type: ${prospectContext.lead_type || 'package'}
- Last completed outreach step: ${lastStepLabel}
- They are replying to: ${triggeredBy}
- Auto-responses so far: ${prospectContext.closer_responses || 0}

THEIR REPLY:
Subject: ${incomingEmail.subject || ''}
Body: ${incomingEmail.body || incomingEmail.text || ''}`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
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
    log.catch('inbox_poll_error', err);
    return [];
  }
}

// ── Send reply via AgentMail ─────────────────────────────────────────────────

async function sendReply(toEmail, subject, body) {
  if (DRY_RUN) {
    log.info('dry_run_reply', { email: toEmail, subject });
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
    log.catch('reply_send_error', err, { email: toEmail });
    return false;
  }
}

// ── Escalation email ─────────────────────────────────────────────────────────

async function escalateToMatthew(prospect, incomingEmail, classification) {
  if (DRY_RUN) {
    log.info('dry_run_escalate', { business: prospect.business_name, intent: classification.intent });
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
<p><strong>Replying to:</strong> Step ${prospect.outreach_step || '?'} (${prospect.outreach_step === 1 ? 'Day 0 initial' : prospect.outreach_step === 2 ? 'Day 3 follow-up' : prospect.outreach_step === 3 ? 'Day 7 final' : 'unknown'})</p>
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
    } catch (err) {
      log.catch('prospect_lookup_failed', err, { email: fromEmail });
    }
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
  log.startRun({ dry_run: DRY_RUN, max_messages: MAX_MESSAGES });

  const messages = await pollInbox();
  log.info('inbox_polled', { count: messages.length });

  let processed = 0;
  let escalated = 0;

  // Track processed message IDs this run to prevent duplicate processing
  const processedMsgIds = new Set();

  for (const msg of messages) {
    if (processed >= MAX_MESSAGES) break;

    const fromEmail = msg.from_email || msg.from?.email || msg.from || '';
    if (!fromEmail) continue;

    // Dedup: skip if we've already processed this message ID
    const msgId = msg.id || msg.message_id || `${fromEmail}-${msg.created_at || msg.date}`;
    if (processedMsgIds.has(msgId)) continue;
    processedMsgIds.add(msgId);

    // Skip system/notification emails
    if (fromEmail.includes('noreply') || fromEmail.includes('mailer-daemon')) continue;

    // Find matching prospect
    const prospect = await findProspect(fromEmail);
    if (!prospect) {
      log.info('no_prospect_match', { email: fromEmail });
      continue;
    }

    // Check if this message was already processed (DB-level idempotency)
    if (prospect.last_closer_msg_id === msgId) {
      log.info('already_processed', { business: prospect.business_name, msg_id: msgId });
      continue;
    }

    // Check auto-response cap
    if ((prospect.closer_responses || 0) >= 2 && !prospect.escalated) {
      log.lead('cap_reached_escalating', prospect);
      await escalateToMatthew(prospect, msg, { intent: 'question', response: 'Escalated after 2 auto-responses' });
      escalated++;
      continue;
    }

    log.lead('processing', prospect, { msg_id: msgId });

    // Classify + generate response
    const classification = await classifyAndRespond(msg, prospect);
    const confidence = classification.confidence || 0;
    log.lead('classified', prospect, { intent: classification.intent, confidence, should_escalate: classification.should_escalate });

    // Low confidence → escalate immediately, don't auto-respond
    if (confidence < 0.7 && !classification.should_unsubscribe) {
      log.lead('low_confidence_escalate', prospect, { confidence, intent: classification.intent });
      await escalateToMatthew(prospect, msg, { ...classification, response: `[LOW CONFIDENCE ${confidence}] AI draft: ${classification.response}` });
      escalated++;
      if (!DRY_RUN && process.env.DATABASE_URL) {
        try {
          const { neon } = require('@neondatabase/serverless');
          const sql = neon(process.env.DATABASE_URL);
          await sql`UPDATE prospects SET escalated = TRUE, last_closer_msg_id = ${msgId}, updated_at = NOW() WHERE email = ${fromEmail}`;
        } catch {}
      }
      processed++;
      continue;
    }

    // Handle unsubscribe
    if (classification.should_unsubscribe) {
      if (!DRY_RUN && process.env.DATABASE_URL) {
        const { neon } = require('@neondatabase/serverless');
        const sql = neon(process.env.DATABASE_URL);
        await sql`UPDATE prospects SET
          unsubscribed = TRUE,
          last_closer_msg_id = ${msgId},
          updated_at = NOW()
        WHERE email = ${fromEmail}`;
      }
      await sendReply(fromEmail, msg.subject || 'Re: Latchly', classification.response);
      log.lead('unsubscribed', prospect);
      processed++;
      continue;
    }

    // Send auto-response
    if (classification.response) {
      await sendReply(fromEmail, msg.subject || 'Re: Latchly', classification.response);
      processed++;
    }

    // Update closer_responses + escalation in single DB call
    if (!DRY_RUN && process.env.DATABASE_URL) {
      try {
        const shouldEscalate = classification.should_escalate || classification.intent === 'interested';
        const { neon } = require('@neondatabase/serverless');
        const sql = neon(process.env.DATABASE_URL);
        await sql`UPDATE prospects SET
          closer_responses = COALESCE(closer_responses, 0) + 1,
          escalated = CASE WHEN ${shouldEscalate} THEN TRUE ELSE escalated END,
          last_closer_msg_id = ${msgId},
          updated_at = NOW()
        WHERE email = ${fromEmail}`;
      } catch (err) {
        log.catch('db_update_failed', err, { email: fromEmail });
      }
    }

    // Escalate if needed
    if (classification.should_escalate || classification.intent === 'interested') {
      await escalateToMatthew(prospect, msg, classification);
      escalated++;
    }
  }

  log.endRun({ processed, escalated });
  return { processed, escalated };
}

module.exports = { main, classifyAndRespond };

if (require.main === module) {
  main().catch(err => { log.catch('fatal', err); process.exit(1); });
}
