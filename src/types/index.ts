// QC Estimator — Core Types
// These types mirror the database schema and are used by the pricing engine.

export type TaxType = 'food' | 'alcohol' | 'general' | 'none';
export type TaxBucket = 'fb' | 'equipment' | 'venue' | 'staffing';
export type EstimateType = 'venue' | 'av' | 'decor' | 'transportation';
export type FeeOption = number; // stored as decimal (e.g. 0.20 = 20%)
export type MarginHealth = '✓ STRONG' | '→ ON TARGET' | '⚠ REVIEW' | '✗ BELOW FLOOR';
export type NetHealth = '✓ STRONG' | '→ ON TARGET' | '⚠ THIN' | '✗ LOSING MONEY';

// ─── Reference Data ──────────────────────────────────────

export interface Location {
  id: string;
  name: string;
  foodTaxRate: number;
  alcoholTaxRate: number;
  generalTaxRate: number;
  effectiveDate?: string;
}

export interface CategoryMarkup {
  id: string;
  name: string;
  markupPct: number;
  notes?: string;
  sortOrder: number;
}

export interface TeamHoursTier {
  revenueThreshold: number;
  baseHours: number;
  tierName: string;
}

// ─── Program (Event Configuration) ───────────────────────

export interface ProgramConfig {
  guestCount: number;
  location: Location;
  ccProcessingFee: number;       // e.g., 0.035
  clientCommission: number;       // e.g., 0.05
  gdpCommissionEnabled: boolean;
  gdpCommissionRate: number;      // e.g., 0.065
  serviceChargeDefault: FeeOption;
  gratuityDefault: FeeOption;
  adminFeeDefault: FeeOption;
  thirdPartyCommissions?: { name: string; rate: number }[];
}

// ─── Line Items ──────────────────────────────────────────

export interface LineItem {
  id: string;
  section: string;
  taxBucket: TaxBucket;
  name: string;
  qty: number;
  unitPrice: number;
  categoryMarkupPct: number;      // resolved from category lookup
  taxType: TaxType;
  clientCostOverride?: number;    // total client cost; when set, skips markup formula
  isRevenueItem?: boolean;        // when true: ourCost=0, clientCost=qty*unitPrice (no markup)
}

export interface CalculatedLineItem extends LineItem {
  ourCost: number;                // qty × unitPrice
  clientCost: number;             // ourCost × (1 + markupPct)
  taxRate: number;                // resolved from location based on taxType
  taxAmount: number;              // clientCost × taxRate (or ourCost × taxRate for internal)
}

// ─── Estimate (Venue Scenario) ───────────────────────────

export interface VenueEstimateInput {
  name: string;
  fbMinimum: number;
  isVenueTaxable: boolean;
  serviceCharge: FeeOption;       // override or default
  gratuity: FeeOption;            // override or default
  adminFee: FeeOption;            // override or default
  lineItems: LineItem[];
  discount?: { type: 'percent' | 'flat'; value: number } | null;
  taxExempt?: boolean;
}

export interface EstimateSummary {
  // Subtotals by section
  fbSubtotalOur: number;
  fbSubtotalClient: number;
  fbFoodSubtotalClient: number;
  fbAlcoholSubtotalClient: number;
  foodTax: number;
  alcoholTax: number;
  equipmentSubtotalOur: number;
  equipmentSubtotalClient: number;
  equipmentTax: number;
  qcStaffingSubtotalOur: number;
  qcStaffingSubtotalClient: number;
  venueSubtotalOur: number;
  venueSubtotalClient: number;
  venueTax: number;
  // Restaurant fees (on F&B subtotal)
  serviceChargeOur: number;
  serviceChargeClient: number;
  gratuityOur: number;
  gratuityClient: number;
  adminFeeOur: number;
  adminFeeClient: number;
  // Totals
  subtotalOur: number;
  subtotalClient: number;      // line items + line-item taxes (production fee base)
  productionFee: number;
  productionFeeTax: number;    // productionFee × generalTaxRate (new: prod fee is taxable)
  lineItemsSubtotalClient: number; // line items without any tax (display "Subtotal" line)
  preTaxTotal: number;         // lineItemsSubtotalClient + productionFee (before all taxes)
  totalOur: number;
  totalClient: number;
  // Margin support fields
  vendorTaxesTotal: number;       // foodTaxOur + alcoholTaxOur + equipmentTaxOur + venueTaxOur
  revenueItemsClientTotal: number; // sum of clientCost for isRevenueItem items
  // Per person
  pricePerPerson: number;
  // F&B minimum
  fbMinimumMet: boolean;
  fbShortfall: number;
  // Discount (0 when no discount applied)
  discountAmount: number;
}

// ─── Margin Analysis ─────────────────────────────────────

export interface MarginAnalysis {
  // Cost breakdown
  vendorCostsBase: number;        // item ourCosts without taxes
  totalTaxes: number;             // client-side taxes (pass-through)
  ccProcessingAmount: number;     // subtotalClient × ccRate (pass-through)
  clientCommissionAmount: number;
  gdpCommissionAmount: number;
  thirdPartyCommissionsTotal: number;
  totalVendorCosts: number;       // alias for vendorCostsBase
  qcRevenue: number;
  qcMarginPct: number;
  marginHealth: MarginHealth;
  // True net (after OpEx and travel)
  estimatedTeamHours: number;
  opExEstimate: number;           // hours × $90
  travelExpenses: number;
  trueNetProfit: number;
  trueNetMarginPct: number;
  trueNetHealth: NetHealth;
}

// ─── Show Math rates (passed to summary panels for formula display) ──────────

export interface SummaryMathRates {
  serviceChargeRate: number;
  gratuityRate: number;
  adminFeeRate: number;
  ccProcessingFee: number;
  clientCommissionRate: number;
  foodTaxRate: number;
  alcoholTaxRate: number;
  generalTaxRate: number;
}

// ─── Comparison ──────────────────────────────────────────

export interface ScenarioComparison {
  estimateId: string;
  estimateName: string;
  totalClient: number;
  pricePerPerson: number;
  lineItemCount: number;
  isLowest: boolean;
}

// ─── Client-Ready Export ─────────────────────────────────

export interface ClientExportRow {
  item: string;
  amount: number;
  perPerson: number;
}
