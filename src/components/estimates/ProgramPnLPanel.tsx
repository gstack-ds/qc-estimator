'use client';
import { useState } from 'react';
import type { EstimateType } from '@/types';

export interface PnLRow {
  id: string;
  name: string;
  type: EstimateType;
  billing: number;
  vendorCosts: number;
  taxes: number;
  commissions: number;
  qcMargin: number;
  marginPct: number;
}

interface Props {
  rows: PnLRow[];
}

const TYPE_LABELS: Record<string, string> = {
  venue: 'Venue',
  av: 'A/V',
  decor: 'Décor',
  transportation: 'Transport',
};

const MARGIN_COLORS: Record<string, string> = {
  '✓ STRONG':      'text-green-700',
  '→ ON TARGET':   'text-blue-700',
  '⚠ REVIEW':      'text-amber-700',
  '✗ BELOW FLOOR': 'text-red-700',
};

function getMarginLabel(pct: number): string {
  if (pct >= 0.35) return '✓ STRONG';
  if (pct >= 0.28) return '→ ON TARGET';
  if (pct >= 0.22) return '⚠ REVIEW';
  return '✗ BELOW FLOOR';
}

function fmt(val: number) {
  return '$' + Math.round(val).toLocaleString('en-US');
}
function pct(val: number) {
  return (val * 100).toFixed(1) + '%';
}

export default function ProgramPnLPanel({ rows }: Props) {
  const [open, setOpen] = useState(false);

  if (rows.length === 0) return null;

  const totals = rows.reduce(
    (acc, r) => ({
      billing: acc.billing + r.billing,
      vendorCosts: acc.vendorCosts + r.vendorCosts,
      taxes: acc.taxes + r.taxes,
      commissions: acc.commissions + r.commissions,
      qcMargin: acc.qcMargin + r.qcMargin,
    }),
    { billing: 0, vendorCosts: 0, taxes: 0, commissions: 0, qcMargin: 0 },
  );
  const totalMarginPct = totals.billing > 0 ? totals.qcMargin / totals.billing : 0;
  const totalLabel = getMarginLabel(totalMarginPct);

  return (
    <div className="border border-brand-copper/30 rounded-lg overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-3 bg-brand-cream hover:bg-brand-cream/80 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px]">{open ? '▾' : '▸'}</span>
          <h2 className="font-serif text-sm font-medium text-brand-charcoal tracking-wide">
            Projected Program P&amp;L
          </h2>
          <span className="text-xs text-brand-silver/60">
            {rows.length} estimate{rows.length !== 1 ? 's' : ''} included in budget
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-brand-charcoal tabular-nums">{fmt(totals.billing)}</span>
          <span className={`text-xs font-medium ${MARGIN_COLORS[totalLabel] ?? ''}`}>
            {pct(totalMarginPct)}
          </span>
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-brand-cream bg-brand-offwhite text-xs font-semibold text-brand-silver uppercase tracking-[0.06em]">
                <th className="text-left px-4 py-2 min-w-[160px]">Estimate</th>
                <th className="text-right px-3 py-2 min-w-[100px]">Billing</th>
                <th className="text-right px-3 py-2 min-w-[100px]">Vendor Costs</th>
                <th className="text-right px-3 py-2 min-w-[80px]">Taxes</th>
                <th className="text-right px-3 py-2 min-w-[100px]">Commissions</th>
                <th className="text-right px-3 py-2 min-w-[100px]">QC Margin</th>
                <th className="text-right px-4 py-2 min-w-[80px]">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const label = getMarginLabel(row.marginPct);
                return (
                  <tr key={row.id} className="border-b border-brand-cream/60 hover:bg-brand-offwhite/50">
                    <td className="px-4 py-2">
                      <div className="font-medium text-brand-charcoal">{row.name}</div>
                      <div className="text-[10px] text-brand-silver/60 uppercase">{TYPE_LABELS[row.type] ?? row.type}</div>
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums text-brand-charcoal">{fmt(row.billing)}</td>
                    <td className="text-right px-3 py-2 tabular-nums text-brand-charcoal/70">{fmt(row.vendorCosts)}</td>
                    <td className="text-right px-3 py-2 tabular-nums text-brand-charcoal/70">{fmt(row.taxes)}</td>
                    <td className="text-right px-3 py-2 tabular-nums text-brand-charcoal/70">{fmt(row.commissions)}</td>
                    <td className="text-right px-3 py-2 tabular-nums font-medium text-brand-charcoal">{fmt(row.qcMargin)}</td>
                    <td className="text-right px-4 py-2">
                      <span className={`font-medium tabular-nums ${MARGIN_COLORS[label] ?? 'text-brand-charcoal'}`}>
                        {pct(row.marginPct)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-brand-copper/20 bg-brand-cream/50 font-semibold text-brand-charcoal">
                <td className="px-4 py-2">Total</td>
                <td className="text-right px-3 py-2 tabular-nums">{fmt(totals.billing)}</td>
                <td className="text-right px-3 py-2 tabular-nums">{fmt(totals.vendorCosts)}</td>
                <td className="text-right px-3 py-2 tabular-nums">{fmt(totals.taxes)}</td>
                <td className="text-right px-3 py-2 tabular-nums">{fmt(totals.commissions)}</td>
                <td className="text-right px-3 py-2 tabular-nums">{fmt(totals.qcMargin)}</td>
                <td className="text-right px-4 py-2">
                  <span className={`${MARGIN_COLORS[totalLabel] ?? ''}`}>{pct(totalMarginPct)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="text-[10px] text-brand-silver/50 px-4 py-2 border-t border-brand-cream">
            Internal · Not visible in exports · Only estimates with &quot;Include in Budget&quot; toggled on
          </p>
        </div>
      )}
    </div>
  );
}
