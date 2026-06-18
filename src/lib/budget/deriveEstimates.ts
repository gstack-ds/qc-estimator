// Budget derivation — turn a real estimate into its CLIENT-FACING values only.
// Returns { total, pricePerPerson } and nothing else: this module never computes or
// exposes cost / markup / margin, so the budget is leak-safe by construction.
//
// NOTE: the small DB→engine conversion helpers below intentionally mirror the ones in
// programs/[id]/page.tsx. They're duplicated (not shared) to keep the budget feature
// self-contained and avoid touching the critical program page. Pure functions; if they
// ever diverge meaningfully, extract to a shared engine module.

import { calculateVenueEstimate } from '@/lib/engine/pricing';
import { calcTransportSummary } from '@/lib/engine/transportation';
import type { DbEstimate, DbLineItem, DbMarkup, DbLocation } from '@/lib/supabase/queries';
import type { LineItem, TaxType, TaxBucket, ProgramConfig } from '@/types';

interface ProgramFeeFields {
  guest_count: number;
  cc_processing_fee: number;
  client_commission: number;
  gdp_commission_enabled: boolean;
  gdp_commission_rate: number;
  service_charge_default: number;
  gratuity_default: number;
  admin_fee_default: number;
  third_party_commissions: { name: string; rate: number }[];
}

export function buildBudgetProgramConfig(program: ProgramFeeFields, location: DbLocation | null): ProgramConfig {
  return {
    guestCount: program.guest_count,
    location: location
      ? {
          id: location.id,
          name: location.name,
          foodTaxRate: location.food_tax_rate,
          alcoholTaxRate: location.alcohol_tax_rate,
          generalTaxRate: location.general_tax_rate,
        }
      : { id: '', name: '', foodTaxRate: 0, alcoholTaxRate: 0, generalTaxRate: 0 },
    ccProcessingFee: program.cc_processing_fee,
    clientCommission: program.client_commission,
    gdpCommissionEnabled: program.gdp_commission_enabled,
    gdpCommissionRate: program.gdp_commission_rate,
    serviceChargeDefault: program.service_charge_default,
    gratuityDefault: program.gratuity_default,
    adminFeeDefault: program.admin_fee_default,
    thirdPartyCommissions: program.third_party_commissions ?? [],
  };
}

const FB_SECTIONS = new Set(['F&B']);
const VENUE_SECTIONS = new Set(['Venue Fees']);
const STAFFING_SECTIONS = new Set(['Non-Taxable Staffing', 'Florals - Non-Taxable', 'Rentals - Non-Taxable']);

function sectionToTaxBucket(section: string): TaxBucket {
  if (FB_SECTIONS.has(section)) return 'fb';
  if (VENUE_SECTIONS.has(section)) return 'venue';
  if (STAFFING_SECTIONS.has(section)) return 'staffing';
  return 'equipment';
}

function buildLineItems(items: DbLineItem[], markups: DbMarkup[]): LineItem[] {
  return items.map((item) => {
    const markup = markups.find((m) => m.id === item.category_id);
    const isCustom = item.custom_client_unit_price !== null;
    const defaultMarkupPct = isCustom ? 0 : (markup?.markup_pct ?? 0.5);
    return {
      id: item.id,
      section: item.section,
      taxBucket: sectionToTaxBucket(item.section),
      name: item.name,
      qty: item.qty,
      unitPrice: item.unit_price,
      categoryMarkupPct: isCustom ? 0 : (item.markup_override ?? defaultMarkupPct),
      taxType: item.tax_type as TaxType,
      clientCostOverride: isCustom ? item.qty * item.custom_client_unit_price! : undefined,
    };
  });
}

export interface EstimateClientValue {
  /** Client total ($). */
  total: number;
  /** Per-person rate ($/pp). */
  pricePerPerson: number;
}

export function deriveEstimateValue(
  estimate: DbEstimate,
  items: DbLineItem[],
  markups: DbMarkup[],
  config: ProgramConfig,
  transportAgg?: { total_our: number; total_client: number },
): EstimateClientValue {
  if (estimate.type === 'transportation') {
    const agg = transportAgg ?? { total_our: 0, total_client: 0 };
    const summary = calcTransportSummary(
      [{ subtotalOur: agg.total_our, subtotalClient: agg.total_client }],
      config.location.generalTaxRate,
      config.ccProcessingFee,
      estimate.transport_commission ?? 0,
    );
    const total = summary.totalClient;
    return { total, pricePerPerson: config.guestCount > 0 ? total / config.guestCount : 0 };
  }

  const lineItems = buildLineItems(items, markups);
  const sc = estimate.service_charge_override ?? config.serviceChargeDefault;
  const gr = estimate.gratuity_override ?? config.gratuityDefault;
  const af = estimate.admin_fee_override ?? config.adminFeeDefault;
  const discount = estimate.discount_type && estimate.discount_value > 0
    ? { type: estimate.discount_type, value: estimate.discount_value }
    : null;

  const summary = calculateVenueEstimate(
    {
      name: estimate.name,
      fbMinimum: estimate.fb_minimum,
      isVenueTaxable: estimate.is_venue_taxable,
      serviceCharge: sc,
      gratuity: gr,
      adminFee: af,
      lineItems,
      discount,
    },
    config,
  );
  return { total: summary.totalClient, pricePerPerson: summary.pricePerPerson };
}
