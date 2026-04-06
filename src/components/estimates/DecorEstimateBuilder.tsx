'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { TaxType } from '@/types';
import type { DbProgram, DbEstimate, DbLineItem, DbMarkup, DbTier, DbLocation } from '@/lib/supabase/queries';
import { calculateVenueEstimate, calculateMarginAnalysis } from '@/lib/engine/pricing';
import type { ProgramConfig, TeamHoursTier } from '@/types';
import ScenarioTabs from './ScenarioTabs';
import LineItemSection from './LineItemSection';
import DecorSummaryPanel from './DecorSummaryPanel';
import MarginPanel from './MarginPanel';
import { updateEstimate, upsertLineItem, deleteLineItem, cacheEstimateTotal } from '@/app/(programs)/programs/[id]/estimates/actions';
import type { LocalLineItem, LocalSection } from './EstimateBuilder';
import TravelPanel from './TravelPanel';
import ExportButtons from './ExportButtons';
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
    serviceChargeDefault: 0,
    gratuityDefault: 0,
    adminFeeDefault: 0,
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

function subtotalClient(items: LocalLineItem[], section: LocalSection) {
  return items
    .filter((li) => li.section === section)
    .reduce((sum, li) => {
      const isCustom = li.categoryId === 'custom';
      const client = isCustom && li.customClientUnitPrice !== undefined
        ? li.qty * li.customClientUnitPrice
        : li.qty * li.unitPrice * (1 + li.categoryMarkupPct);
      return sum + client;
    }, 0);
}

// ─── Sub-section definitions ──────────────────────────────

interface SubSection {
  section: LocalSection;
  label: string;
  taxType: TaxType;
  defaultCategoryHint?: string;
}

const FLORAL_SECTIONS: SubSection[] = [
  { section: 'Florals - Taxable', label: 'Taxable Floral Product', taxType: 'general' },
  { section: 'Florals - Non-Taxable', label: 'Non-Taxable Floral Fees', taxType: 'none' },
];

const RENTAL_SECTIONS: SubSection[] = [
  { section: 'Rentals - Seating', label: 'Seating', taxType: 'general' },
  { section: 'Rentals - Lounge', label: 'Lounge', taxType: 'general' },
  { section: 'Rentals - Tables', label: 'Tables', taxType: 'general' },
  { section: 'Rentals - Rugs & Accessories', label: 'Rugs, Décor & Accessories', taxType: 'general' },
  { section: 'Rentals - Non-Taxable', label: 'Non-Taxable Rental Fees', taxType: 'none' },
];

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

type OpenMap = Partial<Record<LocalSection, boolean>>;

