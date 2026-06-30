import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { callTool } from '../../src/lib/retrieval';

// Structural proof that NO internal margin / vendor-cost / commission field survives on ANY of
// the 7 queries — by running the REAL handlers through callTool({clientSafe:true}) against a mock
// DB and deep-scanning the actual output. This catches leaks a hand-fixture would miss (it only
// contains keys we already thought of); the real mapping code produces the output here.

const FORBIDDEN = [
  'our_cost', 'markup_pct',
  'fb_subtotal_our', 'equipment_subtotal_our', 'qc_staffing_subtotal_our', 'venue_subtotal_our',
  'subtotal_our', 'total_our',
  'margin', 'qc_revenue', 'qc_margin_pct', 'vendor_costs_base', 'totalVendorCosts',
  'true_net_profit', 'true_net_margin_pct', 'op_ex_estimate',
  'client_commission_amount', 'gdp_commission_amount', 'third_party_commissions_total',
  'markup_revenue', 'transport_commission',
  'client_commission', 'gdp_commission_rate', 'gdp_commission_enabled', 'third_party_commissions',
];

function allKeys(value: unknown, acc: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) for (const v of value) allKeys(v, acc);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) { acc.add(k); allKeys(v, acc); }
  }
  return acc;
}
const forbiddenIn = (v: unknown) => FORBIDDEN.filter((f) => allKeys(v).has(f));

