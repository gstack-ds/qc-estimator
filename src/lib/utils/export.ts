// Export utilities — shared between ExportButtons and tests
// Pure functions; no React/Next/Supabase dependencies.

import type { EstimateSummary } from '@/types';

export interface LineItemForExport {
  name: string;
  label?: string;
  section: string;
  qty: number;
  unitPrice: number;
  categoryMarkupPct: number;
  categoryId: string | 'custom' | null;
  customClientUnitPrice?: number;
  taxType: string;
}

export interface MarkupForExport {
  id: string;
  name: string;
}

export function fmtAmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function itemClientCost(li: LineItemForExport): number {
  if (li.categoryId === 'custom' && li.customClientUnitPrice !== undefined) {
    return li.qty * li.customClientUnitPrice;
  }
  return li.qty * li.unitPrice * (1 + li.categoryMarkupPct);
}

export function splitStaffingEquipment(
  lineItems: LineItemForExport[],
  markups: MarkupForExport[],
  summary: EstimateSummary
): { staffing: number; equipment: number } {
  const staffingCatId = markups.find((m) => m.name === 'Staffing & Labor')?.id;
  const staffingFromEquipment = lineItems
    .filter((li) => li.section === 'Equipment & Staffing' && staffingCatId && li.categoryId === staffingCatId)
    .reduce((s, li) => s + itemClientCost(li), 0);
  return {
    staffing: summary.qcStaffingSubtotalClient + staffingFromEquipment,
    equipment: summary.equipmentSubtotalClient - staffingFromEquipment,
  };
}

export function buildSummaryRows(
  summary: EstimateSummary,
  type: 'venue' | 'av' | 'decor',
  lineItems: LineItemForExport[],
  markups: MarkupForExport[]
): { label: string; amount: number }[] {
  const tax = summary.foodTax + summary.alcoholTax + summary.equipmentTax + summary.venueTax;
  const rows: { label: string; amount: number }[] = [];

  if (type === 'av') {
    if (summary.equipmentSubtotalClient > 0) rows.push({ label: 'AV Equipment', amount: summary.equipmentSubtotalClient });
    if (summary.qcStaffingSubtotalClient > 0) rows.push({ label: 'Labor & Fees', amount: summary.qcStaffingSubtotalClient });
    if (tax > 0) rows.push({ label: 'Tax', amount: tax });
    if (summary.productionFee > 0) rows.push({ label: 'Production Fee', amount: summary.productionFee });
  } else if (type === 'decor') {
    if (summary.equipmentSubtotalClient > 0) rows.push({ label: 'Florals & Rentals', amount: summary.equipmentSubtotalClient });
    if (summary.qcStaffingSubtotalClient > 0) rows.push({ label: 'Non-Taxable Fees', amount: summary.qcStaffingSubtotalClient });
    if (tax > 0) rows.push({ label: 'Tax', amount: tax });
    if (summary.productionFee > 0) rows.push({ label: 'Production Fee', amount: summary.productionFee });
  } else {
    // Venue: Menu / Bar Package / Staffing / Equipment / Venue Rental / Production Fee / Tax
    const { staffing, equipment } = splitStaffingEquipment(lineItems, markups, summary);
    if (summary.fbFoodSubtotalClient > 0)    rows.push({ label: 'Menu', amount: summary.fbFoodSubtotalClient });
    if (summary.fbAlcoholSubtotalClient > 0) rows.push({ label: 'Bar Package', amount: summary.fbAlcoholSubtotalClient });
    if (staffing > 0)                        rows.push({ label: 'Staffing', amount: staffing });
    if (equipment > 0)                       rows.push({ label: 'Equipment', amount: equipment });
    if (summary.venueSubtotalClient > 0)     rows.push({ label: 'Venue Rental', amount: summary.venueSubtotalClient });
    if (summary.productionFee > 0)           rows.push({ label: 'Production Fee', amount: summary.productionFee });
    if (tax > 0)                             rows.push({ label: 'Tax', amount: tax });
  }

  return rows;
}

export function buildLineItemsCopyText(
  lineItems: LineItemForExport[],
  estimateName: string
): string {
  const header = `${estimateName.toUpperCase()}\n\nItem Name\tLabel\tQty\tUnit Price\tTotal`;
  const rows = lineItems
    .filter((li) => li.qty > 0 && (li.unitPrice > 0 || (li.categoryId === 'custom' && (li.customClientUnitPrice ?? 0) > 0)))
    .map((li) => {
      const clientUnit = li.categoryId === 'custom' && li.customClientUnitPrice !== undefined
        ? li.customClientUnitPrice
        : li.unitPrice * (1 + li.categoryMarkupPct);
      const clientTotal = li.qty * clientUnit;
      return `${li.name}\t${li.label ?? ''}\t${li.qty}\t${fmtAmt(clientUnit)}\t${fmtAmt(clientTotal)}`;
    });
  if (rows.length === 0) return `${estimateName.toUpperCase()}\n\n(no line items)`;
  return `${header}\n${rows.join('\n')}`;
}

export function buildCopyText(
  summary: EstimateSummary,
  guestCount: number,
  type: 'venue' | 'av' | 'decor',
  estimateName: string,
  lineItems: LineItemForExport[],
  markups: MarkupForExport[]
): string {
  const pp = guestCount > 0 ? Math.ceil(summary.totalClient / guestCount) : 0;
  const rows = buildSummaryRows(summary, type, lineItems, markups);

  const lines = [
    estimateName.toUpperCase(),
    '',
    'Item\tAmount',
    ...rows.map(({ label, amount }) => `${label}\t${fmtAmt(amount)}`),
    `TOTAL ESTIMATE\t${fmtAmt(summary.totalClient)}`,
    `Price PP\t${fmtAmt(pp)}`,
  ];

  return lines.join('\n');
}
