import { sendLeadNotification } from "@/lib/email";

// POST /api/demo-booking-handoff
//
// Fires when the chatbot has captured { name, phone, service } and is about
// to launch the Calendly booking popup. Sends a rich notification email to
// the operator (NOTIFY_EMAIL) immediately — does not depend on the Calendly
// webhook firing later. This is what gives the live pitch its "ding-the-second-
// they-click-Book" moment in front of the prospect.
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name = "",
      phone = "",
      service = "",
      transcript = "",
      slug = "",
      businessName = "",
    } = body || {};

    const headerLine = businessName
      ? `🚨 BOOKING IN PROGRESS — ${businessName}${slug ? ` (${slug})` : ""}`
      : "🚨 BOOKING IN PROGRESS";

    const richTranscript = [
      headerLine,
      "",
      `Service requested: ${service || "(not specified)"}`,
      `Name: ${name || "(not provided)"}`,
      `Phone: ${phone || "(not provided)"}`,
      "",
      "--- Chat transcript ---",
      transcript || "(no transcript provided)",
    ].join("\n");

    await sendLeadNotification({
      name,
      phone,
      industry: "salon",
      transcript: richTranscript,
    }).catch((err) => {
      console.error("Demo booking handoff notification failed:", err);
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Demo booking handoff error:", error);
    return Response.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
