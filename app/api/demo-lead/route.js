/**
 * Demo Lead Capture API
 *
 * When a prospect's demo chat widget or request form captures a visitor's contact info,
 * this endpoint records it and notifies the configured recipient.
 *
 * POST /api/demo-lead
 * Body: { slug, name, phone, email?, rating?, service?, source? }
 */
import { neon } from '@neondatabase/serverless';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveNotifyEmail(slug) {
  if (slug?.startsWith('sams-plumbing-pro')) {
    return process.env.SAMS_PLUMBING_NOTIFY_EMAIL || process.env.NOTIFY_EMAIL || 'matt@latchlyai.com';
  }

  return process.env.NOTIFY_EMAIL || 'matt@latchlyai.com';
}

function resolveDemoUrl(origin, slug) {
  if (slug === 'sams-plumbing-pro-fort-lauderdale-live') {
    return `${origin}/api/demo-direct/${slug}`;
  }

  return `${origin}/demo/${slug}`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { slug, name, phone, email, rating, service, source } = body;

    if (!slug || !name || !phone) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (process.env.DATABASE_URL) {
      const sql = neon(process.env.DATABASE_URL);
      await sql`
        INSERT INTO demo_leads (demo_slug, visitor_name, visitor_phone, visitor_email, rating)
        VALUES (${slug}, ${name}, ${phone}, ${email || null}, ${rating || null})
      `;
    }

    let prospect = null;
    if (process.env.DATABASE_URL) {
      const sql = neon(process.env.DATABASE_URL);
      const rows = await sql`SELECT * FROM prospects WHERE demo_slug = ${slug} LIMIT 1`;
      prospect = rows[0] || null;
    }

    const origin = new URL(request.url).origin;
    const notifyEmail = resolveNotifyEmail(slug);
    const bizName = prospect?.business_name || slug;
    const demoUrl = resolveDemoUrl(origin, slug);
    const safeName = escapeHtml(name);
    const safePhone = escapeHtml(phone);
    const safeEmail = escapeHtml(email || '');
    const safeService = escapeHtml(service || '');
    const safeSource = escapeHtml(source || 'unspecified');
    const safeBizName = escapeHtml(bizName);
    const safeSlug = escapeHtml(slug);
    const safeOwnerName = escapeHtml(prospect?.owner_name || 'Unknown');
    const safeOwnerEmail = escapeHtml(prospect?.email || 'N/A');

    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
          from: 'Latchly Alerts <notifications@latchlyai.com>',
          to: notifyEmail,
          subject: `🔧 Service request for ${bizName}`,
          html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;">
<div style="background:linear-gradient(135deg,#163B57,#102536);color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
<h2 style="margin:0;font-size:18px;">New service request</h2>
<p style="margin:4px 0 0;font-size:13px;opacity:.85;">A visitor submitted a request from the live demo page.</p>
</div>
<div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;background:#fff;">
<h3 style="margin:0 0 16px;font-size:15px;color:#0f172a;">Visitor details</h3>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="padding:6px 0;font-size:14px;color:#64748b;width:120px;">Name</td><td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;">${safeName}</td></tr>
<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Phone</td><td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;"><a href="tel:${safePhone}" style="color:#1B5FA8;text-decoration:none;">${safePhone}</a></td></tr>
${safeEmail ? `<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Email</td><td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;"><a href="mailto:${safeEmail}" style="color:#1B5FA8;text-decoration:none;">${safeEmail}</a></td></tr>` : ''}
${safeService ? `<tr><td style="padding:6px 0;font-size:14px;color:#64748b;vertical-align:top;">Service</td><td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;white-space:pre-line;">${safeService}</td></tr>` : ''}
${rating ? `<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Rating</td><td style="padding:6px 0;font-size:14px;color:#0f172a;">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</td></tr>` : ''}
<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Source</td><td style="padding:6px 0;font-size:14px;color:#0f172a;">${safeSource}</td></tr>
</table>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
<h3 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Demo context</h3>
<p style="font-size:14px;color:#334155;margin:0 0 4px;"><strong>Business:</strong> ${safeBizName}</p>
<p style="font-size:14px;color:#334155;margin:0 0 4px;"><strong>Slug:</strong> ${safeSlug}</p>
${prospect ? `<p style="font-size:14px;color:#334155;margin:0 0 4px;"><strong>Owner:</strong> ${safeOwnerName}</p>
<p style="font-size:14px;color:#334155;margin:0 0 4px;"><strong>Prospect Email:</strong> ${safeOwnerEmail}</p>` : ''}
<p style="font-size:14px;color:#334155;margin:0 0 16px;"><strong>Demo:</strong> <a href="${demoUrl}" style="color:#1B5FA8;">${demoUrl}</a></p>
<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;">
<p style="margin:0;font-size:13px;color:#1e3a8a;"><strong>Follow up fast.</strong> This visitor already asked for service on the page, so the best next move is a quick call or text back.</p>
</div>
</div></div>`,
        });
      } catch (emailErr) {
        console.error('Alert email failed:', emailErr.message);
      }
    } else {
      console.log(`[demo-lead] Lead captured on ${slug}: ${name} ${phone} ${email || ''} ${service || ''} (no RESEND_API_KEY to send alert)`);
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
