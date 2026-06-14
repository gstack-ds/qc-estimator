// QC Estimator — Deck Contract
// Pure TypeScript. No Next.js, no React, no Supabase imports.
// Defines the typed JSON shape of a fully-computed estimate (DeckContract)
// and the builder that calls the pricing engine to produce one.
//
// Imported by:
//   • mcp-server (read-only queries → this builder → JSON response)
//   • ProposalDocument (PDF generator, client-side dynamic import)

import {
  calculateVenueEstimate,
  calculateMarginAnalysis,
  calculateLineItem,
} from '../engine/pricing';
import type {
  EstimateSummary,
  MarginAnalysis,
  ProgramConfig,
  LineItem,
  CalculatedLineItem,
  TaxBucket,
  TaxType,
  TeamHoursTier,
  EstimateType,
  PackageOptions,
  Location,
} from '../../types';

// ─── Output types ─────────────────────────────────────────────────────────────

export interface DeckLineItem {
  id: string;
  name: string;
  label: string | null;
  qty: number;
  unitPrice: number;
  markupPct: number;
  taxType: TaxType;
  taxBucket: TaxBucket;
  ourCost: number;
  clientCost: number;
  taxRate: number;
  taxAmount: number;
  isRevenueItem: boolean;
  notes: string | null;
  thumbnailUrl: string | null;
  thumbnailIcon: string | null;
  packageOptions: PackageOptions | null;
  selectedPackageId: string | null;
  sortOrder: number;
}

export interface DeckSection {
  id: string;
  name: string;
  taxBucket: TaxBucket;
  markupPct: number;
  sortOrder: number;
  lineItems: DeckLineItem[];
}

export interface DeckContract {
  estimateId: string;
  estimateName: string;
  estimateType: EstimateType;
  programId: string;
  eventId: string | null;
  venueId: string | null;
  venueSpaceId: string | null;
  fbMinimum: number;
  isVenueTaxable: boolean;
  serviceCharge: number;
  gratuity: number;
  adminFee: number;
  discountType: 'percent' | 'flat' | null;
  discountValue: number;
  taxExempt: boolean;
  includedInProposal: boolean;
  includeInBudget: boolean;
  sections: DeckSection[];
  summary: EstimateSummary;
  margin: MarginAnalysis;
  programConfig: ProgramConfig;
  computedAt: string;
}

// ─── Input types (raw DB row shapes, no next/supabase dependencies) ────────────

export interface RawEstimate {
  id: string;
  program_id: string;
  event_id: string | null;
  type: string;
  name: string;
  fb_minimum: number;
  is_venue_taxable: boolean;
  service_charge_override: number | null;
  gratuity_override: number | null;
  admin_fee_override: number | null;
  discount_type: 'percent' | 'flat' | null;
  discount_value: number;
  tax_exempt: boolean;
  food_tax_override: number | null;
  alcohol_tax_override: number | null;
  general_tax_override: number | null;
  included_in_proposal: boolean;
  include_in_budget: boolean;
  venue_id: string | null;
  venue_space_id: string | null;
}

export interface RawSection {
  id: string;
  name: string;
  tax_bucket: TaxBucket;
  markup_pct: number;
  sort_order: number;
}

export interface RawLineItem {
  id: string;
  estimate_id: string;
  section_id: string | null;
  section: string;
  name: string;
  label: string | null;
  qty: number;
  unit_price: number;
  category_id: string | null;
  markup_override: number | null;
  custom_client_unit_price: number | null;
  tax_type: string;
  is_revenue_item: boolean;
  notes: string | null;
  thumbnail_url: string | null;
  thumbnail_icon: string | null;
  package_options: PackageOptions | null;
  selected_package_id: string | null;
  sort_order: number;
}

export interface RawCategoryMarkup {
  id: string;
  markup_pct: number;
}

export interface RawProgram {
  id: string;
  guest_count: number;
  cc_processing_fee: number;
  client_commission: number;
  gdp_commission_enabled: boolean;
  gdp_commission_rate: number;
  service_charge_default: number;
  gratuity_default: number;
  admin_fee_default: number;
  third_party_commissions: { name: string; rate: number }[] | null;
  include_travel_in_production_fee: boolean;
}

