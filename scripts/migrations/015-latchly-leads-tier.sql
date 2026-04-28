-- Latchly leads premium tier classification
-- Internal lead-quality grade: premium = score >= 9 AND >=3 verified signals
-- AND (no-website OR poor-website) AND decision_maker_confidence >= 0.6.
-- Standard = everything else that survives the existing quality gate.

ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS signal_count INT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'latchly_leads' AND constraint_name = 'latchly_leads_tier_check'
  ) THEN
    ALTER TABLE latchly_leads
      ADD CONSTRAINT latchly_leads_tier_check CHECK (tier IN ('premium', 'standard'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_latchly_leads_tier ON latchly_leads (tier);
CREATE INDEX IF NOT EXISTS idx_latchly_leads_tier_score ON latchly_leads (tier, score DESC);
