import { describe, it, expect, vi } from 'vitest';
import { handleListPrograms, handleGetProgram } from '../../tools/programs';
import { createMockDb, ok, notFound, dbError } from '../helpers/mockDb';

const PROG = {
  id: 'prog-1',
  name: 'Test Program',
  client_name: 'Acme Corp',
  company_name: null,
  event_date: '2026-09-15',
  guest_count: 100,
  status: 'active',
  program_type: 'Venues',
  lead_id: null,
  latest_total: 50000,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

const FULL_PROG = {
  ...PROG,
  service_style: 'Plated',
  alcohol_type: 'Full Bar',
  event_time: null,
  event_start_time: null,
  event_end_time: null,
  client_hotel: 'Marriott Charlotte',
  location_id: 'loc-1',
  cc_processing_fee: 0.035,
  client_commission: 0.05,
  gdp_commission_enabled: false,
  gdp_commission_rate: 0.065,
  service_charge_default: 0.20,
  gratuity_default: 0.20,
  admin_fee_default: 0.05,
  third_party_commissions: [],
  include_travel_in_production_fee: false,
  archived_at: null,
  location: {
    id: 'loc-1',
    name: 'Charlotte, NC',
    food_tax_rate: 0.0775,
    alcohol_tax_rate: 0.0775,
    general_tax_rate: 0.0775,
  },
};

describe('handleListPrograms', () => {
  it('returns programs with correct shape', async () => {
    const db = createMockDb({ programs: ok([PROG]) });
    const result = await handleListPrograms(db as never, {});

    expect(result.count).toBe(1);
    expect(result.programs[0].id).toBe('prog-1');
    expect(result.programs[0].client).toBe('Acme Corp');
    expect(result.programs[0].event_date).toBe('2026-09-15');
    expect(result.programs[0].latest_total).toBe(50000);
  });

  it('passes status filter to query', async () => {
    const db = createMockDb({ programs: ok([]) });
    await handleListPrograms(db as never, { status: 'completed' });

    const fromCall = (db.from as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect((fromCall.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(['status', 'completed']);
  });

  it('passes client ilike filter to query', async () => {
    const db = createMockDb({ programs: ok([]) });
    await handleListPrograms(db as never, { client: 'Acme' });

    const fromCall = (db.from as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect((fromCall.ilike as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(
      ['client_name', '%Acme%']
    );
  });

  it('applies date range filters', async () => {
    const db = createMockDb({ programs: ok([]) });
    await handleListPrograms(db as never, {
      start_after: '2026-01-01',
      start_before: '2026-12-31',
    });

    const fromCall = (db.from as ReturnType<typeof vi.fn>).mock.results[0].value;
    const gteCalls = (fromCall.gte as ReturnType<typeof vi.fn>).mock.calls;
    const lteCalls = (fromCall.lte as ReturnType<typeof vi.fn>).mock.calls;
    expect(gteCalls).toContainEqual(['event_date', '2026-01-01']);
    expect(lteCalls).toContainEqual(['event_date', '2026-12-31']);
  });

  it('returns empty list when no programs match', async () => {
    const db = createMockDb({ programs: ok([]) });
    const result = await handleListPrograms(db as never, {});
    expect(result.count).toBe(0);
    expect(result.programs).toEqual([]);
  });
});

describe('handleGetProgram', () => {
  it('returns null for not-found program', async () => {
    const db = createMockDb({
      programs: notFound(),
      events: ok([]),
      program_staffing: ok([]),
    });
    const result = await handleGetProgram(db as never, { id: 'missing' });
    expect(result).toBeNull();
  });

  it('returns program with location and fees', async () => {
    const db = createMockDb({
      programs: ok(FULL_PROG),
      events: ok([]),
      program_staffing: ok([]),
      estimates: ok([]),
    });
    const result = await handleGetProgram(db as never, { id: 'prog-1' });

    expect(result).not.toBeNull();
    expect(result!.id).toBe('prog-1');
    expect(result!.location?.name).toBe('Charlotte, NC');
    expect(result!.fees.cc_processing_fee).toBe(0.035);
    expect(result!.fees.service_charge_default).toBe(0.20);
  });

  it('includes events in response', async () => {
    const event = {
      id: 'ev-1',
      name: 'Dinner',
      event_date: '2026-09-15',
      start_time: '18:00',
      end_time: '22:00',
      guest_count: 100,
      event_type: 'dinner',
      sort_order: 0,
      budget_amount: null,
      budget_basis: null,
    };
    const db = createMockDb({
      programs: ok(FULL_PROG),
      events: ok([event]),
      program_staffing: ok([]),
      estimates: ok([]),
    });
    const result = await handleGetProgram(db as never, { id: 'prog-1' });

    expect(result!.events).toHaveLength(1);
    expect(result!.events[0].name).toBe('Dinner');
  });

  it('throws when estimates query fails — surfaces as isError via wrap()', async () => {
    const db = createMockDb({
      programs: ok(FULL_PROG),
      events: ok([]),
      program_staffing: ok([]),
      estimates: dbError('permission denied'),
    });
    await expect(handleGetProgram(db as never, { id: 'prog-1' })).rejects.toThrow('permission denied');
  });

  it('fetches linked lead when lead_id is set', async () => {
    const progWithLead = { ...FULL_PROG, lead_id: 'lead-1' };
    const leadData = { id: 'lead-1', client_name: 'Acme Corp', status: 'under_contract', start_date: '2026-09-15', city: 'Charlotte', state: 'NC' };

    const db = createMockDb({
      programs: ok(progWithLead),
      events: ok([]),
      program_staffing: ok([]),
      estimates: ok([]),
      leads: ok(leadData),
    });
    const result = await handleGetProgram(db as never, { id: 'prog-1' });

    expect(result!.lead).not.toBeNull();
    expect(result!.lead!.status).toBe('under_contract');
  });
});
