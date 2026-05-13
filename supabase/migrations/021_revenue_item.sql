-- Add revenue item flag to line items
-- When true, ourCost = 0 and clientCost = qty * unitPrice (no markup).
-- Used for QC-owned fees like Coordinator Fee where the full client charge is margin.
ALTER TABLE estimate_line_items
  ADD COLUMN IF NOT EXISTS is_revenue_item BOOLEAN NOT NULL DEFAULT FALSE;
