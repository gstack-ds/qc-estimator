-- QC Estimator — Migration 029
-- Add lifecycle status to programs table

ALTER TABLE programs
  ADD COLUMN status      TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'did_not_book')),
  ADD COLUMN archived_at TIMESTAMPTZ;
