'use client';

import { useState, useTransition, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { DbTravelItem } from '@/lib/supabase/queries';
import {
  addTravelItem,
  updateTravelItem,
  deleteTravelItem,
  updateProgram,
} from '@/app/(programs)/programs/actions';

interface Props {
  programId: string;
  initialItems: DbTravelItem[];
  initialIncludeInFee: boolean;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export default function TravelSection({ programId, initialItems, initialIncludeInFee }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [items, setItems] = useState<DbTravelItem[]>(initialItems);
  const [includeInFee, setIncludeInFee] = useState(initialIncludeInFee);
  const [adding, setAdding] = useState(false);

  // debounce per item
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const total = items.reduce((s, it) => s + it.qty * it.unit_price, 0);

  function scheduleUpdate(id: string, patch: Partial<{ description: string; qty: number; unit_price: number }>) {
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      updateTravelItem(id, programId, patch);
    }, 500);
  }

  function handleChange(id: string, field: 'description' | 'qty' | 'unit_price', raw: string) {
    const numVal = field !== 'description' ? parseFloat(raw) || 0 : 0;
    setItems(prev =>
      prev.map(it => it.id === id ? { ...it, [field]: field === 'description' ? raw : numVal } : it)
    );
    scheduleUpdate(id, { [field]: field === 'description' ? raw : numVal });
  }

  async function handleAdd() {
    setAdding(true);
    const { id, error } = await addTravelItem(programId);
    setAdding(false);
    if (error || !id) return;
    const newItem: DbTravelItem = {
      id, program_id: programId, description: '', qty: 1, unit_price: 0,
      sort_order: items.length,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    setItems(prev => [...prev, newItem]);
  }

  async function handleDelete(id: string) {
    setItems(prev => prev.filter(it => it.id !== id));
    await deleteTravelItem(id, programId);
  }

  async function handleToggle(on: boolean) {
    setIncludeInFee(on);
    startTransition(async () => {
      await updateProgram(programId, { include_travel_in_production_fee: on });
      router.refresh();
    });
  }

  const inputCls = 'border border-brand-cream rounded px-2 py-1 text-sm bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper w-full';

  return (
    <div className="space-y-4">
      {/* Header + toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-brand-charcoal">Travel &amp; Transportation</h3>
          <p className="text-xs text-brand-silver mt-0.5">
            Team travel costs entered once per program. Total: <span className="font-medium text-brand-charcoal">{fmt(total)}</span>
          </p>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <div
            onClick={() => handleToggle(!includeInFee)}
            className={`w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${includeInFee ? 'bg-brand-brown' : 'bg-brand-silver/40'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-transform shadow-sm ${includeInFee ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs text-brand-charcoal leading-tight">
            Include in production fee
            {includeInFee && total > 0 && (
              <span className="ml-1 text-brand-copper font-medium">(+{fmt(total)})</span>
            )}
          </span>
        </label>
      </div>

      {/* Line items */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_70px_90px_80px_28px] gap-2 px-1">
            <span className="text-[10px] text-brand-silver uppercase tracking-wide">Description</span>
            <span className="text-[10px] text-brand-silver uppercase tracking-wide text-right">Qty</span>
            <span className="text-[10px] text-brand-silver uppercase tracking-wide text-right">Unit Price</span>
            <span className="text-[10px] text-brand-silver uppercase tracking-wide text-right">Total</span>
            <span />
          </div>

          {items.map(item => (
            <div key={item.id} className="grid grid-cols-[1fr_70px_90px_80px_28px] gap-2 items-center group">
              <input
                type="text"
                value={item.description}
                onChange={e => handleChange(item.id, 'description', e.target.value)}
                placeholder="e.g. 34-passenger Mini Bus"
                className={inputCls}
              />
              <input
                type="number"
                min="0"
                step="1"
                value={item.qty || ''}
                onChange={e => handleChange(item.id, 'qty', e.target.value)}
                className={inputCls + ' text-right'}
              />
              <div className="relative">
                <span className="absolute left-2 top-1.5 text-brand-silver/60 text-xs pointer-events-none">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price || ''}
                  onChange={e => handleChange(item.id, 'unit_price', e.target.value)}
                  className={inputCls + ' pl-5 text-right'}
                />
              </div>
              <span className="text-sm text-brand-charcoal tabular-nums text-right">
                {fmt(item.qty * item.unit_price)}
              </span>
              <button
                onClick={() => handleDelete(item.id)}
                className="opacity-0 group-hover:opacity-100 text-brand-silver hover:text-red-500 transition-all text-sm leading-none"
                title="Delete"
              >
                ×
              </button>
            </div>
          ))}

          {/* Total row */}
          <div className="grid grid-cols-[1fr_70px_90px_80px_28px] gap-2 pt-1.5 border-t border-brand-cream/60">
            <span className="text-xs font-medium text-brand-charcoal col-span-3 text-right pr-2">Total</span>
            <span className="text-sm font-semibold text-brand-charcoal tabular-nums text-right">{fmt(total)}</span>
            <span />
          </div>
        </div>
      )}

      {/* Add item button */}
      <button
        onClick={handleAdd}
        disabled={adding}
        className="text-xs text-brand-brown hover:text-brand-charcoal underline-offset-2 hover:underline transition-colors disabled:opacity-50"
      >
        {adding ? 'Adding…' : '+ Add travel item'}
      </button>

      {items.length === 0 && (
        <p className="text-xs text-brand-silver italic">
          No travel items yet. Add line items for buses, flights, hotels, per diem, etc.
        </p>
      )}
    </div>
  );
}
