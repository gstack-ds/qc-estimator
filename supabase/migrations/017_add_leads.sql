-- Phase 1a: Leads table for GDP lead pipeline
-- assigned_to is text (name) for Phase 1; will become a UUID FK to auth.users in Phase 2

CREATE TYPE lead_status AS ENUM ('new_lead', 'proposal', 'under_contract', 'archived');

CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Client / company
  client_name text,
  end_company text,
  contact_name text,
  contact_email text,
  contact_role text,
  third_party_company text,
  third_party_contact text,
  third_party_comm_notes text,

  -- Program details
  program_name text,
  program_type text,
  program_description text,
  start_date date,
  end_date date,
  rain_date date,
  num_nights integer,
  guest_count integer,

  -- Location
  city text,
  state text,
  hotel text,
  venue text,
  region text,

  -- Source & commission
  lead_source text,
  source_advisor text,
  source_coordinator text,
  source_commission numeric(6,4),
  third_party_commission numeric(6,4),
  commission_notes text,
  billing_notes text,
  returning_client boolean,
  special_instructions text,

  -- Assignment / routing (text name for Phase 1; UUID FK added in Phase 2)
  assigned_to text,
  suggested_owner text,

  -- Scanner metadata
  original_email_link text,
  parsed_by text,
  scan_batch_id text,
  organization_id uuid,

  -- Lifecycle
  status lead_status NOT NULL DEFAULT 'new_lead',

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

-- updated_at trigger (reuses existing function from migration 001)
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select" ON leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "leads_insert" ON leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "leads_update" ON leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "leads_delete" ON leads FOR DELETE TO authenticated USING (true);

-- Link programs back to their source lead
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL;
