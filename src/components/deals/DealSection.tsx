// Read-only section primitives for the deal page. Server components (no interactivity).
// DealSection wraps content with the anchor id (scroll-mt offsets the sticky header so a
// breadcrumb jump doesn't land under it). FieldGrid renders label/value pairs read-only.
import type { ReactNode } from 'react';

export function DealSection({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-40 border-t border-gray-100 pt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-charcoal/70">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export interface Field {
  label: string;
  value: ReactNode;
}

export function FieldGrid({ fields }: { fields: Field[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
      {fields.map((f) => (
        <div key={f.label}>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{f.label}</dt>
          <dd className="mt-0.5 text-sm text-brand-charcoal break-words">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
