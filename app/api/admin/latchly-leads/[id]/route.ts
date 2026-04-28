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

const FIELD_MAP: Record<string, string> = {
  status: "status",
  notes: "notes",
  phone: "phone",
  email: "email",
  website: "website",
  decisionMakerName: "decision_maker_name",
  decisionMakerTitle: "decision_maker_title",
  lastContactedAt: "last_contacted_at",
  nextFollowUpDate: "next_follow_up_date",
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!verifyDashboardRequest(request)) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const url = dbUrl();
  if (!url) {
    return jsonResponse({ error: "DATABASE_URL is required" }, { status: 500 });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return jsonResponse({ error: "Invalid lead id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const sql = neon(url);
    const [existing] = await sql.query(
      "SELECT id, status, notes FROM latchly_leads WHERE id = $1",
      [id],
    );

    if (!existing) {
      return jsonResponse({ error: "Lead not found" }, { status: 404 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    const changedFields: Record<string, any> = {};

    for (const [apiField, column] of Object.entries(FIELD_MAP)) {
      if (!(apiField in body)) continue;
      let value = body[apiField];

      if (apiField === "status") {
        if (!STATUSES.has(value)) {
          return jsonResponse({ error: "Invalid status" }, { status: 400 });
        }
      } else if (apiField === "lastContactedAt" || apiField === "nextFollowUpDate") {
        value = normalizeNullableDate(value);
      } else {
        value = normalizeText(value);
      }

      values.push(value);
      updates.push(`${column} = $${values.length}`);
      changedFields[apiField] = value;
    }

    if (body.status === "contacted" && existing.status !== "contacted" && !("lastContactedAt" in body)) {
      updates.push("last_contacted_at = NOW()");
      changedFields.lastContactedAt = "now";
    }

    if (!updates.length) {
      return jsonResponse({ error: "No supported fields provided" }, { status: 400 });
    }

    values.push(id);
    const [updated] = await sql.query(
      `UPDATE latchly_leads
       SET ${updates.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING
        id, business_key, business_name, normalized_name, niche, city, state,
        phone, email, website, website_status, source_name, source_record_id,
        decision_maker_name, decision_maker_title, decision_maker_confidence,
        score, score_reasons, score_blockers, pitch, is_local_market,
        tier, signal_count,
        status, notes, last_contacted_at, next_follow_up_date,
        archived_at, archive_reason,
        first_seen_at, last_seen_at, delivered_at, created_at, updated_at`,
      values,
    );

    await insertActivity(sql, {
      leadId: id,
      previousStatus: existing.status,
      nextStatus: updated.status,
      previousNotes: existing.notes || "",
      nextNotes: updated.notes || "",
      changedFields,
    });

    return jsonResponse({ lead: mapLead(updated) });
  } catch (error: any) {
    console.error("Latchly lead update error:", error);
    return jsonResponse({ error: error.message }, { status: 500 });
  }
}

function normalizeText(value: any) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeNullableDate(value: any) {
  if (value == null || value === "") return null;
  return String(value);
}

async function insertActivity(sql: any, details: {
  leadId: number;
  previousStatus: string;
  nextStatus: string;
  previousNotes: string;
  nextNotes: string;
  changedFields: Record<string, any>;
}) {
  const statusChanged = details.previousStatus !== details.nextStatus;
  const notesChanged = details.previousNotes !== details.nextNotes;
  const activityType = statusChanged ? "status_change" : notesChanged ? "note_updated" : "lead_updated";

  await sql`
    INSERT INTO latchly_lead_activities (
      lead_id, activity_type, from_status, to_status, note, payload
    )
    VALUES (
      ${details.leadId}, ${activityType},
      ${statusChanged ? details.previousStatus : null},
      ${statusChanged ? details.nextStatus : null},
      ${notesChanged ? details.nextNotes : null},
      ${JSON.stringify({ changedFields: details.changedFields })}::jsonb
    )`;
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
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
