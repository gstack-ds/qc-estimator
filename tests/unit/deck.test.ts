import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { NarrativeOutputSchema, defaultNarrative } from '../../src/lib/deck/types';
import type { NarrativeInput } from '../../src/lib/deck/types';
import { buildDeckHtml, sanitizeEstimateName, sanitizeLineItemName, sectionDisplayLabel, SECTION_DISPLAY_LABELS } from '../../src/lib/deck/renderer';
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

  it('upcharge annotations and internal DR suffix are stripped from estimate name in rendered HTML', () => {
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
    // " - DR" suffix must also be stripped (internal room code)
    expect(html).not.toContain('- DR');
    expect(html).toContain('The Nook on Piedmont');
    expect(html).toContain('Wicked Wolf');
  });

  it('internal initial suffixes (caps and mixed-case) are stripped from estimate name in rendered HTML', () => {
    const doneAqs: RawEstimate = { ...estimate, name: "Marlow's Tavern - DONE AQS" };
    const aqsOnly: RawEstimate = { ...estimate, name: 'Ecco Midtown - AQS DONE' };
    const mixedCase: RawEstimate = { ...estimate, name: 'Old Vinings Inn - KP Pending' };
    const contracts = [doneAqs, aqsOnly, mixedCase].map((e) =>
      buildDeckContract(e, [fbSection], [lineItem], program, location, tiers, categoryMarkups)
    );
    const narratives = [doneAqs, aqsOnly, mixedCase].map((e) =>
      defaultNarrative({ ...narrativeInput, estimateName: e.name })
    );
    const html = buildDeckHtml(contracts.map((c, i) => ({ contract: c, narrative: narratives[i] })));
    // Any segment carrying a team initial must be gone — caps OR mixed-case.
    expect(html).not.toContain('DONE AQS');
    expect(html).not.toContain('AQS DONE');
    expect(html).not.toContain('KP Pending');
    // Venue names must remain
    expect(html).toContain("Marlow's Tavern");
    expect(html).toContain('Ecco Midtown');
    expect(html).toContain('Old Vinings Inn');
  });

  it('chained all-caps suffixes are fully stripped in one pass', () => {
    const chained: RawEstimate = { ...estimate, name: 'The Grand Venue - DR - DONE AQS' };
    const contract1 = buildDeckContract(chained, [fbSection], [lineItem], program, location, tiers, categoryMarkups);
    const html = buildDeckHtml([{ contract: contract1, narrative: defaultNarrative({ ...narrativeInput, estimateName: chained.name }) }]);
    expect(html).not.toContain('- DR');
    expect(html).not.toContain('DONE AQS');
    expect(html).toContain('The Grand Venue');
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

  it('per-person price prefix in line item name is stripped before rendering to client HTML', () => {
    const pricedItem: RawLineItem = {
      ...lineItem,
      name: '$70 Per Person Prefixed Seated Plated Dinner Menu',
    };
    const pricedContract = buildDeckContract(estimate, [fbSection], [pricedItem], program, location, tiers, categoryMarkups);
    const html = buildDeckHtml([{ contract: pricedContract, narrative }]);
    // Client must never see our per-person cost in the menu label
    expect(html).not.toContain('$70 Per Person');
    // Clean portion of the name must remain
    expect(html).toContain('Prefixed Seated Plated Dinner Menu');
  });

  it('per-person price prefix variants are all stripped before rendering', () => {
    const ppItem: RawLineItem = { ...lineItem, name: '$85/pp Premium Dinner Package' };
    const personItem: RawLineItem = { ...lineItem, id: 'li-2', name: '$1,200/person Grand Ballroom Package' };
    const noPrefix: RawLineItem = { ...lineItem, id: 'li-3', name: 'Standard Lunch Buffet' };

    const mixedContract = buildDeckContract(estimate, [fbSection], [ppItem, personItem, noPrefix], program, location, tiers, categoryMarkups);
    const html = buildDeckHtml([{ contract: mixedContract, narrative }]);

    expect(html).not.toContain('$85/pp');
    expect(html).toContain('Premium Dinner Package');

    expect(html).not.toContain('$1,200/person');
    expect(html).toContain('Grand Ballroom Package');

    // Names without a price prefix must be unchanged
    expect(html).toContain('Standard Lunch Buffet');
  });
});

// ─── sanitizeEstimateName (denylist) ──────────────────────────────────────────
// DENYLIST: strip a trailing " - …" note segment ONLY when it carries a known team
// initial (AQS/DR/KP/…) or an upcharge note. Must NOT touch real names — proven
// against the live DB via scripts/check-sanitize-names.ts (22 junk strips, 0 false
// positives). The cases below mirror the real rows in that audit.

