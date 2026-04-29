import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyDashboardRequest } from '@/lib/auth';

// Reject a draft outreach: flips outreach_status='draft' → 'rejected'.
// The drain cron skips this status. The CRM still shows the email so we
// can learn from what got pulled. Optional body { reason } stored to
// outreach_error for accountability.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RejectBody {
  reason?: string;
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

  let body: RejectBody = {};
  try {
    body = (await request.json().catch(() => ({}))) as RejectBody;
  } catch {}

  const reason = String(body.reason || 'rejected_in_qa').slice(0, 500);
  const sql = neon(dbUrl);

  const rows = (await sql`
    UPDATE latchly_leads SET
      outreach_status = 'rejected',
      outreach_error = ${reason},
      updated_at = NOW()
    WHERE id = ${leadId}
      AND outreach_status = 'draft'
    RETURNING id, business_key
  `) as Array<{ id: number; business_key: string }>;

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
    reason,
  });
}
