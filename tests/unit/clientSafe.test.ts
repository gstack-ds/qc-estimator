import { describe, it, expect } from 'vitest';
import { stripEstimateForClient, stripProgramForClient } from '../../src/lib/retrieval/clientSafe';

// Internal fields that must NEVER survive the clientSafe strip (margin, vendor cost, commission).
const FORBIDDEN = [
  'our_cost', 'markup_pct',
  'fb_subtotal_our', 'equipment_subtotal_our', 'qc_staffing_subtotal_our', 'venue_subtotal_our',
  'subtotal_our', 'total_our',
  'margin', 'qc_revenue', 'qc_margin_pct', 'vendor_costs_base', 'true_net_profit', 'true_net_margin_pct',
  'client_commission_amount', 'gdp_commission_amount', 'third_party_commissions_total',
  'markup_revenue', 'transport_commission',
  'client_commission', 'gdp_commission_rate', 'gdp_commission_enabled', 'third_party_commissions',
];

// Recursively collect every object key in a value.
function allKeys(value: unknown, acc: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) allKeys(v, acc);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      acc.add(k);
      allKeys(v, acc);
    }
  }
  return acc;
}

function forbiddenPresent(value: unknown): string[] {
  const keys = allKeys(value);
  return FORBIDDEN.filter((f) => keys.has(f));
}

describe('stripEstimateForClient — deck_contract', () => {
  const fullContract = {
    type: 'deck_contract',
    estimate_name: 'Renuity Holiday',
    summary: {
      fb_subtotal_our: 5000, fb_subtotal_client: 7750,
      equipment_subtotal_our: 1000, equipment_subtotal_client: 1650,
      qc_staffing_subtotal_our: 800, venue_subtotal_our: 2000,
      subtotal_our: 8800, subtotal_client: 14000,
      total_our: 9000, total_client: 16200,
      production_fee: 500, price_per_person: 162,
    },
    sections: [
      {
        name: 'Catering & F&B', tax_bucket: 'fb', markup_pct: 0.55,
        line_items: [
          { name: 'Plated Dinner', qty: 100, unit_price: 50, our_cost: 5000, markup_pct: 0.55, client_cost: 7750, tax_amount: 600 },
        ],
      },
    ],
    margin: {
      vendor_costs_base: 8800, qc_revenue: 6200, qc_margin_pct: 0.38,
      client_commission_amount: 700, gdp_commission_amount: 0, third_party_commissions_total: 0,
      true_net_profit: 4000, true_net_margin_pct: 0.25,
    },
  };

  it('removes ALL internal margin/cost/markup fields (deep scan)', () => {
    const stripped = stripEstimateForClient(fullContract);
    expect(forbiddenPresent(stripped)).toEqual([]);
  });

  it('keeps client-facing fields (client_cost, totals, price_per_person, taxes)', () => {
    const s = stripEstimateForClient(fullContract) as Record<string, any>;
    expect(s.summary.total_client).toBe(16200);
    expect(s.summary.subtotal_client).toBe(14000);
    expect(s.summary.price_per_person).toBe(162);
    expect(s.summary.production_fee).toBe(500);
    expect(s.sections[0].line_items[0].client_cost).toBe(7750);
    expect(s.sections[0].line_items[0].tax_amount).toBe(600);
    expect(s.sections[0].line_items[0].name).toBe('Plated Dinner');
  });

  it('drops the entire margin block', () => {
    const s = stripEstimateForClient(fullContract) as Record<string, unknown>;
    expect('margin' in s).toBe(false);
  });
});

describe('stripEstimateForClient — transport_summary', () => {
  const transport = {
    type: 'transport_summary',
    estimate_name: 'Airport Transfers',
    summary: {
      subtotal_our: 3000, subtotal_client: 5250, markup_revenue: 2250,
      tax: 100, production_fee: 200, total_client: 5550,
      qc_revenue: 2250, qc_margin_pct: 0.4,
    },
    metadata: { transport_commission: 0.05, venue_contact: 'Bob' },
    schedule_rows: [{ service_type: 'Sedan', our_cost: 1500, client_cost: 2625, qty: 2 }],
  };

  it('removes internal transport margin/cost/commission (deep scan)', () => {
    expect(forbiddenPresent(stripEstimateForClient(transport))).toEqual([]);
  });

  it('keeps client-facing transport fields', () => {
    const s = stripEstimateForClient(transport) as Record<string, any>;
    expect(s.summary.total_client).toBe(5550);
    expect(s.summary.subtotal_client).toBe(5250);
    expect(s.summary.tax).toBe(100);
    expect(s.metadata.venue_contact).toBe('Bob');
    expect(s.schedule_rows[0].client_cost).toBe(2625);
    expect(s.schedule_rows[0].service_type).toBe('Sedan');
  });
});

describe('stripProgramForClient', () => {
  const program = {
    id: 'p1', name: 'Renuity', client: 'Renuity Inc',
    fees: {
      cc_processing_fee: 0.035, client_commission: 0.05,
      gdp_commission_enabled: true, gdp_commission_rate: 0.065,
      third_party_commissions: [{ name: 'AmEx', rate: 0.1 }],
      service_charge_default: 0.2, gratuity_default: 0.2, admin_fee_default: 0.05,
    },
  };

  it('removes commission fields from fees (deep scan)', () => {
    expect(forbiddenPresent(stripProgramForClient(program))).toEqual([]);
  });

  it('keeps client-facing fees (cc processing, service charge, gratuity, admin)', () => {
    const s = stripProgramForClient(program) as Record<string, any>;
    expect(s.fees.cc_processing_fee).toBe(0.035);
    expect(s.fees.service_charge_default).toBe(0.2);
    expect(s.fees.gratuity_default).toBe(0.2);
    expect(s.fees.admin_fee_default).toBe(0.05);
    expect(s.name).toBe('Renuity');
  });
});

describe('strip is null/shape safe', () => {
  it('passes through null / non-objects / unknown shapes', () => {
    expect(stripEstimateForClient(null)).toBeNull();
    expect(stripProgramForClient(undefined)).toBeUndefined();
    expect(stripEstimateForClient({ type: 'transport_summary' })).toEqual({ type: 'transport_summary' });
  });
});
