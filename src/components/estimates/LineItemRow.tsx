'use client';

import { useState } from 'react';
import type { TaxType, Location } from '@/types';
import type { DbMarkup } from '@/lib/supabase/queries';
import type { LocalLineItem } from './EstimateBuilder';
import ThumbnailCell from './ThumbnailCell';
import PackageSelector from './PackageSelector';
import { suggestIcon } from '@/lib/utils/suggestIcon';

interface Props {
  item: LocalLineItem;
  markups: DbMarkup[];
  location: Location | null;
  showTaxToggle: boolean;  // only for F&B section
  guestCount?: number;
  onChange: (id: string, patch: Partial<LocalLineItem>) => void;
  onBlur: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveAsTemplate?: (id: string) => Promise<{ error: string | null }>;
  showMath?: boolean;
  taxExempt?: boolean;
}

function shortLocationName(name: string): string {
  return name.replace(/\s*\([^)]*\)/, '').replace(/\s+(NC|SC|GA|VA|PA|MD|NY|NJ|DC)$/, '').trim();
}

function taxLabel(taxType: TaxType, location: Location | null): { rate: string; place: string } | null {
  if (taxType === 'none' || !location) return null;
  const r = taxType === 'food' ? location.foodTaxRate
    : taxType === 'alcohol' ? location.alcoholTaxRate
    : location.generalTaxRate;
  return {
    rate: parseFloat((r * 100).toFixed(3)) + '%',
    place: shortLocationName(location.name),
  };
}

