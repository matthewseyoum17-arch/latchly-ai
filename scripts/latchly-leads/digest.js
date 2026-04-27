const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');
const {
  DIGEST_FROM,
  DIGEST_TO,
  LEADS_DIR,
  MIN_DAILY_LEADS,
  TARGET_DAILY_LEADS,
} = require('./config');
const { ensureDir, toCSV, todayInET } = require('./utils');

const CSV_HEADERS = [
  'Rank',
  'Business Name',
  'Niche',
  'City',
  'State',
  'Phone',
  'Opportunity',
  'Decision Maker',
  'Title',
  'Website',
  'Score',
  'Rating Reasons',
  'Pitch Opener',
  'Pitch Angle',
  'Next Action',
  'Source',
];

function crmUrl() {
  const base = process.env.SITE_BASE || process.env.NEXT_PUBLIC_SITE_URL || 'https://latchlyai.com';
  return `${String(base).replace(/\/+$/, '')}/admin/leads-crm`;
}

function buildDigest(leads, stats = {}) {
  const date = stats.date || todayInET();
  const localLeads = leads.filter(lead => lead.isLocalMarket);
  const otherLeads = leads.filter(lead => !lead.isLocalMarket);
  const underTarget = leads.length < MIN_DAILY_LEADS;
  const subject = underTarget
    ? `Latchly leads ${date}: UNDER TARGET (${leads.length}/${TARGET_DAILY_LEADS})`
    : `Latchly leads ${date}: ${leads.length} qualified leads`;

  const csv = toCSV(toCsvRows(leads), CSV_HEADERS);
  const html = renderHtml({ date, leads, localLeads, otherLeads, stats, underTarget });
  const text = renderText({ date, leads, stats, underTarget });
  return { subject, html, text, csv };
}

