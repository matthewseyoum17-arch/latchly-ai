import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { Webhook } from "svix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.scheduled": "scheduled",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "delivery_delayed",
  "email.delivery_error": "delivery_error",
  "email.failed": "failed",
  "email.suppressed": "unsubscribed",
  "email.unsubscribed": "unsubscribed",
};

function dbUrl() {
  return (
    process.env.DATABASE_URL_UNPOOLED
    || process.env.POSTGRES_URL_NON_POOLING
    || process.env.DATABASE_URL
    || ""
  );
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const devSkip =
    process.env.NODE_ENV === "development"
    && process.env.LATCHLY_WEBHOOK_INSECURE === "1";

  if (!secret && !devSkip) {
    return new Response("webhook_not_configured", { status: 503 });
  }

  const rawBody = await request.text();

  if (secret) {
    try {
      new Webhook(secret).verify(rawBody, {
        "svix-id": request.headers.get("svix-id") ?? "",
        "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
        "svix-signature": request.headers.get("svix-signature") ?? "",
      });
    } catch {
      return new Response("invalid_signature", { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid_json", { status: 400 });
  }

  const url = dbUrl();
  if (!url) return new Response("database_not_configured", { status: 503 });

  const data = payload?.data || {};
  const rawType = String(payload?.type || "unknown");
  const eventType = EVENT_MAP[rawType] || "other";
  const occurredAt = parseOccurredAt(data, payload);
  if (!occurredAt) return new Response("ok", { status: 200 });

  const resendEmailId = normalizeText(data.email_id || data.emailId || payload.email_id);
  const sql = neon(url);

  try {
    const leadId = await resolveLeadId(sql, data, resendEmailId);
    const inserted = await sql`
      INSERT INTO latchly_lead_engagement_events (
        lead_id, resend_email_id, event_type, occurred_at,
        ip, user_agent, link_url, raw
      )
      VALUES (
        ${leadId}, ${resendEmailId || null}, ${eventType}, ${occurredAt},
        ${extractIp(data)}, ${extractUserAgent(data)}, ${extractLinkUrl(data)},
        ${JSON.stringify(payload)}::jsonb
      )
      ON CONFLICT (resend_email_id, event_type, occurred_at)
      WHERE resend_email_id IS NOT NULL
      DO NOTHING
      RETURNING id
    `;

    if (inserted.length > 0 && leadId) {
      await updateLeadRollup(sql, leadId, eventType, occurredAt);
    }
  } catch (error) {
    console.error("[resend-webhook] processing error", error);
    return new Response("processing_error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

function parseOccurredAt(data: any, payload: any) {
  const value = data?.created_at || data?.createdAt || payload?.created_at || payload?.createdAt;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeText(value: any) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

async function resolveLeadId(sql: any, data: any, resendEmailId: string | null) {
  const taggedLeadId = extractLeadIdFromTags(data?.tags);
  if (taggedLeadId) return taggedLeadId;

  if (!resendEmailId) return null;
  const rows = await sql`
    SELECT id FROM latchly_leads
    WHERE last_resend_email_id = ${resendEmailId}
    ORDER BY email_sent_at DESC NULLS LAST
    LIMIT 1
  `;
  return rows[0]?.id ? Number(rows[0].id) : null;
}

function extractLeadIdFromTags(tags: any) {
  if (!tags) return null;

  if (Array.isArray(tags)) {
    const tag = tags.find((item) => item?.name === "lead_id");
    return parseLeadId(tag?.value);
  }

  if (typeof tags === "object") {
    return parseLeadId(tags.lead_id);
  }

  return null;
}

function parseLeadId(value: any) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function extractIp(data: any) {
  return normalizeText(data?.ip || data?.ipAddress || data?.click?.ipAddress);
}

function extractUserAgent(data: any) {
  return normalizeText(data?.user_agent || data?.userAgent || data?.click?.userAgent);
}

function extractLinkUrl(data: any) {
  return normalizeText(data?.link_url || data?.linkUrl || data?.link || data?.click?.link);
}

async function updateLeadRollup(sql: any, leadId: number, eventType: string, occurredAt: Date) {
  switch (eventType) {
    case "opened":
      await sql`
        UPDATE latchly_leads SET
          email_open_count = email_open_count + 1,
          email_first_opened_at = CASE
            WHEN email_first_opened_at IS NULL OR email_first_opened_at > ${occurredAt}
            THEN ${occurredAt}
            ELSE email_first_opened_at
          END,
          email_last_opened_at = CASE
            WHEN email_last_opened_at IS NULL OR email_last_opened_at < ${occurredAt}
            THEN ${occurredAt}
            ELSE email_last_opened_at
          END,
          updated_at = NOW()
        WHERE id = ${leadId}
      `;
      return;
    case "clicked":
      await sql`
        UPDATE latchly_leads SET
          email_click_count = email_click_count + 1,
          email_first_clicked_at = CASE
            WHEN email_first_clicked_at IS NULL OR email_first_clicked_at > ${occurredAt}
            THEN ${occurredAt}
            ELSE email_first_clicked_at
          END,
          email_last_clicked_at = CASE
            WHEN email_last_clicked_at IS NULL OR email_last_clicked_at < ${occurredAt}
            THEN ${occurredAt}
            ELSE email_last_clicked_at
          END,
          updated_at = NOW()
        WHERE id = ${leadId}
      `;
      return;
    case "bounced":
      await sql`
        UPDATE latchly_leads SET
          email_bounced_at = CASE
            WHEN email_bounced_at IS NULL OR email_bounced_at > ${occurredAt}
            THEN ${occurredAt}
            ELSE email_bounced_at
          END,
          updated_at = NOW()
        WHERE id = ${leadId}
      `;
      return;
    case "complained":
      await sql`
        UPDATE latchly_leads SET
          email_complained_at = CASE
            WHEN email_complained_at IS NULL OR email_complained_at > ${occurredAt}
            THEN ${occurredAt}
            ELSE email_complained_at
          END,
          updated_at = NOW()
        WHERE id = ${leadId}
      `;
      return;
    case "replied":
      await sql`
        UPDATE latchly_leads SET
          email_replied_at = CASE
            WHEN email_replied_at IS NULL OR email_replied_at > ${occurredAt}
            THEN ${occurredAt}
            ELSE email_replied_at
          END,
          updated_at = NOW()
        WHERE id = ${leadId}
      `;
      return;
    case "unsubscribed":
      await sql`
        UPDATE latchly_leads SET
          email_unsubscribed_at = CASE
            WHEN email_unsubscribed_at IS NULL OR email_unsubscribed_at > ${occurredAt}
            THEN ${occurredAt}
            ELSE email_unsubscribed_at
          END,
          updated_at = NOW()
        WHERE id = ${leadId}
      `;
      return;
    default:
      return;
  }
}
