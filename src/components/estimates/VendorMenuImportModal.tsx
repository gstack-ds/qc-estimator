'use client';

import { useState } from 'react';
import type { VendorMenu, BarOption } from '@/lib/vendors/profileTypes';
import { computeBarPricePP } from '@/lib/vendors/profileTypes';

export interface BarSelection {
  opt: BarOption;
  durationHours: number | null;
}

interface Props {
  menus: VendorMenu[];
  barOptions?: BarOption[];
  onImport: (menu: VendorMenu) => void;
  onImportBars?: (selections: BarSelection[]) => void;
  onClose: () => void;
  defaultBarDurationHours?: number | null;
}

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function BarPriceLabel({ opt, durationHours }: { opt: BarOption; durationHours: number | null }) {
  if (opt.price_per_person == null) return null;
  if (opt.base_hours != null && opt.additional_hour_price_per_person != null) {
    const baseHrLabel = opt.base_hours === 1 ? '1 hr' : `${opt.base_hours} hrs`;
    const computedPP = computeBarPricePP(opt, durationHours);
    return (
      <span className="text-brand-silver">
        {fmt$(opt.price_per_person)}/pp first {baseHrLabel}, +{fmt$(opt.additional_hour_price_per_person)}/pp/hr
        {durationHours != null && (
          <span className="text-brand-charcoal font-medium ml-1">→ {fmt$(computedPP)}/pp</span>
        )}
      </span>
    );
  }
  return <span className="text-brand-silver">{fmt$(opt.price_per_person)}/pp</span>;
}