async function writeDigestFiles(digest, leads, stats = {}) {
  ensureDir(LEADS_DIR);
  const date = stats.date || todayInET();
  const base = path.join(LEADS_DIR, `daily-${date}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify({ stats, leads }, null, 2));
  fs.writeFileSync(`${base}.csv`, digest.csv);
  fs.writeFileSync(`${base}.html`, digest.html);
  fs.writeFileSync(`${base}.txt`, digest.text);
  return {
    json: `${base}.json`,
    csv: `${base}.csv`,
    html: `${base}.html`,
    text: `${base}.txt`,
  };
}

async function sendDigest(digest, options = {}) {
  const dryRun = options.dryRun || process.env.DRY_RUN === 'true' || process.env.SKIP_EMAIL === '1';
  if (dryRun) {
    return { sent: false, dryRun: true, to: DIGEST_TO };
  }
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required to send the lead digest');
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const payload = {
    from: DIGEST_FROM,
    to: DIGEST_TO,
    subject: digest.subject,
    html: digest.html,
    text: digest.text,
  };

  if (process.env.LATCHLY_ATTACH_CSV === '1') {
    payload.attachments = [
      {
        filename: `latchly-leads-${todayInET()}.csv`,
        content: Buffer.from(digest.csv).toString('base64'),
      },
    ];
  }

  const response = await resend.emails.send(payload);

  if (response.error) {
    throw new Error(response.error.message || 'Resend failed to send digest');
  }
  return { sent: true, id: response.data?.id, to: DIGEST_TO };
}

function toCsvRows(leads) {
  return leads.map((lead, index) => ({
    Rank: index + 1,
    'Business Name': lead.businessName,
    Niche: lead.niche,
    City: lead.city,
    State: lead.state,
    Phone: lead.phone,
    Opportunity: opportunityLabel(lead),
    'Decision Maker': lead.decisionMaker?.name || lead.ownerName || '',
    Title: lead.decisionMaker?.title || lead.ownerTitle || '',
    Website: lead.website || 'No website found',
    Score: lead.score,
    'Rating Reasons': (lead.reasons || []).join('; '),
    'Pitch Opener': lead.pitch?.opener || '',
    'Pitch Angle': lead.pitch?.angle || '',
    'Next Action': lead.pitch?.nextAction || '',
    Source: lead.sourceName || '',
  }));
}

function renderHtml({ date, leads, localLeads, otherLeads, stats, underTarget }) {
  const url = crmUrl();
  return `<!doctype html>
<html>
<body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#172033">
  <div style="max-width:680px;margin:0 auto;padding:24px">
    <div style="background:#111827;color:#fff;padding:22px 26px;border-radius:8px 8px 0 0">
      <h1 style="margin:0;font-size:22px">Daily leads are ready</h1>
      <p style="margin:8px 0 0;color:#cbd5e1">${date} | ${leads.length}/${TARGET_DAILY_LEADS} qualified | ${localLeads.length} local-market</p>
    </div>
    ${underTarget ? `<div style="background:#fef3c7;border-left:4px solid #d97706;padding:14px 20px;color:#7c2d12"><strong>Under target:</strong> fewer than ${MIN_DAILY_LEADS} qualified leads. ${escapeHtml(stats.underTargetReason || 'Source volume or quality gates limited output.')}</div>` : ''}
    <div style="background:#fff;padding:22px;border:1px solid #e5e7eb;border-top:0">
      <p style="margin:0 0 18px;color:#374151;line-height:1.5">New score 8+ home-service leads have been saved to the CRM with decision-maker details, score reasons, and pitch recommendations.</p>
      <a href="${escapeHtml(url)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:7px">Open Leads CRM</a>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:22px">
        <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:7px;padding:12px">
          <div style="font-size:22px;font-weight:800">${leads.length}</div>
          <div style="font-size:12px;color:#64748b">delivered</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:7px;padding:12px">
          <div style="font-size:22px;font-weight:800">${localLeads.length}</div>
          <div style="font-size:12px;color:#64748b">local-market</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:7px;padding:12px">
          <div style="font-size:22px;font-weight:800">${leads.filter(lead => !lead.website).length}</div>
          <div style="font-size:12px;color:#64748b">no website</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:7px;padding:12px">
          <div style="font-size:22px;font-weight:800">${leads.filter(lead => lead.websiteStatus === 'poor_website' || lead.leadType === 'poor_website_redesign').length}</div>
          <div style="font-size:12px;color:#64748b">poor website</div>
        </div>
      </div>
      <p style="margin:18px 0 0;font-size:13px;color:#64748b">Run stats: candidates ${stats.candidates || 0}, audited ${stats.audited || 0}, rejected ${stats.rejected || 0}.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#64748b">Mix: ${stats.noWebsiteDelivered || 0}/${stats.noWebsiteTarget || 0} no-website creation, ${stats.poorWebsiteDelivered || 0}/${stats.poorWebsiteTarget || 0} poor-website redesign.</p>
      ${stats.selectionNotes?.length ? `<p style="margin:8px 0 0;font-size:13px;color:#92400e"><strong>Selection notes:</strong> ${escapeHtml(stats.selectionNotes.join(' '))}</p>` : ''}
      ${stats.topRejectionReasons?.length ? `<p style="margin:8px 0 0;font-size:13px;color:#64748b"><strong>Top rejection reasons:</strong> ${escapeHtml(stats.topRejectionReasons.join('; '))}</p>` : ''}
    </div>
  </div>
</body>
</html>`;
}

function renderSection(title, leads) {
  if (!leads.length) return '';
  const rows = leads.map((lead, index) => `
    <tr style="border-top:1px solid #e5e7eb;vertical-align:top">
      <td style="padding:10px;font-weight:700">${index + 1}</td>
      <td style="padding:10px"><strong>${escapeHtml(lead.businessName)}</strong><br><span style="color:#6b7280">${escapeHtml(lead.niche || '')}</span></td>
      <td style="padding:10px">${escapeHtml(lead.city || '')}, ${escapeHtml(lead.state || '')}</td>
      <td style="padding:10px">${escapeHtml(opportunityLabel(lead))}</td>
      <td style="padding:10px"><a href="tel:${escapeHtml(lead.phone || '')}">${escapeHtml(lead.phone || '')}</a><br>${escapeHtml(lead.decisionMaker?.name || '')}${lead.decisionMaker?.title ? `<br><span style="color:#6b7280">${escapeHtml(lead.decisionMaker.title)}</span>` : ''}</td>
      <td style="padding:10px">${lead.website ? `<a href="${escapeHtml(lead.website)}">${escapeHtml(lead.website)}</a>` : '<strong>No website found</strong>'}</td>
      <td style="padding:10px;font-weight:700;color:#047857">${escapeHtml(String(lead.score))}/10</td>
      <td style="padding:10px">${escapeHtml((lead.reasons || []).join('; '))}</td>
      <td style="padding:10px">${escapeHtml(lead.pitch?.opener || '')}<br><span style="color:#0369a1">${escapeHtml(lead.pitch?.nextAction || '')}</span></td>
    </tr>`).join('');

  return `<div style="background:#fff;margin-top:18px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
    <h2 style="margin:0;padding:16px 18px;background:#f8fafc;font-size:17px">${escapeHtml(title)} (${leads.length})</h2>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="text-align:left;background:#f3f4f6;color:#374151">
            <th style="padding:10px">#</th><th style="padding:10px">Business</th><th style="padding:10px">Market</th><th style="padding:10px">Opportunity</th><th style="padding:10px">Contact</th><th style="padding:10px">Website</th><th style="padding:10px">Score</th><th style="padding:10px">Reasons</th><th style="padding:10px">Pitch</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function renderText({ date, leads, stats, underTarget }) {
  const localCount = leads.filter(lead => lead.isLocalMarket).length;
  const lines = [
    `Latchly leads are ready - ${date}`,
    `${leads.length}/${TARGET_DAILY_LEADS} qualified score 8+ leads saved to the CRM`,
    `${localCount} local-market leads`,
    `${stats.noWebsiteDelivered || 0}/${stats.noWebsiteTarget || 0} no-website creation leads`,
    `${stats.poorWebsiteDelivered || 0}/${stats.poorWebsiteTarget || 0} poor-website redesign leads`,
    underTarget ? `UNDER TARGET: fewer than ${MIN_DAILY_LEADS}. ${stats.underTargetReason || ''}` : '',
    '',
    `Open CRM: ${crmUrl()}`,
    '',
    `Run stats: candidates ${stats.candidates || 0}, audited ${stats.audited || 0}, rejected ${stats.rejected || 0}.`,
    stats.selectionNotes?.length ? `Selection notes: ${stats.selectionNotes.join(' ')}` : '',
    stats.topRejectionReasons?.length ? `Top rejection reasons: ${stats.topRejectionReasons.join('; ')}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

function opportunityLabel(lead) {
  if (lead.websiteStatus === 'no_website' || lead.leadType === 'no_website_creation' || !lead.website) return 'No Website';
  if (lead.websiteStatus === 'poor_website' || lead.leadType === 'poor_website_redesign') return 'Poor Website';
  return 'Website';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  buildDigest,
  writeDigestFiles,
  sendDigest,
  toCsvRows,
  opportunityLabel,
};
