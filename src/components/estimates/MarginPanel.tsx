'use client';
import { useState } from 'react';
import type { MarginAnalysis, EstimateSummary } from '@/types';

interface Props {
  margin: MarginAnalysis;
  summary: EstimateSummary;
  showMath?: boolean;
}

const MARGIN_COLORS: Record<string, string> = {
  '✓ STRONG':      'text-green-800 bg-green-100',
  '→ ON TARGET':   'text-blue-800 bg-blue-100',
  '⚠ REVIEW':      'text-amber-800 bg-amber-100',
  '✗ BELOW FLOOR': 'text-red-800 bg-red-100',
};

const NET_COLORS: Record<string, string> = {
  '✓ STRONG':      'text-green-800 bg-green-100',
  '→ ON TARGET':   'text-blue-800 bg-blue-100',
  '⚠ THIN':        'text-amber-800 bg-amber-100',
  '✗ LOSING MONEY':'text-red-800 bg-red-100',
};

function fmt(val: number) {
  return '$' + Math.round(Math.abs(val)).toLocaleString('en-US');
}
function pct(val: number) {
  return (val * 100).toFixed(1) + '%';
}

export default function MarginPanel({ margin, summary, showMath }: Props) {
  const [vendorExpanded, setVendorExpanded] = useState(false);
  const [commExpanded, setCommExpanded] = useState(false);

  const fbAndFees = summary.fbSubtotalOur + summary.serviceChargeOur + summary.gratuityOur + summary.adminFeeOur;
  const totalComm = margin.ccProcessingAmount + margin.gdpCommissionAmount + margin.thirdPartyCommissionsTotal;

  const math = (s: string) =>
    showMath ? <div className="text-[11px] text-brand-silver/60 -mt-0.5 pb-0.5 pl-3">{s}</div> : null;

  return (
    <div className="bg-brand-cream border border-brand-copper/30 rounded-lg p-4 space-y-0">
      <div className="mb-3">
        <h3 className="font-serif text-sm font-medium text-brand-charcoal tracking-wide">
          Margin Analysis
        </h3>
        <p className="text-[10px] text-brand-brown/70 tracking-wide mt-0.5 uppercase">
          Internal · Not visible in exports
        </p>
      </div>

      {/* Waterfall */}
      <div className="space-y-1 text-sm">

        {/* Total Client Billing */}
        <div className="flex justify-between font-medium text-brand-charcoal py-1">
          <span>Total Client Billing</span>
          <span className="tabular-nums">{fmt(summary.totalClient)}</span>
        </div>
        {math(`subtotal $${Math.round(summary.subtotalClient).toLocaleString()} + production fee $${Math.round(summary.productionFee).toLocaleString()}${summary.discountAmount > 0 ? ` − discount $${Math.round(summary.discountAmount).toLocaleString()}` : ''}`)}

        {/* Vendor Costs (expandable) */}
        <div>
          <button
            type="button"
            className="w-full flex justify-between items-center text-brand-charcoal/70 py-1 hover:text-brand-charcoal"
            onClick={() => setVendorExpanded((v) => !v)}
          >
            <span className="flex items-center gap-1">
              <span className="text-[10px]">{vendorExpanded ? '▾' : '▸'}</span>
              Vendor Costs
            </span>
            <span className="tabular-nums">{fmt(margin.vendorCostsBase)}</span>
          </button>
          {vendorExpanded && (
            <div className="pl-4 space-y-0.5 pb-1">
              {fbAndFees > 0 && (
                <div className="flex justify-between text-xs text-brand-charcoal/60 py-0.5">
                  <span>F&B &amp; Restaurant Fees</span>
                  <span className="tabular-nums">{fmt(fbAndFees)}</span>
                </div>
              )}
              {summary.equipmentSubtotalOur > 0 && (
                <div className="flex justify-between text-xs text-brand-charcoal/60 py-0.5">
                  <span>Equipment &amp; Rentals</span>
                  <span className="tabular-nums">{fmt(summary.equipmentSubtotalOur)}</span>
                </div>
              )}
              {summary.venueSubtotalOur > 0 && (
                <div className="flex justify-between text-xs text-brand-charcoal/60 py-0.5">
                  <span>Venue</span>
                  <span className="tabular-nums">{fmt(summary.venueSubtotalOur)}</span>
                </div>
              )}
              {summary.qcStaffingSubtotalOur > 0 && (
                <div className="flex justify-between text-xs text-brand-charcoal/60 py-0.5">
                  <span>Staffing</span>
                  <span className="tabular-nums">{fmt(summary.qcStaffingSubtotalOur)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Taxes */}
        <div className="flex justify-between text-brand-charcoal/70 py-1">
          <span>Taxes</span>
          <span className="tabular-nums">{fmt(margin.totalTaxes)}</span>
        </div>
        {math(`food $${Math.round(summary.foodTax).toLocaleString()} + alcohol $${Math.round(summary.alcoholTax).toLocaleString()} + equipment $${Math.round(summary.equipmentTax).toLocaleString()}${summary.venueTax > 0 ? ` + venue $${Math.round(summary.venueTax).toLocaleString()}` : ''}`)}

        {/* Commissions (expandable) */}
        <div>
          <button
            type="button"
            className="w-full flex justify-between items-center text-brand-charcoal/70 py-1 hover:text-brand-charcoal"
            onClick={() => setCommExpanded((v) => !v)}
          >
            <span className="flex items-center gap-1">
              <span className="text-[10px]">{commExpanded ? '▾' : '▸'}</span>
              Commissions
            </span>
            <span className="tabular-nums">{fmt(totalComm)}</span>
          </button>
          {commExpanded && (
            <div className="pl-4 space-y-0.5 pb-1">
              <div className="flex justify-between text-xs text-brand-charcoal/60 py-0.5">
                <span>CC Processing ({pct(margin.ccProcessingAmount / (summary.subtotalClient || 1))})</span>
                <span className="tabular-nums">{fmt(margin.ccProcessingAmount)}</span>
              </div>
              {margin.gdpCommissionAmount > 0 && (
                <div className="flex justify-between text-xs text-brand-charcoal/60 py-0.5">
                  <span>GDP Commission (6.5%)</span>
                  <span className="tabular-nums">{fmt(margin.gdpCommissionAmount)}</span>
                </div>
              )}
              {margin.thirdPartyCommissionsTotal > 0 && (
                <div className="flex justify-between text-xs text-brand-charcoal/60 py-0.5">
                  <span>Third-Party</span>
                  <span className="tabular-nums">{fmt(margin.thirdPartyCommissionsTotal)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Revenue items note */}
        {summary.revenueItemsClientTotal > 0 && (
          <div className="flex justify-between text-xs text-brand-copper/80 py-0.5 italic">
            <span>incl. {fmt(summary.revenueItemsClientTotal)} in revenue items (0 vendor cost)</span>
          </div>
        )}

        {/* QC Margin */}
        <div className="border-t border-brand-copper/20 mt-1 pt-2">
          <div className="flex items-center justify-between font-medium text-brand-charcoal">
            <span>QC Margin</span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums">{margin.qcRevenue < 0 ? '-' : ''}{fmt(margin.qcRevenue)}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${MARGIN_COLORS[margin.marginHealth] ?? ''}`}>
                {pct(margin.qcMarginPct)}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${MARGIN_COLORS[margin.marginHealth] ?? ''}`}>
                {margin.marginHealth}
              </span>
            </div>
          </div>
          {math(`$${Math.round(Math.abs(margin.qcRevenue)).toLocaleString()} = billing − vendor costs − taxes − commissions`)}
        </div>
      </div>

      {/* True Net */}
      <div className="border-t border-brand-copper/20 pt-3 mt-3 space-y-1.5 text-sm">
        <h4 className="text-[10px] font-semibold text-brand-brown uppercase tracking-[0.1em]">True Net</h4>
        <div className="flex justify-between text-brand-charcoal/70">
          <span>Team Hours</span>
          <span>{margin.estimatedTeamHours} hrs</span>
        </div>
        <div className="flex justify-between text-brand-charcoal/70">
          <span>OpEx Estimate</span>
          <span className="tabular-nums">{fmt(margin.opExEstimate)}</span>
        </div>
        {margin.travelExpenses > 0 && (
          <div className="flex justify-between text-brand-charcoal/70">
            <span>Travel</span>
            <span className="tabular-nums">{fmt(margin.travelExpenses)}</span>
          </div>
        )}
        <div className="flex items-center justify-between font-medium border-t border-brand-copper/20 pt-1 text-brand-charcoal">
          <span>True Net</span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums">{margin.trueNetProfit < 0 ? '-' : ''}{fmt(margin.trueNetProfit)}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${NET_COLORS[margin.trueNetHealth] ?? ''}`}>
              {margin.trueNetHealth}
            </span>
          </div>
        </div>
        {showMath && (
          <div className="text-[11px] text-brand-silver/60 -mt-0.5 pb-0.5 pl-3">
            {fmt(margin.qcRevenue)} QC Margin − {fmt(margin.opExEstimate)} OpEx{margin.travelExpenses > 0 ? ` − ${fmt(margin.travelExpenses)} travel` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
