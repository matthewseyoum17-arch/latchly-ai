CREATE TABLE IF NOT EXISTS demo_pages (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL,
  business_name TEXT,
  city TEXT,
  state TEXT,
  niche TEXT,
  family TEXT,
  source TEXT DEFAULT 'variation-engine',
  demo_url TEXT,
  html TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_demo_pages_slug ON demo_pages(slug);
CREATE INDEX IF NOT EXISTS idx_demo_pages_family ON demo_pages(family);
