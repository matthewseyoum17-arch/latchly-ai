import { neon } from '@neondatabase/serverless';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const token = searchParams.get('token');

  if (!email) {
    return new Response('Missing email parameter', { status: 400 });
  }

  // Simple token validation: base64 of email must match
  const expectedToken = Buffer.from(email).toString('base64url');
  if (token !== expectedToken) {
    return new Response('Invalid unsubscribe link', { status: 403 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`UPDATE prospects SET unsubscribed = TRUE, updated_at = NOW() WHERE email = ${email}`;
    // Also flip Latchly leads. Any queued row matching this email becomes
    // unsubscribed so the drain cron + send-now never picks it up again.
    await sql`
      UPDATE latchly_leads SET
        outreach_status = 'unsubscribed',
        outreach_error = NULL,
        updated_at = NOW()
      WHERE LOWER(email) = LOWER(${email})
    `;

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#1e293b;}
.card{text-align:center;padding:48px;border-radius:16px;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.06);max-width:400px;}
h1{font-size:24px;margin:0 0 8px;}p{color:#64748b;font-size:15px;line-height:1.6;}</style>
</head><body><div class="card"><h1>You've been unsubscribed</h1><p>You won't receive any more emails from us. If this was a mistake, simply reply to any of our previous emails to re-subscribe.</p></div></body></html>`;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    return new Response('Something went wrong. Please try again.', { status: 500 });
  }
}
