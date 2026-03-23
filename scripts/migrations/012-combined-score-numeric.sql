ALTER TABLE prospects
  ALTER COLUMN combined_score TYPE NUMERIC(4,1)
  USING combined_score::NUMERIC(4,1);
