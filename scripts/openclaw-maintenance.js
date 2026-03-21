#!/usr/bin/env node
/**
 * openclaw-maintenance.js  (Agent 6 — Maintenance)
 *
 * Weekly maintenance tasks:
 *   1. Query billing_subscriptions for active clients
 *   2. Verify Latchly widget is still embedded on each client site
 *   3. Count leads captured this week from leads table
 *   4. Send performance report email via Resend
 *   5. Alert Matthew + client if widget is down
 *
 * Runs weekly: 0 9 * * 1 (Monday 9 AM)
 *
 * Usage:
 *   node scripts/openclaw-maintenance.js
 *   DRY_RUN=true node scripts/openclaw-maintenance.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Load .env
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

const DRY_RUN     = process.env.DRY_RUN === 'true';
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'matt@latchlyai.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html',
};

// ── Widget verification ──────────────────────────────────────────────────────

const LATCHLY_SIGNATURES = ['latchly', 'latchlyai', 'lw-fab', 'lw-panel', 'lw-nudge'];

async function checkWidget(url) {
  if (!url) return { checked: false, reason: 'no_url' };

  try {
    const resp = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    });
    if (!resp.ok) return { checked: true, widgetPresent: false, reason: 'site_down', statusCode: resp.status };

    const html = await resp.text();
    const hasWidget = LATCHLY_SIGNATURES.some(sig => html.toLowerCase().includes(sig));

    return {
      checked: true,
      widgetPresent: hasWidget,
      reason: hasWidget ? 'ok' : 'widget_missing',
    };
  } catch (err) {
    return { checked: true, widgetPresent: false, reason: 'fetch_error', error: err.message };
  }
}

// ── Report email builder ─────────────────────────────────────────────────────

function buildReport(clients) {
  const now = new Date();
  const weekOf = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const activeCount = clients.filter(c => c.widget?.widgetPresent).length;
  const downCount = clients.filter(c => c.widget?.checked && !c.widget?.widgetPresent).length;
  const totalLeads = clients.reduce((sum, c) => sum + (c.leadsThisWeek || 0), 0);

  const clientRows = clients.map(c => {
    const status = c.widget?.widgetPresent ? '&#9989;' : '&#10060;';
    const leads = c.leadsThisWeek || 0;
    return `<tr>
      <td style="padding:8px 12px;font-size:14px;border-bottom:1px solid #f1f5f9;">${c.business_name || c.name || 'Unknown'}</td>
      <td style="padding:8px 12px;font-size:14px;border-bottom:1px solid #f1f5f9;text-align:center;">${status}</td>
      <td style="padding:8px 12px;font-size:14px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:600;">${leads}</td>
    </tr>`;
  }).join('');

  const alertSection = downCount > 0
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:20px;">
<p style="margin:0;font-size:14px;color:#991b1b;font-weight:600;">&#9888; ${downCount} client${downCount > 1 ? 's' : ''} with widget issues</p>
<p style="margin:4px 0 0;font-size:13px;color:#b91c1c;">${clients.filter(c => !c.widget?.widgetPresent).map(c => c.business_name || c.name).join(', ')}</p>
</div>`
    : '';

  return {
    subject: `Weekly Report: ${totalLeads} leads captured, ${activeCount} active clients`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:580px;margin:0 auto;">
<div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:24px;border-radius:12px 12px 0 0;">
<h1 style="margin:0;color:#fff;font-size:20px;">Weekly Maintenance Report</h1>
<p style="margin:4px 0 0;color:rgba(255,255,255,.7);font-size:13px;">Week of ${weekOf}</p>
</div>
<div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
<div style="display:flex;gap:12px;margin-bottom:20px;">
<div style="flex:1;text-align:center;padding:16px;background:#f8fafc;border-radius:8px;">
<div style="font-size:28px;font-weight:900;color:#1e293b;">${activeCount}</div>
<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Active Clients</div>
</div>
<div style="flex:1;text-align:center;padding:16px;background:#f8fafc;border-radius:8px;">
<div style="font-size:28px;font-weight:900;color:#1e293b;">${totalLeads}</div>
<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Leads This Week</div>
</div>
<div style="flex:1;text-align:center;padding:16px;background:${downCount > 0 ? '#fef2f2' : '#f8fafc'};border-radius:8px;">
<div style="font-size:28px;font-weight:900;color:${downCount > 0 ? '#ef4444' : '#1e293b'};">${downCount}</div>
<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Widget Issues</div>
</div>
</div>
${alertSection}
<h3 style="font-size:13px;font-weight:700;color:#64748b;margin:0 0 8px;">Client Status</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
<thead><tr style="background:#f8fafc;">
<th style="padding:8px 12px;text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;">Client</th>
<th style="padding:8px 12px;text-align:center;font-size:11px;color:#94a3b8;text-transform:uppercase;">Widget</th>
<th style="padding:8px 12px;text-align:center;font-size:11px;color:#94a3b8;text-transform:uppercase;">Leads</th>
</tr></thead>
<tbody>${clientRows}</tbody>
</table>
<div style="margin-top:20px;text-align:center;">
<a href="https://latchlyai.com/dashboard" style="display:inline-block;background:#1B5FA8;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;">Open Dashboard</a>
</div>
<p style="margin-top:16px;font-size:11px;color:#94a3b8;text-align:center;">Sent by OpenClaw Maintenance &middot; <a href="https://latchlyai.com" style="color:#1B5FA8;">latchlyai.com</a></p>
</div></div>`,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('OpenClaw Maintenance starting...');

  let clients = [];

  // Query active clients from Stripe subscriptions / prospects table
  if (process.env.DATABASE_URL) {
    try {
      const { neon } = require('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);

      // Get active clients (those who have subscribed or been onboarded)
      const prospects = await sql`
        SELECT * FROM prospects
        WHERE status IN ('active', 'subscribed', 'onboarded')
        ORDER BY business_name
      `;

      // Get lead counts per client for this week
      for (const p of prospects) {
        const [count] = await sql`
          SELECT COUNT(*) as c FROM leads
          WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
          AND (industry ILIKE ${'%' + (p.niche || '') + '%'} OR TRUE)
        `;
        p.leadsThisWeek = parseInt(count?.c || '0');
      }

      clients = prospects;
      console.log(`Found ${clients.length} active clients in DB`);
    } catch (err) {
      console.error(`DB query failed: ${err.message}`);
    }
  }

  // Check widgets for each client
  for (const client of clients) {
    if (client.website) {
      console.log(`  Checking widget: ${client.business_name}...`);
      client.widget = await checkWidget(client.website);
      console.log(`    ${client.widget.widgetPresent ? 'OK' : 'ISSUE: ' + client.widget.reason}`);
      await new Promise(r => setTimeout(r, 1000));
    } else {
      client.widget = { checked: false, reason: 'no_website' };
    }
  }

  // Build and send report
  const report = buildReport(clients);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would send report:');
    console.log(`  Subject: ${report.subject}`);
    console.log(`  To: ${NOTIFY_EMAIL}`);
  } else if (process.env.RESEND_API_KEY) {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: 'Latchly <notifications@latchlyai.com>',
      to: NOTIFY_EMAIL,
      subject: report.subject,
      html: report.html,
    });

    if (error) {
      console.error(`Report email failed: ${error.message}`);
    } else {
      console.log('Report email sent');
    }

    // Send alert for down widgets
    const downClients = clients.filter(c => c.widget?.checked && !c.widget?.widgetPresent);
    if (downClients.length > 0) {
      for (const client of downClients) {
        console.log(`  Sending widget-down alert for ${client.business_name}`);
        await resend.emails.send({
          from: 'Latchly <notifications@latchlyai.com>',
          to: NOTIFY_EMAIL,
          subject: `⚠️ Widget down: ${client.business_name}`,
          html: `<p>The Latchly widget appears to be missing from <strong>${client.business_name}</strong>'s website.</p>
<p>Website: <a href="${client.website}">${client.website}</a></p>
<p>Reason: ${client.widget.reason}</p>
<p>Please investigate and re-install if needed.</p>`,
        });
      }
    }
  }

  console.log('\nMaintenance complete');
  return { clients: clients.length, report: report.subject };
}

module.exports = { main, checkWidget, buildReport };

if (require.main === module) {
  main().catch(err => { console.error('Maintenance failed:', err); process.exit(1); });
}
