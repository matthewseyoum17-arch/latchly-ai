CREATE TABLE IF NOT EXISTS demo_leads (
  id SERIAL PRIMARY KEY,
  demo_slug TEXT NOT NULL,
  visitor_name TEXT NOT NULL,
  visitor_phone TEXT NOT NULL,
  visitor_email TEXT,
  rating INT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_demo_leads_slug ON demo_leads(demo_slug);
