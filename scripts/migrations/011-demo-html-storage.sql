ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS demo_html TEXT,
  ADD COLUMN IF NOT EXISTS demo_persisted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_prospects_demo_persisted_at
  ON prospects(demo_persisted_at);
