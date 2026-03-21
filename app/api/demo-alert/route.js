import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { slug, event } = await request.json();
    if (!slug || !event) {
      return Response.json({ error: "missing slug or event" }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Count total visits for this slug
    const countResult = await sql`
      SELECT COUNT(*)::int AS total FROM demo_visits WHERE demo_slug = ${slug}
    `;
    const totalVisits = countResult[0]?.total || 0;

    const shouldAlert = totalVisits >= 2 || event === "chat_open";
    if (!shouldAlert) {
      return Response.json({ alerted: false, reason: "first visit, no chat" });
    }

    // Throttle: skip if we already sent an alert for this slug in the last 4 hours.
    // We use a simple heuristic — check if there are 2+ visits within 4h (meaning
    // the alert-triggering condition was already met recently).
    const recentResult = await sql`
      SELECT COUNT(*)::int AS recent FROM demo_visits
      WHERE demo_slug = ${slug}
        AND visited_at > NOW() - INTERVAL '4 hours'
        AND visited_at < (SELECT MAX(visited_at) FROM demo_visits WHERE demo_slug = ${slug})
    `;
    const recentPrior = recentResult[0]?.recent || 0;
    // If there were already alert-qualifying visits in the window (excluding the latest),
    // skip to avoid spam. Exception: always alert on chat_open with throttle.
    if (recentPrior >= 2 && event !== "chat_open") {
      return Response.json({ alerted: false, reason: "throttled (4h window)" });
    }

    // Look up prospect info
    const prospectResult = await sql`
      SELECT business_name, email, owner_name, demo_url, demo_slug
      FROM prospects WHERE demo_slug = ${slug} LIMIT 1
    `;
    const prospect = prospectResult[0];

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.log(
        `[demo-alert] RESEND_API_KEY not set. Would alert for slug=${slug}, event=${event}, visits=${totalVisits}`
      );
      return Response.json({ alerted: false, reason: "no RESEND_API_KEY" });
    }

    const notifyEmail = process.env.NOTIFY_EMAIL || "matt@latchlyai.com";
    const businessName = prospect?.business_name || slug;
    const ownerName = prospect?.owner_name || "Unknown";
    const demoLink = prospect?.demo_url || `https://latchlyai.com/demo/${slug}`;

    const eventLabel = event === "chat_open" ? "opened the chat widget" : "visited their demo";
    const subject = `[LeadPilot] ${businessName} ${eventLabel}`;
    const body = [
      `<h2>${businessName} is engaging!</h2>`,
      `<p><strong>Event:</strong> ${eventLabel}</p>`,
      `<p><strong>Prospect:</strong> ${ownerName} (${businessName})</p>`,
      `<p><strong>Total demo visits:</strong> ${totalVisits}</p>`,
      `<p><strong>Demo:</strong> <a href="${demoLink}">${demoLink}</a></p>`,
      `<p style="color:#666;font-size:12px;">Sent by LeadPilot alert system</p>`,
    ].join("\n");

    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);

    await resend.emails.send({
      from: "LeadPilot <alerts@latchlyai.com>",
      to: notifyEmail,
      subject,
      html: body,
    });

    console.log(`[demo-alert] Sent alert for ${slug} (${event}, ${totalVisits} visits)`);
    return Response.json({ alerted: true, visits: totalVisits, event });
  } catch (err) {
    console.error("demo-alert error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
