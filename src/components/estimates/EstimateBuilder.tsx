'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { TaxType } from '@/types';
import type { DbProgram, DbEstimate, DbLineItem, DbMarkup, DbTier, DbLocation } from '@/lib/supabase/queries';
import {
  calculateVenueEstimate,
  calculateMarginAnalysis,
} from '@/lib/engine/pricing';
import type { ProgramConfig, TeamHoursTier, VenueEstimateInput } from '@/types';
import ScenarioTabs from './ScenarioTabs';
import LineItemSection from './LineItemSection';
import SummaryPanel from './SummaryPanel';
import MarginPanel from './MarginPanel';
import TravelPanel from './TravelPanel';
import AttachmentsPanel from './AttachmentsPanel';
import ExportButtons from './ExportButtons';
import { updateEstimate } from '@/app/(programs)/programs/[id]/estimates/actions';
import { upsertLineItem, deleteLineItem, cacheEstimateTotal } from '@/app/(programs)/programs/[id]/estimates/actions';
import type { TravelRefData, DbTrip } from '@/lib/supabase/queries';

// ─── Types ───────────────────────────────────────────────

export type LocalSection =
  | 'F&B'
  | 'Equipment & Staffing'
  | 'Venue Fees'
  | 'Non-Taxable Staffing'
  | 'Florals - Taxable'
  | 'Florals - Non-Taxable'
  | 'Rentals - Seating'
  | 'Rentals - Lounge'
  | 'Rentals - Tables'
  | 'Rentals - Rugs & Accessories'
  | 'Rentals - Non-Taxable';

export interface LocalLineItem {
  id: string;
  section: LocalSection;
  name: string;
  qty: number;
  unitPrice: number;
  categoryId: string | 'custom' | null;
  defaultMarkupPct: number;    // category reference default (for yellow highlight)
  categoryMarkupPct: number;   // effective markup (override ?? default)
  taxType: TaxType;
  customClientUnitPrice?: number;
  sortOrder: number;
  isNew?: boolean;
}

interface LocalEstimate {
  name: string;
  roomSpace: string;
  fbMinimum: number;
  isVenueTaxable: boolean;
  serviceChargeOverride: number | null;
  gratuityOverride: number | null;
  adminFeeOverride: number | null;
}

// ─── Helpers ──────────────────────────────────────────────

function toEngineLineItems(items: LocalLineItem[]) {
  return items.map((item) => ({
    id: item.id,
    section: item.section,
    name: item.name,
    qty: item.qty,
    unitPrice: item.unitPrice,
    categoryMarkupPct: item.categoryMarkupPct,
    taxType: item.taxType,
    clientCostOverride:
      item.categoryId === 'custom' && item.customClientUnitPrice !== undefined
        ? item.qty * item.customClientUnitPrice
        : undefined,
  }));
}

function toProgramConfig(program: DbProgram, location: DbLocation | null): ProgramConfig {
  return {
    guestCount: program.guest_count,
    location: location
      ? {
          id: location.id,
          name: location.name,
          foodTaxRate: location.food_tax_rate,
          alcoholTaxRate: location.alcohol_tax_rate,
          generalTaxRate: location.general_tax_rate,
        }
      : { id: '', name: '', foodTaxRate: 0, alcoholTaxRate: 0, generalTaxRate: 0 },
    ccProcessingFee: program.cc_processing_fee,
    clientCommission: program.client_commission,
    gdpCommissionEnabled: program.gdp_commission_enabled,
    gdpCommissionRate: program.gdp_commission_rate,
    serviceChargeDefault: program.service_charge_default,
    gratuityDefault: program.gratuity_default,
    adminFeeDefault: program.admin_fee_default,
    thirdPartyCommissions: program.third_party_commissions ?? [],
  };
}

function toTiers(tiers: DbTier[]): TeamHoursTier[] {
  return tiers.map((t) => ({
    revenueThreshold: t.revenue_threshold,
    baseHours: t.base_hours,
    tierName: t.tier_name ?? '',
  }));
}

function dbItemToLocal(item: DbLineItem, markups: DbMarkup[]): LocalLineItem {
  const isCustom = item.custom_client_unit_price !== null;
  const markup = markups.find((m) => m.id === item.category_id);
  const defaultMarkupPct = isCustom ? 0 : (markup?.markup_pct ?? 0.5);
  const effectiveMarkupPct = isCustom ? 0 : (item.markup_override ?? defaultMarkupPct);
  return {
    id: item.id,
    section: item.section as LocalSection,
    name: item.name,
    qty: item.qty,
    unitPrice: item.unit_price,
    categoryId: isCustom ? 'custom' : (item.category_id ?? null),
    defaultMarkupPct,
    categoryMarkupPct: effectiveMarkupPct,
    taxType: item.tax_type as TaxType,
    customClientUnitPrice: isCustom ? item.custom_client_unit_price! : undefined,
    sortOrder: item.sort_order,
  };
}