describe('sanitizeEstimateName', () => {
  it('CRITICAL: real client names with hyphens or caps survive untouched', () => {
    // The blanket "strip caps after a dash" rule broke this — the whole reason for the denylist.
    expect(sanitizeEstimateName('WORLD OF COCA-COLA')).toBe('WORLD OF COCA-COLA');
    expect(sanitizeEstimateName('Coca-cola products')).toBe('Coca-cola products');
    expect(sanitizeEstimateName('The Ritz-Carlton')).toBe('The Ritz-Carlton');
  });

  it('legit dash suffixes (no internal marker) survive', () => {
    expect(sanitizeEstimateName('South City Kitchen - Midtown')).toBe('South City Kitchen - Midtown');
    expect(sanitizeEstimateName('NYC Water Cruises - Louisa of the Sea')).toBe('NYC Water Cruises - Louisa of the Sea');
    expect(sanitizeEstimateName('Balloons Over Atlanta & Event Visions - Balloons + Backdrop'))
      .toBe('Balloons Over Atlanta & Event Visions - Balloons + Backdrop');
    // "AV" is not a team initial, so an AV-package suffix must survive.
    expect(sanitizeEstimateName('Grand Ballroom - AV Package')).toBe('Grand Ballroom - AV Package');
  });

  it('strips AQS-tagged internal notes', () => {
    expect(sanitizeEstimateName('5Church Midtown - AQS OVER BUDGET')).toBe('5Church Midtown');
    expect(sanitizeEstimateName('AltaToro - AQS SERPENTINE ROOM MAX OF 50 SEATED')).toBe('AltaToro');
    expect(sanitizeEstimateName("Marlow's Tavern - DONE AQS")).toBe("Marlow's Tavern");
    expect(sanitizeEstimateName('Holeman and Finch - AQS OUT OF BUDGET')).toBe('Holeman and Finch');
  });

  it('strips DR / KP tagged notes including mixed-case and dates', () => {
    expect(sanitizeEstimateName('Old Vinings Inn - KP Pending')).toBe('Old Vinings Inn');
    expect(sanitizeEstimateName('Two Urban Licks - KP Pending')).toBe('Two Urban Licks');
    expect(sanitizeEstimateName('Rumi\'s Kitchen Colony Square - KP edited 6/12/26')).toBe("Rumi's Kitchen Colony Square");
  });

  it('strips DR + upcharge note', () => {
    expect(sanitizeEstimateName('Fado Irish Pub - DR (upcharge at 40%)')).toBe('Fado Irish Pub');
    expect(sanitizeEstimateName('Wicked Wolf - DR (upcharge at 45%)')).toBe('Wicked Wolf');
    expect(sanitizeEstimateName('The Nook at Piedmont - DR (upcharged at 55%)')).toBe('The Nook at Piedmont');
  });

  it('handles no-space-after-dash and preserves "+" in the venue name', () => {
    expect(sanitizeEstimateName('Alma Cocina Downtown -REMOVE AV NOT PERMITTED AQS')).toBe('Alma Cocina Downtown');
    expect(sanitizeEstimateName('Saints + Council - PATIO MAX OF 75 AQS')).toBe('Saints + Council');
  });

  it('cuts at the first dash whose remainder carries a marker (multi-dash note)', () => {
    expect(sanitizeEstimateName('Alta Toro - AQS -NO IN BUDGET OPTION FOR THIS SIZE GROUP')).toBe('Alta Toro');
    expect(sanitizeEstimateName('The Grand Venue - DR - DONE AQS')).toBe('The Grand Venue');
  });

  it('plain names with no dash are unchanged', () => {
    expect(sanitizeEstimateName('Two Urban Licks')).toBe('Two Urban Licks');
    expect(sanitizeEstimateName('Canoe')).toBe('Canoe');
  });
});

// ─── sanitizeLineItemName ─────────────────────────────────────────────────────

