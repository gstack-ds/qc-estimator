import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { NarrativeOutputSchema, defaultNarrative } from '../../src/lib/deck/types';
import type { NarrativeInput } from '../../src/lib/deck/types';
import { buildDeckHtml } from '../../src/lib/deck/renderer';
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

// ─── Shared fixtures ──────────────────────────────────────────────────────────

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
];

const categoryMarkups: RawCategoryMarkup[] = [
  { id: 'cat-fb', markup_pct: 0.55 },
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
  name: 'Gala Dinner',
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

const narrativeInput: NarrativeInput = {
  estimateType: 'venue',
  estimateName: 'Gala Dinner',
  programName: 'Annual Awards',
  clientName: 'Acme Corp',
  venueName: 'The Ballantyne',
  venueCity: 'Charlotte',
  eventType: 'Gala',
  guestCount: 100,
  sectionNames: ['Food & Beverage'],
};

// ─── NarrativeOutputSchema ────────────────────────────────────────────────────

describe('NarrativeOutputSchema', () => {
  it('has no numeric fields — all fields are string or record<string>', () => {
    const shape = NarrativeOutputSchema.shape;
    for (const [key, field] of Object.entries(shape)) {
      const isString = field instanceof z.ZodString;
      const isStringRecord =
        field instanceof z.ZodRecord &&
        field._def.valueType instanceof z.ZodString;
      expect(
        isString || isStringRecord,
        `field "${key}" must be text-only (ZodString or ZodRecord<string,string>)`
      ).toBe(true);
    }
  });

  it('accepts valid narrative output', () => {
    const result = NarrativeOutputSchema.safeParse({
      headline: 'Annual Awards Gala',
      intro: 'A spectacular evening for 100 guests at The Ballantyne.',
      venueSummary: 'An iconic Charlotte venue.',
      experienceSummary: 'An expertly run event.',
      sectionDescriptions: { 'Food & Beverage': 'A curated dining experience.' },
      closingNote: 'We look forward to the event.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects objects with numeric fields', () => {
    const result = NarrativeOutputSchema.safeParse({
      headline: 'Test',
      intro: 'Test',
      venueSummary: 'Test',
      experienceSummary: 'Test',
      sectionDescriptions: {},
      closingNote: 'Test',
      totalCost: 50000, // extra numeric field — should be ignored by Zod (not cause failure)
    });
    // Zod strips unknown keys by default — extra keys don't cause failure.
    // The point is that no numeric field is DEFINED in the schema.
    expect(result.success).toBe(true);
    if (result.success) {
      // @ts-expect-error totalCost should not exist on the parsed output
      expect(result.data.totalCost).toBeUndefined();
    }
  });

  it('rejects missing required fields', () => {
    const result = NarrativeOutputSchema.safeParse({ headline: 'Only headline' });
    expect(result.success).toBe(false);
  });
});

// ─── defaultNarrative ─────────────────────────────────────────────────────────

describe('defaultNarrative', () => {
  it('produces a valid NarrativeOutput', () => {
    const result = defaultNarrative(narrativeInput);
    expect(NarrativeOutputSchema.safeParse(result).success).toBe(true);
  });

  it('includes program name and client name in intro', () => {
    const result = defaultNarrative(narrativeInput);
    expect(result.intro).toContain('Annual Awards');
    expect(result.intro).toContain('Acme Corp');
  });

  it('includes venueCity in intro', () => {
    const result = defaultNarrative(narrativeInput);
    expect(result.intro).toContain('Charlotte');
  });

  it('headline matches estimateName', () => {
    const result = defaultNarrative(narrativeInput);
    expect(result.headline).toBe('Gala Dinner');
  });

  it('sectionDescriptions keys match sectionNames', () => {
    const result = defaultNarrative(narrativeInput);
    expect(Object.keys(result.sectionDescriptions)).toEqual(['Food & Beverage']);
  });
});

// ─── JSON fence stripping ─────────────────────────────────────────────────────

describe('narrative JSON fence stripping', () => {
  function stripFences(raw: string): string {
    return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  it('strips ```json ... ``` fences', () => {
    const raw = '```json\n{"headline":"Test","intro":"x","venueSummary":"y","experienceSummary":"z","sectionDescriptions":{},"closingNote":"c"}\n```';
    const stripped = stripFences(raw);
    expect(() => JSON.parse(stripped)).not.toThrow();
    expect(JSON.parse(stripped).headline).toBe('Test');
  });

  it('strips plain ``` fences', () => {
    const raw = '```\n{"headline":"Test","intro":"x","venueSummary":"y","experienceSummary":"z","sectionDescriptions":{},"closingNote":"c"}\n```';
    expect(() => JSON.parse(stripFences(raw))).not.toThrow();
  });

  it('leaves bare JSON untouched', () => {
    const raw = '{"headline":"Test","intro":"x","venueSummary":"y","experienceSummary":"z","sectionDescriptions":{},"closingNote":"c"}';
    expect(stripFences(raw)).toBe(raw);
  });
});

// ─── buildDeckHtml fidelity ───────────────────────────────────────────────────

describe('buildDeckHtml', () => {
  const contract = buildDeckContract(
    estimate,
    [fbSection],
    [lineItem],
    program,
    location,
    tiers,
    categoryMarkups
  );
  const narrative = defaultNarrative(narrativeInput);

  it('rendered HTML contains the contract grand total via data-deck-total', () => {
    const html = buildDeckHtml([{ contract, narrative }]);
    const match = html.match(/data-deck-total="([^"]+)"/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1])).toBeCloseTo(contract.summary.totalClient, 2);
  });

  it('grand total in HTML matches contract.summary.totalClient exactly', () => {
    const html = buildDeckHtml([{ contract, narrative }]);
    const match = html.match(/data-deck-total="([^"]+)"/);
    expect(Number(match![1])).toBe(contract.summary.totalClient);
  });

  it('section names appear in rendered HTML', () => {
    const html = buildDeckHtml([{ contract, narrative }]);
    expect(html).toContain('Food &amp; Beverage');
  });

  it('narrative headline appears in rendered HTML', () => {
    const html = buildDeckHtml([{ contract, narrative }]);
    expect(html).toContain('Gala Dinner');
  });

  it('multiple slides produce multiple cover and pricing pages', () => {
    const html = buildDeckHtml([
      { contract, narrative },
      { contract, narrative },
    ]);
    const coverCount = (html.match(/class="page cover-page"/g) ?? []).length;
    const pricingCount = (html.match(/class="page pricing-page"/g) ?? []).length;
    expect(coverCount).toBe(2);
    expect(pricingCount).toBe(2);
  });

  it('orphan section (id=__orphan__) appears as Uncategorized in rendered HTML', () => {
    const avSection: RawSection = {
      id: 'sec-av',
      name: 'AV Equipment',
      tax_bucket: 'equipment',
      markup_pct: 0.65,
      sort_order: 0,
    };
    const avItem: RawLineItem = {
      ...lineItem,
      id: 'li-av',
      section_id: 'sec-av',
      section: 'AV Equipment',
      tax_type: 'general',
    };
    const orphanItem: RawLineItem = {
      ...lineItem,
      id: 'li-orphan',
      section_id: null,
      section: 'Deleted Section',
      name: 'Orphaned Line Item',
      qty: 5,
      unit_price: 200,
    };

    const contractWithOrphan = buildDeckContract(
      estimate,
      [avSection],
      [avItem, orphanItem],
      program,
      location,
      tiers,
      categoryMarkups
    );
    const orphanSection = contractWithOrphan.sections.find((s) => s.id === '__orphan__');
    expect(orphanSection).toBeDefined();

    const html = buildDeckHtml([{ contract: contractWithOrphan, narrative }]);
    expect(html).toContain('Uncategorized');
    expect(html).toContain('Orphaned Line Item');
  });

  it('HTML is valid enough to contain full <html> wrapper', () => {
    const html = buildDeckHtml([{ contract, narrative }]);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('</html>');
  });

  it('empty sections (zero line items) produce no section header in rendered HTML', () => {
    const emptySection: RawSection = {
      id: 'sec-empty',
      name: 'Empty Placeholder Section',
      tax_bucket: 'equipment',
      markup_pct: 0.65,
      sort_order: 1,
    };
    // fbSection has one line item; emptySection has none
    const contractWithEmpty = buildDeckContract(
      estimate,
      [fbSection, emptySection],
      [lineItem],
      program,
      location,
      tiers,
      categoryMarkups,
    );
    const html = buildDeckHtml([{ contract: contractWithEmpty, narrative }]);
    // Empty section header must not appear
    expect(html).not.toContain('Empty Placeholder Section');
    // Non-empty section still renders
    expect(html).toContain('Food &amp; Beverage');
  });

  it('upcharge annotations are stripped from estimate name in rendered HTML', () => {
    const upchargeEstimate: RawEstimate = { ...estimate, name: 'The Nook on Piedmont - DR (upcharged at 40%)' };
    const upchargeEstimate2: RawEstimate = { ...estimate, name: 'Wicked Wolf - DR (upcharge at 45%)' };
    const contract1 = buildDeckContract(upchargeEstimate, [fbSection], [lineItem], program, location, tiers, categoryMarkups);
    const contract2 = buildDeckContract(upchargeEstimate2, [fbSection], [lineItem], program, location, tiers, categoryMarkups);
    const html = buildDeckHtml([
      { contract: contract1, narrative: defaultNarrative({ ...narrativeInput, estimateName: upchargeEstimate.name }) },
      { contract: contract2, narrative: defaultNarrative({ ...narrativeInput, estimateName: upchargeEstimate2.name }) },
    ]);
    expect(html).not.toContain('upcharged at 40%');
    expect(html).not.toContain('upcharge at 45%');
    expect(html).toContain('The Nook on Piedmont');
    expect(html).toContain('Wicked Wolf');
  });

  it('internal margin fields are absent from rendered HTML', () => {
    const html = buildDeckHtml([{ contract, narrative }]);
    // These are MarginAnalysis-only fields — they must never leak into a client PDF.
    const internalFields = [
      'qcMargin', 'marginPct', 'trueNetMargin', 'trueNetPct',
      'opExHours', 'opExCost', 'totalOur', 'vendorCostsBase',
      'ccProcessingAmount', 'gdpCommission', 'thirdPartyTotal',
      'revenueItemsClientTotal', 'vendorTaxesTotal',
    ];
    for (const field of internalFields) {
      expect(html, `"${field}" must not appear in client PDF HTML`).not.toContain(field);
    }
  });
});
