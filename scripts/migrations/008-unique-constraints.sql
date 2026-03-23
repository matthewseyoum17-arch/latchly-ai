-- Prevent duplicate prospects across pipeline runs
CREATE UNIQUE INDEX IF NOT EXISTS uq_prospects_email
  ON prospects (email) WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_prospects_biz_location
  ON prospects (business_name, city, state)
  WHERE business_name IS NOT NULL AND city IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_prospects_demo_slug
  ON prospects (demo_slug) WHERE demo_slug IS NOT NULL;
