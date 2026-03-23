import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";

const BOUNCE_EVENTS = new Set([
  "email.bounced",
  "email.complained",
  "email.delivery_error",
]);

const ENGAGEMENT_EVENTS = new Set([
  "email.opened",
  "email.clicked",
]);

export async function POST(request) {
  // Svix header check — warn but don't block
  const svixId = request.headers.get("svix-id");
  if (!svixId) {
    console.warn("[email-webhook] Missing svix-id header — request may not be from Resend");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    console.error("[email-webhook] Failed to parse request body");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const eventType = body.type;
  console.log(`[email-webhook] Received event: ${eventType}`);

  // Handle engagement events (open/click tracking)
  if (ENGAGEMENT_EVENTS.has(eventType)) {
    const recipientEmail =
      body.data?.to?.[0] || body.data?.email || body.data?.recipient_email || null;
    if (recipientEmail) {
      try {
        const sql = neon(process.env.DATABASE_URL);
        if (eventType === "email.opened") {
          await sql`
            UPDATE prospects
            SET opened_at = COALESCE(opened_at, NOW()),
                open_count = COALESCE(open_count, 0) + 1,
                updated_at = NOW()
            WHERE email = ${recipientEmail}
          `;
        } else {
          await sql`
            UPDATE prospects
            SET clicked_at = COALESCE(clicked_at, NOW()),
                click_count = COALESCE(click_count, 0) + 1,
                updated_at = NOW()
            WHERE email = ${recipientEmail}
          `;
        }
        console.log(`[email-webhook] Tracked ${eventType} for ${recipientEmail}`);
      } catch (err) {
        console.error(`[email-webhook] DB error tracking ${eventType}:`, err);
      }
    }
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (!BOUNCE_EVENTS.has(eventType)) {
    console.log(`[email-webhook] Ignoring event type: ${eventType}`);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Resend webhook payload: data.email_id, data.to (array), etc.
  const recipientEmail =
    body.data?.to?.[0] || body.data?.email || body.data?.recipient_email || null;

  if (!recipientEmail) {
    console.warn(`[email-webhook] No recipient email found in payload for ${eventType}`);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  console.log(`[email-webhook] Processing ${eventType} for ${recipientEmail}`);

  // Map event type to bounce_type label
  const bounceType =
    eventType === "email.bounced"
      ? "hard_bounce"
      : eventType === "email.complained"
        ? "spam_complaint"
        : "delivery_error";

  try {
    const sql = neon(process.env.DATABASE_URL);

    await sql`
      UPDATE prospects
      SET
        unsubscribed = TRUE,
        bounce_type = ${bounceType},
        bounced_at = NOW(),
        updated_at = NOW()
      WHERE email = ${recipientEmail}
    `;

    console.log(`[email-webhook] Marked ${recipientEmail} as unsubscribed (${bounceType})`);
  } catch (err) {
    console.error(`[email-webhook] DB error for ${recipientEmail}:`, err);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
