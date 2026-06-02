-- Migration 028: Package options for menu line items
-- package_options: JSONB blob containing alternative packages (name, price, items)
-- selected_package_id: which option the user chose (drives unit_price display in UI)

ALTER TABLE estimate_line_items
  ADD COLUMN IF NOT EXISTS package_options    JSONB,
  ADD COLUMN IF NOT EXISTS selected_package_id TEXT;
