'use client';

import { useState, useRef, useEffect } from 'react';
import { getLineItemsForEstimate } from '@/app/(programs)/programs/[id]/estimates/actions';
import type { DbMarkup } from '@/lib/supabase/queries';
import type { LocalLineItem, LocalSection } from './EstimateBuilder';

interface SourceEstimate {
  id: string;
  name: string;
}

interface Props {
  currentEstimateId: string;
  otherEstimates: SourceEstimate[];
  markups: DbMarkup[];
  onImport: (items: LocalLineItem[]) => void;
}

export default function CopyItemsFromButton({ currentEstimateId, otherEstimates, markups, onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const sources = otherEstimates.filter((e) => e.id !== currentEstimateId);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleSelect(sourceId: string) {
    setLoading(true);
    setOpen(false);
    const { items, error } = await getLineItemsForEstimate(sourceId);
    setLoading(false);
    if (error || items.length === 0) return;

    const imported: LocalLineItem[] = items.map((item) => {
      const isCustom = item.custom_client_unit_price !== null;
      const markup = markups.find((m) => m.id === item.category_id);
      const defaultMarkupPct = isCustom ? 0 : (markup?.markup_pct ?? 0.5);
      const effectiveMarkupPct = isCustom ? 0 : (item.markup_override ?? defaultMarkupPct);
      return {
        id: `new-${Date.now()}-${Math.random()}`,
        section: item.section as LocalSection,
        name: item.name,
        label: item.label ?? undefined,
        qty: item.qty,
        unitPrice: item.unit_price,
        categoryId: isCustom ? 'custom' : (item.category_id ?? null),
        defaultMarkupPct,
        categoryMarkupPct: effectiveMarkupPct,
        taxType: item.tax_type as import('@/types').TaxType,
        customClientUnitPrice: isCustom ? item.custom_client_unit_price! : undefined,
        sortOrder: item.sort_order,
        isNew: true,
      };
    });

    onImport(imported);
  }

  if (sources.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className="text-xs px-2.5 py-1 rounded border border-brand-cream bg-white hover:bg-brand-offwhite text-brand-charcoal/70 hover:text-brand-charcoal transition-colors disabled:opacity-50"
      >
        {loading ? 'Copying…' : 'Copy Items From…'}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-brand-cream rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-brand-cream">
            <p className="text-xs text-brand-silver">Select source estimate</p>
          </div>
          {sources.map((est) => (
            <button
              key={est.id}
              onClick={() => handleSelect(est.id)}
              className="w-full text-left px-3 py-2 text-sm text-brand-charcoal hover:bg-brand-offwhite transition-colors border-b border-brand-cream/50 last:border-0"
            >
              {est.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