export interface RawLocation {
  id: string;
  name: string;
  food_tax_rate: number;
  alcohol_tax_rate: number;
  general_tax_rate: number;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildDeckContract(
  estimate: RawEstimate,
  sections: RawSection[],
  lineItems: RawLineItem[],
  program: RawProgram,
  location: RawLocation,
  tiers: TeamHoursTier[],
  categoryMarkups: RawCategoryMarkup[] = [],
  travelTotal = 0,
): DeckContract {
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const markupById = new Map(categoryMarkups.map((m) => [m.id, m.markup_pct]));

  const programLocation: Location = {
    id: location.id,
    name: location.name,
    foodTaxRate: location.food_tax_rate,
    alcoholTaxRate: location.alcohol_tax_rate,
    generalTaxRate: location.general_tax_rate,
  };

  const programConfig: ProgramConfig = {
    guestCount: program.guest_count,
    location: programLocation,
    ccProcessingFee: program.cc_processing_fee,
    clientCommission: program.client_commission,
    gdpCommissionEnabled: program.gdp_commission_enabled,
    gdpCommissionRate: program.gdp_commission_rate,
    serviceChargeDefault: program.service_charge_default,
    gratuityDefault: program.gratuity_default,
    adminFeeDefault: program.admin_fee_default,
    thirdPartyCommissions: program.third_party_commissions ?? [],
  };

  // Resolve service charge / gratuity / adminFee (estimate override → program default)
  const serviceCharge = estimate.service_charge_override ?? program.service_charge_default;
  const gratuity = estimate.gratuity_override ?? program.gratuity_default;
  const adminFee = estimate.admin_fee_override ?? program.admin_fee_default;

  // Build engine LineItem[] — mirrors the resolution in the main app's page.tsx
  const engineLineItems: LineItem[] = lineItems.map((item) => {
    const section = item.section_id ? sectionById.get(item.section_id) : undefined;
    const taxBucket: TaxBucket = section?.tax_bucket ?? 'equipment';
    const isCustom = item.custom_client_unit_price !== null;
    const categoryMarkupPct = isCustom ? 0 : (markupById.get(item.category_id ?? '') ?? 0.5);
    const categoryMarkupPctResolved = isCustom ? 0 : (item.markup_override ?? categoryMarkupPct);
    const clientCostOverride = isCustom
      ? item.custom_client_unit_price! * item.qty
      : undefined;

    return {
      id: item.id,
      section: section?.name ?? item.section,
      taxBucket,
      name: item.name,
      qty: item.qty,
      unitPrice: item.unit_price,
      categoryMarkupPct: categoryMarkupPctResolved,
      taxType: item.tax_type as TaxType,
      isRevenueItem: item.is_revenue_item,
      clientCostOverride,
    };
  });

  const venueInput = {
    name: estimate.name,
    fbMinimum: estimate.fb_minimum,
    isVenueTaxable: estimate.is_venue_taxable,
    serviceCharge,
    gratuity,
    adminFee,
    lineItems: engineLineItems,
    discount: estimate.discount_type && estimate.discount_value > 0
      ? { type: estimate.discount_type, value: estimate.discount_value }
      : null,
    taxExempt: estimate.tax_exempt,
    foodTaxOverride: estimate.food_tax_override,
    alcoholTaxOverride: estimate.alcohol_tax_override,
    generalTaxOverride: estimate.general_tax_override,
    travelTotal,
    includeTravelInProductionFee: program.include_travel_in_production_fee,
  };

  const summary = calculateVenueEstimate(venueInput, programConfig);
  const margin = calculateMarginAnalysis(summary, programConfig, tiers, travelTotal);

  // Build effective config (with per-estimate tax overrides) for per-item calculations
  const effectiveConfig: ProgramConfig = (
    estimate.food_tax_override != null ||
    estimate.alcohol_tax_override != null ||
    estimate.general_tax_override != null
  ) ? {
    ...programConfig,
    location: {
      ...programLocation,
      foodTaxRate: estimate.food_tax_override ?? programLocation.foodTaxRate,
      alcoholTaxRate: estimate.alcohol_tax_override ?? programLocation.alcoholTaxRate,
      generalTaxRate: estimate.general_tax_override ?? programLocation.generalTaxRate,
    },
  } : programConfig;

  // Compute per-item costs using the engine's calculateLineItem
  const calculatedById = new Map<string, CalculatedLineItem>(
    engineLineItems.map((li) => [li.id, calculateLineItem(li, effectiveConfig)])
  );

  // Group line items by section, preserving section sort order
  const sortedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);
  const itemsBySectionId = new Map<string, RawLineItem[]>();
  for (const item of lineItems) {
    const key = item.section_id ?? '__orphan__';
    if (!itemsBySectionId.has(key)) itemsBySectionId.set(key, []);
    itemsBySectionId.get(key)!.push(item);
  }

  const deckSections: DeckSection[] = sortedSections.map((section) => {
    const sectionRawItems = (itemsBySectionId.get(section.id) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order);

    const deckItems: DeckLineItem[] = sectionRawItems.map((raw) => {
      const calc = calculatedById.get(raw.id);
      const taxAmount = estimate.tax_exempt ? 0 : (calc?.taxAmount ?? 0);
      return {
        id: raw.id,
        name: raw.name,
        label: raw.label,
        qty: raw.qty,
        unitPrice: raw.unit_price,
        markupPct: calc ? (raw.custom_client_unit_price !== null ? 0
          : (raw.markup_override ?? markupById.get(raw.category_id ?? '') ?? 0.5)) : 0,
        taxType: raw.tax_type as TaxType,
        taxBucket: section.tax_bucket,
        ourCost: calc?.ourCost ?? 0,
        clientCost: calc?.clientCost ?? 0,
        taxRate: calc?.taxRate ?? 0,
        taxAmount,
        isRevenueItem: raw.is_revenue_item,
        notes: raw.notes,
        thumbnailUrl: raw.thumbnail_url,
        thumbnailIcon: raw.thumbnail_icon,
        packageOptions: raw.package_options,
        selectedPackageId: raw.selected_package_id,
        sortOrder: raw.sort_order,
      };
    });

    return {
      id: section.id,
      name: section.name,
      taxBucket: section.tax_bucket,
      markupPct: section.markup_pct,
      sortOrder: section.sort_order,
      lineItems: deckItems,
    };
  });

  return {
    estimateId: estimate.id,
    estimateName: estimate.name,
    estimateType: estimate.type as EstimateType,
    programId: estimate.program_id,
    eventId: estimate.event_id,
    venueId: estimate.venue_id,
    venueSpaceId: estimate.venue_space_id,
    fbMinimum: estimate.fb_minimum,
    isVenueTaxable: estimate.is_venue_taxable,
    serviceCharge,
    gratuity,
    adminFee,
    discountType: estimate.discount_type,
    discountValue: estimate.discount_value,
    taxExempt: estimate.tax_exempt,
    includedInProposal: estimate.included_in_proposal,
    includeInBudget: estimate.include_in_budget,
    sections: deckSections,
    summary,
    margin,
    programConfig,
    computedAt: new Date().toISOString(),
  };
}
