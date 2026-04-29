import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyDashboardRequest } from '@/lib/auth';

// Approve a draft outreach: flips outreach_status='draft' → 'queued'.
// The drain cron picks up only 'queued' rows whose outreach_scheduled_for
// has arrived, so approval respects the per-lead 7-9am-local schedule.
//
// Optional body { scheduledFor: ISO } overrides the schedule (e.g. send
// today instead of tomorrow). Otherwise the original computed time stays.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ApproveBody {
  scheduledFor?: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!verifyDashboardRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const leadId = Number(id);
  if (!Number.isFinite(leadId)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const dbUrl =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL;
  if (!dbUrl) return NextResponse.json({ error: 'no_database_url' }, { status: 500 });

  let body: ApproveBody = {};
  try {
    body = (await request.json().catch(() => ({}))) as ApproveBody;
  } catch {}

  const sql = neon(dbUrl);

  const rows = (await sql`
    UPDATE latchly_leads SET
      outreach_status = 'queued',
      outreach_scheduled_for = COALESCE(${body.scheduledFor || null}::timestamp, outreach_scheduled_for),
      outreach_error = NULL,
      updated_at = NOW()
    WHERE id = ${leadId}
      AND outreach_status = 'draft'
      AND email IS NOT NULL AND email <> ''
      AND email_subject IS NOT NULL AND email_subject <> ''
      AND email_body IS NOT NULL AND email_body <> ''
    RETURNING id, business_key, outreach_status, outreach_scheduled_for
  `) as Array<{ id: number; business_key: string; outreach_status: string; outreach_scheduled_for: string | null }>;

  if (!rows.length) {
    const probe = (await sql`
      SELECT outreach_status FROM latchly_leads WHERE id = ${leadId} LIMIT 1
    `) as Array<{ outreach_status: string }>;
    const r = probe[0];
    if (!r) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(
      { error: 'not_in_draft_state', currentStatus: r.outreach_status },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    businessKey: rows[0].business_key,
    scheduledFor: rows[0].outreach_scheduled_for,
  });
}
