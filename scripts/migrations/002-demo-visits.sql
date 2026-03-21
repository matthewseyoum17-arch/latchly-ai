-- Demo visit tracking table
CREATE TABLE IF NOT EXISTS demo_visits (
  id SERIAL PRIMARY KEY,
  demo_slug TEXT NOT NULL,
  visited_at TIMESTAMP DEFAULT NOW(),
  ip TEXT,
  user_agent TEXT,
  referrer TEXT
);
CREATE INDEX IF NOT EXISTS idx_demo_visits_slug ON demo_visits(demo_slug);
CREATE INDEX IF NOT EXISTS idx_demo_visits_time ON demo_visits(visited_at);
