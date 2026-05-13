import type { EstimateSummary, SummaryMathRates } from '@/types';

interface Props {
  summary: EstimateSummary;
  guestCount: number;
  floralTaxableClient: number;
  floralNonTaxableClient: number;
  rentalsTaxableClient: number;
  rentalsNonTaxableClient: number;
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
  summary, guestCount, floralTaxableClient, floralNonTaxableClient, rentalsNonTaxableClient,
  showMath, mathRates,
}: Props) {
  const pp = (val: number) => guestCount > 0 ? Math.ceil(val / guestCount) : 0;
  const markupRevenue = summary.subtotalClient - summary.equipmentTax;

  return (
    <div className="bg-white border border-brand-cream rounded-lg p-4 space-y-0.5">
      <h3 className="font-serif text-sm font-medium text-brand-charcoal tracking-wide mb-3">
        Summary
      </h3>

      {/* Florals */}
      {floralTaxableClient > 0 && (
        <Row label="Floral Product" value={floralTaxableClient} pp={pp(floralTaxableClient)} showMath={showMath} />
      )}
      {floralNonTaxableClient > 0 && (
        <Row label="Floral Fees" value={floralNonTaxableClient} pp={pp(floralNonTaxableClient)} showMath={showMath} />
      )}

      <Divider />

      {/* Rentals */}
      {summary.equipmentSubtotalClient - floralTaxableClient > 0 && (
        <Row label="Rentals & Lounge" value={summary.equipmentSubtotalClient - floralTaxableClient} pp={pp(summary.equipmentSubtotalClient - floralTaxableClient)} showMath={showMath} />
      )}
      {rentalsNonTaxableClient > 0 && (
        <Row label="Rental Fees" value={rentalsNonTaxableClient} pp={pp(rentalsNonTaxableClient)} showMath={showMath} />
      )}

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
      <Row label="Total Estimate" value={summary.totalClient} bold pp={pp(summary.totalClient)} showMath={showMath} />
    </div>
  );
}
