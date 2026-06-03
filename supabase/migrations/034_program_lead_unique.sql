-- QC Estimator — Migration 034
-- Enforce one-program-per-lead.
-- Pre-checked: 0 leads have 2+ linked programs in production data.
-- A genuine re-book should be a new lead, not a second program off the same lead.

ALTER TABLE programs
  ADD CONSTRAINT programs_lead_id_unique UNIQUE (lead_id);
