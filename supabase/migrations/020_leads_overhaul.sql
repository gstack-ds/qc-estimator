-- 020_leads_overhaul.sql
-- Replaces lead_status enum with 12-value pipeline and adds tracking/commission columns

-- Step 1: rename old enum so we can reuse the name
ALTER TYPE lead_status RENAME TO lead_status_old;

-- Step 2: create new expanded enum
CREATE TYPE lead_status AS ENUM (
  'new_lead',
  'proposal_in_progress',
  'pending_client_review',
  'pending_contract_payment',
  'under_contract',
  'planning',
  'unresponsive',
  'post_event_close_out',
  'halted',
  'planning_not_started',
  'did_not_book',
  'completed'
);

-- Step 3: migrate column — map old values to nearest new equivalents
ALTER TABLE leads
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE lead_status USING (
    CASE status::text
      WHEN 'new_lead'       THEN 'new_lead'
      WHEN 'proposal'       THEN 'proposal_in_progress'
      WHEN 'under_contract' THEN 'under_contract'
      WHEN 'archived'       THEN 'did_not_book'
      ELSE 'new_lead'
    END
  )::lead_status,
  ALTER COLUMN status SET DEFAULT 'new_lead'::lead_status;

-- Step 4: drop old enum
DROP TYPE lead_status_old;

-- Step 5: add new tracking / assignment / commission columns
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS team_support        INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_last_followup  DATE,
  ADD COLUMN IF NOT EXISTS current_due_date    DATE,
  ADD COLUMN IF NOT EXISTS end_client          TEXT,
  ADD COLUMN IF NOT EXISTS client_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS gdp_commission      NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS extra_commission    NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS gdp_advisor         TEXT,
  ADD COLUMN IF NOT EXISTS gdp_coordinator     TEXT,
  ADD COLUMN IF NOT EXISTS third_party         TEXT,
  ADD COLUMN IF NOT EXISTS lead_source_type    TEXT,
  ADD COLUMN IF NOT EXISTS sales_coordinator   TEXT;
