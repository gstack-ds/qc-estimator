'use client';

import { useState } from 'react';
import type { EstimateSummary } from '@/types';

// ─── Prop types ───────────────────────────────────────────

export interface LineItemForExport {
  name: string;
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

interface Props {
  programId: string;
  programName: string;
  estimateName: string;
  summary: EstimateSummary;
  guestCount: number;
  estimateType?: 'venue' | 'av' | 'decor';
  lineItems: LineItemForExport[];
  markups: MarkupForExport[];
}

// ─── Helpers ──────────────────────────────────────────────

function fmtAmt(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function itemClientCost(li: LineItemForExport): number {
  if (li.categoryId === 'custom' && li.customClientUnitPrice !== undefined) {
    return li.qty * li.customClientUnitPrice;
  }
  return li.qty * li.unitPrice * (1 + li.categoryMarkupPct);
}

// Split Equipment & Staffing section into staffing-category vs equipment-category items
function splitStaffingEquipment(
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

// Shared row builder used by both Copy and Excel
function buildSummaryRows(
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
    if (summary.fbFoodSubtotalClient > 0)  rows.push({ label: 'Menu', amount: summary.fbFoodSubtotalClient });
    if (summary.fbAlcoholSubtotalClient > 0) rows.push({ label: 'Bar Package', amount: summary.fbAlcoholSubtotalClient });
    if (staffing > 0)                        rows.push({ label: 'Staffing', amount: staffing });
    if (equipment > 0)                       rows.push({ label: 'Equipment', amount: equipment });
    if (summary.venueSubtotalClient > 0)     rows.push({ label: 'Venue Rental', amount: summary.venueSubtotalClient });
    if (summary.productionFee > 0)           rows.push({ label: 'Production Fee', amount: summary.productionFee });
    if (tax > 0)                             rows.push({ label: 'Tax', amount: tax });
  }

  return rows;
}

function buildCopyText(
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
    'Item | Amount',
    ...rows.map(({ label, amount }) => `${label} | ${fmtAmt(amount)}`),
    `TOTAL ESTIMATE | ${fmtAmt(summary.totalClient)}`,
    `Price PP | ${fmtAmt(pp)}`,
  ];

  return lines.join('\n');
}

// ─── Component ────────────────────────────────────────────

export default function ExportButtons({
  programId: _programId,
  programName,
  estimateName,
  summary,
  guestCount,
  estimateType = 'venue',
  lineItems,
  markups,
}: Props) {
  const [copyLabel, setCopyLabel] = useState<'Copy Numbers' | 'Copied!'>('Copy Numbers');
  const [exporting, setExporting] = useState(false);

  async function handleCopy() {
    const text = buildCopyText(summary, guestCount, estimateType, estimateName, lineItems, markups);
    await navigator.clipboard.writeText(text);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy Numbers'), 2000);
  }

  async function handleExcel() {
    setExporting(true);
    try {
      const xlsx = await import('xlsx');
      const wb = xlsx.utils.book_new();

      // ── Sheet 1: Client Summary ────────────────────────────
      const pp = guestCount > 0 ? Math.ceil(summary.totalClient / guestCount) : 0;
      const summaryRows = buildSummaryRows(summary, estimateType, lineItems, markups);

      const sheet1: (string | number)[][] = [
        [estimateName.toUpperCase()],
        [],
        ['Item', 'Amount'],
        ...summaryRows.map(({ label, amount }) => [label, Math.round(amount * 100) / 100]),
        ['TOTAL ESTIMATE', Math.round(summary.totalClient * 100) / 100],
        ['Price PP', Math.round(pp * 100) / 100],
      ];
      const ws1 = xlsx.utils.aoa_to_sheet(sheet1);
      xlsx.utils.book_append_sheet(wb, ws1, 'Client Summary');

      // ── Sheet 2: Detail ────────────────────────────────────
      const sheet2: (string | number | string)[][] = [
        ['Item', 'Section', 'Qty', 'Unit Price', 'Our Cost', 'Markup %', 'Client Cost'],
      ];
      for (const li of lineItems) {
        const ourCost = li.qty * li.unitPrice;
        const clientCost = itemClientCost(li);
        const markupDisplay = li.categoryId === 'custom'
          ? 'Custom'
          : `${parseFloat((li.categoryMarkupPct * 100).toFixed(1))}%`;
        sheet2.push([li.name, li.section, li.qty, li.unitPrice, ourCost, markupDisplay, Math.round(clientCost * 100) / 100]);
      }
      sheet2.push([]);
      sheet2.push(['', '', '', '', '', 'TOTAL', Math.round(summary.totalClient * 100) / 100]);

      const ws2 = xlsx.utils.aoa_to_sheet(sheet2);
      xlsx.utils.book_append_sheet(wb, ws2, 'Detail');

      const safeName = (estimateName || programName).replace(/[^\w\s-]/g, '').trim();
      xlsx.writeFile(wb, `${safeName}_estimate.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  const btnClass = 'text-xs px-2.5 py-1 rounded border border-brand-cream bg-white hover:bg-brand-offwhite text-brand-charcoal/70 hover:text-brand-charcoal transition-colors';

  return (
    <div className="flex items-center gap-2">
      <button onClick={handleCopy} className={btnClass}>
        {copyLabel}
      </button>
      <button onClick={handleExcel} disabled={exporting} className={btnClass + (exporting ? ' opacity-50' : '')}>
        {exporting ? 'Exporting…' : 'Export to Excel'}
      </button>
    </div>
  );
}
