-- Track how each lead's email was sourced so the CRM can warn the operator
-- before sending to a pattern-guessed address. Codex review flagged that
-- shipping `pattern_guess_mx_only` emails into autonomous send risked
-- bounces + Resend warmup damage; this column lets the queue/UI gate on it.

ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_provenance TEXT;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'unknown';
-- email_status values:
--   'unknown'   default — never validated
--   'verified'  scraped from a real source (BBB, contact page, mailto:)
--   'guessed'   pattern_guess_mx_only — domain MX OK, mailbox unverified
--   'rejected'  operator manually cleared / suppressed; do not auto-refill
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'latchly_leads_email_status_check'
  ) THEN
    ALTER TABLE latchly_leads ADD CONSTRAINT latchly_leads_email_status_check
      CHECK (email_status IN ('unknown', 'verified', 'guessed', 'rejected'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_latchly_leads_email_status
  ON latchly_leads (email_status);
