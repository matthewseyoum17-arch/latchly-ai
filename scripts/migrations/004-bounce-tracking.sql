-- Add bounce tracking columns to prospects table
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS bounce_type TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMP;
