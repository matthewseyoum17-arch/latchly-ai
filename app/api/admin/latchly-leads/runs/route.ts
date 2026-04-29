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
  if (!url) {
    return jsonResponse({ error: "DATABASE_URL is required" }, { status: 500 });
  }

  try {
    const sql = neon(url);
    const rows = await sql`
      SELECT
        id, run_date, target_count, minimum_count, candidate_count, audited_count,
        qualified_count, delivered_count, local_count, rejected_count,
        rejection_stats, under_target_reason, resend_email_id, email_sent,
        dry_run, metadata, created_at
      FROM latchly_lead_runs
      ORDER BY created_at DESC
      LIMIT 5`;
    return jsonResponse({ runs: rows.map(mapRun) });
  } catch (error: any) {
    console.error("Latchly lead runs fetch error:", error);
    return jsonResponse({ error: error.message }, { status: 500 });
  }
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
    githubRunId: metadata.githubRunId || null,
    createdAt: row.created_at,
  };
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
