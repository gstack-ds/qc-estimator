-- Add optional internal-tracking label to each line item
ALTER TABLE estimate_line_items ADD COLUMN IF NOT EXISTS label TEXT;
