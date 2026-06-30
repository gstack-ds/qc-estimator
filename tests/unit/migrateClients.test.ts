import { describe, it, expect } from 'vitest';
import {
  buildClientMigration, type MigrationLead, type MigrationProgram,
} from '../../scripts/migrateClients';

function lead(over: Partial<MigrationLead> & { id: string }): MigrationLead {
  return {
    client_name: null, end_company: null, end_client: null,
    contact_name: null, contact_email: null, contact_role: null, client_contact_name: null,
    third_party_company: null, third_party_contact: null, third_party: null, third_party_comm_notes: null,
    source_commission: null, third_party_commission: null, gdp_commission: null, extra_commission: null,
    commission_notes: null, billing_notes: null, returning_client: null,
    ...over,
  };
}
function program(over: Partial<MigrationProgram> & { id: string }): MigrationProgram {
  return {
    lead_id: null, client_name: null, company_name: null, client_commission: null, gdp_commission_rate: null,
    ...over,
  };
}

describe('buildClientMigration — dedupe', () => {
  it('a lead and its converted program share ONE client (same index)', () => {
    const leads = [lead({ id: 'L1', client_name: 'Acme', contact_email: 'a@acme.com' })];
    const programs = [program({ id: 'P1', lead_id: 'L1', client_name: 'Acme' })];
    const r = buildClientMigration(leads, programs);
    expect(r.clients).toHaveLength(1);
    expect(r.leadClientIndex['L1']).toBe(0);
    expect(r.programClientIndex['P1']).toBe(0);
    // contacts come from the lead (programs can't store them)
    expect(r.clients[0].contact_email).toBe('a@acme.com');
  });

  it('a standalone program (no lead) gets its own client', () => {
    const r = buildClientMigration([], [program({ id: 'P1', client_name: 'Solo Co' })]);
    expect(r.clients).toHaveLength(1);
    expect(r.programClientIndex['P1']).toBe(0);
    expect(r.clients[0].client_name).toBe('Solo Co');
    expect(r.clients[0].contact_email).toBeNull(); // programs have no contacts
  });

  it('an unconverted lead gets its own client', () => {
    const r = buildClientMigration([lead({ id: 'L1', client_name: 'Prospect', contact_name: 'Jane' })], []);
    expect(r.clients).toHaveLength(1);
    expect(r.leadClientIndex['L1']).toBe(0);
    expect(r.clients[0].contact_name).toBe('Jane');
  });

  it('mixed set: pair + standalone program + lone lead = 3 distinct clients', () => {
    const leads = [lead({ id: 'L1', client_name: 'Pair' }), lead({ id: 'L2', client_name: 'Lone' })];
    const programs = [program({ id: 'P1', lead_id: 'L1' }), program({ id: 'P2', client_name: 'Standalone' })];
    const r = buildClientMigration(leads, programs);
    expect(r.clients).toHaveLength(3);
    // pair shares
    expect(r.leadClientIndex['L1']).toBe(r.programClientIndex['P1']);
    // the three are distinct
    const idxs = new Set([r.leadClientIndex['L1'], r.programClientIndex['P2'], r.leadClientIndex['L2']]);
    expect(idxs.size).toBe(3);
  });
});

describe('buildClientMigration — field precedence (pair)', () => {
  const leads = [lead({
    id: 'L1', client_name: 'Lead Name', end_company: 'Lead Co',
    source_commission: 0.05, third_party_commission: 0.06,
    contact_name: 'Contact', commission_notes: 'note', returning_client: true,
  })];

  it('program value wins for shared identity/commission when present', () => {
    const programs = [program({
      id: 'P1', lead_id: 'L1', client_name: 'Program Name', company_name: 'Program Co',
      client_commission: 0.07, gdp_commission_rate: 0.065,
    })];
    const c = buildClientMigration(leads, programs).clients[0];
    expect(c.client_name).toBe('Program Name');
    expect(c.company_name).toBe('Program Co');
    expect(c.client_commission).toBe(0.07);
    expect(c.gdp_commission_rate).toBe(0.065);
    // lead-only fields still carried
    expect(c.contact_name).toBe('Contact');
    expect(c.commission_notes).toBe('note');
    expect(c.returning_client).toBe(true);
  });

  it('falls back to the lead value when the program field is null (COALESCE)', () => {
    const programs = [program({ id: 'P1', lead_id: 'L1', client_name: null, client_commission: null })];
    const c = buildClientMigration(leads, programs).clients[0];
    expect(c.client_name).toBe('Lead Name');           // program null → lead
    expect(c.client_commission).toBe(0.05);            // program null → lead.source_commission
    expect(c.gdp_commission_rate).toBe(0.06);          // program null → lead.third_party_commission
  });
});

describe('buildClientMigration — no data loss / full backfill', () => {
  it('every lead and every program receives a client_id index', () => {
    const leads = [lead({ id: 'L1' }), lead({ id: 'L2' }), lead({ id: 'L3' })];
    const programs = [program({ id: 'P1', lead_id: 'L1' }), program({ id: 'P2' })];
    const r = buildClientMigration(leads, programs);
    for (const l of leads) expect(r.leadClientIndex[l.id]).toBeTypeOf('number');
    for (const p of programs) expect(r.programClientIndex[p.id]).toBeTypeOf('number');
    // clients count = 1 pair + 1 standalone program + 2 lone leads = 4
    expect(r.clients).toHaveLength(4);
  });

  it('a program with a dangling lead_id (lead not present) becomes a standalone client', () => {
    const r = buildClientMigration([], [program({ id: 'P1', lead_id: 'GONE', client_name: 'Orphan' })]);
    expect(r.clients).toHaveLength(1);
    expect(r.programClientIndex['P1']).toBe(0);
    expect(r.clients[0].client_name).toBe('Orphan');
  });

  it('empty input yields no clients', () => {
    const r = buildClientMigration([], []);
    expect(r.clients).toHaveLength(0);
  });
});
