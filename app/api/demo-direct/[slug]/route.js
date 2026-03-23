import { neon } from '@neondatabase/serverless';

const DEMO_MAX_AGE_DAYS = parseInt(process.env.DEMO_MAX_AGE_DAYS || '30', 10);
const BOOKING_LINK = process.env.BOOKING_LINK || 'https://calendly.com/latchlyai/demo';

export async function GET(request, { params }) {
  const { slug } = await params;
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '');

  if (!safeSlug || safeSlug !== slug) {
    return new Response('Invalid slug', { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return new Response('Database not configured', { status: 500 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Try demo_pages first
    const demoPages = await sql`
      SELECT html, updated_at, created_at
      FROM demo_pages
      WHERE slug = ${safeSlug}
      LIMIT 1
    `;

    if (demoPages.length && demoPages[0].html) {
      const createdAt = new Date(demoPages[0].updated_at || demoPages[0].created_at);
      const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      if (daysAgo > DEMO_MAX_AGE_DAYS) {
        return new Response(
          `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demo Expired</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:480px;width:100%;padding:48px 32px;text-align:center}h1{font-size:24px;color:#0f172a;margin-bottom:8px}p{font-size:15px;color:#64748b;line-height:1.7;margin-bottom:24px}.btn{display:inline-block;background:#1B5FA8;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px}.btn:hover{background:#174d8a}</style></head><body><div class="card"><div style="font-size:48px;margin-bottom:16px">⏰</div><h1>This Demo Has Expired</h1><p>This personalized demo was built over ${DEMO_MAX_AGE_DAYS} days ago and is no longer available. Want a fresh one? Book a quick call and we'll build you an updated version.</p><a href="${BOOKING_LINK}" class="btn">Book a 10-Minute Call</a><p style="font-size:12px;color:#94a3b8;margin-top:16px;">Latchly</p></div></body></html>`,
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      let html = demoPages[0].html;

      // Add freshness banner
      const urgency =
        daysAgo <= 3
          ? { label: 'Built just for you', bg: '#10b981', icon: '⚡' }
          : daysAgo <= 14
            ? { label: `Built for you ${daysAgo} days ago`, bg: '#f59e0b', icon: '📅' }
            : { label: `Built ${daysAgo} days ago — expiring soon`, bg: '#ef4444', icon: '⏱️' };

      const banner = `<div id="latchly-freshness" style="position:fixed;top:0;left:0;right:0;z-index:99999;background:${urgency.bg};color:#fff;text-align:center;padding:10px 16px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:600;letter-spacing:.3px;box-shadow:0 2px 8px rgba(0,0,0,.15);">
${urgency.icon} ${urgency.label} &mdash; <a href="${BOOKING_LINK}" style="color:#fff;text-decoration:underline;font-weight:700;">Book a call to get started</a>
</div>
<style>#latchly-freshness~*{margin-top:40px!important}</style>`;

      html = html.replace(/<body[^>]*>/i, (match) => match + '\n' + banner);

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow',
          'X-Demo-Source': 'database',
        },
      });
    }

    return new Response('Demo not found', { status: 404 });
  } catch (err) {
    console.error('[demo-direct]', err);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
