import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { verifyDashboardRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUSES = new Set([
  "new",
  "reviewed",
  "contacted",
  "interested",
  "follow_up",
  "not_fit",
  "won",
  "lost",
]);

export async function GET(request: NextRequest) {
  if (!verifyDashboardRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is required" }, { status: 500 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const params: any[] = [];
    const where: string[] = [];
    const searchParams = request.nextUrl.searchParams;
    const includeArchived = isTruthy(searchParams.get("includeArchived"));

    if (!includeArchived) {
      where.push("archived_at IS NULL");
    }

    const status = searchParams.get("status") || "all";
    if (status !== "all" && STATUSES.has(status)) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }

    const minScore = Number(searchParams.get("minScore") || "0");
    if (Number.isFinite(minScore) && minScore > 0) {
      params.push(minScore);
      where.push(`score >= $${params.length}`);
    }

    const city = searchParams.get("city") || "all";
    if (city !== "all") {
      params.push(city);
      where.push(`city = $${params.length}`);
    }

    const niche = searchParams.get("niche") || "all";
    if (niche !== "all") {
      params.push(niche);
      where.push(`niche = $${params.length}`);
    }

    if (isTruthy(searchParams.get("local"))) {
      where.push("(state = 'FL' AND city IN ('Gainesville', 'Tallahassee'))");
    }

    if (isTruthy(searchParams.get("noWebsite"))) {
      where.push("(website IS NULL OR website = '' OR website_status = 'no_website')");
    }

    if (isTruthy(searchParams.get("poorWebsite"))) {
      where.push("website_status = 'poor_website'");
    }

    const q = searchParams.get("q")?.trim();
    if (q) {
      params.push(`%${q}%`);
      where.push(`concat_ws(' ', business_name, decision_maker_name, decision_maker_title, phone, email, city, niche) ILIKE $${params.length}`);
    }

    const limit = Math.min(Math.max(Number(searchParams.get("limit") || "100"), 1), 200);
    params.push(limit);

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const leads = await sql.query(
      `SELECT
        id, business_key, business_name, normalized_name, niche, city, state,
        phone, email, website, website_status, source_name, source_record_id,
        decision_maker_name, decision_maker_title, decision_maker_confidence,
        score, score_reasons, score_blockers, pitch, is_local_market,
        status, notes, last_contacted_at, next_follow_up_date,
        archived_at, archive_reason,
        first_seen_at, last_seen_at, delivered_at, created_at, updated_at
       FROM latchly_leads
       ${whereSql}
       ORDER BY delivered_at DESC, score DESC, business_name ASC
       LIMIT $${params.length}`,
      params,
    );

    const activeWhereSql = includeArchived ? "" : "WHERE archived_at IS NULL";
    const [summary] = await sql.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'new')::int AS new_count,
        COUNT(*) FILTER (WHERE status IN ('contacted', 'interested', 'follow_up'))::int AS active_count,
        COUNT(*) FILTER (WHERE status = 'won')::int AS won_count,
        COUNT(*) FILTER (WHERE score >= 9)::int AS high_score_count,
        COUNT(*) FILTER (WHERE state = 'FL' AND city IN ('Gainesville', 'Tallahassee'))::int AS local_count,
        COUNT(*) FILTER (WHERE website IS NULL OR website = '' OR website_status = 'no_website')::int AS no_website_count,
        COUNT(*) FILTER (WHERE website_status = 'poor_website')::int AS poor_website_count,
        COUNT(*) FILTER (
          WHERE next_follow_up_date IS NOT NULL
          AND next_follow_up_date <= CURRENT_DATE
          AND status NOT IN ('not_fit', 'won', 'lost')
        )::int AS due_follow_up_count,
        ROUND(AVG(score)::numeric, 1) AS avg_score
      FROM latchly_leads
      ${activeWhereSql}`);

    const statusCounts = await sql.query(`
      SELECT status, COUNT(*)::int AS count
      FROM latchly_leads
      ${activeWhereSql}
      GROUP BY status
      ORDER BY status`);

    const cities = await sql.query(`
      SELECT city, COUNT(*)::int AS count
      FROM latchly_leads
      WHERE ${includeArchived ? "" : "archived_at IS NULL AND "}city IS NOT NULL AND city <> ''
      GROUP BY city
      ORDER BY city`);

    const niches = await sql.query(`
      SELECT niche, COUNT(*)::int AS count
      FROM latchly_leads
      WHERE ${includeArchived ? "" : "archived_at IS NULL AND "}niche IS NOT NULL AND niche <> ''
      GROUP BY niche
      ORDER BY niche`);

    const [latestRun] = await sql`
      SELECT
        id, run_date, target_count, minimum_count, candidate_count, audited_count,
        qualified_count, delivered_count, local_count, rejected_count,
        rejection_stats, under_target_reason, resend_email_id, email_sent,
        dry_run, metadata, created_at
      FROM latchly_lead_runs
      ORDER BY created_at DESC
      LIMIT 1`;

    return NextResponse.json({
      leads: leads.map(mapLead),
      stats: {
        total: Number(summary?.total || 0),
        new: Number(summary?.new_count || 0),
        active: Number(summary?.active_count || 0),
        won: Number(summary?.won_count || 0),
        highScore: Number(summary?.high_score_count || 0),
        local: Number(summary?.local_count || 0),
        noWebsite: Number(summary?.no_website_count || 0),
        poorWebsite: Number(summary?.poor_website_count || 0),
        dueFollowUp: Number(summary?.due_follow_up_count || 0),
        avgScore: summary?.avg_score == null ? null : Number(summary.avg_score),
      },
      statusCounts: statusCounts.map((row: any) => ({ status: row.status, count: Number(row.count || 0) })),
      filters: {
        cities: cities.map((row: any) => ({ city: row.city, count: Number(row.count || 0) })),
        niches: niches.map((row: any) => ({ niche: row.niche, count: Number(row.count || 0) })),
      },
      latestRun: latestRun ? mapRun(latestRun) : null,
    });
  } catch (error: any) {
    console.error("Latchly leads CRM fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function isTruthy(value: string | null) {
  return value === "1" || value === "true" || value === "yes";
}

function mapLead(row: any) {
  return {
    id: Number(row.id),
    businessKey: row.business_key,
    businessName: row.business_name,
    normalizedName: row.normalized_name,
    niche: row.niche,
    city: row.city,
    state: row.state,
    phone: row.phone,
    email: row.email,
    website: row.website,
    websiteStatus: row.website_status,
    sourceName: row.source_name,
    sourceRecordId: row.source_record_id,
    decisionMakerName: row.decision_maker_name,
    decisionMakerTitle: row.decision_maker_title,
    decisionMakerConfidence: row.decision_maker_confidence == null ? null : Number(row.decision_maker_confidence),
    score: row.score == null ? null : Number(row.score),
    scoreReasons: normalizeJsonArray(row.score_reasons),
    scoreBlockers: normalizeJsonArray(row.score_blockers),
    pitch: normalizeJsonObject(row.pitch),
    isLocalMarket: Boolean(row.is_local_market) || isLocalRow(row),
    status: row.status,
    notes: row.notes || "",
    lastContactedAt: row.last_contacted_at,
    nextFollowUpDate: row.next_follow_up_date,
    archivedAt: row.archived_at,
    archiveReason: row.archive_reason || "",
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRun(row: any) {
  return {
    id: Number(row.id),
    runDate: row.run_date,
    target: Number(row.target_count || 0),
    minimum: Number(row.minimum_count || 0),
    candidates: Number(row.candidate_count || 0),
    audited: Number(row.audited_count || 0),
    qualified: Number(row.qualified_count || 0),
    delivered: Number(row.delivered_count || 0),
    local: Number(row.local_count || 0),
    rejected: Number(row.rejected_count || 0),
    rejectionStats: normalizeJsonArray(row.rejection_stats),
    underTargetReason: row.under_target_reason || "",
    resendEmailId: row.resend_email_id,
    emailSent: Boolean(row.email_sent),
    dryRun: Boolean(row.dry_run),
    metadata: normalizeJsonObject(row.metadata),
    createdAt: row.created_at,
  };
}

function isLocalRow(row: any) {
  return row.state === "FL" && (row.city === "Gainesville" || row.city === "Tallahassee");
}

function normalizeJsonArray(value: any) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeJsonObject(value: any) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}
