-- Add idempotency tracking for outreach emails
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_resend_email_id TEXT;

-- Add idempotency tracking for closer (prevents duplicate auto-replies)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_closer_msg_id TEXT;

-- Track which demo variant was shown (personalized vs generic)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS demo_variant TEXT;
