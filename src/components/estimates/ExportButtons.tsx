'use client';

import { useState } from 'react';
import type { EstimateSummary } from '@/types';
import { getExportDataForProgram } from '@/app/(programs)/programs/[id]/estimates/actions';

interface Props {
  programId: string;
  programName: string;
  estimateName: string;
  summary: EstimateSummary;
  guestCount: number;
  estimateType?: 'venue' | 'av' | 'decor';
}

function fmtAmtDecimal(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildCopyText(
  summary: EstimateSummary,
  guestCount: number,
  type: 'venue' | 'av' | 'decor',
  estimateName: string
): string {
  const tax = summary.foodTax + summary.alcoholTax + summary.equipmentTax + summary.venueTax;
  const pp = guestCount > 0 ? Math.ceil(summary.totalClient / guestCount) : 0;

  const rows: [string, number][] = [];

  if (type === 'av') {
    if (summary.equipmentSubtotalClient > 0) rows.push(['AV Equipment', summary.equipmentSubtotalClient]);
    if (summary.qcStaffingSubtotalClient > 0) rows.push(['Labor & Fees', summary.qcStaffingSubtotalClient]);
    if (tax > 0) rows.push(['Tax', tax]);
    if (summary.productionFee > 0) rows.push(['Production Fee', summary.productionFee]);
  } else if (type === 'decor') {
    if (summary.equipmentSubtotalClient > 0) rows.push(['Florals & Rentals', summary.equipmentSubtotalClient]);
    if (summary.qcStaffingSubtotalClient > 0) rows.push(['Non-Taxable Fees', summary.qcStaffingSubtotalClient]);
    if (tax > 0) rows.push(['Tax', tax]);
    if (summary.productionFee > 0) rows.push(['Production Fee', summary.productionFee]);
  } else {
    // Venue: exact format for Canva paste
    if (summary.fbFoodSubtotalClient > 0) rows.push(['Menu', summary.fbFoodSubtotalClient]);
    if (summary.fbAlcoholSubtotalClient > 0) rows.push(['Bar Package', summary.fbAlcoholSubtotalClient]);
    if (summary.qcStaffingSubtotalClient > 0) rows.push(['Staffing', summary.qcStaffingSubtotalClient]);
    if (summary.equipmentSubtotalClient > 0) rows.push(['Equipment', summary.equipmentSubtotalClient]);
    if (summary.venueSubtotalClient > 0) rows.push(['Venue Rental', summary.venueSubtotalClient]);
    if (summary.productionFee > 0) rows.push(['Production Fee', summary.productionFee]);
    if (tax > 0) rows.push(['Tax', tax]);
  }

  const header = `${estimateName}\n\nItem | Amount`;
  const itemLines = rows.map(([label, amt]) => `${label} | ${fmtAmtDecimal(amt)}`);
  const total = `TOTAL ESTIMATE | ${fmtAmtDecimal(summary.totalClient)}`;
  const pricePP = `Price PP | ${fmtAmtDecimal(pp)}`;

  return [header, ...itemLines, total, pricePP].join('\n');
}

export default function ExportButtons({ programId, programName, estimateName, summary, guestCount, estimateType = 'venue' }: Props) {
  const [copyLabel, setCopyLabel] = useState<'Copy Numbers' | 'Copied!'>('Copy Numbers');
  const [exporting, setExporting] = useState(false);

  async function handleCopy() {
    const text = buildCopyText(summary, guestCount, estimateType, estimateName);
    await navigator.clipboard.writeText(text);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy Numbers'), 2000);
  }

  async function handleExcel() {
    setExporting(true);
    try {
      const { data, error } = await getExportDataForProgram(programId);
      if (error || !data) {
        setExporting(false);
        return;
      }

      const xlsx = await import('xlsx');
      const wb = xlsx.utils.book_new();

      for (const { estimate, lineItems } of data) {
        const rows: (string | number)[][] = [
          ['Item', 'Section', 'Qty', 'Unit Price', 'Our Cost', 'Client Cost'],
        ];
        for (const li of lineItems) {
          const ourCost = li.qty * li.unit_price;
          const customTotal = li.custom_client_unit_price != null ? li.qty * li.custom_client_unit_price : null;
          rows.push([
            li.name,
            li.section,
            li.qty,
            li.unit_price,
            ourCost,
            customTotal ?? ourCost,
          ]);
        }
        rows.push([]);
        rows.push(['', '', '', '', 'Subtotal', lineItems.reduce((s, li) => s + li.qty * li.unit_price, 0)]);
        rows.push(['', '', '', '', 'Total', summary.totalClient]);
        rows.push(['', '', '', '', 'Per Person', summary.pricePerPerson]);

        const ws = xlsx.utils.aoa_to_sheet(rows);
        const sheetName = estimate.name.slice(0, 31).replace(/[\\/\*\[\]:?]/g, '');
        xlsx.utils.book_append_sheet(wb, ws, sheetName || 'Estimate');
      }

      const filename = `${programName.replace(/[^\w\s-]/g, '')}_estimates.xlsx`;
      xlsx.writeFile(wb, filename);
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
