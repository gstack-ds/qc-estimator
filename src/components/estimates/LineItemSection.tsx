'use client';

import { useState } from 'react';
import type { TaxType, TaxBucket, Location } from '@/types';
import type { DbMarkup } from '@/lib/supabase/queries';
import type { LocalLineItem } from './EstimateBuilder';
import type { DbTemplate } from '@/app/(programs)/programs/[id]/estimates/actions';
import LineItemRow, { FbTaxToggle } from './LineItemRow';
import TemplatePickerDropdown from './TemplatePickerDropdown';

export interface LocalSectionDef {
  id: string;
  name: string;
  taxBucket: TaxBucket;
  markupPct: number;
  isBuiltIn: boolean;
}

interface Props {
  sectionDef: LocalSectionDef;
  label?: string;
  items: LocalLineItem[];
  markups: DbMarkup[];
  location: Location | null;
  defaultTaxType: TaxType;
  guestCount?: number;
  selectedItems?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleAllSelect?: (ids: string[], selected: boolean) => void;
  onChange: (id: string, patch: Partial<LocalLineItem>) => void;
  onBlur: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (sectionDef: LocalSectionDef, taxType: TaxType) => void;
  onAddFromTemplate?: (sectionDef: LocalSectionDef, template: DbTemplate) => void;
  onSaveAsTemplate?: (id: string) => Promise<void>;
  onRename?: (sectionId: string, newName: string) => void;
  onDeleteSection?: (sectionId: string) => void;
  showMath?: boolean;
  taxExempt?: boolean;
}

export default function LineItemSection({ sectionDef, label, items, markups, location, defaultTaxType, guestCount, selectedItems, onToggleSelect, onToggleAllSelect, onChange, onBlur, onDelete, onAdd, onAddFromTemplate, onSaveAsTemplate, onRename, onDeleteSection, showMath, taxExempt }: Props) {
  const isFB = sectionDef.taxBucket === 'fb';
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(sectionDef.name);

  const allSelected = items.length > 0 && items.every((item) => selectedItems?.has(item.id));
  const someSelected = !allSelected && items.some((item) => selectedItems?.has(item.id));

  const displayName = label ?? sectionDef.name;
  const canDelete = items.length === 0 && !!onDeleteSection;

  function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== sectionDef.name && onRename) {
      onRename(sectionDef.id, trimmed);
    } else {
      setRenameValue(sectionDef.name);
    }
    setIsRenaming(false);
  }

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between py-2 border-b border-brand-cream mb-1">
        <div className="flex items-center gap-2">
          {onToggleAllSelect && items.length > 0 && (
            <input
              type="checkbox"
              ref={(el) => { if (el) el.indeterminate = someSelected; }}
              checked={allSelected}
              onChange={(e) => onToggleAllSelect(items.map((i) => i.id), e.target.checked)}
              className="flex-shrink-0 accent-brand-copper cursor-pointer"
              title={allSelected ? 'Deselect all in section' : 'Select all in section'}
            />
          )}
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setRenameValue(sectionDef.name); setIsRenaming(false); } }}
              className="text-xs font-semibold text-brand-brown uppercase tracking-[0.08em] border-b border-brand-copper bg-transparent focus:outline-none w-48"
            />
          ) : (
            <h4 className="text-xs font-semibold text-brand-brown uppercase tracking-[0.08em]">{displayName}</h4>
          )}
          {onRename && !isRenaming && (
            <button
              type="button"
              onClick={() => { setRenameValue(sectionDef.name); setIsRenaming(true); }}
              className="text-brand-silver/40 hover:text-brand-silver transition-colors"
              title="Rename section"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDeleteSection!(sectionDef.id)}
              className="text-brand-silver/30 hover:text-red-400 transition-colors"
              title="Delete empty section"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
        {items.length > 0 && (
          <div className="grid text-xs font-medium text-brand-silver gap-2 pr-6" style={{ gridTemplateColumns: '2fr 60px 90px 130px 100px 60px 80px 80px 20px 20px' }}>
            <span></span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit Price</span>
            <span>Category</span>
            <span>Tax</span>
            <span className="text-right">Markup</span>
            <span className="text-right">Our Cost</span>
            <span className="text-right">Client Cost</span>
            <span></span>
            <span></span>
          </div>
        )}
      </div>

      {items.length === 0 && (
        <p className="text-xs text-gray-400 italic py-3 pl-1">
          No {displayName.toLowerCase()} items — click + Add item below
        </p>
      )}

      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-1">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={selectedItems?.has(item.id) ?? false}
              onChange={() => onToggleSelect(item.id)}
              className="flex-shrink-0 accent-brand-copper cursor-pointer"
              title="Select for bulk move"
            />
          )}
          {isFB && (
            <FbTaxToggle
              taxType={item.taxType}
              onChange={(t) => onChange(item.id, { taxType: t })}
            />
          )}
          <div className="flex-1">
            <LineItemRow
              item={item}
              markups={markups}
              location={location}
              showTaxToggle={isFB}
              guestCount={guestCount}
              onChange={onChange}
              onBlur={onBlur}
              onDelete={onDelete}
              onSaveAsTemplate={onSaveAsTemplate}
              showMath={showMath}
              taxExempt={taxExempt}
            />
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3 mt-1 relative">
        <button
          onClick={() => onAdd(sectionDef, defaultTaxType)}
          className="text-xs text-brand-brown hover:text-brand-charcoal py-1 transition-colors"
        >
          + Add item
        </button>
        {onAddFromTemplate && (
          <div className="relative">
            <button
              onClick={() => setShowTemplatePicker((v) => !v)}
              className="text-xs text-brand-silver hover:text-brand-charcoal py-1 transition-colors"
            >
              + From template
            </button>
            {showTemplatePicker && (
              <TemplatePickerDropdown
                onSelect={(t) => onAddFromTemplate(sectionDef, t)}
                onClose={() => setShowTemplatePicker(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
