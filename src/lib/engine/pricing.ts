// QC Estimator — Pricing Engine
// Pure TypeScript. No React, no Next.js, no Supabase imports.
// This module takes structured inputs and returns calculated results.

import type {
  LineItem,
  CalculatedLineItem,
  ProgramConfig,
  VenueEstimateInput,
  EstimateSummary,
  MarginAnalysis,
  MarginHealth,
  NetHealth,
  FeeOption,
  TaxType,
  TeamHoursTier,
  ClientExportRow,
} from '../../types';

// ─── Fee Parsing ─────────────────────────────────────────

export function parseFeeRate(fee: FeeOption): number {
  if (fee === '20%') return 0.20;
  if (fee === '21.5%') return 0.215;
  if (fee === '5%') return 0.05;
  return 0; // 'None'
}

// ─── Tax Rate Resolution ─────────────────────────────────

export function getTaxRate(
  taxType: TaxType,
  config: ProgramConfig
): number {
  switch (taxType) {
    case 'food': return config.location.foodTaxRate;
    case 'alcohol': return config.location.alcoholTaxRate;
    case 'general': return config.location.generalTaxRate;
    case 'none': return 0;
  }
}

// ─── Line Item Calculation ───────────────────────────────

export function calculateLineItem(
  item: LineItem,
  config: ProgramConfig
): CalculatedLineItem {
  const ourCost = item.qty * item.unitPrice;
  const clientCost = item.clientCostOverride ?? ourCost * (1 + item.categoryMarkupPct);
  const taxRate = getTaxRate(item.taxType, config);

  return {
    ...item,
    ourCost,
    clientCost,
    taxRate,
    taxAmount: clientCost * taxRate,
  };
}

// ─── Venue Estimate Summary ──────────────────────────────

