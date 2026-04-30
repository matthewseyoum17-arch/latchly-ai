-- Purge all pattern-guessed emails and broaden the email_status enum.
--
-- Pattern-guessing is permanently disabled (see scripts/latchly-leads/finders/
-- which replaced the old MX-only permutation guesser). Two things happen here:
--
--   1. Any historical row with email_status='guessed' has its email cleared
--      and the row marked 'rejected' so the auto-enrich path never refills
--      it. We tag email_provenance='guess_purged' so audit logs can show why.
--
--   2. The email_status CHECK constraint is rewritten to allow the new
--      'not_available' value (set when verified-source chain returned
--      nothing) and to reject 'guessed' going forward.
--
-- Idempotent: safe to run more than once.

BEGIN;

-- 1. Clear any historical guessed addresses.
UPDATE latchly_leads
SET
  email = NULL,
  email_provenance = 'guess_purged',
  email_status = 'rejected',
  updated_at = NOW()
WHERE email_status = 'guessed';

-- 2. Drop the old CHECK constraint and add the new one.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'latchly_leads_email_status_check'
  ) THEN
    ALTER TABLE latchly_leads DROP CONSTRAINT latchly_leads_email_status_check;
  END IF;
END$$;

ALTER TABLE latchly_leads ADD CONSTRAINT latchly_leads_email_status_check
  CHECK (email_status IN ('unknown', 'verified', 'rejected', 'not_available'));

COMMIT;
