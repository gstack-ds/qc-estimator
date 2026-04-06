// QC Estimator — Core Types
// These types mirror the database schema and are used by the pricing engine.

export type TaxType = 'food' | 'alcohol' | 'general' | 'none';
export type EstimateType = 'venue' | 'av' | 'decor';
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
  name: string;
  qty: number;
  unitPrice: number;
  categoryMarkupPct: number;      // resolved from category lookup
  taxType: TaxType;
  clientCostOverride?: number;    // total client cost; when set, skips markup formula
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
  subtotalClient: number;
  productionFee: number;
  totalOur: number;
  totalClient: number;
  // Per person
  pricePerPerson: number;
  // F&B minimum
  fbMinimumMet: boolean;
  fbShortfall: number;
}

// ─── Margin Analysis ─────────────────────────────────────

export interface MarginAnalysis {
  clientCommissionAmount: number;
  gdpCommissionAmount: number;
  thirdPartyCommissionsTotal: number;
  totalVendorCosts: number;
  qcRevenue: number;
  qcMarginPct: number;
  marginHealth: MarginHealth;
  // True net (after OpEx and travel)
  estimatedTeamHours: number;
  opExEstimate: number;           // hours × $90
  travelExpenses: number;         // Phase 3
  trueNetProfit: number;
  trueNetMarginPct: number;
  trueNetHealth: NetHealth;
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
