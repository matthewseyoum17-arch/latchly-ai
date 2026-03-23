import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const BOOKING_LINK =
  process.env.BOOKING_LINK || "https://calendly.com/latchlyai/demo";

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
- One CTA max per reply.

OBJECTION HANDLING:
- "What's the price?" → "The site build is a one-time fee, and the monthly is for hosting and the assistant. Happy to walk through the numbers on a quick call if that's easier." Include booking link.
- "Already have a website" → "The concept I sent is more about the conversion structure and how visitors turn into booked jobs. Worth a look even as a reference point."
- "Not now" / "Bad timing" → "No problem. The concept is yours to reference whenever it makes sense." No booking link.
- "Unsubscribe" / "Stop emailing" → "Done. You've been removed. Sorry for the noise."

HARD RULES:
- Never mention "report card", "audit", or "issues we found".
- Plain text only. No markdown. No bullet points. No HTML.

Output JSON only:
{
  "intent": "interested|objection|question|not_interested",
  "response": "Your reply text here",
  "should_escalate": true/false,
  "should_unsubscribe": true/false
}`;

interface InboxMessage {
  id?: string;
  message_id?: string;
  from_email?: string;
  from?: { email?: string } | string;
  subject?: string;
  body?: string;
  text?: string;
  created_at?: string;
  date?: string;
}

interface Prospect {
  id: number;
  business_name: string;
  email: string;
  phone: string | null;
  niche: string | null;
  city: string | null;
  state: string | null;
  demo_url: string | null;
  lead_type: string | null;
  outreach_step: number;
  closer_responses: number;
  escalated: boolean;
  last_closer_msg_id: string | null;
}

async function classifyAndRespond(
  msg: InboxMessage,
  prospect: Prospect
): Promise<{
  intent: string;
  response: string;
  should_escalate: boolean;
  should_unsubscribe: boolean;
}> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const stepLabels: Record<number, string> = {
    0: "Before any outreach",
    1: "Day 0 — initial email with custom concept",
    2: "Day 3 — follow-up",
    3: "Day 7 — breakup email",
  };

  const userMessage = `PROSPECT:
- Business: ${prospect.business_name}
- Niche: ${prospect.niche || "home services"}
- City: ${prospect.city || "unknown"}, ${prospect.state || ""}
- Demo URL: ${prospect.demo_url || "N/A"}
- Last step: ${stepLabels[prospect.outreach_step] || `Step ${prospect.outreach_step}`}
- Auto-responses so far: ${prospect.closer_responses || 0}

