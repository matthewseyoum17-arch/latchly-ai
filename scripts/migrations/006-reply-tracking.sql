-- Track when a prospect first replied (used to stop drip sequence)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP;

-- Index for outreach query performance (finds eligible leads faster)
CREATE INDEX IF NOT EXISTS idx_prospects_outreach_eligible
  ON prospects (status, outreach_step, unsubscribed, bounce_type)
  WHERE outreach_step < 3
    AND unsubscribed = FALSE
    AND bounce_type IS NULL;

-- Index for closer email lookup
CREATE INDEX IF NOT EXISTS idx_prospects_email
  ON prospects (email)
  WHERE email IS NOT NULL;
