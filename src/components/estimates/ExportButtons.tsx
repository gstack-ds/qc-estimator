'use client';

import { useState } from 'react';
import type { EstimateSummary } from '@/types';
import {
  buildCopyText,
  buildLineItemsCopyText,
  buildSummaryRows,
  itemClientCost,
  type LineItemForExport,
  type MarkupForExport,
} from '@/lib/utils/export';

export type { LineItemForExport, MarkupForExport };

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
  const [copyItemsLabel, setCopyItemsLabel] = useState<'Copy Line Items' | 'Copied!'>('Copy Line Items');
  const [exporting, setExporting] = useState(false);

  async function handleCopy() {
    const text = buildCopyText(summary, guestCount, estimateType, estimateName, lineItems, markups);
    await navigator.clipboard.writeText(text);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy Numbers'), 2000);
  }

  async function handleCopyLineItems() {
    const text = buildLineItemsCopyText(lineItems, estimateName);
    await navigator.clipboard.writeText(text);
    setCopyItemsLabel('Copied!');
    setTimeout(() => setCopyItemsLabel('Copy Line Items'), 2000);
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
      const sheet2: (string | number)[][] = [
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

      const safeName = (estimateName || programName || 'estimate').replace(/[^\w\s-]/g, '').trim();
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
      <button onClick={handleCopyLineItems} className={btnClass}>
        {copyItemsLabel}
      </button>
      <button onClick={handleExcel} disabled={exporting} className={btnClass + (exporting ? ' opacity-50' : '')}>
        {exporting ? 'Exporting…' : 'Export to Excel'}
      </button>
    </div>
  );
}
