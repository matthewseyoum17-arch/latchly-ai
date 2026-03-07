import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || "");
  }
  return _resend;
}

const FROM_EMAIL = "Latchly <notifications@latchlyai.com>";

export interface LeadData {
  name: string;
  phone: string;
  email?: string;
  industry?: string;
  rating?: number;
  transcript?: string;
  createdAt?: string;
}

export async function sendLeadNotification(lead: LeadData) {
  const { name, phone, email, industry, rating, transcript } = lead;

  const ratingStars = rating ? "⭐".repeat(rating) : "N/A";
  const transcriptBlock = transcript
    ? transcript
        .split("\n")
        .map((line: string) => `<div style="padding:2px 0;color:#475569;">${line}</div>`)
        .join("")
    : "<em>No transcript available</em>";

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;">
      <div style="background:linear-gradient(135deg,#0e7c6b,#0e7c6bdd);padding:24px 28px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;color:#fff;font-size:20px;">🎯 New Lead Captured!</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">via Latchly Chat Widget</p>
      </div>
      <div style="padding:24px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr>
            <td style="padding:8px 0;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;width:100px;">Name</td>
            <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1e293b;">${name || "-"}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;">Phone</td>
            <td style="padding:8px 0;font-size:14px;color:#1e293b;">
              <a href="tel:${phone}" style="color:#0e7c6b;text-decoration:none;font-weight:600;">${phone || "-"}</a>
            </td>
          </tr>
          ${email ? `<tr>
            <td style="padding:8px 0;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;">Email</td>
            <td style="padding:8px 0;font-size:14px;color:#1e293b;">
              <a href="mailto:${email}" style="color:#0e7c6b;text-decoration:none;">${email}</a>
            </td>
          </tr>` : ""}
          <tr>
            <td style="padding:8px 0;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;">Industry</td>
            <td style="padding:8px 0;font-size:14px;color:#1e293b;">${industry || "-"}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;">Rating</td>
            <td style="padding:8px 0;font-size:14px;">${ratingStars}</td>
          </tr>
        </table>

        <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-top:8px;">
          <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:8px;">Chat Transcript</div>
          <div style="font-size:13px;line-height:1.6;">${transcriptBlock}</div>
        </div>

        <div style="margin-top:20px;text-align:center;">
          <a href="tel:${phone}" style="display:inline-block;background:#0e7c6b;color:#fff;padding:10px 28px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;">
            📞 Call ${name?.split(" ")[0] || "Lead"} Now
          </a>
        </div>

        <p style="margin-top:20px;font-size:11px;color:#94a3b8;text-align:center;">
          This notification was sent by Latchly · <a href="https://latchlyai.com" style="color:#0e7c6b;">latchlyai.com</a>
        </p>
      </div>
    </div>
  `;

  try {
    const notifyEmail = process.env.NOTIFY_EMAIL || "matt@latchlyai.com";
    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: notifyEmail,
      subject: `🎯 New Lead: ${name || "Unknown"}, ${phone || "No phone"}`,
      html,
    });

    if (error) {
      console.error("Resend email error:", error);
      return { success: false, error };
    }

    console.log("Lead notification email sent:", data?.id);
    return { success: true, emailId: data?.id };
  } catch (err) {
    console.error("Failed to send lead notification:", err);
    return { success: false, error: err };
  }
}
