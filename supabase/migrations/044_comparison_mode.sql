-- Migration 044: comparison_mode on budget_plan_entries
-- Determines how event estimates are compared to their budget:
--   compare_each: each included estimate is independently vs the budget (default)
--   combine: all included estimates sum toward the budget

ALTER TABLE budget_plan_entries
  ADD COLUMN comparison_mode TEXT NOT NULL DEFAULT 'compare_each'
  CHECK (comparison_mode IN ('compare_each', 'combine'));
