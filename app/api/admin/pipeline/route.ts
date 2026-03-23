import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);

    // Pipeline counts by status
    const pipelineCounts = await sql`
      SELECT status, COUNT(*) as count
      FROM prospects
      GROUP BY status
      ORDER BY
        CASE status
          WHEN 'scouted' THEN 1
          WHEN 'audited' THEN 2
          WHEN 'outreach' THEN 3
          WHEN 'closer' THEN 4
          WHEN 'closed' THEN 5
          ELSE 6
        END
    `;

    // Bounce / unsubscribe stats
    const [bounceStats] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE unsubscribed = TRUE) as total_unsubscribed,
        COUNT(*) FILTER (WHERE bounce_type = 'hard_bounce') as hard_bounces,
        COUNT(*) FILTER (WHERE bounce_type = 'spam_complaint') as spam_complaints,
        COUNT(*) FILTER (WHERE bounce_type = 'delivery_error') as delivery_errors,
        COUNT(*) FILTER (WHERE email IS NOT NULL) as total_with_email
      FROM prospects
    `;

    // Outreach stats
    const [outreachStats] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE outreach_step >= 1) as emails_sent_step0,
        COUNT(*) FILTER (WHERE outreach_step >= 2) as emails_sent_step1,
        COUNT(*) FILTER (WHERE outreach_step >= 3) as emails_sent_step2,
        COUNT(*) FILTER (WHERE closer_responses > 0) as got_replies,
        COUNT(*) FILTER (WHERE escalated = TRUE) as escalated
      FROM prospects
    `;

    // Demo engagement
    const [demoStats] = await sql`
      SELECT
        COUNT(DISTINCT demo_slug) as total_demos,
        COUNT(*) as total_visits
      FROM demo_visits
    `;

    // Top engaged demos (most visits)
    const topDemos = await sql`
      SELECT
        dv.demo_slug,
        COUNT(*) as visit_count,
        MAX(dv.visited_at) as last_visit,
        p.business_name,
        p.owner_name,
        p.status,
        p.outreach_step
      FROM demo_visits dv
      LEFT JOIN prospects p ON p.demo_slug = dv.demo_slug
      GROUP BY dv.demo_slug, p.business_name, p.owner_name, p.status, p.outreach_step
      ORDER BY visit_count DESC
      LIMIT 20
    `;

    // Recent prospects with full detail
    const prospects = await sql`
      SELECT
        id, business_name, owner_name, email, phone, niche,
        city, state, status, outreach_step, last_outreach_at,
        closer_responses, escalated, unsubscribed, bounce_type,
        bounced_at, demo_slug, demo_url, chatbot_score, redesign_score,
        combined_score, created_at, updated_at
      FROM prospects
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 100
    `;

    // Demo leads captured
    const [leadCaptures] = await sql`
      SELECT COUNT(*) as count FROM demo_leads
    `;

    // Niche breakdown
    const nicheBreakdown = await sql`
      SELECT niche, COUNT(*) as count
      FROM prospects
      WHERE niche IS NOT NULL
      GROUP BY niche
      ORDER BY count DESC
    `;

    return NextResponse.json({
      pipeline: pipelineCounts,
      bounces: {
        totalUnsubscribed: Number(bounceStats.total_unsubscribed),
        hardBounces: Number(bounceStats.hard_bounces),
        spamComplaints: Number(bounceStats.spam_complaints),
        deliveryErrors: Number(bounceStats.delivery_errors),
        totalWithEmail: Number(bounceStats.total_with_email),
      },
      outreach: {
        step0Sent: Number(outreachStats.emails_sent_step0),
        step1Sent: Number(outreachStats.emails_sent_step1),
        step2Sent: Number(outreachStats.emails_sent_step2),
        gotReplies: Number(outreachStats.got_replies),
        escalated: Number(outreachStats.escalated),
      },
      demos: {
        totalDemos: Number(demoStats.total_demos),
        totalVisits: Number(demoStats.total_visits),
        leadCaptures: Number(leadCaptures.count),
      },
      topDemos,
      prospects,
      nicheBreakdown,
    });
  } catch (error: any) {
    console.error("Pipeline stats error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
