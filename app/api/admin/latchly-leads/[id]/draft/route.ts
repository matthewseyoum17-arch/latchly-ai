import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { verifyDashboardRequest } from "@/lib/auth";

// Edit a draft outreach in place. The Cold Email Pending tab uses this when
// the operator tweaks the subject or body before clicking Approve & Send.
// We constrain it to outreach_status='draft' so the cron drain or send-now
// never sees a half-edited row, and we refresh email_body_preview at the
// same time so the inbox row reflects the edit immediately.

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SaveDraftBody {
  subject?: string;
  body?: string;
  email?: string;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!verifyDashboardRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const leadId = Number(id);
  if (!Number.isFinite(leadId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const dbUrl =
    process.env.DATABASE_URL_UNPOOLED
    || process.env.POSTGRES_URL_NON_POOLING
    || process.env.DATABASE_URL;
  if (!dbUrl) return NextResponse.json({ error: "no_database_url" }, { status: 500 });

  let body: SaveDraftBody = {};
  try { body = (await request.json().catch(() => ({}))) as SaveDraftBody; } catch {}

  const subject = typeof body.subject === "string" ? body.subject.trim() : null;
  const emailBody = typeof body.body === "string" ? body.body : null;
  const newEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;

  if (subject == null && emailBody == null && newEmail == null) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }
  if (subject != null && (subject.length < 1 || subject.length > 200)) {
    return NextResponse.json({ error: "subject_length_out_of_range" }, { status: 400 });
  }
  if (emailBody != null && emailBody.length > 20000) {
    return NextResponse.json({ error: "body_too_long" }, { status: 400 });
  }

  const sql = neon(dbUrl);
  const preview = emailBody == null ? null : emailBody.slice(0, 400);
  const rows = (await sql`
    UPDATE latchly_leads SET
      email_subject = COALESCE(${subject}, email_subject),
      email_body = COALESCE(${emailBody}, email_body),
      email_body_preview = COALESCE(${preview}, email_body_preview),
      email = CASE
        WHEN ${newEmail}::text IS NULL THEN email
        WHEN ${newEmail} = '' THEN email
        ELSE ${newEmail}
      END,
      email_status = CASE
        WHEN ${newEmail}::text IS NULL OR ${newEmail} = '' THEN email_status
        ELSE 'verified'
      END,
      email_provenance = CASE
        WHEN ${newEmail}::text IS NULL OR ${newEmail} = '' THEN email_provenance
        ELSE 'operator_set'
      END,
      updated_at = NOW()
    WHERE id = ${leadId}
      AND outreach_status = 'draft'
    RETURNING id, business_key, email, email_subject, email_body_preview,
              email_status, email_provenance
  `) as Array<Record<string, any>>;

  if (!rows.length) {
    const probe = (await sql`
      SELECT outreach_status FROM latchly_leads WHERE id = ${leadId} LIMIT 1
    `) as Array<{ outreach_status: string }>;
    if (!probe.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(
      { error: "not_in_draft_state", currentStatus: probe[0].outreach_status },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, lead: rows[0] }, {
    headers: { "Cache-Control": "no-store" },
  });
}
