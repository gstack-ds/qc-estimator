import type { EstimateSummary, SummaryMathRates } from '@/types';

interface Props {
  summary: EstimateSummary;
  guestCount: number;
  fbMinimum: number;
  showMath?: boolean;
  mathRates?: SummaryMathRates;
}

function fmtM(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pctM(rate: number) {
  return +(rate * 100).toFixed(2) + '%';
}

function fmt(val: number) {
  return val === 0 ? '—' : '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPP(val: number) {
  return val === 0 ? '—' : '$' + val.toLocaleString('en-US');
}

function Row({ label, value, pp, bold, indent, dim, math, showMath }: {
  label: string; value: number; pp?: number; bold?: boolean; indent?: boolean; dim?: boolean;
  math?: string; showMath?: boolean;
}) {
  if (value === 0 && !bold) return null;
  return (
    <div>
      <div className={`flex justify-between py-1 text-sm ${
        bold
          ? 'font-semibold border-t border-brand-cream mt-1 pt-2 text-brand-charcoal'
          : dim
          ? 'text-brand-silver'
          : 'text-brand-charcoal/80'
      } ${indent ? 'pl-3' : ''}`}>
        <span>{label}</span>
        <div className="text-right">
          <span className="tabular-nums">{fmt(value)}</span>
          {pp !== undefined && pp > 0 && (
            <span className="text-xs text-brand-silver ml-2 tabular-nums">{fmtPP(pp)}/pp</span>
          )}
        </div>
      </div>
      {showMath && math && (
        <div className="text-[11px] text-brand-silver/60 pl-3 -mt-0.5 pb-0.5">{math}</div>
      )}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-brand-cream/60 my-1.5" />;
}

export default function SummaryPanel({ summary, guestCount, fbMinimum, showMath, mathRates }: Props) {
  const pp = (val: number) => guestCount > 0 ? Math.ceil(val / guestCount) : 0;
  const markupRevenue = summary.subtotalClient - summary.foodTax - summary.alcoholTax - summary.equipmentTax - summary.venueTax;

  return (
    <div className="bg-white border border-brand-cream rounded-lg p-4 space-y-0.5">
      <h3 className="font-serif text-sm font-medium text-brand-charcoal tracking-wide mb-3">
        Summary
      </h3>

      {/* F&B */}
      <Row label="F&B Subtotal" value={summary.fbSubtotalClient} pp={pp(summary.fbSubtotalClient)} showMath={showMath} />
      <Row label="Food Tax" value={summary.foodTax} indent dim showMath={showMath}
        math={mathRates && summary.fbFoodSubtotalClient > 0 ? `$${fmtM(summary.fbFoodSubtotalClient)} × ${pctM(mathRates.foodTaxRate)}` : undefined}
      />
      <Row label="Alcohol Tax" value={summary.alcoholTax} indent dim showMath={showMath}
        math={mathRates && summary.fbAlcoholSubtotalClient > 0 ? `$${fmtM(summary.fbAlcoholSubtotalClient)} × ${pctM(mathRates.alcoholTaxRate)}` : undefined}
      />
      <Row label="Service Charge" value={summary.serviceChargeClient} indent showMath={showMath}
        math={mathRates ? `$${fmtM(summary.fbSubtotalClient)} × ${pctM(mathRates.serviceChargeRate)}` : undefined}
      />
      <Row label="Gratuity" value={summary.gratuityClient} indent showMath={showMath}
        math={mathRates ? `$${fmtM(summary.fbSubtotalClient)} × ${pctM(mathRates.gratuityRate)}` : undefined}
      />
      <Row label="Admin Fee" value={summary.adminFeeClient} indent showMath={showMath}
        math={mathRates ? `$${fmtM(summary.fbSubtotalClient)} × ${pctM(mathRates.adminFeeRate)}` : undefined}
      />

      <Divider />

      {/* Equipment */}
      <Row label="Equipment & Staffing" value={summary.equipmentSubtotalClient} pp={pp(summary.equipmentSubtotalClient)} showMath={showMath} />
      <Row label="Equipment Tax" value={summary.equipmentTax} indent dim showMath={showMath}
        math={mathRates ? `$${fmtM(summary.equipmentSubtotalClient)} × ${pctM(mathRates.generalTaxRate)}` : undefined}
      />

      <Divider />

      {/* QC Staffing */}
      <Row label="QC Staffing" value={summary.qcStaffingSubtotalClient} pp={pp(summary.qcStaffingSubtotalClient)} showMath={showMath} />

      <Divider />

      {/* Venue */}
      <Row label="Venue Rental" value={summary.venueSubtotalClient} pp={pp(summary.venueSubtotalClient)} showMath={showMath} />
      <Row label="Venue Tax" value={summary.venueTax} indent dim showMath={showMath}
        math={mathRates ? `$${fmtM(summary.venueSubtotalClient)} × ${pctM(mathRates.generalTaxRate)}` : undefined}
      />

      <Divider />

      {/* Totals */}
      <Row label="Subtotal" value={summary.subtotalClient} bold showMath={showMath} />
      <Row label="Production Fee" value={summary.productionFee} showMath={showMath}
        math={mathRates ? `$${fmtM(summary.subtotalClient)} × ${pctM(mathRates.ccProcessingFee)} CC + $${fmtM(markupRevenue)} × ${pctM(mathRates.clientCommissionRate)} commission` : undefined}
      />
      {summary.discountAmount > 0 && (
        <div className="flex justify-between py-1 text-sm text-brand-copper">
          <span>Client Discount</span>
          <span className="tabular-nums">-{fmt(summary.discountAmount)}</span>
        </div>
      )}
      <Row label="Total Estimate" value={summary.totalClient} bold pp={pp(summary.totalClient)} showMath={showMath} />

      {/* F&B Minimum */}
      {fbMinimum > 0 && (
        <div className={`mt-3 text-xs rounded px-2.5 py-2 ${
          summary.fbMinimumMet
            ? 'bg-green-50 text-green-700 border border-green-100'
            : 'bg-amber-50 text-amber-700 border border-amber-100'
        }`}>
          {summary.fbMinimumMet
            ? `F&B Minimum Met (${fmt(fbMinimum)})`
            : `F&B Minimum NOT Met — Shortfall: ${fmt(summary.fbShortfall)}`
          }
        </div>
      )}
    </div>
  );
}