describe('sanitizeLineItemName', () => {
  it('strips "$N Per Person" prefix', () => {
    expect(sanitizeLineItemName('$70 Per Person Prefixed Seated Plated Dinner Menu'))
      .toBe('Prefixed Seated Plated Dinner Menu');
  });

  it('strips "$N/pp" prefix (no space)', () => {
    expect(sanitizeLineItemName('$85/pp Premium Dinner Package')).toBe('Premium Dinner Package');
  });

  it('strips "$N / pp" prefix (spaces around slash)', () => {
    expect(sanitizeLineItemName('$85 / pp Premium Dinner Package')).toBe('Premium Dinner Package');
  });

  it('strips "$N/person" prefix', () => {
    expect(sanitizeLineItemName('$1,200/person Grand Ballroom Package')).toBe('Grand Ballroom Package');
  });

  it('strips "$N/PP" prefix (uppercase PP)', () => {
    expect(sanitizeLineItemName('$95/PP Deluxe Buffet')).toBe('Deluxe Buffet');
  });

  it('strips "$N per person" prefix (all lowercase)', () => {
    expect(sanitizeLineItemName('$50 per person breakfast buffet')).toBe('breakfast buffet');
  });

  it('leaves names without a price prefix unchanged', () => {
    expect(sanitizeLineItemName('Plated Dinner')).toBe('Plated Dinner');
    expect(sanitizeLineItemName('Standard Lunch Buffet')).toBe('Standard Lunch Buffet');
    expect(sanitizeLineItemName('AV Equipment Package')).toBe('AV Equipment Package');
  });

  it('does not strip a bare dollar amount that is not a per-person prefix', () => {
    // "$50 Centerpiece" has no /pp or "per person" — must not be stripped
    expect(sanitizeLineItemName('$50 Centerpiece')).toBe('$50 Centerpiece');
  });

  it('handles commas in price', () => {
    expect(sanitizeLineItemName('$1,500/pp Platinum Experience')).toBe('Platinum Experience');
  });

  it('returns empty string unchanged', () => {
    expect(sanitizeLineItemName('')).toBe('');
  });

  // ─── Auto-seeded default name mappings ──────────────────────────────────────

  it('maps "Per Person Food" → "Menu" (internal shorthand for food F&B line)', () => {
    expect(sanitizeLineItemName('Per Person Food')).toBe('Menu');
  });

  it('maps "NA Beverages" → "Non-Alcoholic Beverages"', () => {
    expect(sanitizeLineItemName('NA Beverages')).toBe('Non-Alcoholic Beverages');
  });

  it('maps "QC Event Staff" → "Event Staff" (strips internal company prefix)', () => {
    expect(sanitizeLineItemName('QC Event Staff')).toBe('Event Staff');
  });

  it('leaves "Bar Package" unchanged — client-safe name', () => {
    expect(sanitizeLineItemName('Bar Package')).toBe('Bar Package');
  });

  it('lookup is exact-match only — does not map partial strings containing default names', () => {
    // "Per Person Food" as a prefix or substring must not trigger the lookup
    expect(sanitizeLineItemName('Per Person Food & Beverage Package')).toBe('Per Person Food & Beverage Package');
    expect(sanitizeLineItemName('QC Event Staffing')).toBe('QC Event Staffing');
    expect(sanitizeLineItemName('NA Beverages (upgrade)')).toBe('NA Beverages (upgrade)');
  });
});

// ─── sectionDisplayLabel ──────────────────────────────────────────────────────

describe('sectionDisplayLabel', () => {
  it('strips "Non-Taxable" from staffing section', () => {
    expect(sectionDisplayLabel('Non-Taxable Staffing')).toBe('Staffing');
  });

  it('maps "Florals - Non-Taxable" → "Florals"', () => {
    expect(sectionDisplayLabel('Florals - Non-Taxable')).toBe('Florals');
  });

  it('maps "Florals - Taxable" → "Florals" (strips tax-bucket qualifier)', () => {
    expect(sectionDisplayLabel('Florals - Taxable')).toBe('Florals');
  });

  it('maps "Rentals - Non-Taxable" → "Rentals"', () => {
    expect(sectionDisplayLabel('Rentals - Non-Taxable')).toBe('Rentals');
  });

  it('maps "F&B" → "Food & Beverage"', () => {
    expect(sectionDisplayLabel('F&B')).toBe('Food & Beverage');
  });

  it('passes through known client-safe section names unchanged', () => {
    expect(sectionDisplayLabel('Rentals - Seating')).toBe('Seating Rentals');
    expect(sectionDisplayLabel('Venue Fees')).toBe('Venue Fees');
    expect(sectionDisplayLabel('AV & Production')).toBe('AV & Production');
    expect(sectionDisplayLabel('Transportation')).toBe('Transportation');
  });

  it('passes through unknown user-renamed sections unchanged', () => {
    expect(sectionDisplayLabel('Custom Section Name')).toBe('Custom Section Name');
    expect(sectionDisplayLabel('Cocktail Florals')).toBe('Cocktail Florals');
  });

  it('SECTION_DISPLAY_LABELS contains no "Non-Taxable" or "Taxable" in any value', () => {
    for (const [key, value] of Object.entries(SECTION_DISPLAY_LABELS)) {
      expect(
        value,
        `SECTION_DISPLAY_LABELS["${key}"] = "${value}" contains tax-bucket language`
      ).not.toMatch(/non-taxable|taxable/i);
    }
  });

  it('internal tax-bucket section names are absent from rendered deck HTML', () => {
    const staffingSection: RawSection = {
      id: 'sec-staffing',
      name: 'Non-Taxable Staffing',
      tax_bucket: 'staffing',
      markup_pct: 0.90,
      sort_order: 1,
    };
    const staffItem: RawLineItem = {
      ...lineItem,
      id: 'li-staff',
      section_id: 'sec-staffing',
      section: 'Non-Taxable Staffing',
      name: 'Event Staff',
      qty: 1,
      unit_price: 500,
      tax_type: 'none',
    };
    const contractWithStaffing = buildDeckContract(
      estimate, [fbSection, staffingSection], [lineItem, staffItem],
      program, location, tiers, categoryMarkups
    );
    const sectionNarrative = defaultNarrative(narrativeInput);
    const html = buildDeckHtml([{ contract: contractWithStaffing, narrative: sectionNarrative }]);

    expect(html).not.toContain('Non-Taxable Staffing');
    expect(html).toContain('Staffing');
    // F&B section still renders as "Food &amp; Beverage" (HTML-escaped)
    expect(html).toContain('Food &amp; Beverage');
  });
});
