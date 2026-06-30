// Pure field-mapping for the clients normalize (Phase 2A — activate the write path).
// Mirrors the dedupe/precedence rules encoded in scripts/migrateClients.ts (the Phase-1
// backfill spec) so a NEW lead or program builds the SAME client row the backfill would have.
// Server-free + side-effect-free → unit-testable; the async insert helpers live in ./sync.ts.

// One client row, ready to insert (no id / timestamps — the DB assigns those).
// Column set mirrors the clients table (migration 057).
export interface ClientInsert {
  client_name: string | null;
  company_name: string | null;
  end_client: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_role: string | null;
  client_contact_name: string | null;
  third_party_company: string | null;
  third_party_contact: string | null;
  third_party: string | null;
  third_party_comm_notes: string | null;
  client_commission: number | null;
  gdp_commission_rate: number | null;
  gdp_commission: number | null;
  extra_commission: number | null;
  commission_notes: string | null;
  billing_notes: string | null;
  returning_client: boolean | null;
}

// Loose shapes — every field optional so the scanner's ParsedLead, the manual
// LeadInput, and a full DbLead all satisfy them. Missing fields coerce to null.
export interface LeadClientSource {
  client_name?: string | null;
  end_company?: string | null;
  end_client?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_role?: string | null;
  client_contact_name?: string | null;
  third_party_company?: string | null;
  third_party_contact?: string | null;
  third_party?: string | null;
  third_party_comm_notes?: string | null;
  source_commission?: number | null;
  third_party_commission?: number | null;
  gdp_commission?: number | null;
  extra_commission?: number | null;
  commission_notes?: string | null;
  billing_notes?: string | null;
  returning_client?: boolean | null;
}

export interface ProgramClientSource {
  client_name?: string | null;
  company_name?: string | null;
  client_commission?: number | null;
  gdp_commission_rate?: number | null;
}

function n<T>(v: T | null | undefined): T | null {
  return v === undefined ? null : v;
}

// A lead supplies identity + contacts + commission. Field mapping matches
// migrateClients.clientFromLead exactly (end_company→company_name,
// source_commission→client_commission, third_party_commission→gdp_commission_rate).
export function clientRowFromLead(l: LeadClientSource): ClientInsert {
  return {
    client_name: n(l.client_name),
    company_name: n(l.end_company),
    end_client: n(l.end_client),
    contact_name: n(l.contact_name),
    contact_email: n(l.contact_email),
    contact_role: n(l.contact_role),
    client_contact_name: n(l.client_contact_name),
    third_party_company: n(l.third_party_company),
    third_party_contact: n(l.third_party_contact),
    third_party: n(l.third_party),
    third_party_comm_notes: n(l.third_party_comm_notes),
    client_commission: n(l.source_commission),
    gdp_commission_rate: n(l.third_party_commission),
    gdp_commission: n(l.gdp_commission),
    extra_commission: n(l.extra_commission),
    commission_notes: n(l.commission_notes),
    billing_notes: n(l.billing_notes),
    returning_client: n(l.returning_client),
  };
}

// A standalone program carries no contacts/source — only the 4 identity+commission
// fields it owns. Matches the migrateClients "standalone program → own client" block.
export function clientRowFromProgram(p: ProgramClientSource): ClientInsert {
  return {
    client_name: n(p.client_name),
    company_name: n(p.company_name),
    end_client: null,
    contact_name: null,
    contact_email: null,
    contact_role: null,
    client_contact_name: null,
    third_party_company: null,
    third_party_contact: null,
    third_party: null,
    third_party_comm_notes: null,
    client_commission: n(p.client_commission),
    gdp_commission_rate: n(p.gdp_commission_rate),
    gdp_commission: null,
    extra_commission: null,
    commission_notes: null,
    billing_notes: null,
    returning_client: null,
  };
}
