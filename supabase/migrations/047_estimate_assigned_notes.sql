-- Migration 047: Estimate-level assignee + internal notes.
--
-- Gives the team a proper, INTERNAL-ONLY place for the working notes and status
-- markers they had been cramming into the estimate NAME (e.g. "Fado Irish Pub - DR
-- (upcharge at 40%)", "Two Urban Licks - DONE AQS"), which then leaked into the
-- client-facing deck/proposal. These two columns are never added to DeckContract
-- or ProposalDocument — they cannot reach a client document by design.
--
-- The 5 tool users (Abbie Blair, Danielle Rose, Khloe Parker, Lindsey Correa,
-- Alex Stack) already exist in team_members (migration 019); no re-seed needed.

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS assigned_to   INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_estimates_assigned_to ON estimates(assigned_to);
