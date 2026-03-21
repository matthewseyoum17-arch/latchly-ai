-- OpenClaw prospects table
CREATE TABLE IF NOT EXISTS prospects (
  id SERIAL PRIMARY KEY,
  business_name TEXT NOT NULL,
  website TEXT,
  phone TEXT,
  email TEXT,
  owner_name TEXT,
  niche TEXT,
  city TEXT,
  state TEXT,
  lead_type TEXT,              -- package / chatbot_only / redesign_only
  chatbot_score INT,
  redesign_score INT,
  combined_score INT,
  report_card JSONB,
  demo_url TEXT,
  demo_slug TEXT,
  status TEXT DEFAULT 'scouted',
  outreach_step INT DEFAULT 0,
  last_outreach_at TIMESTAMP,
  closer_responses INT DEFAULT 0,
  escalated BOOLEAN DEFAULT FALSE,
  unsubscribed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_slug ON prospects(demo_slug);
CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(email);
CREATE INDEX IF NOT EXISTS idx_prospects_unsubscribed ON prospects(unsubscribed);
