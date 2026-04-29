import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { Resend } from 'resend';

// Drains the latchly_leads outreach queue. Runs every 15 min from 10:00 UTC
// to 17:00 UTC (covers 7-9am ET → PT). Each tick:
//   1. Computes daily warmup cap and sends-so-far
//   2. SELECTs rows with outreach_status='queued' AND outreach_scheduled_for<=NOW()
//   3. Sends each via Resend; flips queued → day_zero_sent / day_zero_failed
//   4. Per-row try/catch isolates failures

const TICK_CAP = parseInt(process.env.LATCHLY_OUTREACH_TICK_CAP || '8', 10);

function getWarmupCap(): number {
  const hardMax = parseInt(process.env.LATCHLY_OUTREACH_DAILY_MAX || process.env.MAX_EMAILS || '50', 10);
  const warmupStart = process.env.WARMUP_START;
  if (!warmupStart) return hardMax;
  const start = new Date(warmupStart);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince < 0) return 0;
  if (daysSince < 7) return 5;
  if (daysSince < 14) return 10;
  if (daysSince < 21) return 20;
  return hardMax;
}

interface QueuedRow {
  id: number;
  business_key: string;
  business_name: string;
  city: string | null;
  state: string | null;
  email: string;
  email_subject: string;
  email_body: string;
  demo_url: string | null;
  outreach_scheduled_for: string;
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
  if (!dbUrl) return NextResponse.json({ error: 'no_database_url' }, { status: 500 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: 'no_resend_key' }, { status: 500 });

  const sql = neon(dbUrl);
  const resend = new Resend(resendKey);
  const fromEmail = process.env.OUTREACH_FROM || 'Matthew @ Latchly <matt@latchlyai.com>';
  const replyTo = process.env.OUTREACH_REPLY_TO || 'matt@latchlyai.com';

  const dailyCap = getWarmupCap();
  if (dailyCap === 0) {
    return NextResponse.json({ ticked: 0, reason: 'warmup_not_started' });
  }

  const sentTodayResult = await sql`
    SELECT COUNT(*)::int AS n FROM latchly_leads
    WHERE outreach_status = 'day_zero_sent'
      AND email_sent_at >= date_trunc('day', NOW())
  `;
  const sentToday = sentTodayResult[0]?.n || 0;
  const remainingDaily = Math.max(0, dailyCap - sentToday);
  const tickCap = Math.min(remainingDaily, TICK_CAP);
  if (tickCap === 0) {
    return NextResponse.json({ ticked: 0, reason: 'warmup_cap_reached', sentToday, dailyCap });
  }

  const due = (await sql`
    SELECT id, business_key, business_name, city, state, email,
           email_subject, email_body, demo_url, outreach_scheduled_for
    FROM latchly_leads
    WHERE outreach_status = 'queued'
      AND outreach_scheduled_for IS NOT NULL
      AND outreach_scheduled_for <= NOW()
      AND email IS NOT NULL AND email <> ''
      AND demo_url IS NOT NULL AND demo_url <> ''
    ORDER BY outreach_scheduled_for ASC
    LIMIT ${tickCap}
  `) as QueuedRow[];

  if (!due.length) {
    return NextResponse.json({ ticked: 0, reason: 'no_due_rows', sentToday, dailyCap });
  }

  const sent: { businessKey: string; emailId: string | null }[] = [];
  const failed: { businessKey: string; error: string }[] = [];

  for (const row of due) {
    try {
      const result = await resend.emails.send({
        from: fromEmail,
        replyTo,
        to: row.email,
        subject: row.email_subject,
        text: row.email_body,
        headers: { 'X-Latchly-Source': 'latchly-outreach-cron' },
      });

      if ('error' in result && result.error) {
        const message = (result.error as { message?: string })?.message || 'resend_error';
        // 429 → backoff once and retry
        if (/429|rate/i.test(message)) {
          await new Promise(r => setTimeout(r, 2000));
          const retry = await resend.emails.send({
            from: fromEmail,
            replyTo,
            to: row.email,
            subject: row.email_subject,
            text: row.email_body,
          });
          if ('error' in retry && retry.error) {
            throw new Error((retry.error as { message?: string })?.message || 'resend_retry_error');
          }
          const retryId = retry?.data?.id || null;
          await sql`
            UPDATE latchly_leads SET
              outreach_status = 'day_zero_sent',
              outreach_step = 1,
              email_sent_at = NOW(),
              last_resend_email_id = COALESCE(${retryId}, last_resend_email_id),
              outreach_error = NULL,
              updated_at = NOW()
            WHERE business_key = ${row.business_key}
          `;
          sent.push({ businessKey: row.business_key, emailId: retryId });
          continue;
        }
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
        WHERE business_key = ${row.business_key}
      `;
      sent.push({ businessKey: row.business_key, emailId });

      // Rate-limit 1.5s between sends
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        await sql`
          UPDATE latchly_leads SET
            outreach_status = 'day_zero_failed',
            outreach_error = ${message},
            updated_at = NOW()
          WHERE business_key = ${row.business_key}
        `;
      } catch {
        // swallow secondary failure
      }
      failed.push({ businessKey: row.business_key, error: message });
    }
  }

  return NextResponse.json({
    ticked: sent.length,
    failed: failed.length,
    sent,
    failures: failed,
    sentToday: sentToday + sent.length,
    dailyCap,
    tickCap,
  });
}

// markSent inlined at call sites to avoid neon-driver generic-typed sql param.
