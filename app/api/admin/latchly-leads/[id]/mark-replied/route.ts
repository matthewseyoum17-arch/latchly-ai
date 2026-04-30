import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { verifyDashboardRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function dbUrl() {
  return (
    process.env.DATABASE_URL_UNPOOLED
    || process.env.POSTGRES_URL_NON_POOLING
    || process.env.DATABASE_URL
    || ""
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!verifyDashboardRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const url = dbUrl();
  if (!url) return NextResponse.json({ error: "DATABASE_URL is required" }, { status: 500 });

  try {
    const sql = neon(url);
    const [lead] = await sql`
      UPDATE latchly_leads SET
        email_replied_at = COALESCE(email_replied_at, NOW()),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, last_resend_email_id, email_replied_at
    `;

    if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const existing = await sql`
      SELECT id FROM latchly_lead_engagement_events
      WHERE lead_id = ${id}
        AND event_type = 'replied'
        AND raw->>'source' = 'manual_mark'
      LIMIT 1
    `;

    if (!existing.length) {
      await sql`
        INSERT INTO latchly_lead_engagement_events (
          lead_id, resend_email_id, event_type, occurred_at, raw
        )
        VALUES (
          ${id}, ${lead.last_resend_email_id || null}, 'replied',
          ${lead.email_replied_at}, ${JSON.stringify({ source: "manual_mark" })}::jsonb
        )
      `;
    }

    return NextResponse.json({ ok: true, repliedAt: lead.email_replied_at });
  } catch (error: any) {
    console.error("Latchly mark replied error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