function fmt(val: number) {
  if (val === 0) return '—';
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtM(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const inputClass = 'border border-brand-cream rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper focus:border-brand-brown bg-white text-brand-charcoal w-full';

export default function LineItemRow({ item, markups, location, showTaxToggle, guestCount, onChange, onBlur, onDelete, onSaveAsTemplate, showMath, taxExempt }: Props) {
  const [templateSave, setTemplateSave] = useState<{ state: 'idle' | 'saved' | 'error'; message?: string }>({ state: 'idle' });
  // Signature of the fields a template captures (name | unit price | category | tax).
  // Filled star = "a template was saved from this row" — it stays filled while the row still
  // matches what was saved, and auto-reverts the moment any of these change, because templates
  // are snapshots (a copy at save-time), not a live link. Session-scoped only — there is no
  // stored binding to persist across reload.
  const templateSig = `${item.name}|${item.unitPrice}|${item.categoryId ?? ''}|${item.taxType}`;
  const [savedSig, setSavedSig] = useState<string | null>(null);
  const isCustom = item.categoryId === 'custom';
  const isRevenue = item.isRevenueItem === true;
  const ourCost = isRevenue ? 0 : item.qty * item.unitPrice;
  const clientCost = isRevenue
    ? item.qty * item.unitPrice
    : isCustom && item.customClientUnitPrice !== undefined
      ? item.qty * item.customClientUnitPrice
      : item.qty * item.unitPrice * (1 + item.categoryMarkupPct);

  const markupOverridden = !isCustom && item.categoryMarkupPct !== item.defaultMarkupPct;
  const markupDisplayPct = parseFloat((item.categoryMarkupPct * 100).toFixed(2));
  const showQtyWarning = (guestCount ?? 0) > 0 && item.qty > 0 && item.qty !== guestCount;

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

  async function handleSaveAsTemplate() {
    if (!onSaveAsTemplate) return;
    const { error } = await onSaveAsTemplate(item.id);
    if (error) {
      // Surface the real failure (was previously swallowed → false "Saved!"). console.error so the
      // exact error (e.g. an RLS message) can be captured from prod, like the thumbnail-bucket bug.
      console.error('Save as template failed:', error);
      setTemplateSave({ state: 'error', message: error });
      setTimeout(() => setTemplateSave({ state: 'idle' }), 5000);
    } else {
      setSavedSig(templateSig);
      setTemplateSave({ state: 'saved' });
      setTimeout(() => setTemplateSave({ state: 'idle' }), 2000);
    }
  }

  // Star stays filled while the row still matches the snapshot that was saved.
  const savedMatchesRow = savedSig !== null && savedSig === templateSig;
  const starFilled = templateSave.state === 'saved' || savedMatchesRow;

  const templateLabel =
    templateSave.state === 'error' ? `Save failed: ${templateSave.message ?? 'unknown error'}`
    : templateSave.state === 'saved' ? 'Saved as template ✓'
    : savedMatchesRow ? 'Saved as a template (snapshot — not linked to this row)'
    : 'Save as template';

  return (
    <div className="border-b border-brand-cream/40 last:border-0">
    <div className="grid items-center gap-2 py-1.5" style={{ gridTemplateColumns: '32px 2fr 60px 90px 130px 100px 60px 80px 80px 20px 20px' }}>
      {/* Thumbnail */}
      <ThumbnailCell
        lineItemId={item.id}
        thumbnailUrl={item.thumbnailUrl}
        thumbnailIcon={item.thumbnailIcon}
        suggestedIcon={!item.thumbnailUrl && !item.thumbnailIcon ? suggestIcon(item.name) : undefined}
        onChange={(patch) => { onChange(item.id, patch); onBlur(item.id); }}
      />
      {/* Name + Label + Revenue toggle */}
      <div className="flex flex-col gap-0.5">
        <input
          type="text"
          value={item.name}
          onChange={(e) => onChange(item.id, { name: e.target.value })}
          onBlur={() => onBlur(item.id)}
          className={inputClass}
          placeholder="Item name"
        />
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={item.label ?? ''}
            onChange={(e) => onChange(item.id, { label: e.target.value })}
            onBlur={() => onBlur(item.id)}
            className="border border-brand-cream/60 rounded px-2 py-0.5 text-xs text-brand-silver/80 focus:outline-none focus:ring-1 focus:ring-brand-copper/50 bg-transparent flex-1 min-w-0 placeholder:text-brand-silver/40"
            placeholder="Label (internal)"
          />
          <button
            type="button"
            onClick={() => { onChange(item.id, { isRevenueItem: !item.isRevenueItem }); onBlur(item.id); }}
            title="Revenue item — vendor cost is $0, full client price is QC margin"
            className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 border transition-colors ${
              isRevenue
                ? 'bg-green-100 text-green-700 font-medium border-green-200'
                : 'text-brand-silver/40 border-brand-cream/40 hover:text-brand-silver hover:border-brand-cream'
            }`}
          >
            {isRevenue ? 'Rev ✓' : 'Rev'}
          </button>
        </div>
        {item.packageOptions && (
          <PackageSelector
            packageOptions={item.packageOptions}
            selectedPackageId={item.selectedPackageId}
            onChange={(selectedId, pricePerPerson) => {
              onChange(item.id, { selectedPackageId: selectedId, unitPrice: pricePerPerson });
              onBlur(item.id);
            }}
          />
        )}
      </div>

      {/* Qty */}
      <div className="relative">
        <input
          type="number"
          min="0"
          step="1"
          value={item.qty === 0 ? '' : item.qty}
          onChange={(e) => onChange(item.id, { qty: parseFloat(e.target.value) || 0 })}
          onBlur={() => onBlur(item.id)}
          className={inputClass + ' text-right' + (showQtyWarning ? ' border-amber-400 bg-amber-50' : '')}
          placeholder="1"
        />
        {showQtyWarning && (
          <span
            className="absolute -top-1.5 -right-1.5 text-amber-500 text-[11px] leading-none pointer-events-none select-none"
            title={`Qty (${item.qty}) differs from event guest count (${guestCount})`}
          >
            ⚠
          </span>
        )}
      </div>

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

      {/* Tax */}
      {taxExempt ? (
        <div className="text-xs font-medium text-amber-600">Exempt</div>
      ) : (() => {
        const t = taxLabel(item.taxType, location);
        return t ? (
          <div className="leading-tight" title={`${t.rate} — ${location?.name ?? ''}`}>
            <div className="text-sm tabular-nums text-brand-charcoal/70">{t.rate}</div>
            <div className="text-[10px] text-brand-silver/50 truncate">{t.place}</div>
          </div>
        ) : (
          <div className="text-xs text-brand-silver/40">Non-taxable</div>
        );
      })()}

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

      {/* Save as template */}
      {onSaveAsTemplate ? (
        <div className="relative flex items-center justify-center">
          <button
            onClick={handleSaveAsTemplate}
            className={`text-base leading-none text-center transition-colors ${
              templateSave.state === 'error'
                ? 'text-red-500'
                : starFilled
                  ? 'text-brand-copper'
                  : 'text-brand-copper/70 hover:text-brand-copper'
            }`}
            title={templateLabel}
            aria-label={templateLabel}
          >
            {templateSave.state === 'error' ? '⚠' : starFilled ? '★' : '☆'}
          </button>
          {templateSave.state === 'saved' && (
            <span className="absolute right-full mr-1.5 top-1/2 -translate-y-1/2 whitespace-nowrap bg-brand-copper text-white text-[10px] font-medium px-1.5 py-0.5 rounded shadow-sm pointer-events-none z-20">
              Saved as template ✓
            </span>
          )}
          {templateSave.state === 'error' && (
            <span
              className="absolute right-full mr-1.5 top-1/2 -translate-y-1/2 whitespace-nowrap bg-red-500 text-white text-[10px] font-medium px-1.5 py-0.5 rounded shadow-sm pointer-events-none z-20 max-w-[200px] truncate"
              title={templateSave.message}
            >
              Save failed
            </span>
          )}
        </div>
      ) : (
        <div />
      )}

      {/* Delete */}
      <button
        onClick={() => onDelete(item.id)}
        className="text-brand-silver/50 hover:text-red-500 text-lg leading-none text-center transition-colors"
        title="Delete"
      >
        ×
      </button>
    </div>
    {showMath && item.qty > 0 && item.unitPrice > 0 && (
      <div className="text-[11px] text-brand-silver/60 pb-1 px-1.5 -mt-0.5">
        {isRevenue
          ? `Revenue item — vendor cost $0 · client cost: ${item.qty} × $${fmtM(item.unitPrice)} = $${fmtM(clientCost)}`
          : isCustom
            ? `Our cost: ${item.qty} × $${fmtM(item.unitPrice)} = $${fmtM(ourCost)} · Custom price: $${fmtM(item.customClientUnitPrice ?? 0)}/unit × ${item.qty} = $${fmtM(clientCost)}`
            : `Our cost: ${item.qty} × $${fmtM(item.unitPrice)} = $${fmtM(ourCost)} · Markup ${markupDisplayPct}%${markupOverridden ? ` (overridden from ${(item.defaultMarkupPct * 100).toFixed(0)}%)` : ''} → client cost: $${fmtM(clientCost)}`
        }
      </div>
    )}
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
