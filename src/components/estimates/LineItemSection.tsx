'use client';

import { useState } from 'react';
import type { TaxType, Location } from '@/types';
import type { DbMarkup } from '@/lib/supabase/queries';
import type { LocalLineItem, LocalSection } from './EstimateBuilder';
import type { DbTemplate } from '@/app/(programs)/programs/[id]/estimates/actions';
import LineItemRow, { FbTaxToggle } from './LineItemRow';
import TemplatePickerDropdown from './TemplatePickerDropdown';

interface Props {
  section: LocalSection;
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
  onAdd: (section: LocalSection, taxType: TaxType) => void;
  onAddFromTemplate?: (section: LocalSection, template: DbTemplate) => void;
  onSaveAsTemplate?: (id: string) => Promise<void>;
  showMath?: boolean;
  taxExempt?: boolean;
}

const SECTION_LABELS: Record<string, string> = {
  'F&B': 'Food & Beverage',
  'Equipment & Staffing': 'Equipment & Staffing',
  'Venue Fees': 'Venue Fees',
  'Non-Taxable Staffing': 'Non-Taxable Staffing',
  'Florals - Taxable': 'Taxable Floral Product',
  'Florals - Non-Taxable': 'Non-Taxable Floral Fees',
  'Rentals - Seating': 'Seating',
  'Rentals - Lounge': 'Lounge',
  'Rentals - Tables': 'Tables',
  'Rentals - Rugs & Accessories': 'Rugs, Décor & Accessories',
  'Rentals - Non-Taxable': 'Non-Taxable Rental Fees',
};

export default function LineItemSection({ section, label, items, markups, location, defaultTaxType, guestCount, selectedItems, onToggleSelect, onToggleAllSelect, onChange, onBlur, onDelete, onAdd, onAddFromTemplate, onSaveAsTemplate, showMath, taxExempt }: Props) {
  const isFB = section === 'F&B';
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const allSelected = items.length > 0 && items.every((item) => selectedItems?.has(item.id));
  const someSelected = !allSelected && items.some((item) => selectedItems?.has(item.id));

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
          <h4 className="text-xs font-semibold text-brand-brown uppercase tracking-[0.08em]">{label ?? SECTION_LABELS[section]}</h4>
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
          No {(label ?? SECTION_LABELS[section] ?? section).toLowerCase()} items — click + Add item below
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
          onClick={() => onAdd(section, defaultTaxType)}
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
                onSelect={(t) => onAddFromTemplate(section, t)}
                onClose={() => setShowTemplatePicker(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
