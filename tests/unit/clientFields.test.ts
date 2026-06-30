import { describe, it, expect } from 'vitest';
import {
  clientRowFromLead,
  clientRowFromProgram,
} from '../../src/lib/clients/clientFields';

// These mirror scripts/migrateClients.ts (the Phase-1 backfill spec) — a NEW lead/program
// must build the SAME client row the backfill would have produced for an existing one.

describe('clientRowFromLead', () => {
  it('maps lead fields to client columns with the Phase-1 renames', () => {
    const c = clientRowFromLead({
      client_name: 'Acme Corp',
      end_company: 'Acme Holdings',
      end_client: 'Acme Division',
      contact_name: 'Jane Doe',
      contact_email: 'jane@acme.com',
      contact_role: 'Planner',
      client_contact_name: 'Jane D.',
      third_party_company: 'AmEx',
      third_party_contact: 'Bob',
      third_party: 'American Express',
      third_party_comm_notes: 'net 30',
      source_commission: 0.05,
      third_party_commission: 0.065,
      gdp_commission: 0.04,
      extra_commission: 0.01,
      commission_notes: 'see contract',
      billing_notes: 'invoice monthly',
      returning_client: true,
    });
    // identity
    expect(c.client_name).toBe('Acme Corp');
    expect(c.company_name).toBe('Acme Holdings'); // end_company → company_name
    expect(c.end_client).toBe('Acme Division');
    // contacts (lead-only)
    expect(c.contact_name).toBe('Jane Doe');
    expect(c.contact_email).toBe('jane@acme.com');
    expect(c.client_contact_name).toBe('Jane D.');
    // third party
    expect(c.third_party).toBe('American Express');
    expect(c.third_party_comm_notes).toBe('net 30');
    // commission renames
    expect(c.client_commission).toBe(0.05); // source_commission → client_commission
    expect(c.gdp_commission_rate).toBe(0.065); // third_party_commission → gdp_commission_rate
    expect(c.gdp_commission).toBe(0.04);
    expect(c.extra_commission).toBe(0.01);
    expect(c.returning_client).toBe(true);
  });

  it('coerces missing fields to null (empty lead)', () => {
    const c = clientRowFromLead({});
    expect(c.client_name).toBeNull();
    expect(c.company_name).toBeNull();
    expect(c.client_commission).toBeNull();
    expect(c.gdp_commission_rate).toBeNull();
    expect(c.returning_client).toBeNull();
  });

  it('preserves a meaningful numeric zero commission (not coerced to null)', () => {
    const c = clientRowFromLead({ source_commission: 0, third_party_commission: 0 });
    expect(c.client_commission).toBe(0);
    expect(c.gdp_commission_rate).toBe(0);
  });
});

describe('clientRowFromProgram', () => {
  it('maps only the 4 program-owned fields; the rest are null', () => {
    const c = clientRowFromProgram({
      client_name: 'Direct Co',
      company_name: 'Direct Holdings',
      client_commission: 0.05,
      gdp_commission_rate: 0.065,
    });
    expect(c.client_name).toBe('Direct Co');
    expect(c.company_name).toBe('Direct Holdings');
    expect(c.client_commission).toBe(0.05);
    expect(c.gdp_commission_rate).toBe(0.065);
    // standalone program carries no contacts / source data
    expect(c.contact_name).toBeNull();
    expect(c.contact_email).toBeNull();
    expect(c.end_client).toBeNull();
    expect(c.third_party).toBeNull();
    expect(c.commission_notes).toBeNull();
    expect(c.returning_client).toBeNull();
  });

  it('coerces missing fields to null (empty program)', () => {
    const c = clientRowFromProgram({});
    expect(c.client_name).toBeNull();
    expect(c.client_commission).toBeNull();
  });
});
