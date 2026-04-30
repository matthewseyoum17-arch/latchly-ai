import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { verifyDashboardRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

const TIERS = new Set(["premium", "standard"]);

const OUTREACH_STATUSES = new Set([
  "draft",
  "queued",
  "sending",
  "day_zero_sent",
  "day_zero_failed",
  "rejected",
  "unsubscribed",
  "no_email",
  "no_demo",
]);

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
  if (!url) {
    return jsonResponse({ error: "DATABASE_URL is required" }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;

  if (searchParams.get("debug") === "1") {
    return runDiagnostics(url);
  }

  try {
    const sql = neon(url);
    const params: any[] = [];
    const where: string[] = [];
    const includeArchived = isTruthy(searchParams.get("includeArchived"));

    if (!includeArchived) {
      where.push("archived_at IS NULL");
    }

    const status = searchParams.get("status") || "all";
    if (status !== "all" && STATUSES.has(status)) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }

    const tier = searchParams.get("tier") || "all";
    if (tier !== "all" && TIERS.has(tier)) {
      params.push(tier);
      where.push(`tier = $${params.length}`);
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

    const outreachStatus = searchParams.get("outreachStatus") || "all";
    if (outreachStatus === "sent_today") {
      where.push(
        `outreach_status = 'day_zero_sent' AND email_sent_at >= date_trunc('day', NOW())`,
      );
    } else if (outreachStatus === "attempted") {
      where.push(
        `outreach_status IN ('queued', 'sending', 'day_zero_sent', 'day_zero_failed')`,
      );
    } else if (outreachStatus === "active") {
      where.push(
        `outreach_status IN ('draft', 'queued', 'sending', 'day_zero_failed')`,
      );
    } else if (outreachStatus !== "all" && OUTREACH_STATUSES.has(outreachStatus)) {
      params.push(outreachStatus);
      where.push(`outreach_status = $${params.length}`);
    }

    if (isTruthy(searchParams.get("local"))) {
      where.push("(state = 'FL' AND city IN ('Gainesville', 'Tallahassee'))");
    }

    const wantsNoWebsite = isTruthy(searchParams.get("noWebsite"));
    const wantsPoorWebsite = isTruthy(searchParams.get("poorWebsite"));
    const wantsWebsiteIssue = isTruthy(searchParams.get("websiteIssue"));
    if (wantsWebsiteIssue || (wantsNoWebsite && wantsPoorWebsite)) {
      where.push("((website IS NULL OR website = '' OR website_status = 'no_website') OR website_status = 'poor_website')");
    } else if (wantsNoWebsite) {
      where.push("(website IS NULL OR website = '' OR website_status = 'no_website')");
    } else if (wantsPoorWebsite) {
      where.push("website_status = 'poor_website'");
    }

    const q = searchParams.get("q")?.trim();
    if (q) {
      params.push(`%${q}%`);
      where.push(`concat_ws(' ', business_name, decision_maker_name, decision_maker_title, phone, email, city, niche) ILIKE $${params.length}`);
    }

    const limit = Math.min(Math.max(Number(searchParams.get("limit") || "100"), 1), 500);
    params.push(limit);

    // Cold Email inbox completeness — Codex review #15. When the caller is
    // explicitly viewing an outreach slice, sort outreach-active rows first
    // so a queued/draft row can't get pushed off the end by high-score
    // archived rows. Default ordering (score DESC) stays for the CRM.
    const outreachActive = outreachStatus !== "all";
    const orderBy = outreachActive
      ? `ORDER BY
          CASE WHEN outreach_status IN ('draft', 'queued', 'sending', 'day_zero_failed') THEN 0
               WHEN outreach_status = 'day_zero_sent' THEN 1
               ELSE 2 END,
          COALESCE(outreach_scheduled_for, email_sent_at, outreach_queued_at) DESC NULLS LAST,
          score DESC,
          business_name ASC`
      : `ORDER BY score DESC, delivered_at DESC, business_name ASC`;

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const leads = await sql.query(
      `SELECT
        id, business_key, business_name, normalized_name, niche, city, state,
        phone, email, website, website_status, source_name, source_record_id,
        decision_maker_name, decision_maker_title, decision_maker_confidence,
        score, score_reasons, score_blockers, pitch, is_local_market,
        tier, signal_count,
        status, notes, last_contacted_at, next_follow_up_date,
        archived_at, archive_reason,
        place_id, demo_slug, demo_url, demo_direction, demo_quality_score, demo_built_at,
        outreach_status, outreach_step, email_subject, email_body_preview,
        outreach_queued_at, outreach_scheduled_for, email_sent_at,
        last_resend_email_id, outreach_error, enrichment_data,
        email_provenance, email_status,
        email_open_count, email_first_opened_at, email_last_opened_at,
        email_click_count, email_first_clicked_at, email_last_clicked_at,
        email_bounced_at, email_complained_at, email_replied_at, email_unsubscribed_at,
        first_seen_at, last_seen_at, delivered_at, created_at, updated_at
       FROM latchly_leads
       ${whereSql}
       ${orderBy}
       LIMIT $${params.length}`,
      params,
    );

    const summaryRows = includeArchived
      ? await sql`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'new')::int AS new_count,
            COUNT(*) FILTER (WHERE status = 'contacted')::int AS contacted_count,
            COUNT(*) FILTER (WHERE status IN ('contacted', 'interested', 'follow_up'))::int AS active_count,
            COUNT(*) FILTER (WHERE status = 'won')::int AS won_count,
            COUNT(*) FILTER (WHERE status = 'lost')::int AS lost_count,
            COUNT(*) FILTER (WHERE tier = 'premium')::int AS premium_count,
            COUNT(*) FILTER (WHERE tier = 'standard')::int AS standard_count,
            COUNT(*) FILTER (WHERE score >= 9)::int AS high_score_count,
            COUNT(*) FILTER (WHERE state = 'FL' AND city IN ('Gainesville', 'Tallahassee'))::int AS local_count,
            COUNT(*) FILTER (WHERE website IS NULL OR website = '' OR website_status = 'no_website')::int AS no_website_count,
            COUNT(*) FILTER (WHERE website_status = 'poor_website')::int AS poor_website_count,
            COUNT(*) FILTER (
              WHERE next_follow_up_date IS NOT NULL
              AND next_follow_up_date <= CURRENT_DATE
              AND status NOT IN ('not_fit', 'won', 'lost')
            )::int AS due_follow_up_count,
            COUNT(*) FILTER (WHERE outreach_status = 'draft')::int AS outreach_draft,
            COUNT(*) FILTER (WHERE outreach_status = 'queued')::int AS outreach_queued,
            COUNT(*) FILTER (WHERE outreach_status = 'sending')::int AS outreach_sending,
            COUNT(*) FILTER (WHERE outreach_status = 'day_zero_sent')::int AS outreach_sent,
            COUNT(*) FILTER (WHERE outreach_status = 'day_zero_sent' AND email_sent_at >= date_trunc('day', NOW()))::int AS outreach_sent_today,
            COUNT(*) FILTER (WHERE outreach_status = 'day_zero_failed')::int AS outreach_failed,
            COUNT(*) FILTER (WHERE outreach_status = 'rejected')::int AS outreach_rejected,
            COUNT(*) FILTER (WHERE outreach_status = 'unsubscribed')::int AS outreach_unsubscribed,
            COUNT(*) FILTER (WHERE email IS NOT NULL AND email <> '' AND email_status <> 'rejected')::int AS with_email,
            COUNT(*) FILTER (WHERE decision_maker_name IS NOT NULL AND decision_maker_name <> '')::int AS with_owner,
            ROUND(AVG(score)::numeric, 1) AS avg_score
          FROM latchly_leads`
      : await sql`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'new')::int AS new_count,
            COUNT(*) FILTER (WHERE status = 'contacted')::int AS contacted_count,
            COUNT(*) FILTER (WHERE status IN ('contacted', 'interested', 'follow_up'))::int AS active_count,
            COUNT(*) FILTER (WHERE status = 'won')::int AS won_count,
            COUNT(*) FILTER (WHERE status = 'lost')::int AS lost_count,
            COUNT(*) FILTER (WHERE tier = 'premium')::int AS premium_count,
            COUNT(*) FILTER (WHERE tier = 'standard')::int AS standard_count,
            COUNT(*) FILTER (WHERE score >= 9)::int AS high_score_count,
            COUNT(*) FILTER (WHERE state = 'FL' AND city IN ('Gainesville', 'Tallahassee'))::int AS local_count,
            COUNT(*) FILTER (WHERE website IS NULL OR website = '' OR website_status = 'no_website')::int AS no_website_count,
            COUNT(*) FILTER (WHERE website_status = 'poor_website')::int AS poor_website_count,
            COUNT(*) FILTER (
              WHERE next_follow_up_date IS NOT NULL
              AND next_follow_up_date <= CURRENT_DATE
              AND status NOT IN ('not_fit', 'won', 'lost')
            )::int AS due_follow_up_count,
            COUNT(*) FILTER (WHERE outreach_status = 'draft')::int AS outreach_draft,
            COUNT(*) FILTER (WHERE outreach_status = 'queued')::int AS outreach_queued,
            COUNT(*) FILTER (WHERE outreach_status = 'sending')::int AS outreach_sending,
            COUNT(*) FILTER (WHERE outreach_status = 'day_zero_sent')::int AS outreach_sent,
            COUNT(*) FILTER (WHERE outreach_status = 'day_zero_sent' AND email_sent_at >= date_trunc('day', NOW()))::int AS outreach_sent_today,
            COUNT(*) FILTER (WHERE outreach_status = 'day_zero_failed')::int AS outreach_failed,
            COUNT(*) FILTER (WHERE outreach_status = 'rejected')::int AS outreach_rejected,
            COUNT(*) FILTER (WHERE outreach_status = 'unsubscribed')::int AS outreach_unsubscribed,
            COUNT(*) FILTER (WHERE email IS NOT NULL AND email <> '' AND email_status <> 'rejected')::int AS with_email,
            COUNT(*) FILTER (WHERE decision_maker_name IS NOT NULL AND decision_maker_name <> '')::int AS with_owner,
            ROUND(AVG(score)::numeric, 1) AS avg_score
          FROM latchly_leads
          WHERE archived_at IS NULL`;
    const summary = summaryRows[0] || {};

    const statusCounts = includeArchived
      ? await sql`
          SELECT status, COUNT(*)::int AS count
          FROM latchly_leads
          GROUP BY status
          ORDER BY status`
      : await sql`
          SELECT status, COUNT(*)::int AS count
          FROM latchly_leads
          WHERE archived_at IS NULL
          GROUP BY status
          ORDER BY status`;

    const cities = includeArchived
      ? await sql`
          SELECT city, COUNT(*)::int AS count
          FROM latchly_leads
          WHERE city IS NOT NULL AND city <> ''
          GROUP BY city
          ORDER BY city`
      : await sql`
          SELECT city, COUNT(*)::int AS count
          FROM latchly_leads
          WHERE archived_at IS NULL AND city IS NOT NULL AND city <> ''
          GROUP BY city
          ORDER BY city`;

    const niches = includeArchived
      ? await sql`
          SELECT niche, COUNT(*)::int AS count
          FROM latchly_leads
          WHERE niche IS NOT NULL AND niche <> ''
          GROUP BY niche
          ORDER BY niche`
      : await sql`
          SELECT niche, COUNT(*)::int AS count
          FROM latchly_leads
          WHERE archived_at IS NULL AND niche IS NOT NULL AND niche <> ''
          GROUP BY niche
          ORDER BY niche`;

    const latestRunRows = await sql`
      SELECT
        id, run_date, target_count, minimum_count, candidate_count, audited_count,
        qualified_count, delivered_count, local_count, rejected_count,
        rejection_stats, under_target_reason, resend_email_id, email_sent,
        dry_run, metadata, created_at
      FROM latchly_lead_runs
      ORDER BY created_at DESC
      LIMIT 1`;
    const latestRun = latestRunRows[0];

    return jsonResponse({
      leads: leads.map(mapLead),
      stats: {
        total: Number(summary?.total || 0),
        new: Number(summary?.new_count || 0),
        contacted: Number(summary?.contacted_count || 0),
        active: Number(summary?.active_count || 0),
        won: Number(summary?.won_count || 0),
        lost: Number(summary?.lost_count || 0),
        premium: Number(summary?.premium_count || 0),
        standard: Number(summary?.standard_count || 0),
        highScore: Number(summary?.high_score_count || 0),
        local: Number(summary?.local_count || 0),
        noWebsite: Number(summary?.no_website_count || 0),
        poorWebsite: Number(summary?.poor_website_count || 0),
        dueFollowUp: Number(summary?.due_follow_up_count || 0),
        avgScore: summary?.avg_score == null ? null : Number(summary.avg_score),
        withEmail: Number(summary?.with_email || 0),
        withOwner: Number(summary?.with_owner || 0),
        outreach: {
          draft: Number(summary?.outreach_draft || 0),
          queued: Number(summary?.outreach_queued || 0),
          sending: Number(summary?.outreach_sending || 0),
          sent: Number(summary?.outreach_sent || 0),
          sentToday: Number(summary?.outreach_sent_today || 0),
          failed: Number(summary?.outreach_failed || 0),
          rejected: Number(summary?.outreach_rejected || 0),
          unsubscribed: Number(summary?.outreach_unsubscribed || 0),
          // Codex review #16: surface the actual warmup cap (was hardcoded 50
          // on the client). Mirrors the math in the cron drain so the UI bar
          // shows real capacity, not a fiction.
          dailyCap: getOutreachDailyCap(),
        },
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
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

async function runDiagnostics(url: string) {
  try {
    const sql = neon(url);
    const [meta] = await sql`SELECT current_database() AS db, current_user AS user, now() AS db_now`;
    const [counts] = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM latchly_leads) AS leads_total,
        (SELECT COUNT(*)::int FROM latchly_leads WHERE archived_at IS NULL) AS leads_active,
        (SELECT COUNT(*)::int FROM latchly_lead_runs) AS runs_total,
        (SELECT COUNT(*)::int FROM latchly_lead_activities) AS activities_total`;
    const recentRuns = await sql`
      SELECT id, run_date, dry_run, delivered_count, rejected_count, email_sent, created_at
      FROM latchly_lead_runs
      ORDER BY id DESC
      LIMIT 5`;
    return jsonResponse({
      ok: true,
      url_kind: process.env.DATABASE_URL_UNPOOLED
        ? "DATABASE_URL_UNPOOLED"
        : process.env.POSTGRES_URL_NON_POOLING
          ? "POSTGRES_URL_NON_POOLING"
          : "DATABASE_URL",
      meta,
      counts,
      recentRuns,
    });
  } catch (error: any) {
    return jsonResponse({ ok: false, error: error.message }, { status: 500 });
  }
}

function isTruthy(value: string | null) {
  return value === "1" || value === "true" || value === "yes";
}

// Mirrors the warmup math in app/api/cron/latchly-outreach/route.ts so the
// UI shows the real daily cap, not the hardcoded 50 the cold-email page
// previously rendered.
function getOutreachDailyCap(): number {
  const hardMax = parseInt(
    process.env.LATCHLY_OUTREACH_DAILY_MAX || process.env.MAX_EMAILS || "50",
    10,
  );
  const warmupStart = process.env.WARMUP_START;
  if (!warmupStart) return hardMax;
  const start = new Date(warmupStart);
  const daysSince = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (!Number.isFinite(daysSince) || daysSince < 0) return 0;
  if (daysSince < 7) return 5;
  if (daysSince < 14) return 10;
  if (daysSince < 21) return 20;
  return hardMax;
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
    tier: row.tier === "premium" ? "premium" : "standard",
    signalCount: row.signal_count == null ? 0 : Number(row.signal_count),
    status: row.status,
    notes: row.notes || "",
    lastContactedAt: row.last_contacted_at,
    nextFollowUpDate: row.next_follow_up_date,
    archivedAt: row.archived_at,
    archiveReason: row.archive_reason || "",
    placeId: row.place_id || null,
    demoSlug: row.demo_slug || null,
    demoUrl: row.demo_url || null,
    demoDirection: row.demo_direction || null,
    demoQualityScore: row.demo_quality_score == null ? null : Number(row.demo_quality_score),
    demoBuiltAt: row.demo_built_at || null,
    outreachStatus: row.outreach_status || "none",
    outreachStep: row.outreach_step == null ? 0 : Number(row.outreach_step),
    emailSubject: row.email_subject || null,
    emailBodyPreview: row.email_body_preview || null,
    outreachQueuedAt: row.outreach_queued_at || null,
    outreachScheduledFor: row.outreach_scheduled_for || null,
    emailSentAt: row.email_sent_at || null,
    lastResendEmailId: row.last_resend_email_id || null,
    outreachError: row.outreach_error || null,
    emailProvenance: row.email_provenance || null,
    emailStatus: row.email_status || "unknown",
    emailOpenCount: row.email_open_count == null ? 0 : Number(row.email_open_count),
    emailFirstOpenedAt: row.email_first_opened_at || null,
    emailLastOpenedAt: row.email_last_opened_at || null,
    emailClickCount: row.email_click_count == null ? 0 : Number(row.email_click_count),
    emailFirstClickedAt: row.email_first_clicked_at || null,
    emailLastClickedAt: row.email_last_clicked_at || null,
    emailBouncedAt: row.email_bounced_at || null,
    emailComplainedAt: row.email_complained_at || null,
    emailRepliedAt: row.email_replied_at || null,
    emailUnsubscribedAt: row.email_unsubscribed_at || null,
    enrichmentSummary: summarizeEnrichment(row.enrichment_data),
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function summarizeEnrichment(raw: any) {
  if (!raw) return null;
  let payload: any = raw;
  if (typeof raw === "string") {
    try { payload = JSON.parse(raw); } catch { return null; }
  }
  if (!payload || typeof payload !== "object") return null;
  return {
    ownerFirstName: payload.ownerFirstName || null,
    ownerName: payload.ownerName || null,
    yearsInBusiness: payload.yearsInBusiness || null,
    averageRating: payload.averageRating ?? null,
    reviewCount: payload.reviewCount ?? null,
    topReview: Array.isArray(payload.reviews) && payload.reviews[0]
      ? { author: payload.reviews[0].author, text: String(payload.reviews[0].text || "").slice(0, 240), rating: payload.reviews[0].rating }
      : null,
    bbbRating: payload.bbbAccreditation?.rating || null,
    servicesVerified: Array.isArray(payload.servicesVerified) ? payload.servicesVerified.slice(0, 6) : [],
  };
}

// GitHub Actions workflow caps at 90 min. Any pending row older than this
// will never resolve on its own — treat as failed so the dashboard unblocks.
const PENDING_TTL_MS = 2 * 60 * 60 * 1000;

function resolveRunStatus(rawStatus: any, createdAt: any) {
  const status = String(rawStatus || "").toLowerCase() || "completed";
  if (status !== "pending" && status !== "running") return status;
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) return status;
  return Date.now() - created.getTime() > PENDING_TTL_MS ? "failed" : status;
}

function mapRun(row: any) {
  const metadata = normalizeJsonObject(row.metadata);
  const status = resolveRunStatus(metadata.status, row.created_at);
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
    metadata,
    status,
    premiumDelivered: Number(metadata.premiumDelivered || 0),
    standardDelivered: Number(metadata.standardDelivered || 0),
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
