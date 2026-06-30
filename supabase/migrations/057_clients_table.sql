-- Phase 1 of the leads↔programs normalize: a shared `clients` table + client_id references.
-- PURELY ADDITIVE — creates new structure and COPIES data in. Does NOT drop/modify any existing
-- column or value on leads or programs. The app still reads/writes the original columns; nothing
-- references client_id yet. This phase only stands up the table + FKs + migrated/deduped data.

-- ─── 1. clients table (client-level identity / contact / commission) ───────────
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT,
  company_name TEXT,
  end_client TEXT,
  -- Contacts — these are dropped entirely today (programs have no contact columns).
  contact_name TEXT,
  contact_email TEXT,
  contact_role TEXT,
  client_contact_name TEXT,
  -- Third party / partner
  third_party_company TEXT,
  third_party_contact TEXT,
  third_party TEXT,
  third_party_comm_notes TEXT,
  -- Commission (canonical: client_commission = lead.source_commission / program.client_commission;
  --  gdp_commission_rate = lead.third_party_commission / program.gdp_commission_rate)
  client_commission NUMERIC(6,4),
  gdp_commission_rate NUMERIC(6,4),
  gdp_commission NUMERIC(6,4),
  extra_commission NUMERIC(6,4),
  commission_notes TEXT,
  billing_notes TEXT,
  returning_client BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS — match the project baseline (same authenticated policies as leads/programs).
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_select" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_insert" ON clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "clients_update" ON clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "clients_delete" ON clients FOR DELETE TO authenticated USING (true);

-- ─── 2. nullable client_id references on BOTH leads and programs ───────────────
ALTER TABLE leads    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leads_client_id    ON leads(client_id);
CREATE INDEX IF NOT EXISTS idx_programs_client_id ON programs(client_id);

-- ─── 3 + 4. Migrate + dedupe existing data, backfill client_id ─────────────────
-- Dedupe rule: a program linked to a lead (programs.lead_id) is the SAME real client as that lead,
-- so they share ONE client row. Standalone programs and unconverted leads each get their own.
-- One-time DO block; idempotent via the `client_id IS NULL` guards (safe to re-run).
DO $$
DECLARE
  r RECORD;
  cid UUID;
BEGIN
  -- A) Lead + its converted program → one shared client.
  --    Shared identity/commission: program value wins, fall back to lead. Contacts + lead-only
  --    commission/notes come from the lead (programs never stored them).
  FOR r IN
    SELECT
      pr.id AS program_id, l.id AS lead_id,
      COALESCE(pr.client_name, l.client_name)               AS client_name,
      COALESCE(pr.company_name, l.end_company)              AS company_name,
      l.end_client, l.contact_name, l.contact_email, l.contact_role, l.client_contact_name,
      l.third_party_company, l.third_party_contact, l.third_party, l.third_party_comm_notes,
      COALESCE(pr.client_commission, l.source_commission)        AS client_commission,
      COALESCE(pr.gdp_commission_rate, l.third_party_commission) AS gdp_commission_rate,
      l.gdp_commission, l.extra_commission, l.commission_notes, l.billing_notes, l.returning_client
    FROM programs pr
    JOIN leads l ON l.id = pr.lead_id
    WHERE pr.lead_id IS NOT NULL AND pr.client_id IS NULL
  LOOP
    INSERT INTO clients (
      client_name, company_name, end_client, contact_name, contact_email, contact_role,
      client_contact_name, third_party_company, third_party_contact, third_party, third_party_comm_notes,
      client_commission, gdp_commission_rate, gdp_commission, extra_commission,
      commission_notes, billing_notes, returning_client
    ) VALUES (
      r.client_name, r.company_name, r.end_client, r.contact_name, r.contact_email, r.contact_role,
      r.client_contact_name, r.third_party_company, r.third_party_contact, r.third_party, r.third_party_comm_notes,
      r.client_commission, r.gdp_commission_rate, r.gdp_commission, r.extra_commission,
      r.commission_notes, r.billing_notes, r.returning_client
    ) RETURNING id INTO cid;

    UPDATE programs SET client_id = cid WHERE id = r.program_id;
    UPDATE leads    SET client_id = cid WHERE id = r.lead_id;
  END LOOP;

  -- B) Standalone programs (no lead) → own client.
  FOR r IN SELECT * FROM programs WHERE lead_id IS NULL AND client_id IS NULL
  LOOP
    INSERT INTO clients (client_name, company_name, client_commission, gdp_commission_rate)
    VALUES (r.client_name, r.company_name, r.client_commission, r.gdp_commission_rate)
    RETURNING id INTO cid;
    UPDATE programs SET client_id = cid WHERE id = r.id;
  END LOOP;

  -- C) Remaining unlinked leads (never converted) → own client.
  FOR r IN SELECT * FROM leads WHERE client_id IS NULL
  LOOP
    INSERT INTO clients (
      client_name, company_name, end_client, contact_name, contact_email, contact_role,
      client_contact_name, third_party_company, third_party_contact, third_party, third_party_comm_notes,
      client_commission, gdp_commission_rate, gdp_commission, extra_commission,
      commission_notes, billing_notes, returning_client
    ) VALUES (
      r.client_name, r.end_company, r.end_client, r.contact_name, r.contact_email, r.contact_role,
      r.client_contact_name, r.third_party_company, r.third_party_contact, r.third_party, r.third_party_comm_notes,
      r.source_commission, r.third_party_commission, r.gdp_commission, r.extra_commission,
      r.commission_notes, r.billing_notes, r.returning_client
    ) RETURNING id INTO cid;
    UPDATE leads SET client_id = cid WHERE id = r.id;
  END LOOP;
END $$;
