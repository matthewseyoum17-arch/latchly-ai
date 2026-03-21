/**
 * Demo Lead Capture API
 *
 * When a prospect's demo chat widget captures a visitor's contact info,
 * this endpoint records it and immediately notifies Matthew.
 *
 * POST /api/demo-lead
 * Body: { slug, name, phone, email?, rating? }
 */
import { neon } from '@neondatabase/serverless';

export async function POST(request) {
  try {
    const body = await request.json();
    const { slug, name, phone, email, rating } = body;

    if (!slug || !name || !phone) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Store the captured lead
    if (process.env.DATABASE_URL) {
      const sql = neon(process.env.DATABASE_URL);
      await sql`
        INSERT INTO demo_leads (demo_slug, visitor_name, visitor_phone, visitor_email, rating)
        VALUES (${slug}, ${name}, ${phone}, ${email || null}, ${rating || null})
      `;
    }

    // Look up the prospect to get business context
    let prospect = null;
    if (process.env.DATABASE_URL) {
      const sql = neon(process.env.DATABASE_URL);
      const rows = await sql`SELECT * FROM prospects WHERE demo_slug = ${slug} LIMIT 1`;
      prospect = rows[0] || null;
    }

    // Send instant alert to Matthew
    const notifyEmail = process.env.NOTIFY_EMAIL || 'matt@latchlyai.com';
    const siteBase = process.env.SITE_BASE || 'https://latchlyai.com';

    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        const bizName = prospect?.business_name || slug;
        const demoUrl = `${siteBase}/demo/${slug}`;

        await resend.emails.send({
          from: 'Latchly Alerts <notifications@latchlyai.com>',
          to: notifyEmail,
          subject: `🎯 Lead captured on ${bizName}'s demo!`,
          html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;">
<div style="background:linear-gradient(135deg,#059669,#10b981);color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
<h2 style="margin:0;font-size:18px;">Lead Captured!</h2>
<p style="margin:4px 0 0;font-size:13px;opacity:.85;">Someone used the chat widget on a prospect demo</p>
</div>
<div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;background:#fff;">
<h3 style="margin:0 0 16px;font-size:15px;color:#0f172a;">Visitor Info</h3>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:6px 0;font-size:14px;color:#64748b;width:100px;">Name</td><td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;">${name}</td></tr>
<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Phone</td><td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;">${phone}</td></tr>
${email ? `<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Email</td><td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;">${email}</td></tr>` : ''}
${rating ? `<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Rating</td><td style="padding:6px 0;font-size:14px;color:#0f172a;">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</td></tr>` : ''}
</table>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
<h3 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Demo Context</h3>
<p style="font-size:14px;color:#334155;margin:0 0 4px;"><strong>Business:</strong> ${bizName}</p>
${prospect ? `<p style="font-size:14px;color:#334155;margin:0 0 4px;"><strong>Owner:</strong> ${prospect.owner_name || 'Unknown'}</p>
<p style="font-size:14px;color:#334155;margin:0 0 4px;"><strong>Owner Email:</strong> ${prospect.email || 'N/A'}</p>` : ''}
<p style="font-size:14px;color:#334155;margin:0 0 16px;"><strong>Demo:</strong> <a href="${demoUrl}" style="color:#1B5FA8;">${demoUrl}</a></p>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;">
<p style="margin:0;font-size:13px;color:#166534;"><strong>This proves the product works.</strong> A real visitor just used the AI chat on ${bizName}'s demo and gave their contact info. Call the prospect now — this is your proof of concept.</p>
</div>
</div></div>`,
        });
      } catch (emailErr) {
        console.error('Alert email failed:', emailErr.message);
      }
    } else {
      console.log(`[demo-lead] Lead captured on ${slug}: ${name} ${phone} (no RESEND_API_KEY to send alert)`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Demo lead capture error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