function resolveOverride<T>(override: T | null, def: T): T {
  return override !== null ? override : def;
}

// ─── Main Component ───────────────────────────────────────

interface Props {
  program: DbProgram;
  location: DbLocation | null;
  allEstimates: DbEstimate[];
  estimate: DbEstimate;
  dbLineItems: DbLineItem[];
  markups: DbMarkup[];
  tiers: DbTier[];
  travelRefs: TravelRefData;
  initialTrips: DbTrip[];
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function EstimateBuilder({
  program, location, allEstimates, estimate, dbLineItems, markups, tiers, travelRefs, initialTrips,
}: Props) {
  const programConfig = useMemo(() => toProgramConfig(program, location), [program, location]);
  const tiersList = useMemo(() => toTiers(tiers), [tiers]);

  // Estimate header state
  const [est, setEst] = useState<LocalEstimate>({
    name: estimate.name,
    roomSpace: estimate.room_space ?? '',
    fbMinimum: estimate.fb_minimum,
    isVenueTaxable: estimate.is_venue_taxable,
    serviceChargeOverride: estimate.service_charge_override,
    gratuityOverride: estimate.gratuity_override,
    adminFeeOverride: estimate.admin_fee_override,
  });

  // Line items state
  const [lineItems, setLineItems] = useState<LocalLineItem[]>(
    dbLineItems.map((item) => dbItemToLocal(item, markups))
  );
  const lineItemsRef = useRef(lineItems);
  lineItemsRef.current = lineItems;

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(0);
  const [travelExpenses, setTravelExpenses] = useState(0);

  // ─── Engine ─────────────────────────────────────────────

  const venueInput = useMemo((): VenueEstimateInput => ({
    name: est.name,
    fbMinimum: est.fbMinimum,
    isVenueTaxable: est.isVenueTaxable,
    serviceCharge: resolveOverride(est.serviceChargeOverride, program.service_charge_default),
    gratuity: resolveOverride(est.gratuityOverride, program.gratuity_default),
    adminFee: resolveOverride(est.adminFeeOverride, program.admin_fee_default),
    lineItems: toEngineLineItems(lineItems),
  }), [est, lineItems, program]);

  const summary = useMemo(
    () => calculateVenueEstimate(venueInput, programConfig),
    [venueInput, programConfig]
  );

  const marginAnalysis = useMemo(
    () => calculateMarginAnalysis(summary, programConfig, tiersList, travelExpenses),
    [summary, programConfig, tiersList, travelExpenses]
  );

  // ─── Cache total (debounced 2s) ───────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => {
      cacheEstimateTotal(estimate.id, program.id, summary.totalClient);
    }, 2000);
    return () => clearTimeout(timer);
  }, [summary.totalClient, estimate.id, program.id]);

  // ─── Save helpers ────────────────────────────────────────

  async function withSave<T>(fn: () => Promise<{ error: string | null } & T>) {
    savingRef.current++;
    setSaveState('saving');
    const result = await fn();
    savingRef.current--;
    if (result.error) {
      setSaveState('error');
      setSaveError(result.error);
    } else if (savingRef.current === 0) {
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => s === 'saved' ? 'idle' : s), 2000);
    }
    return result;
  }

  // ─── Estimate header mutations ────────────────────────────

  function updateEstField(patch: Partial<LocalEstimate>) {
    setEst((prev) => ({ ...prev, ...patch }));
  }

  async function saveEstimate(patch: Partial<LocalEstimate>) {
    const merged = { ...est, ...patch };
    await withSave(() => updateEstimate(estimate.id, program.id, {
      name: merged.name,
      room_space: merged.roomSpace || null,
      fb_minimum: merged.fbMinimum,
      is_venue_taxable: merged.isVenueTaxable,
      service_charge_override: merged.serviceChargeOverride,
      gratuity_override: merged.gratuityOverride,
      admin_fee_override: merged.adminFeeOverride,
    }));
  }

  // ─── Line item mutations ──────────────────────────────────

  const handleItemChange = useCallback((id: string, patch: Partial<LocalLineItem>) => {
    setLineItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      // When category changes, reset markup to new category's default
      if (patch.categoryId !== undefined && patch.categoryId !== item.categoryId) {
        const newDefault = patch.defaultMarkupPct ?? item.defaultMarkupPct;
        return { ...item, ...patch, categoryMarkupPct: newDefault };
      }
      return { ...item, ...patch };
    }));
  }, []);

  const handleItemSave = useCallback(async (id: string) => {
    const item = lineItemsRef.current.find((li) => li.id === id);
    if (!item) return;

    const isOverridden = item.categoryId !== 'custom' && item.categoryMarkupPct !== item.defaultMarkupPct;
    const result = await withSave(() => upsertLineItem({
      id: item.isNew ? undefined : item.id,
      estimate_id: estimate.id,
      section: item.section,
      name: item.name || 'Item',
      qty: item.qty,
      unit_price: item.unitPrice,
      category_id: item.categoryId === 'custom' ? null : (item.categoryId ?? null),
      tax_type: item.taxType,
      custom_client_unit_price: item.categoryId === 'custom' ? (item.customClientUnitPrice ?? 0) : null,
      markup_override: isOverridden ? item.categoryMarkupPct : null,
      sort_order: item.sortOrder,
    }));

    // If it was a new item, replace the temp id with the real DB id
    if (item.isNew && result.id) {
      setLineItems((prev) =>
        prev.map((li) => li.id === id ? { ...li, id: result.id!, isNew: false } : li)
      );
    }
  }, [estimate.id]);

  const handleItemDelete = useCallback(async (id: string) => {
    const item = lineItemsRef.current.find((li) => li.id === id);
    setLineItems((prev) => prev.filter((li) => li.id !== id));
    if (item && !item.isNew) {
      await withSave(() => deleteLineItem(id));
    }
  }, []);

  const handleAddItem = useCallback((section: LocalSection, taxType: TaxType) => {
    const tempId = `new-${Date.now()}-${Math.random()}`;
    const maxOrder = lineItemsRef.current
      .filter((li) => li.section === section)
      .reduce((max, li) => Math.max(max, li.sortOrder), -1);

    const newItem: LocalLineItem = {
      id: tempId,
      section,
      name: '',
      qty: 1,
      unitPrice: 0,
      categoryId: null,
      defaultMarkupPct: 0.5,
      categoryMarkupPct: 0.5,
      taxType,
      sortOrder: maxOrder + 1,
      isNew: true,
    };

    setLineItems((prev) => [...prev, newItem]);

    // Save to DB immediately so we get an id
    setTimeout(() => handleItemSave(tempId), 0);
  }, [handleItemSave]);

  // ─── Fee override helpers ─────────────────────────────────

  const defaultSC = program.service_charge_default;
  const defaultGrat = program.gratuity_default;
  const defaultAdmin = program.admin_fee_default;

  const isOverridden = (val: number | null, def: number) => val !== null && val !== def;

  const feeInputClass = (val: number | null, def: number) =>
    `border rounded px-2 py-1.5 pr-6 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper text-brand-charcoal w-full text-right ${
      isOverridden(val, def)
        ? 'border-yellow-300 bg-yellow-50 focus:border-yellow-400'
        : 'border-brand-cream bg-white'
    }`;

  // ─── Sections ─────────────────────────────────────────────

  const sections: { name: LocalSection; taxType: TaxType }[] = [
    { name: 'F&B', taxType: 'food' },
    { name: 'Equipment & Staffing', taxType: 'general' },
    { name: 'Venue Fees', taxType: 'general' },
    { name: 'Non-Taxable Staffing', taxType: 'none' },
  ];

  // ─── Render ───────────────────────────────────────────────

  const fieldClass = 'border border-brand-cream rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper focus:border-brand-brown bg-white text-brand-charcoal w-full';
  const labelClass = 'block text-xs font-medium text-brand-charcoal/60 tracking-wide mb-1';

  return (
    <div className="flex flex-col h-full">
      {/* Tabs row */}
      <div className="bg-brand-offwhite border-b border-brand-cream px-6 pt-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm text-brand-charcoal/70">
            <a href={`/programs/${program.id}`} className="hover:text-brand-brown text-brand-silver transition-colors">
              {program.name}
            </a>
            <span className="mx-1 text-brand-silver/40">/</span>
            <span className="font-medium text-brand-charcoal">Estimates</span>
          </div>
          <div className="flex items-center gap-3">
            <ExportButtons programId={program.id} programName={program.name} estimateName={est.name} summary={summary} guestCount={program.guest_count} lineItems={lineItems} markups={markups} />
            <div className="text-xs">
              {saveState === 'saving' && <span className="text-brand-silver">Saving…</span>}
              {saveState === 'saved' && <span className="text-green-600">Saved</span>}
              {saveState === 'error' && <span className="text-red-500">{saveError}</span>}
            </div>
          </div>
        </div>
        <ScenarioTabs
          estimates={allEstimates.map((e) => ({ id: e.id, name: e.name }))}
          currentEstimateId={estimate.id}
          programId={program.id}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Estimate header */}
          <div className="bg-white border border-brand-cream rounded-lg p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Estimate Name</label>
                <input
                  type="text"
                  value={est.name}
                  onChange={(e) => updateEstField({ name: e.target.value })}
                  onBlur={() => saveEstimate({ name: est.name })}
                  className={fieldClass}
                  placeholder="e.g., The Belmond — Ballroom"
                />
              </div>
              <div>
                <label className={labelClass}>Room / Space</label>
                <input
                  type="text"
                  value={est.roomSpace}
                  onChange={(e) => updateEstField({ roomSpace: e.target.value })}
                  onBlur={() => saveEstimate({ roomSpace: est.roomSpace })}
                  className={fieldClass}
                  placeholder="e.g., Ballroom A"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>F&B Minimum</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    value={est.fbMinimum === 0 ? '' : est.fbMinimum}
                    onChange={(e) => updateEstField({ fbMinimum: parseFloat(e.target.value) || 0 })}
                    onBlur={() => saveEstimate({ fbMinimum: est.fbMinimum })}
                    className={fieldClass + ' pl-5'}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => {
                      const next = !est.isVenueTaxable;
                      updateEstField({ isVenueTaxable: next });
                      saveEstimate({ isVenueTaxable: next });
                    }}
                    className={`w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${est.isVenueTaxable ? 'bg-brand-brown' : 'bg-brand-silver/40'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-transform ${est.isVenueTaxable ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm text-gray-700">Venue Rental Taxable</span>
                </label>
              </div>

              {/* Fee overrides */}
              <div className="grid grid-cols-3 gap-2 col-span-1">
                <div>
                  <label className={labelClass}>Svc Charge</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={est.serviceChargeOverride !== null ? parseFloat((est.serviceChargeOverride * 100).toFixed(4)) : ''}
                      placeholder={`${parseFloat((defaultSC * 100).toFixed(2))}`}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseFloat(e.target.value) / 100;
                        updateEstField({ serviceChargeOverride: val });
                      }}
                      onBlur={() => saveEstimate({ serviceChargeOverride: est.serviceChargeOverride })}
                      className={feeInputClass(est.serviceChargeOverride, defaultSC)}
                    />
                    <span className="absolute right-2 top-1.5 text-brand-silver text-xs pointer-events-none">%</span>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Gratuity</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={est.gratuityOverride !== null ? parseFloat((est.gratuityOverride * 100).toFixed(4)) : ''}
                      placeholder={`${parseFloat((defaultGrat * 100).toFixed(2))}`}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseFloat(e.target.value) / 100;
                        updateEstField({ gratuityOverride: val });
                      }}
                      onBlur={() => saveEstimate({ gratuityOverride: est.gratuityOverride })}
                      className={feeInputClass(est.gratuityOverride, defaultGrat)}
                    />
                    <span className="absolute right-2 top-1.5 text-brand-silver text-xs pointer-events-none">%</span>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Admin Fee</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={est.adminFeeOverride !== null ? parseFloat((est.adminFeeOverride * 100).toFixed(4)) : ''}
                      placeholder={`${parseFloat((defaultAdmin * 100).toFixed(2))}`}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseFloat(e.target.value) / 100;
                        updateEstField({ adminFeeOverride: val });
                      }}
                      onBlur={() => saveEstimate({ adminFeeOverride: est.adminFeeOverride })}
                      className={feeInputClass(est.adminFeeOverride, defaultAdmin)}
                    />
                    <span className="absolute right-2 top-1.5 text-brand-silver text-xs pointer-events-none">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Line item sections */}
          <div className="bg-white border border-brand-cream rounded-lg p-5 space-y-6">
            {sections.map(({ name: sectionName, taxType }) => (
              <LineItemSection
                key={sectionName}
                section={sectionName}
                items={lineItems.filter((li) => li.section === sectionName)}
                markups={markups}
                defaultTaxType={taxType}
                onChange={(id, patch) => {
                  handleItemChange(id, patch);
                  // Save immediately on select changes (category, tax type)
                  if (patch.categoryId !== undefined || patch.taxType !== undefined) {
                    setTimeout(() => handleItemSave(id), 0);
                  }
                }}
                onBlur={handleItemSave}
                onDelete={handleItemDelete}
                onAdd={handleAddItem}
              />
            ))}
          </div>

          {/* Travel Expenses */}
          <TravelPanel
            estimateId={estimate.id}
            initialTrips={initialTrips}
            refs={travelRefs}
            onTotalChange={setTravelExpenses}
          />

          {/* Attachments */}
          <AttachmentsPanel estimateId={estimate.id} />
        </div>

        {/* Right sidebar — summary + margin */}
        <div className="w-72 flex-shrink-0 border-l border-brand-cream bg-brand-offwhite overflow-y-auto p-4 space-y-4">
          <SummaryPanel summary={summary} guestCount={program.guest_count} fbMinimum={est.fbMinimum} />
          <MarginPanel margin={marginAnalysis} />
        </div>
      </div>
    </div>
  );
}
