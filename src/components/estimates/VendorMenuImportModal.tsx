'use client';

import { useState } from 'react';
import type { VendorMenu } from '@/lib/vendors/profileTypes';

interface Props {
  menus: VendorMenu[];
  onImport: (menu: VendorMenu) => void;
  onClose: () => void;
}

export default function VendorMenuImportModal({ menus, onImport, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(menus[0]?.id ?? null);

  const selected = menus.find((m) => m.id === selectedId) ?? null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-brand-silver/20">
          <h2 className="text-sm font-semibold text-brand-charcoal">Add from vendor menu</h2>
          <button onClick={onClose} className="text-brand-silver hover:text-brand-charcoal text-lg leading-none">×</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Menu list */}
          <div className="w-48 shrink-0 border-r border-brand-silver/20 overflow-y-auto">
            {menus.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`w-full text-left px-3 py-2.5 text-sm border-b border-brand-silver/10 transition-colors ${selectedId === m.id ? 'bg-brand-cream/60 text-brand-brown font-medium' : 'text-brand-charcoal hover:bg-brand-cream/30'}`}
              >
                <div>{m.name}</div>
                {m.price_per_person != null && (
                  <div className="text-xs text-brand-silver">${m.price_per_person}/pp</div>
                )}
              </button>
            ))}
          </div>

          {/* Menu detail */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {selected ? (
              <>
                <div>
                  <p className="font-medium text-brand-charcoal">{selected.name}</p>
                  {selected.price_per_person != null && (
                    <p className="text-xs text-brand-silver">${selected.price_per_person} per person</p>
                  )}
                  {selected.description && (
                    <p className="text-xs text-brand-silver/70 mt-0.5">{selected.description}</p>
                  )}
                </div>

                {selected.courses.length > 0 && (
                  <div className="space-y-2">
                    {selected.courses.map((course) => (
                      <div key={course.id}>
                        <p className="text-xs font-semibold text-brand-charcoal/60 uppercase tracking-wide">
                          {course.name}{course.selection_rule ? ` — ${course.selection_rule}` : ''}
                        </p>
                        <div className="mt-0.5 space-y-0.5">
                          {course.items.map((item) => (
                            <div key={item.id} className="flex items-baseline gap-2 text-xs text-brand-charcoal pl-1">
                              <span>{item.name}</span>
                              {item.price != null && <span className="text-brand-silver">${item.price}</span>}
                              {item.dietary_tags?.map((t) => (
                                <span key={t} className="text-[10px] text-emerald-700 border border-emerald-200 bg-emerald-50 rounded px-0.5">{t}</span>
                              ))}
                            </div>
                          ))}
                          {course.items.length === 0 && (
                            <div className="text-xs text-brand-silver pl-1">No items listed</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selected.courses.length === 0 && selected.price_per_person == null && (
                  <p className="text-xs text-brand-silver">No menu details available — will import as a $0 line item.</p>
                )}

                <div className="pt-2 border-t border-brand-silver/10">
                  <p className="text-xs text-brand-silver mb-2">
                    {selected.price_per_person != null
                      ? 'Creates one F&B line item at this per-person price × your guest count.'
                      : 'Creates one line item per course item (or one $0 item if no courses). All prices are per person × guest count.'}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-brand-silver">Select a menu.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-brand-silver/20 flex justify-end gap-3">
          <button onClick={onClose} className="text-sm text-brand-silver hover:text-brand-charcoal px-4 py-1.5">
            Cancel
          </button>
          <button
            onClick={() => { if (selected) { onImport(selected); onClose(); } }}
            disabled={!selected}
            className="text-sm bg-brand-brown text-white px-4 py-1.5 rounded hover:bg-brand-brown/90 disabled:opacity-50"
          >
            Add to estimate
          </button>
        </div>
      </div>
    </div>
  );
}