// ── Minimal chainable supabase mock: from(table) → thenable builder that resolves to the
// configured rows. .single() → first row; head-count select → { count }. ──
type Rows = Record<string, Record<string, unknown>[]>;
function mockDb(rows: Rows): SupabaseClient {
  const from = (table: string) => {
    let single = false;
    let head = false;
    const b: Record<string, unknown> = {
      select: (_c?: string, opts?: { head?: boolean }) => { if (opts?.head) head = true; return b; },
      eq: () => b, ilike: () => b, or: () => b, gte: () => b, lte: () => b, in: () => b, not: () => b,
      order: () => b, limit: () => b,
      single: () => { single = true; return b; },
      then: (onF: (v: unknown) => unknown) => {
        const data = rows[table] ?? [];
        const result = head
          ? { count: data.length, error: null }
          : single
            ? { data: data[0] ?? null, error: data[0] ? null : { code: 'PGRST116' } }
            : { data, error: null };
        return Promise.resolve(onF(result));
      },
    };
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

const program = {
  id: 'p1', guest_count: 100, cc_processing_fee: 0.035, client_commission: 0.05,
  gdp_commission_enabled: true, gdp_commission_rate: 0.065,
  service_charge_default: 0.2, gratuity_default: 0.2, admin_fee_default: 0.05,
  third_party_commissions: [{ name: 'AmEx', rate: 0.1 }], include_travel_in_production_fee: false,
  location_id: 'loc1', name: 'Renuity', client_name: 'Renuity Inc', company_name: 'Renuity',
  event_date: '2026-12-01', service_style: 'Plated', alcohol_type: 'Full Bar', event_time: null,
  event_start_time: null, event_end_time: null, client_hotel: null, status: 'active',
  program_type: 'Venues', archived_at: null, lead_id: null, created_at: '', updated_at: '',
  location: { id: 'loc1', name: 'Loc', food_tax_rate: 0.06, alcohol_tax_rate: 0.08, general_tax_rate: 0.07 },
};
const location = [{ id: 'loc1', name: 'Loc', food_tax_rate: 0.06, alcohol_tax_rate: 0.08, general_tax_rate: 0.07 }];
const tiers = [{ revenue_threshold: 0, base_hours: 10, tier_name: 'T1' }];
const section = [{ id: 's1', name: 'F&B', tax_bucket: 'fb', markup_pct: 0.55, sort_order: 0 }];
const lineItem = [{
  id: 'li1', estimate_id: 'e1', section: 'F&B', section_id: 's1', name: 'Dinner', label: null,
  qty: 100, unit_price: 50, category_id: null, markup_override: null, custom_client_unit_price: null,
  tax_type: 'food', is_revenue_item: false, notes: null, sort_order: 0,
  thumbnail_url: null, thumbnail_icon: null, package_options: null, selected_package_id: null,
}];
const venueEstimate = [{
  id: 'e1', program_id: 'p1', event_id: null, type: 'venue', name: 'Venue Est', room_space: null,
  fb_minimum: 0, is_venue_taxable: true, service_charge_override: null, gratuity_override: null,
  admin_fee_override: null, include_in_budget: true, sort_order: 0, included_in_proposal: true,
  venue_contact: null, menu_notes: null, transport_commission: null, venue_id: null, venue_space_id: null,
  discount_type: null, discount_value: 0, eeg_enabled: false, eeg_rate: 0, tax_exempt: false,
  food_tax_override: null, alcohol_tax_override: null, general_tax_override: null,
  tour_details: null, created_at: '', updated_at: '',
}];

describe('clientSafe — REAL output of all 7 queries through callTool({clientSafe:true})', () => {
  it('list_programs', async () => {
    const r = await callTool(mockDb({ programs: [{ ...program, latest_total: 16200 }] }), 'list_programs', {}, { clientSafe: true });
    expect(forbiddenIn(r)).toEqual([]);
  });

  it('get_program (commissions stripped from real output)', async () => {
    const db = mockDb({
      programs: [program], events: [{ id: 'ev1', event_id: 'ev1' }], program_staffing: [],
      estimates: [{ id: 'e1', name: 'Venue Est', type: 'venue', event_id: 'ev1', included_in_proposal: true, include_in_budget: true }],
    });
    const r = await callTool(db, 'get_program', { id: 'p1' }, { clientSafe: true });
    expect(forbiddenIn(r)).toEqual([]);
  });

  it('list_estimates', async () => {
    const r = await callTool(mockDb({ estimates: venueEstimate }), 'list_estimates', {}, { clientSafe: true });
    expect(forbiddenIn(r)).toEqual([]);
  });

  it('get_estimate — venue/deck path (engine runs; margin block stripped)', async () => {
    const db = mockDb({
      estimates: venueEstimate, estimate_sections: section, estimate_line_items: lineItem,
      programs: [program], category_markups: [], team_hours_tiers: tiers,
      program_travel_items: [], locations: location,
    });
    const r = await callTool(db, 'get_estimate', { id: 'e1' }, { clientSafe: true });
    expect(forbiddenIn(r)).toEqual([]);
    // sanity: client-facing data survived
    expect(allKeys(r).has('client_cost')).toBe(true);
    expect(allKeys(r).has('total_client')).toBe(true);
  });

  it('get_estimate — transportation path (qc_revenue/margin/commission stripped)', async () => {
    const db = mockDb({
      estimates: [{ ...venueEstimate[0], type: 'transportation' }],
      transport_schedule_rows: [{ id: 't1', service_type: 'Sedan', our_cost: 1500, client_cost: 2625, qty: 2 }],
      programs: [{ client_commission: 0.05, cc_processing_fee: 0.035, location_id: 'loc1' }],
      locations: [{ general_tax_rate: 0.07 }],
    });
    const r = await callTool(db, 'get_estimate', { id: 'e1' }, { clientSafe: true });
    expect(forbiddenIn(r)).toEqual([]);
  });

  it('search_venues', async () => {
    const r = await callTool(mockDb({ venues: [{ id: 'v1', name: 'Marlow', service_charge_default: 0.2, gratuity_default: 0.2, admin_fee_default: 0.05 }] }), 'search_venues', {}, { clientSafe: true });
    expect(forbiddenIn(r)).toEqual([]);
  });

  it('get_venue', async () => {
    const db = mockDb({
      venues: [{ id: 'v1', name: 'Marlow', service_charge_default: 0.2, gratuity_default: 0.2, admin_fee_default: 0.05, menus: null, bar_options: null }],
      venue_spaces: [{ id: 'sp1', name: 'Room A', fb_minimum: 5000, room_fee: 500 }],
      estimates: [{ id: 'e1' }],
    });
    const r = await callTool(db, 'get_venue', { id: 'v1' }, { clientSafe: true });
    expect(forbiddenIn(r)).toEqual([]);
  });

  it('get_pipeline', async () => {
    const db = mockDb({
      leads: [{ id: 'l1', client_name: 'Acme', end_company: 'Acme', program_name: 'X', status: 'new_lead', start_date: '2026-01-01', city: 'NYC', state: 'NY', assigned_to: 1, gdp_advisor: 'Shelley', lead_source_type: 'GDP', current_due_date: null, updated_at: '' }],
      team_members: [{ id: 1, first_name: 'Alex', last_name: 'Stack' }],
      programs: [],
    });
    const r = await callTool(db, 'get_pipeline', { status_group: 'open' }, { clientSafe: true });
    expect(forbiddenIn(r)).toEqual([]);
  });
});
