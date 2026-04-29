import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { Resend } from 'resend';
import { verifyDashboardRequest } from '@/lib/auth';

// Manual override: send a queued lead's Day-0 email immediately, bypassing
// outreach_scheduled_for. Used from the CRM "Send now" button for live testing
// or when an owner-operator says "go".

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface QueuedRow {
  id: number;
  business_key: string;
  business_name: string;
  email: string;
  email_subject: string;
  email_body: string;
  demo_url: string | null;
  outreach_status: string;
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

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: 'no_resend_key' }, { status: 500 });

  const sql = neon(dbUrl);
  const resend = new Resend(resendKey);
  const fromEmail = process.env.OUTREACH_FROM || 'Matthew @ Latchly <matt@latchlyai.com>';
  const replyTo = process.env.OUTREACH_REPLY_TO || 'matt@latchlyai.com';

  // Atomic claim: flip eligible row to 'sending' in one UPDATE...RETURNING.
  // The CAS WHERE clause excludes already-sent/sending/unsubscribed rows so
  // a stuck-in-sending row, a concurrent cron tick, or a double-clicked Send
  // Now button cannot all send the same email.
  const rows = (await sql`
    UPDATE latchly_leads SET
      outreach_status = 'sending',
      updated_at = NOW()
    WHERE id = ${leadId}
      AND outreach_status NOT IN ('day_zero_sent', 'sending', 'unsubscribed')
      AND email IS NOT NULL AND email <> ''
      AND email_subject IS NOT NULL AND email_subject <> ''
      AND email_body IS NOT NULL AND email_body <> ''
      AND demo_url IS NOT NULL AND demo_url <> ''
    RETURNING id, business_key, business_name, email,
              email_subject, email_body, demo_url, outreach_status
  `) as QueuedRow[];
  const row = rows[0];

  if (!row) {
    // Determine why the claim failed for a useful response.
    const probe = (await sql`
      SELECT outreach_status, email, email_subject, email_body, demo_url
      FROM latchly_leads WHERE id = ${leadId} LIMIT 1
    `) as QueuedRow[];
    const r = probe[0];
    if (!r) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (r.outreach_status === 'day_zero_sent') return NextResponse.json({ error: 'already_sent' }, { status: 409 });
    if (r.outreach_status === 'sending') return NextResponse.json({ error: 'sending_in_flight' }, { status: 409 });
    if (r.outreach_status === 'unsubscribed') return NextResponse.json({ error: 'unsubscribed' }, { status: 409 });
    if (!r.email) return NextResponse.json({ error: 'no_email' }, { status: 400 });
    if (!r.email_subject || !r.email_body) return NextResponse.json({ error: 'no_composed_email' }, { status: 400 });
    if (!r.demo_url) return NextResponse.json({ error: 'no_demo' }, { status: 400 });
    return NextResponse.json({ error: 'claim_failed' }, { status: 409 });
  }

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      replyTo,
      to: row.email,
      subject: row.email_subject,
      text: row.email_body,
      headers: { 'X-Latchly-Source': 'latchly-send-now' },
    });

    if ('error' in result && result.error) {
      const message = (result.error as { message?: string })?.message || 'resend_error';
      throw new Error(message);
    }
    const emailId = (result as { data?: { id?: string } })?.data?.id || null;

    await sql`
      UPDATE latchly_leads SET
        outreach_status = 'day_zero_sent',
        outreach_step = 1,
        email_sent_at = NOW(),
        last_resend_email_id = COALESCE(${emailId}, last_resend_email_id),
        outreach_error = NULL,
        updated_at = NOW()
      WHERE id = ${leadId}
        AND outreach_status = 'sending'
    `;

    return NextResponse.json({ ok: true, emailId, businessKey: row.business_key });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sql`
      UPDATE latchly_leads SET
        outreach_status = 'day_zero_failed',
        outreach_error = ${message},
        updated_at = NOW()
      WHERE id = ${leadId}
        AND outreach_status = 'sending'
    `;
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
