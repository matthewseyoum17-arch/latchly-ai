import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const DEMO_MAX_AGE_DAYS = parseInt(process.env.DEMO_MAX_AGE_DAYS || '30', 10);
const BOOKING_LINK = process.env.BOOKING_LINK || 'https://calendly.com/latchlyai/demo';

function expiredPage(slug) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Demo Expired</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:480px;width:100%;padding:48px 32px;text-align:center}
h1{font-size:24px;color:#0f172a;margin-bottom:8px}p{font-size:15px;color:#64748b;line-height:1.7;margin-bottom:24px}
.btn{display:inline-block;background:#1B5FA8;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px}
.btn:hover{background:#174d8a}.sub{font-size:12px;color:#94a3b8;margin-top:16px}</style></head>
<body><div class="card">
<div style="font-size:48px;margin-bottom:16px">&#128337;</div>
<h1>This Demo Has Expired</h1>
<p>This personalized demo was built over 30 days ago and is no longer available. Want a fresh one? Book a quick call and we'll build you an updated version.</p>
<a href="${BOOKING_LINK}" class="btn">Book a 10-Minute Call</a>
<p class="sub">Latchly</p>
</div></body></html>`;
}

function freshnessBanner(daysAgo) {
  const urgency = daysAgo <= 3
    ? { label: 'Built just for you', bg: '#10b981', icon: '&#9889;' }
    : daysAgo <= 14
      ? { label: `Built for you ${daysAgo} days ago`, bg: '#f59e0b', icon: '&#128197;' }
      : { label: `Built ${daysAgo} days ago — expiring soon`, bg: '#ef4444', icon: '&#9203;' };

  return `<div id="latchly-freshness" style="position:fixed;top:0;left:0;right:0;z-index:99999;background:${urgency.bg};color:#fff;text-align:center;padding:10px 16px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:600;letter-spacing:.3px;box-shadow:0 2px 8px rgba(0,0,0,.15);">
${urgency.icon} ${urgency.label} &mdash; <a href="${BOOKING_LINK}" style="color:#fff;text-decoration:underline;font-weight:700;">Book a call to get started</a>
</div>
<style>#latchly-freshness~*{margin-top:40px!important}</style>`;
}

async function loadDemoFromDb(safeSlug) {
  if (!process.env.DATABASE_URL) return null;

  try {
    const sql = neon(process.env.DATABASE_URL);

    const demoPages = await sql`
      SELECT html, updated_at, created_at, source
      FROM demo_pages
      WHERE slug = ${safeSlug}
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 1
    `;

    if (demoPages.length && demoPages[0].html) {
      return {
        html: demoPages[0].html,
        createdAt: demoPages[0].updated_at || demoPages[0].created_at,
        source: demoPages[0].source || 'demo_pages',
      };
    }

    const rows = await sql`
      SELECT demo_html, demo_persisted_at, updated_at, created_at
      FROM prospects
      WHERE demo_slug = ${safeSlug}
        AND demo_html IS NOT NULL
      ORDER BY demo_persisted_at DESC NULLS LAST, updated_at DESC NULLS LAST
      LIMIT 1
    `;

    if (!rows.length || !rows[0].demo_html) return null;

    return {
      html: rows[0].demo_html,
      createdAt: rows[0].demo_persisted_at || rows[0].updated_at || rows[0].created_at,
      source: 'db',
    };
  } catch (err) {
    console.error('[demo-route] DB lookup failed:', err.message || err);
    return null;
  }
}

function loadDemoFromFile(safeSlug) {
  const demoPath = path.join(process.cwd(), 'demos', 'prospects', `${safeSlug}.html`);
  if (!fs.existsSync(demoPath)) return null;

  const stat = fs.statSync(demoPath);
  return {
    html: fs.readFileSync(demoPath, 'utf8'),
    createdAt: stat.birthtime || stat.mtime,
    source: 'file',
  };
}

export async function GET(request, { params }) {
  const { slug } = await params;

  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '');
  if (!safeSlug || safeSlug !== slug) {
    return new Response('Not found', { status: 404 });
  }

  const dbResult = await loadDemoFromDb(safeSlug);
  const demoRecord = dbResult || loadDemoFromFile(safeSlug);
  if (!demoRecord) {
    const hasDbUrl = !!process.env.DATABASE_URL;
    console.error(`[demo-route] Not found: slug=${safeSlug}, DATABASE_URL=${hasDbUrl ? 'set' : 'MISSING'}`);
    return new Response('Demo not found', { status: 404, headers: { 'X-Debug-DB': hasDbUrl ? 'set' : 'missing' } });
  }

  const createdAt = new Date(demoRecord.createdAt || Date.now());
  const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo > DEMO_MAX_AGE_DAYS) {
    return new Response(expiredPage(safeSlug), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  let html = demoRecord.html;
  const banner = freshnessBanner(daysAgo);
  html = html.replace(/<body[^>]*>/i, (match) => match + '\n' + banner);

  const trackingSnippet = `
<script>
(function(){
  var slug = ${JSON.stringify(safeSlug)};
  new Image().src = '/api/demo-track?slug=' + encodeURIComponent(slug);
  fetch('/api/demo-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: slug, event: 'visit' })
  }).catch(function(){});
  var fab = document.getElementById('lw-fab');
  if (fab) {
    fab.addEventListener('click', function() {
      fetch('/api/demo-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug, event: 'chat_open' })
      }).catch(function(){});
    });
  }
})();
</script>`;

  html = html.replace('</body>', trackingSnippet + '\n</body>');

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Demo-Source': demoRecord.source,
    },
  });
}
