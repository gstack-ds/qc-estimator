-- Migration: 002_add_custom_price
-- Adds custom_client_unit_price to estimate_line_items for the "Custom" category escape hatch.
-- When set, the pricing engine uses this as the per-unit client price instead of applying markup.

ALTER TABLE estimate_line_items
  ADD COLUMN IF NOT EXISTS custom_client_unit_price NUMERIC(12,2);

-- Also add updated_at to team_hours_tiers (missed in 001)
ALTER TABLE team_hours_tiers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TRIGGER trg_team_hours_updated_at
  BEFORE UPDATE ON team_hours_tiers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
