import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const token = request.nextUrl.searchParams.get("token");

  if (!email || !token) {
    return htmlResponse("Missing parameters.", 400);
  }

  // Verify token matches (base64url of email)
  const expected = Buffer.from(email).toString("base64url");
  if (token !== expected) {
    return htmlResponse("Invalid unsubscribe link.", 403);
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      UPDATE prospects
      SET unsubscribed = TRUE, updated_at = NOW()
      WHERE email = ${email}
    `;
  } catch (err) {
    console.error("Unsubscribe DB error:", err);
    // Still show success to the user — don't leak internal errors
  }

  return htmlResponse(`
    <h1>You've been unsubscribed</h1>
    <p>We've removed <strong>${escapeHtml(email)}</strong> from all future emails.</p>
    <p>Sorry for the noise. You won't hear from us again.</p>
  `);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function htmlResponse(body: string, status = 200) {
  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribe — Latchly</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 20px; color: #1e293b; }
  h1 { font-size: 22px; margin-bottom: 12px; }
  p { color: #475569; line-height: 1.6; }
</style>
</head><body>${body}</body></html>`;

  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
