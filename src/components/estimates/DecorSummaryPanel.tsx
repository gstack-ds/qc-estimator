import type { EstimateSummary } from '@/types';

interface Props {
  summary: EstimateSummary;
  guestCount: number;
  floralTaxableClient: number;
  floralNonTaxableClient: number;
  rentalsTaxableClient: number;
  rentalsNonTaxableClient: number;
}

function fmt(val: number) {
  return val === 0 ? '—' : '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPP(val: number) {
  return val === 0 ? '—' : '$' + val.toLocaleString('en-US');
}

function Row({ label, value, pp, bold, indent, dim }: {
  label: string; value: number; pp?: number; bold?: boolean; indent?: boolean; dim?: boolean;
}) {
  if (value === 0 && !bold) return null;
  return (
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
  );
}

function Divider() {
  return <div className="border-t border-brand-cream/60 my-1.5" />;
}

export default function DecorSummaryPanel({
  summary, guestCount, floralTaxableClient, floralNonTaxableClient, rentalsNonTaxableClient,
}: Props) {
  const pp = (val: number) => guestCount > 0 ? Math.ceil(val / guestCount) : 0;

  return (
    <div className="bg-white border border-brand-cream rounded-lg p-4 space-y-0.5">
      <h3 className="font-serif text-sm font-medium text-brand-charcoal tracking-wide mb-3">
        Summary
      </h3>

      {/* Florals */}
      {floralTaxableClient > 0 && (
        <Row label="Floral Product" value={floralTaxableClient} pp={pp(floralTaxableClient)} />
      )}
      {floralNonTaxableClient > 0 && (
        <Row label="Floral Fees" value={floralNonTaxableClient} pp={pp(floralNonTaxableClient)} />
      )}

      <Divider />

      {/* Rentals */}
      {summary.equipmentSubtotalClient - floralTaxableClient > 0 && (
        <Row label="Rentals & Lounge" value={summary.equipmentSubtotalClient - floralTaxableClient} pp={pp(summary.equipmentSubtotalClient - floralTaxableClient)} />
      )}
      {rentalsNonTaxableClient > 0 && (
        <Row label="Rental Fees" value={rentalsNonTaxableClient} pp={pp(rentalsNonTaxableClient)} />
      )}

      <Divider />

      {/* Tax & Totals */}
      <Row label="Taxable Product Subtotal" value={summary.equipmentSubtotalClient} />
      <Row label="Sales Tax" value={summary.equipmentTax} indent dim />
      <Row label="Non-Taxable Fees" value={summary.qcStaffingSubtotalClient} />

      <Divider />

      <Row label="Subtotal" value={summary.subtotalClient} bold />
      <Row label="Production Fee" value={summary.productionFee} />
      <Row label="Total Estimate" value={summary.totalClient} bold pp={pp(summary.totalClient)} />
    </div>
  );
}