export default function DecorEstimateBuilder({
  program, location, allEstimates, estimate, dbLineItems, markups, tiers, travelRefs, initialTrips,
}: Props) {
  const programConfig = useMemo(() => toProgramConfig(program, location), [program, location]);
  const tiersList = useMemo(() => toTiers(tiers), [tiers]);

  const [name, setName] = useState(estimate.name);
  const [lineItems, setLineItems] = useState<LocalLineItem[]>(
    dbLineItems.map((item) => dbItemToLocal(item, markups))
  );

  // All sub-sections open by default
  const [openMap, setOpenMap] = useState<OpenMap>(() => {
    const map: OpenMap = {};
    [...FLORAL_SECTIONS, ...RENTAL_SECTIONS].forEach((s) => { map[s.section] = true; });
    return map;
  });

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
        serviceCharge: 0,
        gratuity: 0,
        adminFee: 0,
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

  // Sub-section client totals for summary panel breakdown
  const floralTaxableClient = useMemo(() => subtotalClient(lineItems, 'Florals - Taxable'), [lineItems]);
  const floralNonTaxableClient = useMemo(() => subtotalClient(lineItems, 'Florals - Non-Taxable'), [lineItems]);
  const rentalsTaxableClient = useMemo(
    () => ['Rentals - Seating', 'Rentals - Lounge', 'Rentals - Tables', 'Rentals - Rugs & Accessories']
      .reduce((sum, s) => sum + subtotalClient(lineItems, s as LocalSection), 0),
    [lineItems]
  );
  const rentalsNonTaxableClient = useMemo(() => subtotalClient(lineItems, 'Rentals - Non-Taxable'), [lineItems]);

  // ─── Cache total ─────────────────────────────────────────

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
      defaultMarkupPct: 0.85,   // Décor & Design default
      categoryMarkupPct: 0.85,
      taxType,
      sortOrder: maxOrder + 1,
      isNew: true,
    };

    setLineItems((prev) => [...prev, newItem]);
    setTimeout(() => handleItemSave(tempId), 0);
  }, [lineItems, handleItemSave]);

  function toggleSection(section: LocalSection) {
    setOpenMap((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  // ─── Render helpers ───────────────────────────────────────

  const fieldClass = 'border border-brand-cream rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper focus:border-brand-brown bg-white text-brand-charcoal w-full';
  const labelClass = 'block text-xs font-medium text-brand-charcoal/60 tracking-wide mb-1';

  function fmt(val: number) {
    return val === 0 ? '' : '$' + Math.round(val).toLocaleString('en-US');
  }

  function renderSubSection(sub: SubSection) {
    const items = lineItems.filter((li) => li.section === sub.section);
    const isOpen = openMap[sub.section] !== false;
    const total = subtotalClient(items, sub.section);

    return (
      <div key={sub.section} className="border border-brand-cream rounded-md overflow-hidden">
        {/* Sub-section header */}
        <button
          type="button"
          onClick={() => toggleSection(sub.section)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-brand-offwhite hover:bg-brand-cream/40 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className={`text-brand-silver text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
            <span className="text-xs font-semibold text-brand-brown uppercase tracking-[0.08em]">{sub.label}</span>
            <span className="text-xs text-brand-silver/70">
              {items.length > 0 ? `${items.length} item${items.length !== 1 ? 's' : ''}` : ''}
            </span>
          </div>
          {total > 0 && (
            <span className="text-xs font-medium text-brand-charcoal tabular-nums">{fmt(total)}</span>
          )}
        </button>

        {/* Sub-section content */}
        {isOpen && (
          <div className="px-4 pb-4 pt-2">
            <LineItemSection
              section={sub.section}
              label={sub.label}
              items={items}
              markups={markups}
              defaultTaxType={sub.taxType}
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
          </div>
        )}
      </div>
    );
  }

  // Section totals for headers
  const floralTotal = floralTaxableClient + floralNonTaxableClient;
  const rentalsTotal = rentalsTaxableClient + rentalsNonTaxableClient;

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
            <ExportButtons programId={program.id} programName={program.name} estimateName={name} summary={summary} guestCount={program.guest_count} estimateType="decor" />
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
              <span className="text-[10px] font-medium text-brand-silver bg-brand-offwhite border border-brand-cream rounded px-1.5 py-0.5 uppercase tracking-wide">Decor</span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => saveName(name)}
              className={fieldClass}
              placeholder="e.g., Gala Florals & Rentals"
            />
          </div>

          {/* Florals section */}
          <div className="bg-white border border-brand-cream rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-brand-cream">
              <h3 className="font-serif text-base font-medium text-brand-charcoal">Florals</h3>
              {floralTotal > 0 && (
                <span className="text-sm font-medium text-brand-charcoal tabular-nums">{fmt(floralTotal)}</span>
              )}
            </div>
            {FLORAL_SECTIONS.map(renderSubSection)}
          </div>

          {/* Rentals & Lounge section */}
          <div className="bg-white border border-brand-cream rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-brand-cream">
              <h3 className="font-serif text-base font-medium text-brand-charcoal">Rentals & Lounge</h3>
              {rentalsTotal > 0 && (
                <span className="text-sm font-medium text-brand-charcoal tabular-nums">{fmt(rentalsTotal)}</span>
              )}
            </div>
            {RENTAL_SECTIONS.map(renderSubSection)}
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
          <DecorSummaryPanel
            summary={summary}
            guestCount={program.guest_count}
            floralTaxableClient={floralTaxableClient}
            floralNonTaxableClient={floralNonTaxableClient}
            rentalsTaxableClient={rentalsTaxableClient}
            rentalsNonTaxableClient={rentalsNonTaxableClient}
          />
          <MarginPanel margin={marginAnalysis} />
        </div>
      </div>
    </div>
  );
}