export default function VendorMenuImportModal({
  menus,
  barOptions = [],
  onImport,
  onImportBars,
  onClose,
  defaultBarDurationHours,
}: Props) {
  const hasMenus = menus.length > 0;
  const hasBars = barOptions.length > 0;
  const [activeTab, setActiveTab] = useState<'menus' | 'bar'>(hasMenus ? 'menus' : 'bar');

  // Menus tab state
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(menus[0]?.id ?? null);
  const selectedMenu = menus.find((m) => m.id === selectedMenuId) ?? null;

  // Bar tab state
  const [selectedBars, setSelectedBars] = useState<Set<string>>(new Set());
  const [barDurations, setBarDurations] = useState<Record<string, string>>({});

  function toggleBar(id: string) {
    setSelectedBars((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    // Pre-fill duration with event default if available and not yet set
    if (!selectedBars.has(id) && defaultBarDurationHours != null && !(id in barDurations)) {
      setBarDurations((prev) => ({ ...prev, [id]: String(defaultBarDurationHours) }));
    }
  }

  function getDurationHours(optId: string): number | null {
    const raw = barDurations[optId];
    if (!raw) return null;
    const v = parseFloat(raw);
    return isNaN(v) || v <= 0 ? null : v;
  }

  function handleAddBars() {
    if (!onImportBars || selectedBars.size === 0) return;
    const selections: BarSelection[] = barOptions
      .filter((o) => selectedBars.has(o.id))
      .map((o) => ({ opt: o, durationHours: getDurationHours(o.id) }));
    onImportBars(selections);
    onClose();
  }

  const isDurationPriced = (opt: BarOption) =>
    opt.base_hours != null && opt.additional_hour_price_per_person != null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-brand-silver/20">
          <h2 className="text-sm font-semibold text-brand-charcoal">Add from vendor</h2>
          <button onClick={onClose} className="text-brand-silver hover:text-brand-charcoal text-lg leading-none">×</button>
        </div>

        {/* Tabs — shown only when both menus and bar options exist */}
        {hasMenus && hasBars && (
          <div className="flex border-b border-brand-silver/20 px-5">
            <button
              onClick={() => setActiveTab('menus')}
              className={`text-xs px-3 py-2 border-b-2 transition-colors -mb-px ${activeTab === 'menus' ? 'border-brand-brown text-brand-brown font-medium' : 'border-transparent text-brand-silver hover:text-brand-charcoal'}`}
            >
              Menus
            </button>
            <button
              onClick={() => setActiveTab('bar')}
              className={`text-xs px-3 py-2 border-b-2 transition-colors -mb-px ${activeTab === 'bar' ? 'border-brand-brown text-brand-brown font-medium' : 'border-transparent text-brand-silver hover:text-brand-charcoal'}`}
            >
              Bar packages
            </button>
          </div>
        )}

        {/* Menus tab */}
        {activeTab === 'menus' && (
          <div className="flex flex-1 overflow-hidden">
            {/* Menu list */}
            <div className="w-48 shrink-0 border-r border-brand-silver/20 overflow-y-auto">
              {menus.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMenuId(m.id)}
                  className={`w-full text-left px-3 py-2.5 text-sm border-b border-brand-silver/10 transition-colors ${selectedMenuId === m.id ? 'bg-brand-cream/60 text-brand-brown font-medium' : 'text-brand-charcoal hover:bg-brand-cream/30'}`}
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
              {selectedMenu ? (
                <>
                  <div>
                    <p className="font-medium text-brand-charcoal">{selectedMenu.name}</p>
                    {selectedMenu.price_per_person != null && (
                      <p className="text-xs text-brand-silver">${selectedMenu.price_per_person} per person</p>
                    )}
                    {selectedMenu.description && (
                      <p className="text-xs text-brand-silver/70 mt-0.5">{selectedMenu.description}</p>
                    )}
                  </div>

                  {selectedMenu.courses.length > 0 && (
                    <div className="space-y-2">
                      {selectedMenu.courses.map((course) => (
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

                  {selectedMenu.courses.length === 0 && selectedMenu.price_per_person == null && (
                    <p className="text-xs text-brand-silver">No menu details available — will import as a $0 line item.</p>
                  )}

                  <div className="pt-2 border-t border-brand-silver/10">
                    <p className="text-xs text-brand-silver mb-2">
                      {selectedMenu.price_per_person != null
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
        )}

        {/* Bar tab */}
        {activeTab === 'bar' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <p className="text-xs text-brand-silver mb-3">Select one or more packages — each becomes a separate alcohol line item × guest count.</p>
            {barOptions.map((opt) => {
              const checked = selectedBars.has(opt.id);
              const durationPriced = isDurationPriced(opt);
              const durationVal = barDurations[opt.id] ?? (defaultBarDurationHours != null ? String(defaultBarDurationHours) : '');
              const computedPP = durationPriced ? computeBarPricePP(opt, getDurationHours(opt.id)) : (opt.price_per_person ?? 0);

              return (
                <div
                  key={opt.id}
                  onClick={() => toggleBar(opt.id)}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${checked ? 'border-brand-brown bg-brand-cream/30' : 'border-brand-silver/20 hover:bg-brand-cream/20'}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBar(opt.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 accent-brand-brown"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-charcoal">{opt.name}</p>
                      <p className="text-xs mt-0.5">
                        <BarPriceLabel opt={opt} durationHours={checked && durationPriced ? getDurationHours(opt.id) : null} />
                      </p>
                      {opt.description && (
                        <p className="text-xs text-brand-silver/70 mt-0.5">{opt.description}</p>
                      )}

                      {/* Duration input — shown when selected and duration-priced */}
                      {checked && durationPriced && (
                        <div
                          className="mt-2 flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label className="text-xs text-brand-charcoal/70">Bar duration:</label>
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={durationVal}
                            onChange={(e) => setBarDurations((prev) => ({ ...prev, [opt.id]: e.target.value }))}
                            className="w-16 border border-brand-silver/40 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-brown text-center"
                          />
                          <span className="text-xs text-brand-silver">hrs</span>
                          {getDurationHours(opt.id) != null && (
                            <span className="text-xs font-medium text-brand-brown">
                              {fmt$(computedPP)}/pp total
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-brand-silver/20 flex justify-end gap-3">
          <button onClick={onClose} className="text-sm text-brand-silver hover:text-brand-charcoal px-4 py-1.5">
            Cancel
          </button>
          {activeTab === 'menus' ? (
            <button
              onClick={() => { if (selectedMenu) { onImport(selectedMenu); onClose(); } }}
              disabled={!selectedMenu}
              className="text-sm bg-brand-brown text-white px-4 py-1.5 rounded hover:bg-brand-brown/90 disabled:opacity-50"
            >
              Add to estimate
            </button>
          ) : (
            <button
              onClick={handleAddBars}
              disabled={selectedBars.size === 0}
              className="text-sm bg-brand-brown text-white px-4 py-1.5 rounded hover:bg-brand-brown/90 disabled:opacity-50"
            >
              {selectedBars.size === 0 ? 'Add to estimate' : `Add ${selectedBars.size} package${selectedBars.size > 1 ? 's' : ''} to estimate`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
