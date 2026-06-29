// Program-level combined proposal — pure, server-free helpers.
// No React / Next / Supabase imports. The combined PDF aggregates ALREADY-COMPUTED per-estimate
// summaries; it never re-runs pricing math (the engine stays untouched).

import type { EstimateSummary, Location } from '@/types';
import type { LineItemForExport, OrderedSection } from '@/lib/utils/export';
import type { PackageOptions } from '@/types';
import type { TourDetails } from '@/lib/tours/types';

export type EstimateProposalType = 'venue' | 'av' | 'decor' | 'tour';

// One estimate's render payload for the combined doc — the subset ProgramProposalDocument needs.
// JSON-serializable so a server action can hand it to the client renderer.
export interface EstimateProposalPayload {
  estimateId: string;
  estimateName: string;
  eventName: string | null;
  estimateType: EstimateProposalType;
  guestCount: number;
  summary: EstimateSummary;
  lineItems: LineItemForExport[];
  orderedSections: OrderedSection[];
  location: Location | null;
  taxExempt: boolean;
  tourDetails: TourDetails | null;
}

export interface ProgramProposalData {
  programName: string;
  clientName: string | null;
  clientCompany: string | null;
  proposalDate: string;
  estimates: EstimateProposalPayload[];
}

export interface ProgramGrandTotal {
  subtotal: number;          // Σ lineItemsSubtotalClient
  productionFee: number;     // Σ productionFee
  preTaxTotal: number;       // Σ preTaxTotal
  tax: number;               // Σ each estimate's own tax (jurisdictions never blended)
  discountAmount: number;    // Σ discountAmount
  eegCommissionAmount: number; // Σ eegCommissionAmount
  total: number;             // Σ totalClient
}

// A single estimate's total tax — its own jurisdiction only (line-item taxes + production fee tax).
export function estimateTax(s: EstimateSummary): number {
  return s.foodTax + s.alcoholTax + s.equipmentTax + s.venueTax + s.productionFeeTax;
}

// Grand total = sum of the per-estimate computed totals. No pricing recomputation.
export function computeProgramGrandTotal(summaries: EstimateSummary[]): ProgramGrandTotal {
  return summaries.reduce<ProgramGrandTotal>(
    (acc, s) => ({
      subtotal: acc.subtotal + s.lineItemsSubtotalClient,
      productionFee: acc.productionFee + s.productionFee,
      preTaxTotal: acc.preTaxTotal + s.preTaxTotal,
      tax: acc.tax + estimateTax(s),
      discountAmount: acc.discountAmount + s.discountAmount,
      eegCommissionAmount: acc.eegCommissionAmount + s.eegCommissionAmount,
      total: acc.total + s.totalClient,
    }),
    { subtotal: 0, productionFee: 0, preTaxTotal: 0, tax: 0, discountAmount: 0, eegCommissionAmount: 0, total: 0 },
  );
}

// Per-estimate effective location: program location with the estimate's tax overrides applied.
// Display-only (the engine already used these overrides to compute the summary).
export function effectiveLocation(
  base: Location,
  overrides: { food_tax_override?: number | null; alcohol_tax_override?: number | null; general_tax_override?: number | null },
): Location {
  return {
    ...base,
    foodTaxRate: overrides.food_tax_override ?? base.foodTaxRate,
    alcoholTaxRate: overrides.alcohol_tax_override ?? base.alcoholTaxRate,
    generalTaxRate: overrides.general_tax_override ?? base.generalTaxRate,
  };
}

// Raw DB line-item row (snake_case) — the fields needed to build the export shape.
export interface RawLineItemRow {
  section: string;
  section_id: string | null;
  name: string;
  label: string | null;
  qty: number;
  unit_price: number;
  category_id: string | null;
  markup_override: number | null;
  custom_client_unit_price: number | null;
  tax_type: string;
  is_revenue_item: boolean;
  thumbnail_url: string | null;
  thumbnail_icon: string | null;
  package_options: PackageOptions | null;
  selected_package_id: string | null;
}

// Map a raw DB line item to the export shape — mirrors the builders' dbItemToLocal so the combined
// PDF prices/displays items exactly as the per-estimate export does. Custom items carry their own
// unit price (markup 0); others carry the effective markup (override ?? category default ?? 0.5).
export function rawLineItemToExportItem(
  item: RawLineItemRow,
  markupById: Map<string, number>,
  sectionById: Map<string, { id: string; name: string }>,
): LineItemForExport {
  const isCustom = item.custom_client_unit_price !== null && item.custom_client_unit_price !== undefined;
  const defaultMarkupPct = isCustom ? 0 : (markupById.get(item.category_id ?? '') ?? 0.5);
  const effectiveMarkupPct = isCustom ? 0 : (item.markup_override ?? defaultMarkupPct);
  const sectionDef = item.section_id ? sectionById.get(item.section_id) : undefined;
  return {
    name: item.name,
    label: item.label ?? undefined,
    section: sectionDef?.name ?? item.section,
    sectionId: sectionDef?.id ?? item.section_id ?? undefined,
    qty: item.qty,
    unitPrice: item.unit_price,
    categoryMarkupPct: effectiveMarkupPct,
    categoryId: isCustom ? 'custom' : (item.category_id ?? null),
    customClientUnitPrice: isCustom ? item.custom_client_unit_price! : undefined,
    taxType: item.tax_type,
    isRevenueItem: item.is_revenue_item,
    thumbnailUrl: item.thumbnail_url,
    thumbnailIcon: item.thumbnail_icon,
    packageOptions: item.package_options,
    selectedPackageId: item.selected_package_id,
  };
}
