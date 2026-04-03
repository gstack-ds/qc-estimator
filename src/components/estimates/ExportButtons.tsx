'use client';

import { useState } from 'react';
import type { EstimateSummary } from '@/types';
import { getExportDataForProgram } from '@/app/(programs)/programs/[id]/estimates/actions';

interface Props {
  programId: string;
  programName: string;
  summary: EstimateSummary;
  guestCount: number;
}

function fmtAmt(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function fmtPP(n: number, guests: number) {
  if (guests <= 0) return '—';
  return '$' + Math.ceil(n / guests).toLocaleString('en-US') + '/pp';
}

function buildCopyText(summary: EstimateSummary, guestCount: number): string {
  const g = guestCount;
  const tax = summary.foodTax + summary.alcoholTax + summary.equipmentTax + summary.venueTax;
  const svcCharge = summary.serviceChargeClient;
  const gratuity = summary.gratuityClient;
  const adminFee = summary.adminFeeClient;

  const rows: [string, number][] = [];
  if (summary.fbFoodSubtotalClient > 0) rows.push(['Menu', summary.fbFoodSubtotalClient]);
  if (summary.fbAlcoholSubtotalClient > 0) rows.push(['Bar', summary.fbAlcoholSubtotalClient]);
  if (summary.qcStaffingSubtotalClient > 0) rows.push(['Staffing', summary.qcStaffingSubtotalClient]);
  if (summary.equipmentSubtotalClient > 0) rows.push(['Equipment', summary.equipmentSubtotalClient]);
  if (summary.venueSubtotalClient > 0) rows.push(['Venue Rental', summary.venueSubtotalClient]);
  if (svcCharge > 0) rows.push(['Service Charge', svcCharge]);
  if (gratuity > 0) rows.push(['Gratuity', gratuity]);
  if (adminFee > 0) rows.push(['Admin Fee', adminFee]);
  if (tax > 0) rows.push(['Tax', tax]);
  if (summary.productionFee > 0) rows.push(['Production Fee', summary.productionFee]);
  rows.push(['Total', summary.totalClient]);

  const lines = rows.map(([label, amt]) => `${label}: ${fmtAmt(amt)}  (${fmtPP(amt, g)})`);
  return lines.join('\n');
}

export default function ExportButtons({ programId, programName, summary, guestCount }: Props) {
  const [copyLabel, setCopyLabel] = useState<'Copy Numbers' | 'Copied!'>('Copy Numbers');
  const [exporting, setExporting] = useState(false);

  async function handleCopy() {
    const text = buildCopyText(summary, guestCount);
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

  const btnClass = 'text-xs px-2.5 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors';

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
