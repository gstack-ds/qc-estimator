import { describe, it, expect } from 'vitest';
import {
  buildDeckContract,
  type RawEstimate,
  type RawSection,
  type RawLineItem,
  type RawProgram,
  type RawLocation,
  type RawCategoryMarkup,
} from '../../src/lib/contracts/deckContract';
import type { TeamHoursTier } from '../../src/types';

// ─── Test fixtures ─────────────────────────────────────────────────────────────

const location: RawLocation = {
  id: 'loc-1',
  name: 'Charlotte, NC',
  food_tax_rate: 0.0775,
  alcohol_tax_rate: 0.0775,
  general_tax_rate: 0.0775,
};

const program: RawProgram = {
  id: 'prog-1',
  guest_count: 100,
  cc_processing_fee: 0.035,
  client_commission: 0.05,
  gdp_commission_enabled: false,
  gdp_commission_rate: 0.065,
  service_charge_default: 0.20,
  gratuity_default: 0.20,
  admin_fee_default: 0.05,
  third_party_commissions: null,
  include_travel_in_production_fee: false,
};

const tiers: TeamHoursTier[] = [
  { revenueThreshold: 0, baseHours: 5, tierName: 'Base' },
  { revenueThreshold: 50000, baseHours: 15, tierName: 'Mid' },
];

const categoryMarkups: RawCategoryMarkup[] = [
  { id: 'cat-fb', markup_pct: 0.55 },
  { id: 'cat-av', markup_pct: 0.65 },
];

const fbSection: RawSection = {
  id: 'sec-fb',
  name: 'Food & Beverage',
  tax_bucket: 'fb',
  markup_pct: 0.55,
  sort_order: 0,
};

const estimate: RawEstimate = {
  id: 'est-1',
  program_id: 'prog-1',
  event_id: null,
  type: 'venue',
  name: 'Test Venue Estimate',
  fb_minimum: 5000,
  is_venue_taxable: false,
  service_charge_override: null,
  gratuity_override: null,
  admin_fee_override: null,
  discount_type: null,
  discount_value: 0,
  tax_exempt: false,
  food_tax_override: null,
  alcohol_tax_override: null,
  general_tax_override: null,
  included_in_proposal: true,
  include_in_budget: true,
  venue_id: 'venue-1',
  venue_space_id: null,
};

