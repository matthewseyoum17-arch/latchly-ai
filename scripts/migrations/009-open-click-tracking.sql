-- Open and click tracking from Resend webhooks
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS open_count INT DEFAULT 0;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS click_count INT DEFAULT 0;
