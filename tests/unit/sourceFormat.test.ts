import { describe, it, expect } from 'vitest';
import { classifyField, formatField, humanizeKey, isHiddenKey, sourceHeader, collectReadableRows } from '../../src/lib/chat/sourceFormat';

describe('classifyField — rate vs currency (the correctness-critical distinction)', () => {
  it('decimal RATE fields are percent, NEVER currency', () => {
    // These would read as "$0.04" / "$0.20" if mis-classified — the source-display must not lie.
    expect(classifyField('cc_processing_fee', 0.035)).toBe('percent');
    expect(classifyField('service_charge_default', 0.2)).toBe('percent');
    expect(classifyField('gratuity_default', 0.2)).toBe('percent');
    expect(classifyField('admin_fee_default', 0.05)).toBe('percent');
    expect(classifyField('gdp_commission_rate', 0.065)).toBe('percent');
  });

  it('dollar fields are currency', () => {
    expect(classifyField('total_client', 16200)).toBe('currency');
    expect(classifyField('subtotal_client', 14000)).toBe('currency');
    expect(classifyField('price_per_person', 162)).toBe('currency');
    expect(classifyField('production_fee', 500)).toBe('currency'); // "fee" but a $ amount
    expect(classifyField('client_cost', 7750)).toBe('currency');
    expect(classifyField('unit_price', 50)).toBe('currency');
    expect(classifyField('latest_total', 16200)).toBe('currency');
    expect(classifyField('room_fee', 500)).toBe('currency');
    expect(classifyField('fb_minimum', 5000)).toBe('currency');
    expect(classifyField('food_tax', 465)).toBe('currency');
    expect(classifyField('discount_amount', 0)).toBe('currency'); // real $0 still formats
  });

  it('a currency-named sub-$1 fraction falls back to a plain number (never mislabel a stray rate)', () => {
    expect(classifyField('mystery_fee', 0.5)).toBe('number');
  });

  it('counts / quantities are plain numbers, not currency', () => {
    expect(classifyField('guest_count', 100)).toBe('number');
    expect(classifyField('qty', 100)).toBe('number');
    expect(classifyField('count', 5)).toBe('number');
    expect(classifyField('capacity_seated', 200)).toBe('number');
  });

  it('dates and booleans', () => {
    expect(classifyField('event_date', '2026-12-01')).toBe('date');
    expect(classifyField('start_date', '2026-01-01')).toBe('date');
    expect(classifyField('is_venue_taxable', true)).toBe('bool');
  });
});

describe('formatField', () => {
  it('formats each kind correctly', () => {
    expect(formatField('total_client', 16200)).toBe('$16,200.00');
    expect(formatField('price_per_person', 162)).toBe('$162.00');
    expect(formatField('cc_processing_fee', 0.035)).toBe('3.5%');
    expect(formatField('service_charge_default', 0.2)).toBe('20%');
    expect(formatField('event_date', '2026-12-01')).toBe('Dec 1, 2026');
    expect(formatField('is_venue_taxable', false)).toBe('No');
    expect(formatField('guest_count', 100)).toBe('100');
  });
});

describe('humanizeKey / isHiddenKey / sourceHeader', () => {
  it('humanizes with domain abbreviations', () => {
    expect(humanizeKey('total_client')).toBe('Total Client');
    expect(humanizeKey('fb_minimum')).toBe('F&B Minimum');
    expect(humanizeKey('cc_processing_fee')).toBe('CC Processing Fee');
    expect(humanizeKey('price_per_person')).toBe('Price Per Person');
  });

  it('hides ids and timestamps', () => {
    expect(isHiddenKey('id')).toBe(true);
    expect(isHiddenKey('program_id')).toBe(true);
    expect(isHiddenKey('created_at')).toBe(true);
    expect(isHiddenKey('updated_at')).toBe(true);
    expect(isHiddenKey('name')).toBe(false);
    expect(isHiddenKey('total_client')).toBe(false);
  });

  it('builds a readable header per tool', () => {
    expect(sourceHeader('get_estimate', { estimate_name: 'Renuity Holiday' })).toBe('Estimate — Renuity Holiday');
    expect(sourceHeader('get_venue', { name: 'Marlow' })).toBe('Venue — Marlow');
    expect(sourceHeader('list_programs', { count: 3 })).toBe('Programs (3)');
    expect(sourceHeader('get_pipeline', { total_leads: 12 })).toBe('Pipeline (12 leads)');
  });
});

describe('collectReadableRows — real fields become correct readable rows (renderer core)', () => {
  // A realistic clientSafe get_estimate result (margin/costs already stripped upstream).
  const estimate = {
    type: 'deck_contract',
    estimate_name: 'Renuity Holiday',
    summary: { subtotal_client: 14000, production_fee: 500, total_client: 16200, price_per_person: 162 },
    sections: [
      { name: 'Catering & F&B', line_items: [{ name: 'Plated Dinner', qty: 100, unit_price: 50, client_cost: 7750 }] },
      { name: 'AV', line_items: [{ name: 'Screen', qty: 1, unit_price: 300, client_cost: 495 }] },
    ],
  };

  it('surfaces the real price as a formatted currency row a user can read', () => {
    const rows = collectReadableRows(estimate);
    expect(rows).toContainEqual({ label: 'Total Client', value: '$16,200.00' });
    expect(rows).toContainEqual({ label: 'Price Per Person', value: '$162.00' });
  });

  it('traverses nested sections/line_items so ALL retrieved data shows (not just what prose mentioned)', () => {
    const rows = collectReadableRows(estimate);
    // both line items surface, even if the answer only mentioned one
    const clientCosts = rows.filter((r) => r.label === 'Client Cost').map((r) => r.value);
    expect(clientCosts).toEqual(expect.arrayContaining(['$7,750.00', '$495.00']));
    expect(rows.some((r) => r.label === 'Name' && r.value === 'Plated Dinner')).toBe(true);
    expect(rows.some((r) => r.label === 'Name' && r.value === 'Screen')).toBe(true);
  });

  it('a rate stays a percent row (never rendered as a dollar amount)', () => {
    const program = { name: 'Renuity', fees: { cc_processing_fee: 0.035, service_charge_default: 0.2 } };
    const rows = collectReadableRows(program);
    expect(rows).toContainEqual({ label: 'CC Processing Fee', value: '3.5%' });
    expect(rows).toContainEqual({ label: 'Service Charge Default', value: '20%' });
    expect(rows.every((r) => !/\$0\.0[24]/.test(r.value))).toBe(true); // no rate leaked as currency
  });

  it('multi-source: each source produces its own rows (all shown)', () => {
    const est = collectReadableRows(estimate);
    const venue = collectReadableRows({ name: 'Marlow', city: 'Atlanta', fee_defaults: { service_charge: 0.2 } });
    expect(est.some((r) => r.value === '$16,200.00')).toBe(true);
    expect(venue.some((r) => r.label === 'Name' && r.value === 'Marlow')).toBe(true);
  });

  it('empty / no data → no rows (the component shows an explicit "no sources" note)', () => {
    expect(collectReadableRows({})).toEqual([]);
    expect(collectReadableRows(null)).toEqual([]);
    expect(collectReadableRows({ id: 'x', created_at: 't', updated_at: 't' })).toEqual([]); // only hidden keys
  });
});
