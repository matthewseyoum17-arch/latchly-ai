CREATE TABLE IF NOT EXISTS latchly_lead_engagement_events (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT REFERENCES latchly_leads(id) ON DELETE SET NULL,
  resend_email_id TEXT,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  ip TEXT,
  user_agent TEXT,
  link_url TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS latchly_engagement_dedup_idx
  ON latchly_lead_engagement_events(resend_email_id, event_type, occurred_at)
  WHERE resend_email_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS latchly_engagement_lead_idx
  ON latchly_lead_engagement_events(lead_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS latchly_engagement_type_time_idx
  ON latchly_lead_engagement_events(event_type, occurred_at DESC);

ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_open_count INT NOT NULL DEFAULT 0;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_first_opened_at TIMESTAMPTZ;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_last_opened_at TIMESTAMPTZ;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_click_count INT NOT NULL DEFAULT 0;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_first_clicked_at TIMESTAMPTZ;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_last_clicked_at TIMESTAMPTZ;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_bounced_at TIMESTAMPTZ;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_complained_at TIMESTAMPTZ;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_replied_at TIMESTAMPTZ;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_unsubscribed_at TIMESTAMPTZ;
