import { Resend } from "resend";
import { neon } from "@neondatabase/serverless";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || "");
  return _resend;
}

export async function sendWeeklySummary() {
  const sql = neon(process.env.DATABASE_URL!);
  const to = process.env.NOTIFY_EMAIL || "matt@latchlyai.com";

  const [tw] = await sql`SELECT COUNT(*) as c FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'`;
  const [ar] = await sql`SELECT COALESCE(AVG(rating),0) as a FROM leads WHERE rating IS NOT NULL AND created_at >= CURRENT_DATE - INTERVAL '7 days'`;
  const ind = await sql`SELECT industry, COUNT(*) as c FROM leads WHERE industry IS NOT NULL AND created_at >= CURRENT_DATE - INTERVAL '7 days' GROUP BY industry ORDER BY c DESC LIMIT 5`;
  const recent = await sql`SELECT name, phone, industry, created_at FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' ORDER BY created_at DESC LIMIT 10`;

  const wk = Number(tw.c);
  const rat = Number(Number(ar.a).toFixed(1));

  const indHtml = ind.length > 0 ? ind.map((i: any) => `<tr><td style="padding:4px 8px;text-transform:capitalize">${i.industry}</td><td style="padding:4px 8px;font-weight:700;color:#0e7c6b">${i.c}</td></tr>`).join("") : "<tr><td colspan='2'>No data</td></tr>";

  const leadHtml = recent.length > 0 ? recent.map((l: any) => `<tr><td style="padding:4px 8px">${l.name||"—"}</td><td style="padding:4px 8px">${l.phone||"—"}</td><td style="padding:4px 8px;text-transform:capitalize">${l.industry||"—"}</td><td style="padding:4px 8px;font-size:12px;color:#94a3b8">${new Date(l.created_at).toLocaleDateString()}</td></tr>`).join("") : "<tr><td colspan='4'>No leads this week</td></tr>";

  const html = `<div style="font-family:sans-serif;max-width:580px;margin:0 auto">
<div style="background:linear-gradient(135deg,#0e7c6b,#0e7c6bdd);padding:24px;border-radius:12px 12px 0 0">
<h1 style="margin:0;color:#fff;font-size:20px">📊 Weekly Summary</h1>
<p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px">Your Latchly performance report</p>
</div>
<div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
<div style="display:flex;gap:16px;margin-bottom:20px">
<div style="flex:1;background:#f8fafc;border-radius:8px;padding:16px;text-align:center">
<div style="font-size:28px;font-weight:900;color:#1e293b">${wk}</div>
<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600">Leads This Week</div>
</div>
<div style="flex:1;background:#f8fafc;border-radius:8px;padding:16px;text-align:center">
<div style="font-size:28px;font-weight:900;color:#1e293b">${rat > 0 ? rat + " ⭐" : "—"}</div>
<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600">Avg Rating</div>
</div>
</div>
<h3 style="font-size:13px;font-weight:700;color:#64748b;margin:0 0 8px">Top Industries</h3>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;color:#1e293b">${indHtml}</table>
<h3 style="font-size:13px;font-weight:700;color:#64748b;margin:0 0 8px">Recent Leads</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px;color:#1e293b">${leadHtml}</table>
<div style="margin-top:20px;text-align:center">
<a href="https://latchlyai.com/dashboard" style="display:inline-block;background:#0e7c6b;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700">Open Dashboard</a>
</div>
<p style="margin-top:16px;font-size:11px;color:#94a3b8;text-align:center">Sent by Latchly · <a href="https://latchlyai.com" style="color:#0e7c6b">latchlyai.com</a></p>
</div></div>`;

  const { data, error } = await getResend().emails.send({
    from: "Latchly <notifications@latchlyai.com>",
    to,
    subject: `📊 Latchly Weekly Summary — ${wk} lead${wk !== 1 ? "s" : ""} this week`,
    html,
  });

  if (error) {
    console.error("Weekly summary email error:", error);
    return { success: false, error };
  }
  console.log("Weekly summary sent:", data?.id);
  return { success: true, emailId: data?.id };
}
