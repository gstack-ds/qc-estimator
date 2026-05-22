'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { TaxType } from '@/types';
import type { DbProgram, DbEstimate, DbLineItem, DbMarkup, DbTier, DbLocation } from '@/lib/supabase/queries';
import { calculateVenueEstimate, calculateMarginAnalysis } from '@/lib/engine/pricing';
import type { ProgramConfig, TeamHoursTier } from '@/types';
import EstimateNav from './EstimateNav';
import CopyItemsFromButton from './CopyItemsFromButton';
import LineItemSection from './LineItemSection';
import DecorSummaryPanel from './DecorSummaryPanel';
import MarginPanel from './MarginPanel';
import { updateEstimate, upsertLineItem, deleteLineItem, cacheEstimateTotal, saveTemplate } from '@/app/(programs)/programs/[id]/estimates/actions';
import type { DbTemplate, ExtractedData } from '@/app/(programs)/programs/[id]/estimates/actions';
import type { LocalLineItem, LocalSection } from './EstimateBuilder';
import TravelPanel from './TravelPanel';
import AttachmentsPanel from './AttachmentsPanel';
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
    isRevenueItem: item.isRevenueItem,
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
    label: item.label ?? undefined,
    qty: item.qty,
    unitPrice: item.unit_price,
    categoryId: isCustom ? 'custom' : (item.category_id ?? null),
    defaultMarkupPct,
    categoryMarkupPct: effectiveMarkupPct,
    taxType: item.tax_type as TaxType,
    customClientUnitPrice: isCustom ? item.custom_client_unit_price! : undefined,
    isRevenueItem: item.is_revenue_item,
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
  eventName?: string | null;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type OpenMap = Partial<Record<LocalSection, boolean>>;

