'use client';

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="text-sm border border-brand-cream bg-white text-brand-charcoal rounded-md px-4 py-1.5 hover:bg-brand-offwhite transition-colors print:hidden"
    >
      Print / Save PDF
    </button>
  );
}
