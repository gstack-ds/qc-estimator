import type { MarginAnalysis } from '@/types';

interface Props {
  margin: MarginAnalysis;
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

export default function MarginPanel({ margin }: Props) {
  return (
    <div className="bg-brand-cream border border-brand-copper/30 rounded-lg p-4 space-y-3">
      <div>
        <h3 className="font-serif text-sm font-medium text-brand-charcoal tracking-wide">
          Margin Analysis
        </h3>
        <p className="text-[10px] text-brand-brown/70 tracking-wide mt-0.5 uppercase">
          Internal · Not visible in exports
        </p>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-brand-charcoal/70">
          <span>Vendor Costs</span>
          <span className="tabular-nums">{fmt(margin.totalVendorCosts)}</span>
        </div>
        <div className="flex justify-between text-brand-charcoal/70">
          <span>Client Commission ({pct(margin.clientCommissionAmount / (margin.qcRevenue + margin.clientCommissionAmount + margin.gdpCommissionAmount + margin.totalVendorCosts || 1))})</span>
          <span className="tabular-nums">{fmt(margin.clientCommissionAmount)}</span>
        </div>
        {margin.gdpCommissionAmount > 0 && (
          <div className="flex justify-between text-brand-charcoal/70">
            <span>GDP Commission (6.5%)</span>
            <span className="tabular-nums">{fmt(margin.gdpCommissionAmount)}</span>
          </div>
        )}
        {margin.thirdPartyCommissionsTotal > 0 && (
          <div className="flex justify-between text-brand-charcoal/70">
            <span>Third-Party Commissions</span>
            <span className="tabular-nums">{fmt(margin.thirdPartyCommissionsTotal)}</span>
          </div>
        )}

        <div className="border-t border-brand-copper/20 pt-2 flex justify-between font-medium text-brand-charcoal">
          <span>QC Revenue</span>
          <span className="tabular-nums">{margin.qcRevenue < 0 ? '-' : ''}{fmt(margin.qcRevenue)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-brand-charcoal/70">QC Margin</span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums font-medium text-brand-charcoal">{pct(margin.qcMarginPct)}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${MARGIN_COLORS[margin.marginHealth] ?? ''}`}>
              {margin.marginHealth}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-brand-copper/20 pt-3 space-y-1.5 text-sm">
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
      </div>
    </div>
  );
}
