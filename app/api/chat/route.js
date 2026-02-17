import Anthropic from "@anthropic-ai/sdk";
import { detectLeadInfo } from "@/lib/leadDetection";
import { sendLeadNotification } from "@/lib/email";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request) {
  try {
    const { messages, businessInfo } = await request.json();

    if (!messages || !businessInfo) {
      return Response.json({ error: "Missing messages or businessInfo" }, { status: 400 });
    }

    const systemPrompt = `You are a friendly, professional receptionist for ${businessInfo.name}.

Your goal is to answer visitor questions and capture their contact info so the team can follow up.

Business Information:
- Business Name: ${businessInfo.name}
- Phone: ${businessInfo.phone}
- Services & Pricing: ${businessInfo.pricing}
- Hours: ${businessInfo.hours}

Rules:
- Be warm but concise — 1-3 sentences per reply, unless listing services or pricing.
- Answer questions using ONLY the business information above. Never make up services, prices, hours, or details not explicitly listed. If you don't know, say so and offer to connect them with the team at ${businessInfo.phone}.
- After answering a question, naturally guide toward collecting their contact info.
- To capture a lead, you only need: their name, phone number, and what service they need. Do NOT ask for email or preferred date — the team will handle that on the callback.
- Ask for missing fields naturally, one at a time. Never re-ask info already provided.
- Once you have name + phone + service needed, confirm and say: "Great — I've passed your info to the team at ${businessInfo.name}. They'll reach out shortly to get you scheduled!"
- You do NOT book appointments. You capture requests. Never say "You're booked" or confirm a specific time slot.
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
        model: "claude-3-haiku-20240307",
        max_tokens: 200,
        temperature: 0.7,
        system: systemPrompt,
        messages: claudeMessages,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("API call timeout after 15 seconds")), 15000)
      )
    ]);

    const text = response.content[0]?.text || "I'm sorry, I didn't catch that. Could you try again?";

    // Lead detection: check if conversation contains a complete lead
    const detected = detectLeadInfo(messages);
    let leadDetected = false;

    if (detected.isComplete) {
      leadDetected = true;
      // Fire-and-forget: save lead + send notification
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
