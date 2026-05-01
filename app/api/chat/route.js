import Anthropic from "@anthropic-ai/sdk";
import { detectLeadInfo } from "@/lib/leadDetection";
import { sendLeadNotification } from "@/lib/email";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Conversation + payload caps — defends against runaway costs from a public demo
// URL where anyone can drain the Anthropic budget.
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 2000;

// Per-IP sliding-window rate limit. In-memory: per-Lambda-instance only, resets
// on cold start. Best-effort defense against casual abuse; for production-grade
// limits use Upstash Redis or a Postgres-backed sliding window.
const RATE_LIMIT = 30; // requests
const RATE_WINDOW_MS = 60_000; // per minute
const rateLimitMap = new Map();

function getClientIp(request) {
  const fwd = request.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Periodic cleanup so the map doesn't grow unbounded across long-lived Lambdas.
function cleanupRateLimit() {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) rateLimitMap.delete(ip);
  }
}

export async function POST(request) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
      return Response.json(
        { error: "Too many requests. Please slow down and try again in a minute." },
        { status: 429 }
      );
    }
    if (rateLimitMap.size > 1000) cleanupRateLimit();

    const { messages, businessInfo } = await request.json();

    if (!messages || !businessInfo) {
      return Response.json({ error: "Missing messages or businessInfo" }, { status: 400 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages must be a non-empty array" }, { status: 400 });
    }
    if (messages.length > MAX_MESSAGES) {
      return Response.json(
        { error: "Conversation too long. Please refresh to start a new chat." },
        { status: 400 }
      );
    }
    for (const msg of messages) {
      if (typeof msg?.text !== "string" || msg.text.length > MAX_MESSAGE_LENGTH) {
        return Response.json({ error: "Message too long." }, { status: 400 });
      }
    }

    const isSalon = (businessInfo.industry || "").toLowerCase() === "salon";

    const optionalLine = (label, value) => (value ? `\n- ${label}: ${value}` : "");
    const optionalSection = (label, value) =>
      value ? `\n${label}:\n${value}\n` : "";

    const systemPrompt = `You are a friendly, professional AI sales agent for ${businessInfo.name}.

Your goal is to qualify visitors, answer their questions, capture their contact info, and ${isSalon ? "hand them off to the live booking calendar" : "guide them toward booking or a callback"}.

Business Information:
- Business Name: ${businessInfo.name}${optionalLine("Phone", businessInfo.phone)}${optionalLine("Address", businessInfo.address)}
- Services & Pricing: ${businessInfo.services || businessInfo.pricing || "(not provided)"}
- Hours: ${businessInfo.hours || "(not provided)"}${optionalSection("Staff", businessInfo.staff)}${optionalSection("Policies", businessInfo.policies)}${optionalSection("FAQ", businessInfo.faq)}

Rules:
- Be warm but concise, 1-3 sentences per reply, unless listing services or pricing.
- Answer questions using ONLY the business information above. Never make up services, prices, hours, staff, or details not explicitly listed. If you don't know, say so${businessInfo.phone ? ` and offer to connect them with the team at ${businessInfo.phone}` : ""}.
- After answering a question, naturally guide toward ${isSalon ? "booking an appointment" : "collecting their contact info"}.
${isSalon
        ? `- When the user wants to book, ask for their name, phone, and service in turn (one at a time, in that order). Never re-ask info already provided — if they mentioned a service in their first message, treat it as already captured and don't ask again.
- Once you have name + phone + service, reply EXACTLY with: "Perfect — opening the booking calendar for you now…" (this exact phrase triggers the booking calendar to open). Do not list any times. The calendar widget handles the time selection.
- After the calendar opens, do not keep prompting — if the user replies, briefly acknowledge and let them pick a time on the calendar.
- The booking calendar is connected to the live owner's Google Calendar — bookings go straight through.`
        : `- To capture a lead, you only need: their name, phone number, and what service they need. Do NOT ask for email or preferred date.
- Ask for missing fields naturally, one at a time. Never re-ask info already provided.
- Once you have name + phone + service needed, confirm and say: "I've passed your info to the team at ${businessInfo.name}. They'll reach out shortly to get you scheduled!"
- You do NOT book appointments directly. You qualify and capture requests. Never say "You're booked" or confirm a specific time slot.`}
- If someone needs immediate help outside business hours, prioritize getting their name and phone number. Say the team will call back first thing.
- Never repeat yourself or give the same response twice.
- Keep every reply moving the conversation forward.
- Use emojis sparingly (max 1 per message).
- Never mention that you are an AI, bot, or automated system.
- If the user says "hi" or "hello", greet them warmly and ask how you can help.`;

    const claudeMessages = messages.map((m) => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.text,
    }));

    const response = await Promise.race([
      anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 600,
        temperature: 0.7,
        system: systemPrompt,
        messages: claudeMessages,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("API call timeout after 15 seconds")), 15000)
      ),
    ]);

    const text = response.content[0]?.text || "I'm sorry, I didn't catch that. Could you try again?";

    // Lead detection — fire notification ONLY on the turn that completes the lead.
    // Comparing current detection to the previous turn's detection prevents the
    // same lead from re-emailing the operator on every subsequent message.
    const detected = detectLeadInfo(messages);
    const detectedPrev =
      messages.length > 1 ? detectLeadInfo(messages.slice(0, -1)) : { isComplete: false };
    const justBecameComplete = detected.isComplete && !detectedPrev.isComplete;
    const leadDetected = detected.isComplete;

    // For salon demos, /api/demo-booking-handoff is the canonical notification
    // (richer transcript, fires the moment Calendly opens). Suppress the auto-
    // detect notification here to avoid 2-N emails per booking.
    if (justBecameComplete && !isSalon) {
      const transcript = messages
        .map((m) => `${m.role === "user" ? "Customer" : "Bot"}: ${m.text}`)
        .join("\n");

      sendLeadNotification({
        name: detected.name,
        phone: detected.phone,
        email: detected.email,
        transcript,
      }).catch((err) => console.error("Auto lead notification failed:", err));
    }

    return Response.json({ text, leadDetected });
  } catch (error) {
    console.error("Anthropic API error:", error);
    return Response.json(
      { error: "Failed to get response. Please try again." },
      { status: 500 }
    );
  }
}
