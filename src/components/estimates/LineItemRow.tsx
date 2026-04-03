'use client';

import type { TaxType } from '@/types';
import type { DbMarkup } from '@/lib/supabase/queries';
import type { LocalLineItem } from './EstimateBuilder';

interface Props {
  item: LocalLineItem;
  markups: DbMarkup[];
  showTaxToggle: boolean;  // only for F&B section
  onChange: (id: string, patch: Partial<LocalLineItem>) => void;
  onBlur: (id: string) => void;
  onDelete: (id: string) => void;
}

function fmt(val: number) {
  if (val === 0) return '—';
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const inputClass = 'border border-brand-cream rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper focus:border-brand-brown bg-white text-brand-charcoal w-full';

export default function LineItemRow({ item, markups, showTaxToggle, onChange, onBlur, onDelete }: Props) {
  const isCustom = item.categoryId === 'custom';
  const ourCost = item.qty * item.unitPrice;
  const clientCost = isCustom && item.customClientUnitPrice !== undefined
    ? item.qty * item.customClientUnitPrice
    : ourCost * (1 + item.categoryMarkupPct);

  const markupOverridden = !isCustom && item.categoryMarkupPct !== item.defaultMarkupPct;
  const markupDisplayPct = parseFloat((item.categoryMarkupPct * 100).toFixed(2));

  function handleCategoryChange(categoryId: string) {
    if (categoryId === 'custom') {
      onChange(item.id, { categoryId: 'custom', defaultMarkupPct: 0, categoryMarkupPct: 0, customClientUnitPrice: item.unitPrice });
    } else {
      const markup = markups.find((m) => m.id === categoryId);
      const defaultPct = markup?.markup_pct ?? 0.5;
      onChange(item.id, {
        categoryId,
        defaultMarkupPct: defaultPct,
        categoryMarkupPct: defaultPct,
        customClientUnitPrice: undefined,
      });
    }
  }

  function handleMarkupBlur(e: React.FocusEvent<HTMLInputElement>) {
    const raw = parseFloat(e.target.value);
    const clamped = isNaN(raw) ? item.defaultMarkupPct : Math.min(3.0, Math.max(0.05, raw / 100));
    onChange(item.id, { categoryMarkupPct: clamped });
    onBlur(item.id);
  }

  return (
    <div className="grid items-center gap-2 py-1.5 border-b border-brand-cream/40 last:border-0" style={{ gridTemplateColumns: '2fr 60px 90px 130px 60px 80px 80px 24px' }}>
      {/* Name */}
      <input
        type="text"
        value={item.name}
        onChange={(e) => onChange(item.id, { name: e.target.value })}
        onBlur={() => onBlur(item.id)}
        className={inputClass}
        placeholder="Item name"
      />

      {/* Qty */}
      <input
        type="number"
        min="0"
        step="1"
        value={item.qty === 0 ? '' : item.qty}
        onChange={(e) => onChange(item.id, { qty: parseFloat(e.target.value) || 0 })}
        onBlur={() => onBlur(item.id)}
        className={inputClass + ' text-right'}
        placeholder="1"
      />

      {/* Unit price (our cost) */}
      <div className="relative">
        <span className="absolute left-2 top-1 text-gray-400 text-sm pointer-events-none">$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={item.unitPrice === 0 ? '' : item.unitPrice}
          onChange={(e) => onChange(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
          onBlur={() => onBlur(item.id)}
          className={inputClass + ' pl-5 text-right'}
          placeholder="0.00"
        />
      </div>

      {/* Category dropdown */}
      <select
        value={item.categoryId ?? ''}
        onChange={(e) => handleCategoryChange(e.target.value)}
        className={inputClass}
      >
        <option value="">— Category —</option>
        {markups.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
        <option value="custom">Custom (manual price)</option>
      </select>

      {/* Markup % (editable, yellow when overridden) */}
      {isCustom ? (
        <div />
      ) : (
        <div className="relative">
          <input
            type="number"
            min="5"
            max="300"
            step="1"
            value={markupDisplayPct}
            onChange={(e) => onChange(item.id, { categoryMarkupPct: (parseFloat(e.target.value) || 50) / 100 })}
            onBlur={handleMarkupBlur}
            className={
              inputClass + ' text-right pr-5 ' +
              (markupOverridden ? 'bg-yellow-50 border-yellow-300 focus:border-yellow-400 focus:ring-yellow-300' : '')
            }
            title={markupOverridden ? `Default: ${(item.defaultMarkupPct * 100).toFixed(0)}%` : undefined}
          />
          <span className="absolute right-2 top-1 text-gray-400 text-xs pointer-events-none">%</span>
        </div>
      )}

      {/* Custom client price OR our cost display */}
      {isCustom ? (
        <div className="relative">
          <span className="absolute left-2 top-1 text-gray-400 text-sm pointer-events-none">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.customClientUnitPrice === undefined || item.customClientUnitPrice === 0 ? '' : item.customClientUnitPrice}
            onChange={(e) => onChange(item.id, { customClientUnitPrice: parseFloat(e.target.value) || 0 })}
            onBlur={() => onBlur(item.id)}
            className={inputClass + ' pl-5 text-right bg-yellow-50 border-yellow-300'}
            placeholder="Client $"
            title="Client price per unit"
          />
        </div>
      ) : (
        <div className="text-right text-sm text-brand-silver tabular-nums pr-1">{fmt(ourCost)}</div>
      )}

      {/* Client cost */}
      <div className="text-right text-sm font-medium text-brand-charcoal tabular-nums pr-1">{fmt(clientCost)}</div>

      {/* Delete */}
      <button
        onClick={() => onDelete(item.id)}
        className="text-brand-silver/50 hover:text-red-500 text-lg leading-none text-center transition-colors"
        title="Delete"
      >
        ×
      </button>
    </div>
  );
}

// Sub-component: F&B food/alcohol toggle
export function FbTaxToggle({ taxType, onChange }: { taxType: TaxType; onChange: (t: TaxType) => void }) {
  return (
    <div className="flex items-center gap-1 ml-2">
      <button
        onClick={() => onChange('food')}
        className={`text-xs px-1.5 py-0.5 rounded ${taxType === 'food' ? 'bg-orange-100 text-orange-700 font-medium' : 'text-gray-400 hover:bg-gray-100'}`}
      >
        Food
      </button>
      <button
        onClick={() => onChange('alcohol')}
        className={`text-xs px-1.5 py-0.5 rounded ${taxType === 'alcohol' ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-400 hover:bg-gray-100'}`}
      >
        Bar
      </button>
    </div>
  );
}