THEIR REPLY:
Subject: ${msg.subject || ""}
Body: ${msg.body || msg.text || ""}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    temperature: 0.3,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}

  return {
    intent: "question",
    response: text,
    should_escalate: true,
    should_unsubscribe: false,
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "YOUR_ANTHROPIC_KEY_HERE") {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const maxMessages = parseInt(process.env.MAX_MESSAGES || "200", 10);

  // Poll AgentMail for messages
  let messages: InboxMessage[] = [];
  try {
    const { AgentMailClient } = await import("agentmail");
    const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY! });
    const inboxId = process.env.AGENTMAIL_INBOX_ID!;
    const response = await client.inboxes.messages.list(inboxId);
    const allMsgs = (response as any).messages || (response as any).data || [];
    // Only last 24 hours
    messages = allMsgs.filter((m: InboxMessage) => {
      const age = Date.now() - new Date(m.created_at || m.date || "").getTime();
      return age < 24 * 60 * 60 * 1000;
    });
  } catch (err: any) {
    return NextResponse.json({ error: `Inbox poll failed: ${err.message}` }, { status: 500 });
  }

  if (messages.length === 0) {
    return NextResponse.json({ success: true, processed: 0, reason: "No new messages" });
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const notifyEmail = process.env.NOTIFY_EMAIL || "matt@latchlyai.com";
  let processed = 0;
  let escalated = 0;

  for (const msg of messages) {
    if (processed >= maxMessages) break;

    const fromEmail =
      (msg as any).from_email ||
      (typeof msg.from === "object" ? msg.from?.email : msg.from) ||
      "";
    if (!fromEmail || fromEmail.includes("noreply") || fromEmail.includes("mailer-daemon"))
      continue;

    const msgId = msg.id || msg.message_id || `${fromEmail}-${msg.created_at || msg.date}`;

    // Find matching prospect in DB
    const rows = await sql`SELECT * FROM prospects WHERE email = ${fromEmail} LIMIT 1`;
    const prospect = rows[0] as Prospect | undefined;
    if (!prospect) continue;
    if (prospect.last_closer_msg_id === msgId) continue; // Already processed

    // Auto-response cap — escalate after 2
    if ((prospect.closer_responses || 0) >= 2 && !prospect.escalated) {
      await resend.emails.send({
        from: "Latchly Closer <notifications@latchlyai.com>",
        to: notifyEmail,
        subject: `Warm lead: ${prospect.business_name} (cap reached)`,
        text: `${prospect.business_name} has sent ${prospect.closer_responses + 1} replies. Auto-response cap reached.\n\nTheir latest:\n${msg.body || msg.text || "(no body)"}\n\nPhone: ${prospect.phone || "N/A"}\nDemo: ${prospect.demo_url || "N/A"}`,
      });
      await sql`UPDATE prospects SET escalated = TRUE, last_closer_msg_id = ${msgId}, updated_at = NOW() WHERE id = ${prospect.id}`;
      escalated++;
      processed++;
      continue;
    }

    // Classify and respond
    const classification = await classifyAndRespond(msg, prospect);

    // Handle unsubscribe
    if (classification.should_unsubscribe) {
      await sql`UPDATE prospects SET unsubscribed = TRUE, last_closer_msg_id = ${msgId}, updated_at = NOW() WHERE email = ${fromEmail}`;
      // Reply confirming removal
      try {
        const { AgentMailClient } = await import("agentmail");
        const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY! });
        await client.inboxes.messages.send(process.env.AGENTMAIL_INBOX_ID!, {
          to: fromEmail,
          subject: msg.subject?.startsWith("Re:") ? msg.subject : `Re: ${msg.subject || "Latchly"}`,
          text: classification.response,
        });
      } catch {}
      processed++;
      continue;
    }

    // Send auto-reply via AgentMail
    if (classification.response) {
      try {
        const { AgentMailClient } = await import("agentmail");
        const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY! });
        await client.inboxes.messages.send(process.env.AGENTMAIL_INBOX_ID!, {
          to: fromEmail,
          subject: msg.subject?.startsWith("Re:") ? msg.subject : `Re: ${msg.subject || "Latchly"}`,
          text: classification.response,
        });
      } catch {}
      processed++;
    }

    // Update DB
    const shouldEscalate =
      classification.should_escalate || classification.intent === "interested";
    await sql`UPDATE prospects SET
      closer_responses = COALESCE(closer_responses, 0) + 1,
      escalated = CASE WHEN ${shouldEscalate} THEN TRUE ELSE escalated END,
      replied_at = COALESCE(replied_at, NOW()),
      last_closer_msg_id = ${msgId},
      updated_at = NOW()
    WHERE id = ${prospect.id}`;

    // Escalate warm leads to Matt
    if (shouldEscalate) {
      try {
        await resend.emails.send({
          from: "Latchly Closer <notifications@latchlyai.com>",
          to: notifyEmail,
          subject: `Warm lead: ${prospect.business_name} (${classification.intent})`,
          html: `<div style="font-family:system-ui,sans-serif;max-width:580px;margin:0 auto;">
<div style="background:#0f172a;color:#fff;padding:20px;border-radius:12px 12px 0 0;">
<h2 style="margin:0;font-size:18px;">Warm Lead Alert</h2>
</div>
<div style="padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
<p><strong>Business:</strong> ${prospect.business_name}</p>
<p><strong>Email:</strong> ${prospect.email}</p>
<p><strong>Phone:</strong> ${prospect.phone || "N/A"}</p>
<p><strong>Intent:</strong> ${classification.intent}</p>
<p><strong>Demo:</strong> <a href="${prospect.demo_url}">${prospect.demo_url}</a></p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
<p><strong>Their reply:</strong></p>
<blockquote style="margin:8px 0;padding:12px;background:#f8fafc;border-left:3px solid #1B5FA8;border-radius:4px;">${(msg.body || msg.text || "").replace(/\n/g, "<br>")}</blockquote>
<p><strong>AI response sent:</strong></p>
<blockquote style="margin:8px 0;padding:12px;background:#f0fdf4;border-left:3px solid #10b981;border-radius:4px;">${classification.response.replace(/\n/g, "<br>")}</blockquote>
</div></div>`,
        });
      } catch {}
      escalated++;
    }
  }

  // Log run
  try {
    await sql`INSERT INTO pipeline_runs (agent, metadata)
      VALUES ('closer-cron', ${JSON.stringify({ processed, escalated, inbox_messages: messages.length })}::jsonb)`;
  } catch {}

  return NextResponse.json({ success: true, processed, escalated });
}
