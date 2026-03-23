import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function POST(req: Request) {
  try {
    const { email, businessName } = await req.json();

    if (!email || !businessName) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (process.env.DATABASE_URL) {
      const sql = neon(process.env.DATABASE_URL);
      await sql`
        INSERT INTO contacts (name, email, business, message, created_at)
        VALUES (${businessName}, ${email}, ${businessName}, ${"Free website audit request"}, NOW())
        ON CONFLICT DO NOTHING
      `;
    }

    // Send notification email if Resend is configured
    if (process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Latchly <notifications@latchlyai.com>",
          to: process.env.NOTIFY_EMAIL,
          subject: `New audit request: ${businessName}`,
          text: `New website audit request:\n\nBusiness: ${businessName}\nEmail: ${email}\n\nFollow up with a personalized audit.`,
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lead capture error:", error);
    return NextResponse.json({ success: true }); // don't expose errors to frontend
  }
}
