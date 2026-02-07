import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request) {
  try {
    const { messages, businessInfo } = await request.json();

    if (!messages || !businessInfo) {
      return Response.json({ error: "Missing messages or businessInfo" }, { status: 400 });
    }

    const systemPrompt = `You are a friendly, professional AI receptionist for ${businessInfo.name}.

Your primary goal is to answer visitor questions and book appointments efficiently.

Business Information:
- Business Name: ${businessInfo.name}
- Phone: ${businessInfo.phone}
- Services & Pricing: ${businessInfo.pricing}
- Hours: ${businessInfo.hours}

Conversation Rules:
- Be warm but concise — 1-3 sentences per reply, unless listing services or pricing.
- Answer questions about services, pricing, and hours accurately using the business info above.
- After answering a question, naturally guide toward booking an appointment.
- When booking, collect these required fields ONE AT A TIME:
  1. Service (what they need)
  2. Name
  3. Phone number
  4. Email
  5. Preferred date and time
- Ask ONLY for missing fields. Never re-ask info already provided.
- Never repeat yourself or give the same response twice.
- Once all 5 fields are collected, confirm the booking summary and say the team will follow up.
- If you don't know something, say so honestly and offer to connect them with the team at ${businessInfo.phone}.
- Keep every reply moving the conversation forward.
- Use emojis sparingly (1-2 per message max).
- Never mention that you are an AI, a system, a bot, or describe your own internal steps.
- Format service/pricing lists with bullet points when relevant.
- If the user says something casual like "hi" or "hello", greet them warmly and ask how you can help.`;

    const claudeMessages = messages.map((m) => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.text,
    }));

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const text = response.content[0]?.text || "I'm sorry, I didn't catch that. Could you try again?";

    return Response.json({ text });
  } catch (error) {
    console.error("Anthropic API error:", error);
    return Response.json(
      { error: "Failed to get response. Please try again." },
      { status: 500 }
    );
  }
}