export function calculateVenueEstimate(
  input: VenueEstimateInput,
  config: ProgramConfig
): EstimateSummary {
  const calculated = input.lineItems.map((li) => calculateLineItem(li, config));

  // Group by section
  const fb = calculated.filter((li) => li.section === 'F&B');
  const equipment = calculated.filter((li) => li.section === 'Equipment & Staffing');
  const venue = calculated.filter((li) => li.section === 'Venue Fees');
  const qcStaffing = calculated.filter((li) => li.section === 'Non-Taxable Staffing');

  // Subtotals
  const fbSubtotalOur = fb.reduce((s, li) => s + li.ourCost, 0);
  const fbSubtotalClient = fb.reduce((s, li) => s + li.clientCost, 0);
  const equipmentSubtotalOur = equipment.reduce((s, li) => s + li.ourCost, 0);
  const equipmentSubtotalClient = equipment.reduce((s, li) => s + li.clientCost, 0);
  const venueSubtotalOur = venue.reduce((s, li) => s + li.ourCost, 0);
  const venueSubtotalClient = venue.reduce((s, li) => s + li.clientCost, 0);
  const qcStaffingSubtotalOur = qcStaffing.reduce((s, li) => s + li.ourCost, 0);
  const qcStaffingSubtotalClient = qcStaffing.reduce((s, li) => s + li.clientCost, 0);

  // Tax — food items
  const foodItems = fb.filter((li) => li.taxType === 'food');
  const fbFoodSubtotalClient = foodItems.reduce((s, li) => s + li.clientCost, 0);
  const foodTaxOur = foodItems.reduce((s, li) => s + li.ourCost * li.taxRate, 0);
  const foodTax = foodItems.reduce((s, li) => s + li.clientCost * li.taxRate, 0);

  // Tax — alcohol items
  const alcoholItems = fb.filter((li) => li.taxType === 'alcohol');
  const fbAlcoholSubtotalClient = alcoholItems.reduce((s, li) => s + li.clientCost, 0);
  const alcoholTaxOur = alcoholItems.reduce((s, li) => s + li.ourCost * li.taxRate, 0);
  const alcoholTax = alcoholItems.reduce((s, li) => s + li.clientCost * li.taxRate, 0);

  // Tax — equipment (general sales tax)
  const equipmentTaxOur = equipmentSubtotalOur * config.location.generalTaxRate;
  const equipmentTax = equipmentSubtotalClient * config.location.generalTaxRate;

  // Tax — venue (if taxable)
  const venueTaxRate = input.isVenueTaxable ? config.location.generalTaxRate : 0;
  const venueTaxOur = venueSubtotalOur * venueTaxRate;
  const venueTax = venueSubtotalClient * venueTaxRate;

  // Restaurant fees (applied to F&B subtotals)
  const serviceChargeRate = parseFeeRate(input.serviceCharge);
  const gratuityRate = parseFeeRate(input.gratuity);
  const adminFeeRate = parseFeeRate(input.adminFee);

  const serviceChargeOur = fbSubtotalOur * serviceChargeRate;
  const serviceChargeClient = fbSubtotalClient * serviceChargeRate;
  const gratuityOur = fbSubtotalOur * gratuityRate;
  const gratuityClient = fbSubtotalClient * gratuityRate;
  const adminFeeOur = fbSubtotalOur * adminFeeRate;
  const adminFeeClient = fbSubtotalClient * adminFeeRate;

  // Subtotals (everything before production fee)
  const subtotalOur =
    fbSubtotalOur + foodTaxOur + alcoholTaxOur +
    equipmentSubtotalOur + equipmentTaxOur +
    qcStaffingSubtotalOur +
    venueSubtotalOur + venueTaxOur +
    serviceChargeOur + gratuityOur + adminFeeOur;

  const subtotalClient =
    fbSubtotalClient + foodTax + alcoholTax +
    equipmentSubtotalClient + equipmentTax +
    qcStaffingSubtotalClient +
    venueSubtotalClient + venueTax +
    serviceChargeClient + gratuityClient + adminFeeClient;

  // Production fee = CC processing on client subtotal + client commission on markup revenue
  // Markup revenue = fbClient + equipClient + qcStaffClient + venueClient + serviceCharge + gratuity + adminFee
  const markupRevenue =
    fbSubtotalClient + equipmentSubtotalClient + qcStaffingSubtotalClient +
    venueSubtotalClient + serviceChargeClient + gratuityClient + adminFeeClient;

  const productionFee =
    subtotalClient * config.ccProcessingFee +
    markupRevenue * config.clientCommission;

  // Totals
  const totalOur = subtotalOur + productionFee;
  const totalClient = subtotalClient + productionFee;

  // Per person
  const pricePerPerson = config.guestCount > 0
    ? Math.ceil(totalClient / config.guestCount)
    : 0;

  // F&B minimum check
  const fbMinimumMet = fbSubtotalOur >= input.fbMinimum;
  const fbShortfall = fbMinimumMet ? 0 : input.fbMinimum - fbSubtotalOur;

  return {
    fbSubtotalOur, fbSubtotalClient,
    fbFoodSubtotalClient, fbAlcoholSubtotalClient,
    foodTax, alcoholTax,
    equipmentSubtotalOur, equipmentSubtotalClient, equipmentTax,
    qcStaffingSubtotalOur, qcStaffingSubtotalClient,
    venueSubtotalOur, venueSubtotalClient, venueTax,
    serviceChargeOur, serviceChargeClient,
    gratuityOur, gratuityClient,
    adminFeeOur, adminFeeClient,
    subtotalOur, subtotalClient,
    productionFee,
    totalOur, totalClient,
    pricePerPerson,
    fbMinimumMet, fbShortfall,
  };
}

// ─── Margin Analysis ─────────────────────────────────────

export function getMarginHealth(marginPct: number): MarginHealth {
  if (marginPct >= 0.35) return '✓ STRONG';
  if (marginPct >= 0.28) return '→ ON TARGET';
  if (marginPct >= 0.22) return '⚠ REVIEW';
  return '✗ BELOW FLOOR';
}

