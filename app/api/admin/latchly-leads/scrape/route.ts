import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { verifyDashboardRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
};

const TIERS = new Set(["premium", "standard", "both"]);

function jsonResponse(body: any, init?: { status?: number }) {
  return NextResponse.json(body, { ...init, headers: NO_STORE_HEADERS });
}

function dbUrl() {
  return (
    process.env.DATABASE_URL_UNPOOLED
    || process.env.POSTGRES_URL_NON_POOLING
    || process.env.DATABASE_URL
    || ""
  );
}

export async function POST(request: NextRequest) {
  if (!verifyDashboardRequest(request)) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    return jsonResponse({ error: "GITHUB_DISPATCH_TOKEN and GITHUB_REPO are required" }, { status: 500 });
  }

  const body = await readBody(request);
  const tier = TIERS.has(body.tier) ? body.tier : "both";
  const target = normalizeTarget(body.target);
  const dryRun = Boolean(body.dry_run ?? body.dryRun ?? false);
  const ref = process.env.GITHUB_DISPATCH_REF || process.env.VERCEL_GIT_COMMIT_REF || "main";
  const workflow = process.env.GITHUB_LEADS_WORKFLOW || "latchly-leads-digest.yml";
  const dispatchedAt = new Date().toISOString();

  const dispatchUrl = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;
  const dispatch = await fetch(dispatchUrl, {
    method: "POST",
    headers: githubHeaders(token),
    body: JSON.stringify({
      ref,
      inputs: {
        tier,
        target: String(target),
        dry_run: String(dryRun),
      },
    }),
  });

  if (!dispatch.ok && dispatch.status !== 204) {
    const text = await dispatch.text().catch(() => "");
    return jsonResponse({ error: `GitHub dispatch failed (${dispatch.status}): ${text || dispatch.statusText}` }, { status: 502 });
  }

  const runId = await latestWorkflowRunId({ repo, workflow, token, dispatchedAt });
  const pendingRunId = await insertPendingRun({
    tier,
    target,
    dryRun,
    runId,
    dispatchedAt,
  });

  return jsonResponse({
    run_id: runId,
    pending_run_id: pendingRunId,
    dispatched_at: dispatchedAt,
  });
}

async function readBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function normalizeTarget(value: any) {
  const parsed = Number(value || 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(200, Math.max(1, Math.round(parsed)));
}

function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function latestWorkflowRunId({
  repo, workflow, token, dispatchedAt,
}: { repo: string; workflow: string; token: string; dispatchedAt: string }) {
  // GitHub doesn't always have the dispatched run queryable on the first call;
  // poll briefly and pick the newest run created at/after dispatch time so we
  // don't pin metadata to a stale prior run.
  const dispatchTs = Date.parse(dispatchedAt);
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?event=workflow_dispatch&per_page=5`;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
    try {
      const res = await fetch(url, { headers: githubHeaders(token) });
      if (!res.ok) continue;
      const json = await res.json();
      const runs = Array.isArray(json.workflow_runs) ? json.workflow_runs : [];
      const candidate = runs
        .map((r: any) => ({ id: r.id, ts: Date.parse(r.created_at || "") }))
        .filter((r: any) => Number.isFinite(r.ts) && r.ts >= dispatchTs - 5000)
        .sort((a: any, b: any) => b.ts - a.ts)[0];
      if (candidate?.id != null) return candidate.id;
    } catch {
      // retry
    }
  }
  return null;
}

async function insertPendingRun(details: {
  tier: string;
  target: number;
  dryRun: boolean;
  runId: number | null;
  dispatchedAt: string;
}) {
  const url = dbUrl();
  if (!url) return null;
  try {
    const sql = neon(url);
    const [row] = await sql`
      INSERT INTO latchly_lead_runs (
        target_count, minimum_count, dry_run, metadata
      )
      VALUES (
        ${details.target}, ${details.target}, ${details.dryRun},
        ${JSON.stringify({
          status: "pending",
          tierMode: details.tier,
          githubRunId: details.runId,
          dispatchedAt: details.dispatchedAt,
          manualDispatch: true,
        })}::jsonb
      )
      RETURNING id`;
    return row?.id ? Number(row.id) : null;
  } catch (error) {
    console.error("Unable to insert pending Latchly lead run:", error);
    return null;
  }
}
