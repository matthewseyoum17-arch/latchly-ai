import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { verifyDashboardRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
};

function dbUrl() {
  return (
    process.env.DATABASE_URL_UNPOOLED
    || process.env.POSTGRES_URL_NON_POOLING
    || process.env.DATABASE_URL
    || ""
  );
}

function jsonResponse(body: any, init?: { status?: number }) {
  return NextResponse.json(body, { ...init, headers: NO_STORE_HEADERS });
}

export async function GET(request: NextRequest) {
  if (!verifyDashboardRequest(request)) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const url = dbUrl();
  if (!url) return jsonResponse({ error: "DATABASE_URL is required" }, { status: 500 });

  const rangeDays = parseRangeDays(request.nextUrl.searchParams.get("range"));
  const leadId = parseLeadId(request.nextUrl.searchParams.get("leadId"));
  const endsAt = new Date();
  const startsAt = new Date(endsAt.getTime() - (rangeDays - 1) * 86400000);
  startsAt.setHours(0, 0, 0, 0);

  try {
    const sql = neon(url);
    const totalsPromise = sql.query(
      `SELECT
        COUNT(*) FILTER (WHERE e.event_type = 'sent')::int AS sent,
        COUNT(*) FILTER (WHERE e.event_type = 'delivered')::int AS delivered,
        COUNT(DISTINCT e.lead_id) FILTER (
          WHERE e.event_type = 'opened'
            AND e.lead_id IS NOT NULL
            AND (l.email_sent_at IS NULL OR e.occurred_at > l.email_sent_at + INTERVAL '5 minutes')
        )::int AS opened_unique,
        COUNT(*) FILTER (
          WHERE e.event_type = 'opened'
            AND (l.email_sent_at IS NULL OR e.occurred_at > l.email_sent_at + INTERVAL '5 minutes')
        )::int AS opened_total,
        COUNT(DISTINCT e.lead_id) FILTER (WHERE e.event_type = 'clicked' AND e.lead_id IS NOT NULL)::int AS clicked_unique,
        COUNT(*) FILTER (WHERE e.event_type = 'clicked')::int AS clicked_total,
        COUNT(*) FILTER (WHERE e.event_type = 'bounced')::int AS bounced,
        COUNT(*) FILTER (WHERE e.event_type = 'complained')::int AS complained,
        COUNT(*) FILTER (WHERE e.event_type = 'unsubscribed')::int AS unsubscribed,
        COUNT(*) FILTER (WHERE e.event_type = 'replied')::int AS replied
       FROM latchly_lead_engagement_events e
       LEFT JOIN latchly_leads l ON l.id = e.lead_id
       WHERE e.occurred_at >= $1 AND e.occurred_at <= $2`,
      [startsAt, endsAt],
    );

    const dailyPromise = sql.query(
      `WITH days AS (
        SELECT generate_series(
          date_trunc('day', $1::timestamptz),
          date_trunc('day', $2::timestamptz),
          INTERVAL '1 day'
        ) AS day
      )
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS day,
        COUNT(*) FILTER (WHERE e.event_type = 'sent')::int AS sent,
        COUNT(DISTINCT e.lead_id) FILTER (
          WHERE e.event_type = 'opened'
            AND e.lead_id IS NOT NULL
            AND (l.email_sent_at IS NULL OR e.occurred_at > l.email_sent_at + INTERVAL '5 minutes')
        )::int AS opened,
        COUNT(DISTINCT e.lead_id) FILTER (WHERE e.event_type = 'clicked' AND e.lead_id IS NOT NULL)::int AS clicked
      FROM days d
      LEFT JOIN latchly_lead_engagement_events e
        ON e.occurred_at >= d.day
       AND e.occurred_at < d.day + INTERVAL '1 day'
       AND e.occurred_at >= $1
       AND e.occurred_at <= $2
      LEFT JOIN latchly_leads l ON l.id = e.lead_id
      GROUP BY d.day
      ORDER BY d.day`,
      [startsAt, endsAt],
    );

    const topLeadsPromise = sql.query(
      `SELECT
        l.id AS lead_id,
        l.business_name,
        l.decision_maker_name,
        COUNT(*) FILTER (
          WHERE e.event_type = 'opened'
            AND (l.email_sent_at IS NULL OR e.occurred_at > l.email_sent_at + INTERVAL '5 minutes')
        )::int AS open_count,
        COUNT(*) FILTER (WHERE e.event_type = 'clicked')::int AS click_count,
        MAX(e.occurred_at) AS last_event_at
       FROM latchly_leads l
       JOIN latchly_lead_engagement_events e ON e.lead_id = l.id
       WHERE e.occurred_at >= $1
         AND e.occurred_at <= $2
         AND l.archived_at IS NULL
       GROUP BY l.id, l.business_name, l.decision_maker_name
       HAVING
        COUNT(*) FILTER (
          WHERE e.event_type = 'opened'
            AND (l.email_sent_at IS NULL OR e.occurred_at > l.email_sent_at + INTERVAL '5 minutes')
        ) > 0
        OR COUNT(*) FILTER (WHERE e.event_type = 'clicked') > 0
       ORDER BY open_count DESC, click_count DESC, last_event_at DESC
       LIMIT 10`,
      [startsAt, endsAt],
    );

    const hot24hPromise = sql.query(
      `WITH filtered AS (
        SELECT
          e.id,
          e.lead_id,
          e.event_type,
          e.occurred_at,
          l.business_name,
          l.decision_maker_name,
          ROW_NUMBER() OVER (PARTITION BY e.lead_id ORDER BY e.occurred_at DESC, e.id DESC) AS rn
        FROM latchly_lead_engagement_events e
        JOIN latchly_leads l ON l.id = e.lead_id
        WHERE e.occurred_at >= NOW() - INTERVAL '24 hours'
          AND l.archived_at IS NULL
          AND e.event_type IN ('opened', 'clicked', 'replied', 'bounced', 'complained', 'unsubscribed')
          AND (
            e.event_type <> 'opened'
            OR l.email_sent_at IS NULL
            OR e.occurred_at > l.email_sent_at + INTERVAL '5 minutes'
          )
      )
      SELECT lead_id, business_name, decision_maker_name, event_type, occurred_at
      FROM filtered
      WHERE rn = 1
      ORDER BY occurred_at DESC
      LIMIT 10`,
    );

    const leadRowsPromise = sql.query(
      `SELECT
        l.id AS lead_id,
        l.business_name,
        l.decision_maker_name,
        l.email,
        COUNT(*) FILTER (WHERE e.event_type = 'sent')::int AS sent_count,
        COUNT(*) FILTER (WHERE e.event_type = 'delivered')::int AS delivered_count,
        COUNT(*) FILTER (
          WHERE e.event_type = 'opened'
            AND (l.email_sent_at IS NULL OR e.occurred_at > l.email_sent_at + INTERVAL '5 minutes')
        )::int AS open_count,
        COUNT(*) FILTER (WHERE e.event_type = 'clicked')::int AS click_count,
        COUNT(*) FILTER (WHERE e.event_type = 'bounced')::int AS bounced_count,
        COUNT(*) FILTER (WHERE e.event_type = 'complained')::int AS complained_count,
        COUNT(*) FILTER (WHERE e.event_type = 'replied')::int AS replied_count,
        MAX(e.occurred_at) AS last_event_at
       FROM latchly_leads l
       JOIN latchly_lead_engagement_events e ON e.lead_id = l.id
       WHERE e.occurred_at >= $1
         AND e.occurred_at <= $2
         AND l.archived_at IS NULL
       GROUP BY l.id, l.business_name, l.decision_maker_name, l.email
       ORDER BY last_event_at DESC
       LIMIT 100`,
      [startsAt, endsAt],
    );

    const eventsPromise = leadId
      ? sql.query(
          `SELECT
            id, event_type, occurred_at, link_url, ip, user_agent, raw->>'source' AS raw_source
           FROM latchly_lead_engagement_events
           WHERE lead_id = $1
           ORDER BY occurred_at DESC, id DESC
           LIMIT 100`,
          [leadId],
        )
      : Promise.resolve([]);

    const [totalsRows, dailyRows, topLeadRows, hotRows, leadRows, eventRows] = await Promise.all([
      totalsPromise,
      dailyPromise,
      topLeadsPromise,
      hot24hPromise,
      leadRowsPromise,
      eventsPromise,
    ]);

    const totals = mapTotals(totalsRows[0] || {});
    const daily = dailyRows.map((row: any) => {
      const sent = Number(row.sent || 0);
      const opened = Number(row.opened || 0);
      return {
        day: row.day,
        sent,
        opened,
        clicked: Number(row.clicked || 0),
        openRate: sent ? Math.round((opened / sent) * 100) : 0,
      };
    });

    return jsonResponse({
      range: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), days: rangeDays },
      totals,
      daily,
      topLeads: topLeadRows.map((row: any) => ({
        leadId: Number(row.lead_id),
        businessName: row.business_name,
        ownerName: row.decision_maker_name || null,
        openCount: Number(row.open_count || 0),
        clickCount: Number(row.click_count || 0),
        lastEventAt: row.last_event_at,
      })),
      hot24h: hotRows.map((row: any) => ({
        leadId: Number(row.lead_id),
        businessName: row.business_name,
        ownerName: row.decision_maker_name || null,
        lastEventType: row.event_type,
        lastEventAt: row.occurred_at,
      })),
      leadRows: leadRows.map((row: any) => ({
        leadId: Number(row.lead_id),
        businessName: row.business_name,
        ownerName: row.decision_maker_name || null,
        email: row.email || null,
        sentCount: Number(row.sent_count || 0),
        deliveredCount: Number(row.delivered_count || 0),
        openCount: Number(row.open_count || 0),
        clickCount: Number(row.click_count || 0),
        bouncedCount: Number(row.bounced_count || 0),
        complainedCount: Number(row.complained_count || 0),
        repliedCount: Number(row.replied_count || 0),
        lastEventAt: row.last_event_at,
      })),
      events: leadId
        ? eventRows.map((row: any) => ({
            id: Number(row.id),
            eventType: row.event_type,
            occurredAt: row.occurred_at,
            linkUrl: row.link_url || null,
            ip: row.ip || null,
            userAgent: row.user_agent || null,
            rawSource: row.raw_source || null,
          }))
        : undefined,
    });
  } catch (error: any) {
    console.error("Latchly engagement analytics error:", error);
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

function parseRangeDays(value: string | null) {
  const match = /^(\d+)d$/.exec(value || "");
  const days = match ? Number(match[1]) : 14;
  if (!Number.isFinite(days)) return 14;
  return Math.min(90, Math.max(1, days));
}

function parseLeadId(value: string | null) {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function mapTotals(row: any) {
  return {
    sent: Number(row.sent || 0),
    delivered: Number(row.delivered || 0),
    openedUnique: Number(row.opened_unique || 0),
    openedTotal: Number(row.opened_total || 0),
    clickedUnique: Number(row.clicked_unique || 0),
    clickedTotal: Number(row.clicked_total || 0),
    bounced: Number(row.bounced || 0),
    complained: Number(row.complained || 0),
    unsubscribed: Number(row.unsubscribed || 0),
    replied: Number(row.replied || 0),
  };
}
