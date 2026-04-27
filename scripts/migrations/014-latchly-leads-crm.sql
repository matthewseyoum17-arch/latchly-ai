-- Latchly scored-leads CRM
CREATE TABLE IF NOT EXISTS latchly_leads (
  id SERIAL PRIMARY KEY,
  business_key TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  normalized_name TEXT,
  niche TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  website_status TEXT DEFAULT 'unknown',
  source_name TEXT,
  source_record_id TEXT,
  decision_maker_name TEXT,
  decision_maker_title TEXT,
  decision_maker_confidence NUMERIC(4,1),
  score NUMERIC(4,1) NOT NULL DEFAULT 0,
  score_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  score_blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  pitch JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_local_market BOOLEAN NOT NULL DEFAULT FALSE,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  audit_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT NOT NULL DEFAULT '',
  last_contacted_at TIMESTAMP,
  next_follow_up_date DATE,
  archived_at TIMESTAMP,
  archive_reason TEXT,
  first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT latchly_leads_status_check CHECK (
    status IN ('new', 'reviewed', 'contacted', 'interested', 'follow_up', 'not_fit', 'won', 'lost')
  )
);

ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS archive_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_latchly_leads_status ON latchly_leads (status);
CREATE INDEX IF NOT EXISTS idx_latchly_leads_score ON latchly_leads (score DESC);
CREATE INDEX IF NOT EXISTS idx_latchly_leads_delivered_at ON latchly_leads (delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_latchly_leads_local_market ON latchly_leads (is_local_market);
CREATE INDEX IF NOT EXISTS idx_latchly_leads_city ON latchly_leads (city);
CREATE INDEX IF NOT EXISTS idx_latchly_leads_niche ON latchly_leads (niche);
CREATE INDEX IF NOT EXISTS idx_latchly_leads_website_status ON latchly_leads (website_status);
CREATE INDEX IF NOT EXISTS idx_latchly_leads_archived_at ON latchly_leads (archived_at);
CREATE INDEX IF NOT EXISTS idx_latchly_leads_follow_up ON latchly_leads (next_follow_up_date)
  WHERE next_follow_up_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS latchly_lead_runs (
  id SERIAL PRIMARY KEY,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_count INT NOT NULL DEFAULT 50,
  minimum_count INT NOT NULL DEFAULT 40,
  candidate_count INT NOT NULL DEFAULT 0,
  audited_count INT NOT NULL DEFAULT 0,
  qualified_count INT NOT NULL DEFAULT 0,
  delivered_count INT NOT NULL DEFAULT 0,
  local_count INT NOT NULL DEFAULT 0,
  rejected_count INT NOT NULL DEFAULT 0,
  rejection_stats JSONB NOT NULL DEFAULT '[]'::jsonb,
  under_target_reason TEXT,
  resend_email_id TEXT,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_latchly_lead_runs_run_date ON latchly_lead_runs (run_date DESC);
CREATE INDEX IF NOT EXISTS idx_latchly_lead_runs_created_at ON latchly_lead_runs (created_at DESC);

CREATE TABLE IF NOT EXISTS latchly_lead_activities (
  id SERIAL PRIMARY KEY,
  lead_id INT NOT NULL REFERENCES latchly_leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_latchly_lead_activities_lead_id
  ON latchly_lead_activities (lead_id, created_at DESC);
