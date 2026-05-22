-- Add client discount fields to estimates table
-- discount_type: 'percent' (stored as 0–1 decimal, e.g. 0.10 = 10%) or 'flat' (dollar amount)
-- discount_value: the numeric amount; 0 when no discount
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK (discount_type IN ('percent', 'flat')),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12,2) NOT NULL DEFAULT 0;
