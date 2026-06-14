import { describe, it, expect, vi } from 'vitest';
import { handleListEstimates, handleGetEstimate } from '../../tools/estimates';
import { createMockDb, ok, notFound, dbError } from '../helpers/mockDb';

const ESTIMATE_ROW = {
  id: 'est-1',
  program_id: 'prog-1',
  event_id: 'ev-1',
  type: 'venue',
  name: 'Test Venue',
  room_space: 'Main Ballroom',
  fb_minimum: 5000,
  is_venue_taxable: false,
  include_in_budget: true,
  sort_order: 0,
  included_in_proposal: true,
  venue_id: 'venue-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

const FULL_ESTIMATE = {
  ...ESTIMATE_ROW,
  service_charge_override: null,
  gratuity_override: null,
  admin_fee_override: null,
  transport_commission: null,
  venue_space_id: null,
  venue_contact: null,
  menu_notes: null,
  discount_type: null,
  discount_value: 0,
  tax_exempt: false,
  food_tax_override: null,
  alcohol_tax_override: null,
  general_tax_override: null,
  slide_copy_data: null,
  tour_details: null,
};

const PROGRAM = {
  id: 'prog-1',
  guest_count: 100,
  cc_processing_fee: 0.035,
  client_commission: 0.05,
  gdp_commission_enabled: false,
  gdp_commission_rate: 0.065,
  service_charge_default: 0.20,
  gratuity_default: 0.20,
  admin_fee_default: 0.05,
  third_party_commissions: [],
  include_travel_in_production_fee: false,
  location_id: 'loc-1',
};

const LOCATION = {
  id: 'loc-1',
  name: 'Charlotte, NC',
  food_tax_rate: 0.0775,
  alcohol_tax_rate: 0.0775,
  general_tax_rate: 0.0775,
};

const FB_SECTION = {
  id: 'sec-fb',
  name: 'Food & Beverage',
  tax_bucket: 'fb',
  markup_pct: 0.55,
  sort_order: 0,
};

const LINE_ITEM = {
  id: 'li-1',
  estimate_id: 'est-1',
  section: 'Food & Beverage',
  section_id: 'sec-fb',
  name: 'Plated Dinner',
  label: null,
  qty: 100,
  unit_price: 80,
  category_id: 'cat-fb',
  markup_override: null,
  custom_client_unit_price: null,
  tax_type: 'food',
  is_revenue_item: false,
  notes: null,
  sort_order: 0,
  thumbnail_url: null,
  thumbnail_icon: null,
  package_options: null,
  selected_package_id: null,
};

const CATEGORY_MARKUP = { id: 'cat-fb', markup_pct: 0.55 };
const TIER = { revenue_threshold: 0, base_hours: 5, tier_name: 'Base' };

function buildEstimateDb() {
  return createMockDb({
    estimates: ok(FULL_ESTIMATE),
    estimate_sections: ok([FB_SECTION]),
    estimate_line_items: ok([LINE_ITEM]),
    programs: ok(PROGRAM),
    category_markups: ok([CATEGORY_MARKUP]),
    team_hours_tiers: ok([TIER]),
    program_travel_items: ok([]),
    locations: ok(LOCATION),
  });
}

describe('handleListEstimates', () => {
  it('returns estimate list with correct shape', async () => {
    const db = createMockDb({ estimates: ok([ESTIMATE_ROW]) });
    const result = await handleListEstimates(db as never, {});

    expect(result.count).toBe(1);
    expect(result.estimates[0].id).toBe('est-1');
    expect(result.estimates[0].type).toBe('venue');
    expect(result.estimates[0].fb_minimum).toBe(5000);
  });

  it('passes program_id filter', async () => {
    const db = createMockDb({ estimates: ok([]) });
    await handleListEstimates(db as never, { program_id: 'prog-1' });

    const fromCall = (db.from as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect((fromCall.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(
      ['program_id', 'prog-1']
    );
  });

  it('passes estimate_type filter', async () => {
    const db = createMockDb({ estimates: ok([]) });
    await handleListEstimates(db as never, { estimate_type: 'venue' });

    const fromCall = (db.from as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect((fromCall.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(
      ['type', 'venue']
    );
  });

  it('filters by included_in_proposal', async () => {
    const db = createMockDb({ estimates: ok([]) });
    await handleListEstimates(db as never, { included_in_proposal: true });

    const fromCall = (db.from as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect((fromCall.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(
      ['included_in_proposal', true]
    );
  });
});

describe('handleGetEstimate', () => {
  it('returns null for not-found estimate', async () => {
    const db = createMockDb({ estimates: notFound() });
    const result = await handleGetEstimate(db as never, { id: 'missing' });
    expect(result).toBeNull();
  });

  it('returns deck contract for venue estimate', async () => {
    const db = buildEstimateDb();
    const result = await handleGetEstimate(db as never, { id: 'est-1' });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('deck_contract');
    expect(result!.estimate_type).toBe('venue');
  });

  it('summary.total_client is engine-computed (not hand-rolled)', async () => {
    const db = buildEstimateDb();
    const result = await handleGetEstimate(db as never, { id: 'est-1' }) as Record<string, unknown>;

    const summary = result!.summary as Record<string, number>;
    // total_client = subtotalClient + productionFee + productionFeeTax - discount
    // Must be > 0 and substantially > the vendor cost
    expect(summary.total_client).toBeGreaterThan(0);
    expect(summary.fb_subtotal_client).toBeCloseTo(100 * 80 * 1.55, 0); // $12,400
    expect(summary.total_client).toBeGreaterThan(summary.fb_subtotal_client);
  });

  it('returns margin analysis with health rating', async () => {
    const db = buildEstimateDb();
    const result = await handleGetEstimate(db as never, { id: 'est-1' }) as Record<string, unknown>;

    const margin = result!.margin as Record<string, unknown>;
    expect(typeof margin.qc_margin_pct).toBe('number');
    expect(['✓ STRONG', '→ ON TARGET', '⚠ REVIEW', '✗ BELOW FLOOR']).toContain(margin.margin_health);
  });

  it('returns sections with line items', async () => {
    const db = buildEstimateDb();
    const result = await handleGetEstimate(db as never, { id: 'est-1' }) as Record<string, unknown>;

    const sections = result!.sections as Array<{
      name: string;
      line_items: Array<{ name: string; our_cost: number; client_cost: number }>;
    }>;
    expect(sections).toHaveLength(1);
    expect(sections[0].name).toBe('Food & Beverage');
    expect(sections[0].line_items[0].name).toBe('Plated Dinner');
    expect(sections[0].line_items[0].our_cost).toBeCloseTo(8000, 0);
    expect(sections[0].line_items[0].client_cost).toBeCloseTo(12400, 0);
  });

  it('throws when a required parallel query fails — surfaces as isError via wrap()', async () => {
    const db = createMockDb({
      estimates: ok(FULL_ESTIMATE),
      estimate_sections: dbError('connection refused'),
      estimate_line_items: ok([LINE_ITEM]),
      programs: ok(PROGRAM),
      category_markups: ok([CATEGORY_MARKUP]),
      team_hours_tiers: ok([TIER]),
      program_travel_items: ok([]),
      locations: ok(LOCATION),
    });
    await expect(handleGetEstimate(db as never, { id: 'est-1' })).rejects.toThrow('connection refused');
  });

  it('returns transport_summary for transportation estimate', async () => {
    const transportEstimate = {
      ...FULL_ESTIMATE,
      type: 'transportation',
      transport_commission: 0.05,
    };
    const scheduleRow = {
      id: 'row-1', service_date: '2026-09-15', service_type: 'hourly',
      vehicle_rate_id: null, spot_time: null, start_time: '18:00', end_time: '22:00',
      qty: 1, our_cost: 400, client_cost: 700, notes: null,
    };
    const db = createMockDb({
      estimates: ok(transportEstimate),
      transport_schedule_rows: ok([scheduleRow]),
      programs: ok(PROGRAM),
      locations: ok(LOCATION),
    });

    const result = await handleGetEstimate(db as never, { id: 'est-1' }) as Record<string, unknown>;

    expect(result!.type).toBe('transport_summary');
    const summary = result!.summary as Record<string, number>;
    expect(summary.subtotal_our).toBe(400);
    expect(summary.subtotal_client).toBe(700);
    expect(summary.markup_revenue).toBe(300);
  });
});
