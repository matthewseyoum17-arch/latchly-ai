-- Backfills the columns that scripts/latchly-leads/storage.js creates at
-- runtime via ALTER TABLE ... ADD COLUMN IF NOT EXISTS. These never ran
-- against the Vercel-attached Neon DB because the Next.js API route
-- doesn't import storage.js, so /api/admin/latchly-leads SELECTs were
-- 500ing with "column place_id does not exist" until this ran.
--
-- Idempotent. Safe to re-apply.

ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS archive_reason TEXT;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS signal_count INT NOT NULL DEFAULT 0;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS enrichment_data JSONB;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS existing_site_clone JSONB;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS demo_slug TEXT;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS demo_url TEXT;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS demo_direction TEXT;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS demo_quality_score NUMERIC(4,1);
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS demo_built_at TIMESTAMP;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS outreach_step INT NOT NULL DEFAULT 0;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS outreach_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_subject TEXT;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_body TEXT;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_body_preview TEXT;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS outreach_queued_at TIMESTAMP;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS outreach_scheduled_for TIMESTAMP;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS last_resend_email_id TEXT;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS outreach_error TEXT;

CREATE INDEX IF NOT EXISTS idx_latchly_leads_outreach_status
  ON latchly_leads (outreach_status);
CREATE INDEX IF NOT EXISTS idx_latchly_leads_outreach_due
  ON latchly_leads (outreach_status, outreach_scheduled_for);
CREATE INDEX IF NOT EXISTS idx_latchly_leads_place_id
  ON latchly_leads (place_id) WHERE place_id IS NOT NULL;
