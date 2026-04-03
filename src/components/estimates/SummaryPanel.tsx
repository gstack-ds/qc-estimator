import type { EstimateSummary } from '@/types';

interface Props {
  summary: EstimateSummary;
  guestCount: number;
  fbMinimum: number;
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

export default function SummaryPanel({ summary, guestCount, fbMinimum }: Props) {
  const pp = (val: number) => guestCount > 0 ? Math.ceil(val / guestCount) : 0;

  return (
    <div className="bg-white border border-brand-cream rounded-lg p-4 space-y-0.5">
      <h3 className="font-serif text-sm font-medium text-brand-charcoal tracking-wide mb-3">
        Summary
      </h3>

      {/* F&B */}
      <Row label="F&B Subtotal" value={summary.fbSubtotalClient} pp={pp(summary.fbSubtotalClient)} />
      <Row label="Food Tax" value={summary.foodTax} indent dim />
      <Row label="Alcohol Tax" value={summary.alcoholTax} indent dim />
      <Row label="Service Charge" value={summary.serviceChargeClient} indent />
      <Row label="Gratuity" value={summary.gratuityClient} indent />
      <Row label="Admin Fee" value={summary.adminFeeClient} indent />

      <Divider />

      {/* Equipment */}
      <Row label="Equipment & Staffing" value={summary.equipmentSubtotalClient} pp={pp(summary.equipmentSubtotalClient)} />
      <Row label="Equipment Tax" value={summary.equipmentTax} indent dim />

      <Divider />

      {/* QC Staffing */}
      <Row label="QC Staffing" value={summary.qcStaffingSubtotalClient} pp={pp(summary.qcStaffingSubtotalClient)} />

      <Divider />

      {/* Venue */}
      <Row label="Venue Rental" value={summary.venueSubtotalClient} pp={pp(summary.venueSubtotalClient)} />
      <Row label="Venue Tax" value={summary.venueTax} indent dim />

      <Divider />

      {/* Totals */}
      <Row label="Subtotal" value={summary.subtotalClient} bold />
      <Row label="Production Fee" value={summary.productionFee} />
      <Row label="Total Estimate" value={summary.totalClient} bold pp={pp(summary.totalClient)} />

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
