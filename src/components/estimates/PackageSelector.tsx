'use client';

import { useState } from 'react';
import type { PackageOptions } from '@/types';

interface Props {
  packageOptions: PackageOptions;
  selectedPackageId?: string | null;
  guestCount?: number;
  onChange: (selectedId: string, pricePerPerson: number) => void;
}

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PackageSelector({ packageOptions, selectedPackageId, guestCount, onChange }: Props) {
  const [expanded, setExpanded] = useState(!selectedPackageId);
  const selected = packageOptions.options.find((o) => o.id === selectedPackageId);

  return (
    <div className="mt-1 rounded border border-brand-copper/20 bg-brand-offwhite/60 text-xs">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-brand-cream/40 transition-colors rounded"
      >
        <span className={`font-medium ${selectedPackageId ? 'text-brand-charcoal' : 'text-brand-copper'}`}>
          {selected ? (
            <span>
              <span className="text-brand-brown">{selected.name}</span>
              <span className="text-brand-charcoal/50 ml-1.5">{fmt(selected.pricePerPerson)}/pp</span>
            </span>
          ) : (
            '⚠ Choose a package'
          )}
        </span>
        <span className="text-brand-silver/60 text-[10px]">
          {packageOptions.options.length} options {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Options list */}
      {expanded && (
        <div className="border-t border-brand-copper/10 divide-y divide-brand-cream/60">
          {packageOptions.options.map((opt) => {
            const isSelected = selectedPackageId === opt.id;
            return (
              <label
                key={opt.id}
                className={`flex gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                  isSelected ? 'bg-brand-cream/50' : 'hover:bg-white/60'
                }`}
              >
                <input
                  type="radio"
                  name={`pkg-${packageOptions.label}`}
                  value={opt.id}
                  checked={isSelected}
                  onChange={() => { onChange(opt.id, opt.pricePerPerson); setExpanded(false); }}
                  className="mt-0.5 accent-brand-brown flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={`font-medium ${isSelected ? 'text-brand-brown' : 'text-brand-charcoal'}`}>
                      {opt.name}
                    </span>
                    <span className="text-brand-charcoal/60 tabular-nums">
                      {fmt(opt.pricePerPerson)}/pp
                      {guestCount ? ` · ${fmt(opt.pricePerPerson * guestCount)} total` : ''}
                    </span>
                  </div>
                  {opt.description && (
                    <p className="text-brand-charcoal/50 mt-0.5 leading-relaxed">{opt.description}</p>
                  )}
                  {opt.items.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {opt.items.map((item, i) => (
                        <li key={i} className="text-brand-charcoal/40 flex items-start gap-1">
                          <span className="text-brand-copper/40 mt-0.5 flex-shrink-0">·</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