export default function DecorEstimateBuilder({
  program, location, allEstimates, estimate, dbLineItems, markups, tiers, travelRefs, initialTrips, eventName,
}: Props) {
  const programConfig = useMemo(() => toProgramConfig(program, location), [program, location]);
  const tiersList = useMemo(() => toTiers(tiers), [tiers]);

  const [name, setName] = useState(estimate.name);
  const [discountType, setDiscountType] = useState<'percent' | 'flat' | null>(estimate.discount_type ?? null);
  const [discountValue, setDiscountValue] = useState(estimate.discount_value ?? 0);
  const [lineItems, setLineItems] = useState<LocalLineItem[]>(
    dbLineItems.map((item) => dbItemToLocal(item, markups))
  );
  const lineItemsRef = useRef(lineItems);
  lineItemsRef.current = lineItems;

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
  const [showMath, setShowMath] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

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
        discount: discountType && discountValue > 0 ? { type: discountType, value: discountValue } : null,
      },
      programConfig
    ),
    [name, lineItems, programConfig, discountType, discountValue]
  );

  const marginAnalysis = useMemo(
    () => calculateMarginAnalysis(summary, programConfig, tiersList, travelExpenses),
    [summary, programConfig, tiersList, travelExpenses]
  );

  const mathRates = useMemo(() => ({
    serviceChargeRate: 0,
    gratuityRate: 0,
    adminFeeRate: 0,
    ccProcessingFee: programConfig.ccProcessingFee,
    clientCommissionRate: programConfig.clientCommission,
    foodTaxRate: programConfig.location.foodTaxRate,
    alcoholTaxRate: programConfig.location.alcoholTaxRate,
    generalTaxRate: programConfig.location.generalTaxRate,
  }), [programConfig]);

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

  async function saveDiscount(type: 'percent' | 'flat' | null, value: number) {
    await withSave(() => updateEstimate(estimate.id, program.id, { discount_type: type, discount_value: value }));
  }

  // ─── Line item mutations ──────────────────────────────────

  const handleItemChange = useCallback((id: string, patch: Partial<LocalLineItem>) => {
    setLineItems((prev) => {
      const next = prev.map((item) => {
        if (item.id !== id) return item;
        if (patch.categoryId !== undefined && patch.categoryId !== item.categoryId) {
          const newDefault = patch.defaultMarkupPct ?? item.defaultMarkupPct;
          return { ...item, ...patch, categoryMarkupPct: newDefault };
        }
        return { ...item, ...patch };
      });
      lineItemsRef.current = next;
      return next;
    });
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
      label: item.label ?? null,
      qty: item.qty,
      unit_price: item.unitPrice,
      category_id: item.categoryId === 'custom' ? null : (item.categoryId ?? null),
      tax_type: item.taxType,
      custom_client_unit_price: item.categoryId === 'custom' ? (item.customClientUnitPrice ?? 0) : null,
      markup_override: isOverridden ? item.categoryMarkupPct : null,
      is_revenue_item: item.isRevenueItem ?? false,
      sort_order: item.sortOrder,
    }));

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
      defaultMarkupPct: 0.85,   // Décor & Design default
      categoryMarkupPct: 0.85,
      taxType,
      sortOrder: maxOrder + 1,
      isNew: true,
    };

    setLineItems((prev) => [...prev, newItem]);
    setTimeout(() => handleItemSave(tempId), 0);
  }, [handleItemSave]);

  const handleSaveAsTemplate = useCallback(async (id: string) => {
    const item = lineItemsRef.current.find((li) => li.id === id);
    if (!item) return;
    await saveTemplate({
      name: item.name || 'Unnamed item',
      category_id: item.categoryId === 'custom' ? null : (item.categoryId ?? null),
      default_unit_price: item.unitPrice,
      tax_type: item.taxType,
    });
  }, []);

  const handleAddFromTemplate = useCallback((section: LocalSection, template: DbTemplate) => {
    const tempId = `new-${Date.now()}-${Math.random()}`;
    const maxOrder = lineItemsRef.current
      .filter((li) => li.section === section)
      .reduce((max, li) => Math.max(max, li.sortOrder), -1);
    const newItem: LocalLineItem = {
      id: tempId,
      section,
      name: template.name,
      qty: 1,
      unitPrice: template.default_unit_price,
      categoryId: template.category_id,
      defaultMarkupPct: template.category_markup_pct ?? 0.85,
      categoryMarkupPct: template.category_markup_pct ?? 0.85,
      taxType: template.tax_type as TaxType,
      sortOrder: maxOrder + 1,
      isNew: true,
    };
    setLineItems((prev) => [...prev, newItem]);
    setTimeout(() => handleItemSave(tempId), 0);
  }, [handleItemSave]);

  const handleImportItems = useCallback((imported: LocalLineItem[]) => {
    setLineItems((prev) => [...prev, ...imported]);
    imported.forEach((item) => setTimeout(() => handleItemSave(item.id), 0));
  }, [handleItemSave]);

  const SECTION_DEFAULT_TAX: Record<LocalSection, TaxType> = {
    'F&B': 'food', 'Equipment & Staffing': 'general', 'Venue Fees': 'general',
    'Non-Taxable Staffing': 'none', 'Florals - Taxable': 'general', 'Florals - Non-Taxable': 'none',
    'Rentals - Seating': 'general', 'Rentals - Lounge': 'general', 'Rentals - Tables': 'general',
    'Rentals - Rugs & Accessories': 'general', 'Rentals - Non-Taxable': 'none',
  };

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedItems((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  const handleMoveToSection = useCallback((targetSection: LocalSection) => {
    const ids = new Set(selectedItems);
    const taxType = SECTION_DEFAULT_TAX[targetSection];
    setLineItems((prev) => {
      const next = prev.map((item) => ids.has(item.id) ? { ...item, section: targetSection, taxType } : item);
      lineItemsRef.current = next;
      return next;
    });
    for (const id of ids) setTimeout(() => handleItemSave(id), 0);
    setSelectedItems(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, handleItemSave]);

  const handlePopulateFromExtraction = useCallback((data: ExtractedData) => {
    const decorMarkup = markups.find((m) => m.name === 'Décor & Design');
    const deliveryMarkup = markups.find((m) => m.name === 'Delivery & Logistics');

    const sectionOrders: Partial<Record<LocalSection, number>> = {};
    function nextOrder(section: LocalSection): number {
      if (sectionOrders[section] === undefined) {
        sectionOrders[section] = lineItemsRef.current
          .filter((li) => li.section === section)
          .reduce((max, li) => Math.max(max, li.sortOrder), -1) + 1;
      }
      const order = sectionOrders[section] as number;
      sectionOrders[section] = order + 1;
      return order;
    }

    const toImport: LocalLineItem[] = (data.equipmentItems ?? []).map((item) => {
      let section: LocalSection;
      let markup: typeof decorMarkup;
      let taxType: TaxType;

      if (item.section === 'delivery') {
        section = 'Florals - Non-Taxable';
        markup = deliveryMarkup;
        taxType = 'none';
      } else if (item.section === 'rentals') {
        section = 'Rentals - Rugs & Accessories';
        markup = decorMarkup;
        taxType = 'general';
      } else {
        // florals, lighting, signage, or any unrecognized section → Florals - Taxable
        section = 'Florals - Taxable';
        markup = decorMarkup;
        taxType = 'general';
      }

      return {
        id: `new-${Date.now()}-${Math.random()}`,
        section,
        name: item.name,
        label: item.label ?? undefined,
        qty: item.qty ?? 1,
        unitPrice: item.unitPrice ?? 0,
        categoryId: markup?.id ?? null,
        defaultMarkupPct: markup?.markup_pct ?? 0.85,
        categoryMarkupPct: markup?.markup_pct ?? 0.85,
        taxType,
        sortOrder: nextOrder(section),
        isNew: true,
      };
    });

    handleImportItems(toImport);
  }, [markups, handleImportItems]);

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
              guestCount={program.guest_count}
              onChange={(id, patch) => {
                handleItemChange(id, patch);
                if (patch.categoryId !== undefined || patch.taxType !== undefined) {
                  setTimeout(() => handleItemSave(id), 0);
                }
              }}
              onBlur={handleItemSave}
              onDelete={handleItemDelete}
              onAdd={handleAddItem}
              onAddFromTemplate={handleAddFromTemplate}
              onSaveAsTemplate={handleSaveAsTemplate}
              location={programConfig.location}
              showMath={showMath}
              selectedItems={selectedItems}
              onToggleSelect={handleToggleSelect}
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
      {/* Header */}
      <div className="bg-brand-offwhite border-b border-brand-cream px-6 py-2 flex items-center gap-4">
        <EstimateNav
          programId={program.id}
          programName={program.name}
          eventName={eventName}
          estimateId={estimate.id}
          estimateName={name}
        />
        <div className="flex items-center gap-3 flex-shrink-0">
          <CopyItemsFromButton
            currentEstimateId={estimate.id}
            otherEstimates={allEstimates.map((e) => ({ id: e.id, name: e.name }))}
            markups={markups}
            onImport={handleImportItems}
          />
          <ExportButtons programId={program.id} programName={program.name} estimateId={estimate.id} estimateName={name} clientName={program.client_name} clientCompany={program.company_name} summary={summary} guestCount={program.guest_count} estimateType="decor" lineItems={lineItems} markups={markups} />
          <button
            onClick={() => setShowMath(v => !v)}
            className={`text-xs px-2.5 py-1 rounded border transition-colors ${showMath ? 'border-brand-copper/60 bg-brand-offwhite text-brand-brown' : 'border-brand-cream bg-white text-brand-charcoal/70 hover:text-brand-charcoal hover:bg-brand-offwhite'}`}
          >
            {showMath ? 'Hide Math' : 'Show Math'}
          </button>
          <div className="text-xs">
            {saveState === 'saving' && <span className="text-brand-silver">Saving…</span>}
            {saveState === 'saved' && <span className="text-green-600">Saved</span>}
            {saveState === 'error' && <span className="text-red-500">{saveError}</span>}
          </div>
        </div>
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

          {/* Discount */}
          {(discountType || discountValue > 0) ? (
            <div className="bg-white border border-brand-cream rounded-lg p-5">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-medium text-brand-charcoal/60 tracking-wide uppercase">Client Discount</span>
                <div className="flex rounded overflow-hidden border border-brand-cream text-xs">
                  <button
                    type="button"
                    onClick={() => { setDiscountType('percent'); saveDiscount('percent', discountValue); }}
                    className={`px-2.5 py-1 ${discountType === 'percent' ? 'bg-brand-copper text-white' : 'bg-white text-brand-charcoal/70 hover:bg-brand-offwhite'}`}
                  >%</button>
                  <button
                    type="button"
                    onClick={() => { setDiscountType('flat'); saveDiscount('flat', discountValue); }}
                    className={`px-2.5 py-1 ${discountType === 'flat' ? 'bg-brand-copper text-white' : 'bg-white text-brand-charcoal/70 hover:bg-brand-offwhite'}`}
                  >$</button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  onBlur={(e) => { const v = parseFloat(e.target.value) || 0; setDiscountValue(v); saveDiscount(discountType, v); }}
                  className="border border-brand-cream rounded px-2.5 py-1.5 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-brand-copper bg-white text-brand-charcoal"
                  placeholder={discountType === 'percent' ? '0.00' : '0.00'}
                />
                <button
                  type="button"
                  onClick={() => { setDiscountType(null); setDiscountValue(0); saveDiscount(null, 0); }}
                  className="text-xs text-brand-silver hover:text-brand-charcoal"
                >Clear</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDiscountType('percent')}
              className="text-xs text-brand-silver hover:text-brand-charcoal underline underline-offset-2 self-start"
            >+ Add Client Discount</button>
          )}

          {/* Attachments */}
          <AttachmentsPanel estimateId={estimate.id} estimateType="decor" onPopulateLineItems={handlePopulateFromExtraction} />

          {/* Guest count mismatch banner */}
          {program.guest_count > 0 && lineItems.filter((li) => li.qty > 0 && li.qty !== program.guest_count).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-2 text-sm text-amber-800">
              {(() => {
                const n = lineItems.filter((li) => li.qty > 0 && li.qty !== program.guest_count).length;
                return `⚠ ${n} line item${n !== 1 ? 's have' : ' has'} a different quantity than the event guest count (${program.guest_count})`;
              })()}
            </div>
          )}

          {/* Move items action bar */}
          {selectedItems.size > 0 && (
            <div className="bg-brand-offwhite border border-brand-copper/30 rounded-lg px-4 py-2.5 flex items-center gap-3">
              <span className="text-xs text-brand-charcoal/70">{selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected</span>
              <span className="text-xs text-brand-silver">Move to:</span>
              <select
                className="text-xs border border-brand-cream rounded px-2 py-1 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
                defaultValue=""
                onChange={(e) => { if (e.target.value) handleMoveToSection(e.target.value as LocalSection); }}
              >
                <option value="" disabled>Select section…</option>
                {[...FLORAL_SECTIONS, ...RENTAL_SECTIONS].map((s) => (
                  <option key={s.section} value={s.section}>{s.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSelectedItems(new Set())}
                className="text-xs text-brand-silver hover:text-brand-charcoal ml-auto"
              >Cancel</button>
            </div>
          )}

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
            showMath={showMath}
            mathRates={mathRates}
          />
          <MarginPanel margin={marginAnalysis} summary={summary} showMath={showMath} />
        </div>
      </div>
    </div>
  );
}
