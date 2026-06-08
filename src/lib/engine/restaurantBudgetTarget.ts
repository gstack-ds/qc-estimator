// Reverse budget target calculator — venue/restaurant estimates only.
// Pure TypeScript. No React, no Next.js, no Supabase imports.
//
// Exact inverse of the forward pricing engine (pricing.ts) for F&B-only scenarios.
// Given a target client $/pp budget, peels off markup, fees, tax, and production
// fee to reveal the maximum vendor F&B spend per person.
//
// Math derivation (all variables are per-person, assuming 100% food taxType):
//
//   feeRate  = serviceChargeRate + gratuityRate + adminFeeRate
//   A        = 1 + feeRate                        (total F&B multiplier including fees)
//
//   clientFB  = vendorCost × (1 + fbMarkupPct)
//   fees      = clientFB × feeRate
//   fbTax     = clientFB × foodTaxRate             (on client cost, zero if taxExempt)
//   markupRev = clientFB + fees                    (production fee base — FB portion only)
//   subtotal  = clientFB + fbTax + fees            (production fee multiplied on this)
//   prodFee   = subtotal × ccFee + markupRev × clientComm
//   prodTax   = prodFee × generalTaxRate           (zero if taxExempt)
//   total     = subtotal + prodFee + prodTax
//
//   Expanding: total = clientFB × [(1 + feeRate + foodTaxRate) + K1 × (1 + generalTaxRate)]
//     where K1 = (1 + feeRate + foodTaxRate) × ccFee + (1 + feeRate) × clientComm
//   => K2 = (1 + feeRate + foodTaxRate) + K1 × (1 + generalTaxRate)
//   => clientFBPP = targetPP / K2

export interface BudgetTargetInput {
  targetClientPP: number;        // client budget per person (e.g. 150)
  fbMarkupPct: number;           // category markup as decimal (e.g. 0.55)
  foodTaxRate: number;           // food tax rate (e.g. 0.0775)
  generalTaxRate: number;        // general sales tax rate (for production fee tax)
  serviceChargeRate: number;     // e.g. 0.20 or 0
  gratuityRate: number;          // e.g. 0.20 or 0
  adminFeeRate: number;          // e.g. 0.05 or 0
  ccProcessingFee: number;       // e.g. 0.035
  clientCommission: number;      // e.g. 0.05
  taxExempt: boolean;
}

export interface BudgetTargetResult {
  // Per-person cost breakdown
  vendorCostPerPerson: number;     // maximum F&B vendor spend per person
  clientFBPerPerson: number;       // client F&B cost (vendorCost × (1 + markup))
  serviceChargePerPerson: number;
  gratuityPerPerson: number;
  adminFeePerPerson: number;
  fbTaxPerPerson: number;
  productionFeePerPerson: number;
  productionFeeTaxPerPerson: number;
  totalCheck: number;              // must equal targetClientPP (within floating point)
}

export function reverseCalculateBudgetTarget(input: BudgetTargetInput): BudgetTargetResult {
  const {
    targetClientPP,
    fbMarkupPct,
    foodTaxRate,
    generalTaxRate,
    serviceChargeRate,
    gratuityRate,
    adminFeeRate,
    ccProcessingFee,
    clientCommission,
    taxExempt,
  } = input;

  if (targetClientPP <= 0) {
    return {
      vendorCostPerPerson: 0,
      clientFBPerPerson: 0,
      serviceChargePerPerson: 0,
      gratuityPerPerson: 0,
      adminFeePerPerson: 0,
      fbTaxPerPerson: 0,
      productionFeePerPerson: 0,
      productionFeeTaxPerPerson: 0,
      totalCheck: 0,
    };
  }

  const tm = taxExempt ? 0 : 1;

  const feeRate = serviceChargeRate + gratuityRate + adminFeeRate;

  // K1 = production fee coefficient applied to clientFB
  //   prodFee = subtotal × ccFee + markupRev × clientComm
  //   subtotal  ∋ clientFB × (1 + feeRate + tm × foodTaxRate)
  //   markupRev ∋ clientFB × (1 + feeRate)
  const K1 =
    (1 + feeRate + tm * foodTaxRate) * ccProcessingFee +
    (1 + feeRate) * clientCommission;

  // K2 = total multiplier: total = clientFB × K2
  const K2 =
    (1 + feeRate + tm * foodTaxRate) +
    K1 * (1 + tm * generalTaxRate);

  const clientFBPerPerson = targetClientPP / K2;
  const vendorCostPerPerson = clientFBPerPerson / (1 + fbMarkupPct);

  const serviceChargePerPerson = clientFBPerPerson * serviceChargeRate;
  const gratuityPerPerson = clientFBPerPerson * gratuityRate;
  const adminFeePerPerson = clientFBPerPerson * adminFeeRate;
  const fbTaxPerPerson = tm * clientFBPerPerson * foodTaxRate;

  const subtotalPerPerson = clientFBPerPerson + fbTaxPerPerson + serviceChargePerPerson + gratuityPerPerson + adminFeePerPerson;
  const markupRevPerPerson = clientFBPerPerson + serviceChargePerPerson + gratuityPerPerson + adminFeePerPerson;

  const productionFeePerPerson = subtotalPerPerson * ccProcessingFee + markupRevPerPerson * clientCommission;
  const productionFeeTaxPerPerson = tm * productionFeePerPerson * generalTaxRate;

  const totalCheck = subtotalPerPerson + productionFeePerPerson + productionFeeTaxPerPerson;

  return {
    vendorCostPerPerson,
    clientFBPerPerson,
    serviceChargePerPerson,
    gratuityPerPerson,
    adminFeePerPerson,
    fbTaxPerPerson,
    productionFeePerPerson,
    productionFeeTaxPerPerson,
    totalCheck,
  };
}
