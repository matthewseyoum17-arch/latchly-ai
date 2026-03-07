import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { sendLeadNotification } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = body.event;
    const payload = body.payload;

    // Only handle invitee.created events
    if (event !== "invitee.created") {
      return NextResponse.json({ received: true, skipped: true });
    }

    const invitee = payload?.invitee || {};
    const scheduledEvent = payload?.event || {};
    const questionsAndAnswers = payload?.questions_and_answers || [];

    const name = invitee.name || "";
    const email = invitee.email || "";
    const scheduledTime = scheduledEvent.start_time || "";
    const eventName = scheduledEvent.name || "";

    // Extract phone and service from custom questions if available
    let phone = "";
    let service = "";
    for (const qa of questionsAndAnswers) {
      const question = (qa.question || "").toLowerCase();
      const answer = qa.answer || "";
      if (question.includes("phone")) phone = answer;
      if (question.includes("service") || question.includes("need")) service = answer;
    }

    const sql = neon(process.env.DATABASE_URL!);

    // Try to find existing lead by email and update with booking info
    const existing = await sql`
      SELECT id FROM leads WHERE email = ${email} ORDER BY created_at DESC LIMIT 1
    `;

    if (existing.length > 0) {
      // Update existing lead with booking status
      await sql`
        UPDATE leads 
        SET contact_method = 'booked',
            transcript = COALESCE(transcript, '') || ${`\n[BOOKED: ${eventName} at ${scheduledTime}]`}
        WHERE id = ${existing[0].id}
      `;
    } else {
      // Create new lead record for this booking
      await sql`
        INSERT INTO leads (name, phone, email, contact_method, industry, transcript)
        VALUES (
          ${name || null},
          ${phone || null},
          ${email || null},
          'booked',
          ${null},
          ${`[BOOKED via Calendly: ${eventName} at ${scheduledTime}]${service ? `\nService: ${service}` : ""}`}
        )
      `;
    }

    // Send notification email with booking details
    const formattedTime = scheduledTime
      ? new Date(scheduledTime).toLocaleString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        })
      : "Time not available";

    await sendLeadNotification({
      name,
      phone,
      email,
      transcript: `APPOINTMENT BOOKED\nEvent: ${eventName}\nTime: ${formattedTime}${service ? `\nService: ${service}` : ""}\n\nBooked via Calendly webhook.`,
    }).catch((err) => console.error("Booking notification failed:", err));

    return NextResponse.json({ received: true, updated: existing.length > 0 });
  } catch (error: any) {
    console.error("Calendly webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
