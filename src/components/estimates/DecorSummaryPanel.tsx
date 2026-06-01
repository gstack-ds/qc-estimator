import type { EstimateSummary, SummaryMathRates } from '@/types';
import type { SectionTotal } from '@/lib/utils/sectionLabels';

interface Props {
  summary: EstimateSummary;
  guestCount: number;
  sectionTotals: SectionTotal[];
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

export default function DecorSummaryPanel({
  summary, guestCount, sectionTotals,
  showMath, mathRates,
}: Props) {
  const pp = (val: number) => guestCount > 0 ? Math.ceil(val / guestCount) : 0;
  const markupRevenue = summary.subtotalClient - summary.equipmentTax;

  return (
    <div className="bg-white border border-brand-cream rounded-lg p-4 space-y-0.5">
      <h3 className="font-serif text-sm font-medium text-brand-charcoal tracking-wide mb-3">
        Summary
      </h3>

      {/* Per-section breakdown — uses live section names */}
      {sectionTotals.map((s) => (
        <Row key={s.id} label={s.name} value={s.total} pp={pp(s.total)} showMath={showMath} />
      ))}

      <Divider />

      {/* Tax & Totals */}
      <Row label="Taxable Product Subtotal" value={summary.equipmentSubtotalClient} showMath={showMath} />
      <Row label="Sales Tax" value={summary.equipmentTax} indent dim showMath={showMath}
        math={mathRates ? `$${fmtM(summary.equipmentSubtotalClient)} × ${pctM(mathRates.generalTaxRate)}` : undefined}
      />
      <Row label="Non-Taxable Fees" value={summary.qcStaffingSubtotalClient} showMath={showMath} />

      <Divider />

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
    </div>
  );
}
