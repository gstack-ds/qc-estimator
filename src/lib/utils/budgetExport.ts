/**
 * Budget vs Charged spreadsheet export.
 * Pure functions — no React, no Supabase, no xlsx import.
 * Returns plain arrays ready to hand to SheetJS aoa_to_sheet().
 */

// ─── Input types ──────────────────────────────────────────

export interface BudgetLineItem {
  section: string;
  name: string;
  isRevenueItem: boolean;
  qty: number;
  unitCost: number;           // our cost per unit (unit_price)
  ourTotal: number;           // qty × unitCost
  markupDisplay: string;      // "55.0%" or "Custom"
  clientUnitPrice: number;    // budgeted / qty
  budgeted: number;           // budgeted client total
  taxType: string;
}

export interface BudgetEstimate {
  id: string;
  name: string;
  type: string;
  lineItems: BudgetLineItem[];
  // Fee rows (service charge, gratuity, admin fee)
  serviceChargeOur: number;
  serviceChargeClient: number;
  serviceChargeLabel: string;
  gratuityOur: number;
  gratuityClient: number;
  gratuityLabel: string;
  adminFeeOur: number;
  adminFeeClient: number;
  adminFeeLabel: string;
  // Taxes
  foodTax: number;
  alcoholTax: number;
  equipmentTax: number;
  venueTax: number;
  productionFeeTax: number;
  // Totals
  productionFee: number;
  travelInFee: number;
  discountAmount: number;
  subtotalOur: number;
  totalTaxes: number;
  totalClient: number;
  // Margin
  vendorCosts: number;
  commissions: number;
  qcMargin: number;
  qcMarginPct: number;
}

export interface BudgetTravelItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface BudgetExportData {
  programName: string;
  clientName: string | null;
  eventDate: string | null;
  guestCount: number;
  exportedAt: string;
  estimates: BudgetEstimate[];
  travelItems: BudgetTravelItem[];
  programTravelTotal: number;
  includeTravelInFee: boolean;
  // Grand totals (across all estimates)
  grandOurCost: number;
  grandBudgeted: number;
  grandTaxes: number;
  grandCommissions: number;
  grandQcMargin: number;
  grandMarginPct: number;
}

// ─── Helpers ──────────────────────────────────────────────

