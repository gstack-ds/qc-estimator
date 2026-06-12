-- Migration 046: event-level budget (amount + basis)
-- Adds a simple, direct budget to each event row.
-- 'overall' = total dollar amount; 'per_person' = per-guest dollar amount.

ALTER TABLE events
  ADD COLUMN budget_amount NUMERIC,
  ADD COLUMN budget_basis  TEXT CHECK (budget_basis IN ('overall', 'per_person'));
