-- Pipeline run history (replaces local jsonl logging)
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id SERIAL PRIMARY KEY,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  agent TEXT NOT NULL,
  scouted INT DEFAULT 0,
  audited INT DEFAULT 0,
  demos_built INT DEFAULT 0,
  emails_sent INT DEFAULT 0,
  sco_dispatched INT DEFAULT 0,
  errors INT DEFAULT 0,
  duration_ms INT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_date ON pipeline_runs (run_date DESC);