function r(n: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

function pct(n: number): string {
  return r(n * 100, 1).toFixed(1) + '%';
}

// ─── Sheet builders ───────────────────────────────────────

type Row = (string | number | null)[];

/** Sheet 1: Program-level P&L summary — one row per estimate */
export function buildSummarySheet(data: BudgetExportData): Row[] {
  const rows: Row[] = [];

  // Header block
  rows.push([`BUDGET VS CHARGED EXPORT — ${data.programName.toUpperCase()}`]);
  rows.push(['Client:', data.clientName ?? '—', '', 'Event Date:', data.eventDate ?? '—']);
  rows.push(['Guests:', data.guestCount, '', 'Exported:', data.exportedAt]);
  rows.push([]);
  rows.push([
    'NOTE: "Charged" column = Budgeted for V1. Enter actual billed amounts after the event to see variance.',
  ]);
  rows.push([]);

  // Column headers
  rows.push([
    'Estimate',
    'Type',
    'Our Cost',
    'Budgeted',
    'Charged (enter actuals)',
    'Variance $',
    'Variance %',
    'Taxes',
    'Commissions',
    'QC Margin $',
    'QC Margin %',
  ]);

  for (const est of data.estimates) {
    const budgeted = r(est.totalClient);
    rows.push([
      est.name,
      est.type,
      r(est.subtotalOur),
      budgeted,
      budgeted,        // Charged = Budgeted for V1
      0,               // Variance $ = 0
      '0.0%',          // Variance % = 0
      r(est.totalTaxes),
      r(est.commissions),
      r(est.qcMargin),
      pct(est.qcMarginPct),
    ]);
  }

  // Travel row (if not in production fee)
  if (data.programTravelTotal > 0 && !data.includeTravelInFee) {
    rows.push([
      'Travel & Transportation',
      'program',
      r(data.programTravelTotal),
      '',
      '',
      '',
      '',
      '',
      '',
      r(-data.programTravelTotal),   // reduces QC margin
      '',
    ]);
  }

  rows.push([]);

  // Grand total
  rows.push([
    'PROGRAM TOTAL',
    '',
    r(data.grandOurCost),
    r(data.grandBudgeted),
    r(data.grandBudgeted),
    0,
    '0.0%',
    r(data.grandTaxes),
    r(data.grandCommissions),
    r(data.grandQcMargin),
    pct(data.grandMarginPct),
  ]);

  return rows;
}

/** Sheet 2: Line-item detail grouped by estimate → section */
export function buildDetailSheet(data: BudgetExportData): Row[] {
  const rows: Row[] = [];

  // Column headers
  rows.push([
    'Estimate',
    'Section',
    'Item',
    'Rev?',
    'Qty',
    'Unit Cost',
    'Our Total',
    'Markup %',
    'Client Unit',
    'Budgeted',
    'Charged (enter actuals)',
    'Variance $',
    'Variance %',
    'Margin $',
    'Margin %',
    'Tax Type',
    'Notes',
  ]);

  for (const est of data.estimates) {
    // Estimate name row (spanning)
    rows.push([
      `► ${est.name} (${est.type})`,
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    ]);

    // Group line items by section
    const sections = [...new Set(est.lineItems.map(li => li.section))];

    for (const section of sections) {
      const items = est.lineItems.filter(li => li.section === section);

      for (const li of items) {
        const margin = li.budgeted - li.ourTotal;
        const marginPct = li.budgeted > 0 ? margin / li.budgeted : 0;
        rows.push([
          '',
          section,
          li.isRevenueItem ? `${li.name} [REVENUE ITEM]` : li.name,
          li.isRevenueItem ? 'Y' : '',
          li.qty,
          r(li.unitCost),
          r(li.ourTotal),
          li.markupDisplay,
          li.qty > 0 ? r(li.clientUnitPrice) : '',
          r(li.budgeted),
          r(li.budgeted),  // Charged = Budgeted for V1
          0,
          '0.0%',
          r(margin),
          pct(marginPct),
          li.taxType,
          '',
        ]);
      }

      // Section subtotal
      const sectionOur = items.reduce((s, li) => s + li.ourTotal, 0);
      const sectionClient = items.reduce((s, li) => s + li.budgeted, 0);
      const sectionMargin = sectionClient - sectionOur;
      rows.push([
        '',
        `  ${section} subtotal`,
        '',
        '', '',
        r(sectionOur),
        '',
        '',
        '',
        r(sectionClient),
        r(sectionClient),
        0, '0.0%',
        r(sectionMargin),
        sectionClient > 0 ? pct(sectionMargin / sectionClient) : '',
        '', '',
      ]);
    }

    // Fee rows
    const feeRows: { label: string; our: number; client: number }[] = [];
    if (est.serviceChargeClient > 0) feeRows.push({ label: est.serviceChargeLabel, our: est.serviceChargeOur, client: est.serviceChargeClient });
    if (est.gratuityClient > 0) feeRows.push({ label: est.gratuityLabel, our: est.gratuityOur, client: est.gratuityClient });
    if (est.adminFeeClient > 0) feeRows.push({ label: est.adminFeeLabel, our: est.adminFeeOur, client: est.adminFeeClient });
    if (est.productionFee > 0) feeRows.push({ label: 'Production Fee', our: 0, client: est.productionFee });
    if (est.travelInFee > 0) feeRows.push({ label: 'Travel & Transportation', our: est.travelInFee, client: est.travelInFee });

    for (const fee of feeRows) {
      const fMargin = fee.client - fee.our;
      rows.push([
        '',
        'Fees',
        fee.label,
        '', '',
        r(fee.our),
        r(fee.our),
        '',
        '',
        r(fee.client),
        r(fee.client),
        0, '0.0%',
        r(fMargin),
        fee.client > 0 ? pct(fMargin / fee.client) : '',
        '', '',
      ]);
    }

    // Tax rows
    const totalTax = est.foodTax + est.alcoholTax + est.equipmentTax + est.venueTax + est.productionFeeTax;
    if (totalTax > 0) {
      rows.push([
        '',
        'Taxes',
        `Tax (food: ${r(est.foodTax)}, alcohol: ${r(est.alcoholTax)}, other: ${r(est.equipmentTax + est.venueTax + est.productionFeeTax)})`,
        '', '', r(totalTax), r(totalTax), '', '',
        r(totalTax), r(totalTax), 0, '0.0%', 0, '', '', '',
      ]);
    }

    // Discount row
    if (est.discountAmount > 0) {
      rows.push([
        '',
        'Adjustments',
        'Client Discount',
        '', '', '', '', '', '',
        r(-est.discountAmount), r(-est.discountAmount), 0, '0.0%',
        r(-est.discountAmount), '', '', '',
      ]);
    }

    // Estimate total
    const estMargin = est.totalClient - est.subtotalOur;
    rows.push([
      `${est.name} TOTAL`,
      '', '', '', '',
      r(est.subtotalOur),
      '',
      '',
      '',
      r(est.totalClient),
      r(est.totalClient),
      0,
      '0.0%',
      r(estMargin),
      pct(est.qcMarginPct),
      '', '',
    ]);

    rows.push([]);  // blank separator
  }

  // Travel section (not in fee)
  if (data.travelItems.length > 0) {
    rows.push(['► Travel & Transportation (program-level)', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    for (const ti of data.travelItems) {
      rows.push(['', 'Travel', ti.description, '', ti.qty, r(ti.unitPrice), r(ti.total), '', '', r(ti.total), r(ti.total), 0, '0.0%', r(-ti.total), '', '', '']);
    }
    rows.push(['Travel TOTAL', '', '', '', '', r(data.programTravelTotal), '', '', '', r(data.programTravelTotal), r(data.programTravelTotal), 0, '0.0%', r(-data.programTravelTotal), '', '', '']);
    rows.push([]);
  }

  // Grand total
  rows.push([
    'PROGRAM GRAND TOTAL',
    '', '', '', '',
    r(data.grandOurCost),
    '',
    '',
    '',
    r(data.grandBudgeted),
    r(data.grandBudgeted),
    0,
    '0.0%',
    r(data.grandQcMargin),
    pct(data.grandMarginPct),
    '', '',
  ]);

  return rows;
}
