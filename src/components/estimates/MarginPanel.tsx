import type { MarginAnalysis } from '@/types';

interface Props {
  margin: MarginAnalysis;
}

const MARGIN_COLORS: Record<string, string> = {
  '✓ STRONG': 'text-green-700 bg-green-50',
  '→ ON TARGET': 'text-blue-700 bg-blue-50',
  '⚠ REVIEW': 'text-amber-700 bg-amber-50',
  '✗ BELOW FLOOR': 'text-red-700 bg-red-50',
};

const NET_COLORS: Record<string, string> = {
  '✓ STRONG': 'text-green-700 bg-green-50',
  '→ ON TARGET': 'text-blue-700 bg-blue-50',
  '⚠ THIN': 'text-amber-700 bg-amber-50',
  '✗ LOSING MONEY': 'text-red-700 bg-red-50',
};

function fmt(val: number) {
  return '$' + Math.round(Math.abs(val)).toLocaleString('en-US');
}
function pct(val: number) {
  return (val * 100).toFixed(1) + '%';
}

export default function MarginPanel({ margin }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Margin Analysis</h3>
      <p className="text-xs text-gray-400 italic">Internal only — not visible in exports</p>

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Vendor Costs</span>
          <span className="tabular-nums">{fmt(margin.totalVendorCosts)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Client Commission ({pct(margin.clientCommissionAmount / (margin.qcRevenue + margin.clientCommissionAmount + margin.gdpCommissionAmount + margin.totalVendorCosts || 1))})</span>
          <span className="tabular-nums">{fmt(margin.clientCommissionAmount)}</span>
        </div>
        {margin.gdpCommissionAmount > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>GDP Commission (6.5%)</span>
            <span className="tabular-nums">{fmt(margin.gdpCommissionAmount)}</span>
          </div>
        )}
        {margin.thirdPartyCommissionsTotal > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Third-Party Commissions</span>
            <span className="tabular-nums">{fmt(margin.thirdPartyCommissionsTotal)}</span>
          </div>
        )}

        <div className="border-t border-gray-100 pt-2 flex justify-between font-medium">
          <span>QC Revenue</span>
          <span className="tabular-nums">{margin.qcRevenue < 0 ? '-' : ''}{fmt(margin.qcRevenue)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-600">QC Margin</span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums font-medium">{pct(margin.qcMarginPct)}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${MARGIN_COLORS[margin.marginHealth] ?? ''}`}>
              {margin.marginHealth}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">True Net</h4>
        <div className="flex justify-between text-gray-600">
          <span>Team Hours</span>
          <span>{margin.estimatedTeamHours} hrs</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>OpEx Estimate</span>
          <span className="tabular-nums">{fmt(margin.opExEstimate)}</span>
        </div>
        {margin.travelExpenses > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Travel</span>
            <span className="tabular-nums">{fmt(margin.travelExpenses)}</span>
          </div>
        )}
        <div className="flex items-center justify-between font-medium border-t border-gray-100 pt-1">
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
