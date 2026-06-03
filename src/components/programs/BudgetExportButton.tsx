'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import type { BudgetExportData } from '@/lib/utils/budgetExport';
import { buildSummarySheet, buildDetailSheet } from '@/lib/utils/budgetExport';

interface Props {
  data: BudgetExportData;
}

export default function BudgetExportButton({ data }: Props) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const xlsx = await import('xlsx');
      const wb = xlsx.utils.book_new();

      // ── Sheet 1: Program Summary ────────────────────────
      const summaryRows = buildSummarySheet(data);
      const ws1 = xlsx.utils.aoa_to_sheet(summaryRows);

      // Column widths for Summary
      ws1['!cols'] = [
        { wch: 36 }, // Estimate
        { wch: 14 }, // Type
        { wch: 14 }, // Our Cost
        { wch: 14 }, // Budgeted
        { wch: 22 }, // Charged
        { wch: 12 }, // Variance $
        { wch: 12 }, // Variance %
        { wch: 12 }, // Taxes
        { wch: 14 }, // Commissions
        { wch: 14 }, // QC Margin $
        { wch: 12 }, // Margin %
      ];

      xlsx.utils.book_append_sheet(wb, ws1, 'Program Summary');

      // ── Sheet 2: Line Item Detail ────────────────────────
      const detailRows = buildDetailSheet(data);
      const ws2 = xlsx.utils.aoa_to_sheet(detailRows);

      // Column widths for Detail
      ws2['!cols'] = [
        { wch: 32 }, // Estimate
        { wch: 24 }, // Section
        { wch: 36 }, // Item
        { wch: 6  }, // Rev?
        { wch: 6  }, // Qty
        { wch: 12 }, // Unit Cost
        { wch: 12 }, // Our Total
        { wch: 10 }, // Markup %
        { wch: 12 }, // Client Unit
        { wch: 14 }, // Budgeted
        { wch: 22 }, // Charged
        { wch: 12 }, // Variance $
        { wch: 12 }, // Variance %
        { wch: 12 }, // Margin $
        { wch: 10 }, // Margin %
        { wch: 10 }, // Tax Type
        { wch: 24 }, // Notes
      ];

      xlsx.utils.book_append_sheet(wb, ws2, 'Line Items');

      // Write file
      const safeName = (data.programName || 'program').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
      const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      xlsx.writeFile(wb, `${safeName}_budget_vs_charged_${dateStamp}.xlsx`);
    } catch (err) {
      console.error('Budget export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-1.5 text-xs border border-brand-cream rounded px-3 py-1.5 bg-white text-brand-charcoal/70 hover:text-brand-charcoal hover:bg-brand-offwhite transition-colors disabled:opacity-50"
    >
      <Download size={12} />
      {exporting ? 'Exporting…' : 'Budget vs Charged (Excel)'}
    </button>
  );
}