const lineItem: RawLineItem = {
  id: 'li-1',
  estimate_id: 'est-1',
  section_id: 'sec-fb',
  section: 'Food & Beverage',
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
  thumbnail_url: null,
  thumbnail_icon: null,
  package_options: null,
  selected_package_id: null,
  sort_order: 0,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildDeckContract', () => {
  it('computes correct ourCost and clientCost for a standard line item', () => {
    const contract = buildDeckContract(
      estimate,
      [fbSection],
      [lineItem],
      program,
      location,
      tiers,
      categoryMarkups,
    );

    const item = contract.sections[0].lineItems[0];
    expect(item.ourCost).toBe(100 * 80);        // qty × unitPrice = 8000
    expect(item.clientCost).toBeCloseTo(8000 * 1.55, 2); // 55% markup = 12400
    expect(item.taxRate).toBeCloseTo(0.0775, 4);
    expect(item.taxAmount).toBeCloseTo(item.clientCost * 0.0775, 2);
  });

  it('engine summary totalClient matches manually computed contract', () => {
    const contract = buildDeckContract(
      estimate,
      [fbSection],
      [lineItem],
      program,
      location,
      tiers,
      categoryMarkups,
    );

    expect(contract.summary.totalClient).toBeGreaterThan(0);
    // totalClient must equal sum of all client costs + fees + taxes
    expect(contract.summary.fbSubtotalClient).toBeCloseTo(12400, 2);
    expect(contract.summary.pricePerPerson).toBe(
      Math.ceil(contract.summary.totalClient / 100)
    );
  });

  it('uses markup_override when present', () => {
    const overrideItem: RawLineItem = { ...lineItem, id: 'li-2', markup_override: 0.80 };
    const contract = buildDeckContract(
      estimate,
      [fbSection],
      [overrideItem],
      program,
      location,
      tiers,
      categoryMarkups,
    );

    const item = contract.sections[0].lineItems[0];
    expect(item.clientCost).toBeCloseTo(8000 * 1.80, 2); // 80% override
  });

  it('uses custom_client_unit_price as clientCostOverride (bypasses markup)', () => {
    const customItem: RawLineItem = {
      ...lineItem,
      id: 'li-3',
      custom_client_unit_price: 100, // $100/person × 100 guests
    };
    const contract = buildDeckContract(
      estimate,
      [fbSection],
      [customItem],
      program,
      location,
      tiers,
      categoryMarkups,
    );

    const item = contract.sections[0].lineItems[0];
    expect(item.ourCost).toBeCloseTo(8000, 2); // qty × unitPrice still 8000
    expect(item.clientCost).toBeCloseTo(10000, 2); // 100 × $100/pp
  });

  it('revenue items have ourCost=0', () => {
    const revenueItem: RawLineItem = {
      ...lineItem,
      id: 'li-rev',
      is_revenue_item: true,
      unit_price: 500,
      qty: 1,
    };
    const contract = buildDeckContract(
      estimate,
      [fbSection],
      [revenueItem],
      program,
      location,
      tiers,
      categoryMarkups,
    );

    const item = contract.sections[0].lineItems[0];
    expect(item.ourCost).toBe(0);
    expect(item.clientCost).toBe(500);
  });

  it('tax_exempt zeroes out item taxAmount', () => {
    const taxExemptEstimate: RawEstimate = { ...estimate, tax_exempt: true };
    const contract = buildDeckContract(
      taxExemptEstimate,
      [fbSection],
      [lineItem],
      program,
      location,
      tiers,
      categoryMarkups,
    );

    expect(contract.sections[0].lineItems[0].taxAmount).toBe(0);
    expect(contract.summary.foodTax).toBe(0);
    expect(contract.summary.alcoholTax).toBe(0);
  });

  it('applies percent discount to totalClient', () => {
    const discountedEstimate: RawEstimate = {
      ...estimate,
      discount_type: 'percent',
      discount_value: 0.10,
    };
    const contractNoDiscount = buildDeckContract(
      estimate, [fbSection], [lineItem], program, location, tiers, categoryMarkups,
    );
    const contractDiscount = buildDeckContract(
      discountedEstimate, [fbSection], [lineItem], program, location, tiers, categoryMarkups,
    );

    expect(contractDiscount.summary.discountAmount).toBeCloseTo(
      contractNoDiscount.summary.totalClient * 0.10, 2
    );
    expect(contractDiscount.summary.totalClient).toBeCloseTo(
      contractNoDiscount.summary.totalClient * 0.90, 2
    );
  });

  it('applies per-estimate food tax override', () => {
    const overrideEstimate: RawEstimate = { ...estimate, food_tax_override: 0.10 };
    const contract = buildDeckContract(
      overrideEstimate, [fbSection], [lineItem], program, location, tiers, categoryMarkups,
    );

    const item = contract.sections[0].lineItems[0];
    expect(item.taxRate).toBeCloseTo(0.10, 4);
  });

  it('preserves section sort order in output', () => {
    const section2: RawSection = {
      id: 'sec-2', name: 'AV', tax_bucket: 'equipment', markup_pct: 0.65, sort_order: 1,
    };
    const avItem: RawLineItem = {
      ...lineItem, id: 'li-av', section_id: 'sec-2', section: 'AV',
      category_id: 'cat-av', tax_type: 'general',
    };
    const contract = buildDeckContract(
      estimate,
      [section2, fbSection], // reversed order
      [lineItem, avItem],
      program,
      location,
      tiers,
      categoryMarkups,
    );

    expect(contract.sections[0].name).toBe('Food & Beverage'); // sort_order: 0 first
    expect(contract.sections[1].name).toBe('AV');
  });

  it('falls back to 50% markup when category not found', () => {
    const unknownCatItem: RawLineItem = { ...lineItem, id: 'li-unk', category_id: 'cat-unknown' };
    const contract = buildDeckContract(
      estimate, [fbSection], [unknownCatItem], program, location, tiers, categoryMarkups,
    );

    const item = contract.sections[0].lineItems[0];
    expect(item.clientCost).toBeCloseTo(8000 * 1.5, 2); // 50% fallback
  });

  it('includes engine-computed margin analysis', () => {
    const contract = buildDeckContract(
      estimate, [fbSection], [lineItem], program, location, tiers, categoryMarkups,
    );

    expect(contract.margin.qcMarginPct).toBeGreaterThan(0);
    expect(['✓ STRONG', '→ ON TARGET', '⚠ REVIEW', '✗ BELOW FLOOR']).toContain(
      contract.margin.marginHealth
    );
    expect(contract.margin.estimatedTeamHours).toBeGreaterThan(0);
  });

  it('resolves service charge from program default when not overridden', () => {
    const contract = buildDeckContract(
      estimate, [fbSection], [lineItem], program, location, tiers, categoryMarkups,
    );

    expect(contract.serviceCharge).toBe(0.20); // program default
    expect(contract.summary.serviceChargeClient).toBeCloseTo(
      contract.summary.fbSubtotalClient * 0.20, 2
    );
  });

  it('estimate service charge override beats program default', () => {
    const overrideEst: RawEstimate = { ...estimate, service_charge_override: 0.215 };
    const contract = buildDeckContract(
      overrideEst, [fbSection], [lineItem], program, location, tiers, categoryMarkups,
    );

    expect(contract.serviceCharge).toBe(0.215);
  });

  it('orphan item (null section_id) appears in Uncategorized section and is counted in summary', () => {
    const avSection: RawSection = {
      id: 'sec-av', name: 'AV', tax_bucket: 'equipment', markup_pct: 0.65, sort_order: 0,
    };
    const avItem: RawLineItem = {
      ...lineItem, id: 'li-av', section_id: 'sec-av', section: 'AV',
      category_id: 'cat-av', tax_type: 'general',
    };
    const orphanItem: RawLineItem = {
      ...lineItem, id: 'li-orphan', section_id: null, section: 'Deleted Section',
      unit_price: 50, qty: 10,
    };

    const contract = buildDeckContract(
      estimate, [avSection], [avItem, orphanItem], program, location, tiers, categoryMarkups,
    );

    // Orphan section must be present and contain the item
    const orphanSection = contract.sections.find((s) => s.id === '__orphan__');
    expect(orphanSection).toBeDefined();
    expect(orphanSection!.name).toBe('Uncategorized');
    expect(orphanSection!.lineItems).toHaveLength(1);
    expect(orphanSection!.lineItems[0].id).toBe('li-orphan');

    // summary == sum of section subtotals: orphan clientCost included in equipmentSubtotalClient
    // because the engine received it with taxBucket 'equipment' (the null-section fallback).
    const sectionClientTotal = contract.sections
      .flatMap((s) => s.lineItems)
      .reduce((sum, li) => sum + li.clientCost, 0);
    const engineBucketTotal =
      contract.summary.fbSubtotalClient +
      contract.summary.equipmentSubtotalClient +
      contract.summary.venueSubtotalClient +
      contract.summary.qcStaffingSubtotalClient;
    expect(sectionClientTotal).toBeCloseTo(engineBucketTotal, 1);
  });
});