export function getNetHealth(netPct: number): NetHealth {
  if (netPct >= 0.15) return '✓ STRONG';
  if (netPct >= 0.07) return '→ ON TARGET';
  if (netPct >= 0) return '⚠ THIN';
  return '✗ LOSING MONEY';
}

export function lookupTeamHours(
  clientTotal: number,
  tiers: TeamHoursTier[]
): number {
  const sorted = [...tiers].sort((a, b) => b.revenueThreshold - a.revenueThreshold);
  const tier = sorted.find((t) => clientTotal >= t.revenueThreshold);
  return tier?.baseHours ?? 5;
}

export function calculateMarginAnalysis(
  summary: EstimateSummary,
  config: ProgramConfig,
  tiers: TeamHoursTier[],
  travelExpenses: number = 0
): MarginAnalysis {
  const markupRevenue =
    summary.fbSubtotalClient + summary.equipmentSubtotalClient +
    summary.qcStaffingSubtotalClient + summary.venueSubtotalClient +
    summary.serviceChargeClient + summary.gratuityClient + summary.adminFeeClient;

  const clientCommissionAmount = markupRevenue * config.clientCommission;
  const gdpCommissionAmount = config.gdpCommissionEnabled
    ? markupRevenue * config.gdpCommissionRate
    : 0;

  const thirdPartyCommissionsTotal = (config.thirdPartyCommissions ?? [])
    .reduce((s, c) => s + markupRevenue * c.rate, 0);

  const totalVendorCosts = summary.totalOur;
  const qcRevenue = summary.totalClient - clientCommissionAmount - gdpCommissionAmount - thirdPartyCommissionsTotal - totalVendorCosts;
  const qcMarginPct = summary.totalClient > 0 ? qcRevenue / summary.totalClient : 0;
  const marginHealth = getMarginHealth(qcMarginPct);

  const estimatedTeamHours = lookupTeamHours(summary.totalClient, tiers);
  const opExEstimate = estimatedTeamHours * 90;

  const trueNetProfit = qcRevenue - opExEstimate - travelExpenses;
  const trueNetMarginPct = summary.totalClient > 0 ? trueNetProfit / summary.totalClient : 0;
  const trueNetHealth = getNetHealth(trueNetMarginPct);

  return {
    clientCommissionAmount,
    gdpCommissionAmount,
    thirdPartyCommissionsTotal,
    totalVendorCosts,
    qcRevenue,
    qcMarginPct,
    marginHealth,
    estimatedTeamHours,
    opExEstimate,
    travelExpenses,
    trueNetProfit,
    trueNetMarginPct,
    trueNetHealth,
  };
}

// ─── Client Export Builder ───────────────────────────────

export function buildClientExport(
  summary: EstimateSummary,
  guestCount: number
): ClientExportRow[] {
  const pp = (amount: number) => guestCount > 0 ? Math.ceil(amount / guestCount) : 0;

  const rows: ClientExportRow[] = [];

  if (summary.fbSubtotalClient > 0) {
    // Split food vs bar for client view
    rows.push({ item: 'Menu', amount: summary.fbSubtotalClient - (summary.alcoholTax > 0 ? summary.fbSubtotalClient * 0.4 : 0), perPerson: 0 });
  }

  // Simplified: group into client-friendly categories
  const items: [string, number][] = [
    ['Menu', summary.fbSubtotalClient],
    ['Staffing', summary.qcStaffingSubtotalClient],
    ['Equipment', summary.equipmentSubtotalClient],
    ['Venue Rental', summary.venueSubtotalClient],
    ['Production Fee', summary.productionFee],
    ['Tax', summary.foodTax + summary.alcoholTax + summary.equipmentTax + summary.venueTax],
  ];

  return items
    .filter(([, amount]) => amount > 0)
    .map(([item, amount]) => ({
      item,
      amount: Math.round(amount),
      perPerson: pp(amount),
    }));
}
