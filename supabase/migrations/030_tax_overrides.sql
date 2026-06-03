-- QC Estimator — Migration 030
-- Per-estimate tax rate overrides

ALTER TABLE estimates
  ADD COLUMN food_tax_override    NUMERIC(6,4),
  ADD COLUMN alcohol_tax_override NUMERIC(6,4),
  ADD COLUMN general_tax_override NUMERIC(6,4);
