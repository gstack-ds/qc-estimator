// Reference logic for the Phase-1 clients normalize (migration 057). The SQL DO block in
// supabase/migrations/057_clients_table.sql is the source of truth that runs in Supabase; this pure
// TS encodes the SAME extraction + dedupe + field-precedence rules so they can be unit-tested (vitest
// can't run Postgres). Lives in scripts/ (not app source) — a spec/helper, never imported by the app.
// Keep the two in sync.
//
// Dedupe rule: a program linked to a lead (program.lead_id) is the SAME client as that lead → ONE
// client row shared by both. Standalone programs and unconverted leads each get their own.

export interface MigrationLead {
  id: string;
  client_name: string | null;
  end_company: string | null;
  end_client: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_role: string | null;
  client_contact_name: string | null;
  third_party_company: string | null;
  third_party_contact: string | null;
  third_party: string | null;
  third_party_comm_notes: string | null;
  source_commission: number | null;
  third_party_commission: number | null;
  gdp_commission: number | null;
  extra_commission: number | null;
  commission_notes: string | null;
  billing_notes: string | null;
  returning_client: boolean | null;
}

export interface MigrationProgram {
  id: string;
  lead_id: string | null;
  client_name: string | null;
  company_name: string | null;
  client_commission: number | null;
  gdp_commission_rate: number | null;
}

// One client row (no id — the DB assigns it). Mirrors the clients table columns.
export interface ClientRecord {
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

export interface MigrationResult {
  clients: ClientRecord[];
  // lead.id / program.id → index into `clients` (the surrogate for the DB client_id).
  leadClientIndex: Record<string, number>;
  programClientIndex: Record<string, number>;
}

// COALESCE(a, b): first non-null wins (empty string is a value, like SQL).
function coalesce<T>(a: T | null, b: T | null): T | null {
  return a !== null && a !== undefined ? a : b;
}

function emptyClient(): ClientRecord {
  return {
    client_name: null, company_name: null, end_client: null,
    contact_name: null, contact_email: null, contact_role: null, client_contact_name: null,
    third_party_company: null, third_party_contact: null, third_party: null, third_party_comm_notes: null,
    client_commission: null, gdp_commission_rate: null, gdp_commission: null, extra_commission: null,
    commission_notes: null, billing_notes: null, returning_client: null,
  };
}

function clientFromLead(l: MigrationLead): ClientRecord {
  return {
    client_name: l.client_name,
    company_name: l.end_company,
    end_client: l.end_client,
    contact_name: l.contact_name,
    contact_email: l.contact_email,
    contact_role: l.contact_role,
    client_contact_name: l.client_contact_name,
    third_party_company: l.third_party_company,
    third_party_contact: l.third_party_contact,
    third_party: l.third_party,
    third_party_comm_notes: l.third_party_comm_notes,
    client_commission: l.source_commission,
    gdp_commission_rate: l.third_party_commission,
    gdp_commission: l.gdp_commission,
    extra_commission: l.extra_commission,
    commission_notes: l.commission_notes,
    billing_notes: l.billing_notes,
    returning_client: l.returning_client,
  };
}

export function buildClientMigration(
  leads: MigrationLead[],
  programs: MigrationProgram[],
): MigrationResult {
  const clients: ClientRecord[] = [];
  const leadClientIndex: Record<string, number> = {};
  const programClientIndex: Record<string, number> = {};
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const consumedLeads = new Set<string>();

  // A) pairs: program with a lead → one shared client (program wins shared fields; lead supplies contacts)
  for (const pr of programs) {
    if (!pr.lead_id) continue;
    const l = leadById.get(pr.lead_id);
    if (!l) continue; // dangling lead_id (FK makes this impossible in prod) → handled as standalone in B
    const c = clientFromLead(l);
    c.client_name = coalesce(pr.client_name, l.client_name);
    c.company_name = coalesce(pr.company_name, l.end_company);
    c.client_commission = coalesce(pr.client_commission, l.source_commission);
    c.gdp_commission_rate = coalesce(pr.gdp_commission_rate, l.third_party_commission);
    const idx = clients.push(c) - 1;
    programClientIndex[pr.id] = idx;
    leadClientIndex[l.id] = idx;
    consumedLeads.add(l.id);
  }

  // B) standalone programs (no lead, or dangling lead_id) → own client
  for (const pr of programs) {
    if (pr.id in programClientIndex) continue;
    const c = emptyClient();
    c.client_name = pr.client_name;
    c.company_name = pr.company_name;
    c.client_commission = pr.client_commission;
    c.gdp_commission_rate = pr.gdp_commission_rate;
    programClientIndex[pr.id] = clients.push(c) - 1;
  }

  // C) remaining unconverted leads → own client
  for (const l of leads) {
    if (consumedLeads.has(l.id)) continue;
    leadClientIndex[l.id] = clients.push(clientFromLead(l)) - 1;
  }

  return { clients, leadClientIndex, programClientIndex };
}
