'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { TaxType } from '@/types';
import type { DbProgram, DbEstimate, DbLineItem, DbMarkup, DbTier, DbLocation } from '@/lib/supabase/queries';
import {
  calculateVenueEstimate,
  calculateMarginAnalysis,
} from '@/lib/engine/pricing';
import type { ProgramConfig, TeamHoursTier } from '@/types';
import ScenarioTabs from './ScenarioTabs';
import LineItemSection from './LineItemSection';
import AvSummaryPanel from './AvSummaryPanel';
import MarginPanel from './MarginPanel';
import { updateEstimate, upsertLineItem, deleteLineItem, cacheEstimateTotal } from '@/app/(programs)/programs/[id]/estimates/actions';
import type { LocalLineItem, LocalSection } from './EstimateBuilder';
import TravelPanel from './TravelPanel';
import type { TravelRefData, DbTrip } from '@/lib/supabase/queries';

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
    serviceChargeDefault: 'None',
    gratuityDefault: 'None',
    adminFeeDefault: 'None',
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

// AV sections map to existing engine section names
const AV_SECTIONS: { name: LocalSection; label: string; taxType: TaxType }[] = [
  { name: 'Equipment & Staffing', label: 'Taxable AV & Production Equipment', taxType: 'general' },
  { name: 'Non-Taxable Staffing', label: 'Non-Taxable AV Fees & Labor', taxType: 'none' },
];

export default function AvEstimateBuilder({
  program, location, allEstimates, estimate, dbLineItems, markups, tiers, travelRefs, initialTrips,
}: Props) {
  const programConfig = useMemo(() => toProgramConfig(program, location), [program, location]);
  const tiersList = useMemo(() => toTiers(tiers), [tiers]);

  const [name, setName] = useState(estimate.name);
  const [lineItems, setLineItems] = useState<LocalLineItem[]>(
    dbLineItems.map((item) => dbItemToLocal(item, markups))
  );

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(0);
  const [travelExpenses, setTravelExpenses] = useState(0);

  // ─── Engine ─────────────────────────────────────────────

  const summary = useMemo(
    () => calculateVenueEstimate(
      {
        name,
        fbMinimum: 0,
        isVenueTaxable: false,
        serviceCharge: 'None',
        gratuity: 'None',
        adminFee: 'None',
        lineItems: toEngineLineItems(lineItems),
      },
      programConfig
    ),
    [name, lineItems, programConfig]
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

  async function saveName(val: string) {
    await withSave(() => updateEstimate(estimate.id, program.id, { name: val }));
  }

  // ─── Line item mutations ──────────────────────────────────

  const handleItemChange = useCallback((id: string, patch: Partial<LocalLineItem>) => {
    setLineItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      if (patch.categoryId !== undefined && patch.categoryId !== item.categoryId) {
        const newDefault = patch.defaultMarkupPct ?? item.defaultMarkupPct;
        return { ...item, ...patch, categoryMarkupPct: newDefault };
      }
      return { ...item, ...patch };
    }));
  }, []);

  const handleItemSave = useCallback(async (id: string) => {
    const item = lineItems.find((li) => li.id === id);
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

    if (item.isNew && result.id) {
      setLineItems((prev) =>
        prev.map((li) => li.id === id ? { ...li, id: result.id!, isNew: false } : li)
      );
    }
  }, [lineItems, estimate.id]);

  const handleItemDelete = useCallback(async (id: string) => {
    const item = lineItems.find((li) => li.id === id);
    setLineItems((prev) => prev.filter((li) => li.id !== id));
    if (item && !item.isNew) {
      await withSave(() => deleteLineItem(id));
    }
  }, [lineItems]);

  const handleAddItem = useCallback((section: LocalSection, taxType: TaxType) => {
    const tempId = `new-${Date.now()}-${Math.random()}`;
    const maxOrder = lineItems
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
    setTimeout(() => handleItemSave(tempId), 0);
  }, [lineItems, handleItemSave]);

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
          <div className="bg-white border border-brand-cream rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <label className={labelClass + ' mb-0'}>Estimate Name</label>
              <span className="text-[10px] font-medium text-brand-silver bg-brand-offwhite border border-brand-cream rounded px-1.5 py-0.5 uppercase tracking-wide">AV</span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => saveName(name)}
              className={fieldClass}
              placeholder="e.g., Main Stage AV"
            />
          </div>

          {/* Line item sections */}
          <div className="bg-white border border-brand-cream rounded-lg p-5 space-y-6">
            {AV_SECTIONS.map(({ name: sectionName, label, taxType }) => (
              <LineItemSection
                key={sectionName}
                section={sectionName}
                label={label}
                items={lineItems.filter((li) => li.section === sectionName)}
                markups={markups}
                defaultTaxType={taxType}
                onChange={(id, patch) => {
                  handleItemChange(id, patch);
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
        </div>

        {/* Right sidebar */}
        <div className="w-72 flex-shrink-0 border-l border-brand-cream bg-brand-offwhite overflow-y-auto p-4 space-y-4">
          <AvSummaryPanel summary={summary} guestCount={program.guest_count} />
          <MarginPanel margin={marginAnalysis} />
        </div>
      </div>
    </div>
  );
}
