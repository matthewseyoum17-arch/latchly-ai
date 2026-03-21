import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { slug } = await params;

  // Sanitize slug to prevent path traversal
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '');
  if (!safeSlug || safeSlug !== slug) {
    return new Response('Not found', { status: 404 });
  }

  const demoPath = path.join(process.cwd(), 'demos', 'prospects', `${safeSlug}.html`);

  if (!fs.existsSync(demoPath)) {
    return new Response('Demo not found', { status: 404 });
  }

  let html = fs.readFileSync(demoPath, 'utf8');

  // Inject tracking + alert snippet before </body>
  const trackingSnippet = `
<script>
(function(){
  var slug = ${JSON.stringify(safeSlug)};
  // Track page visit
  new Image().src = '/api/demo-track?slug=' + encodeURIComponent(slug);
  // Alert on 2nd+ visit
  fetch('/api/demo-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: slug, event: 'visit' })
  }).catch(function(){});
  // Track chat widget open
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
    },
  });
}
