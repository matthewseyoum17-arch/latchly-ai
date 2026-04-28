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

  const runId = await latestWorkflowRunId({ repo, workflow, token });
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

async function latestWorkflowRunId({ repo, workflow, token }: { repo: string; workflow: string; token: string }) {
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?event=workflow_dispatch&per_page=1`;
  try {
    const res = await fetch(url, { headers: githubHeaders(token) });
    if (!res.ok) return null;
    const json = await res.json();
    return json.workflow_runs?.[0]?.id ?? null;
  } catch {
    return null;
  }
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
