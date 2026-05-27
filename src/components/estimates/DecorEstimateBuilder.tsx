'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { TaxType, TaxBucket } from '@/types';
import type { DbProgram, DbEstimate, DbLineItem, DbMarkup, DbTier, DbLocation, DbEstimateSection } from '@/lib/supabase/queries';
import { calculateVenueEstimate, calculateMarginAnalysis } from '@/lib/engine/pricing';
import type { ProgramConfig, TeamHoursTier } from '@/types';
import EstimateNav from './EstimateNav';
import CopyItemsFromButton from './CopyItemsFromButton';
import LineItemSection from './LineItemSection';
import type { LocalSectionDef } from './LineItemSection';
import DecorSummaryPanel from './DecorSummaryPanel';
import MarginPanel from './MarginPanel';
import { updateEstimate, upsertLineItem, deleteLineItem, cacheEstimateTotal, saveTemplate, upsertSection, deleteSection } from '@/app/(programs)/programs/[id]/estimates/actions';
import type { DbTemplate, ExtractedData } from '@/app/(programs)/programs/[id]/estimates/actions';
import type { LocalLineItem } from './EstimateBuilder';
import TravelPanel from './TravelPanel';
import AttachmentsPanel from './AttachmentsPanel';
import ExportButtons from './ExportButtons';
import type { TravelRefData, DbTrip } from '@/lib/supabase/queries';

// ─── Helpers ──────────────────────────────────────────────

function toEngineLineItems(items: LocalLineItem[]) {
  return items.map((item) => ({
    id: item.id,
    section: item.section,
    taxBucket: item.taxBucket,
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

function dbItemToLocal(item: DbLineItem, markups: DbMarkup[], sections: LocalSectionDef[]): LocalLineItem {
  const isCustom = item.custom_client_unit_price !== null;
  const markup = markups.find((m) => m.id === item.category_id);
  const defaultMarkupPct = isCustom ? 0 : (markup?.markup_pct ?? 0.5);
  const effectiveMarkupPct = isCustom ? 0 : (item.markup_override ?? defaultMarkupPct);
  const sectionDef = sections.find((s) => s.id === item.section_id) ?? sections.find((s) => s.name === item.section);
  return {
    id: item.id,
    sectionId: sectionDef?.id ?? item.section_id ?? '',
    section: sectionDef?.name ?? item.section,
    taxBucket: sectionDef?.taxBucket ?? 'equipment',
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

function bucketDefaultTax(taxBucket: TaxBucket): TaxType {
  if (taxBucket === 'fb') return 'food';
  if (taxBucket === 'staffing') return 'none';
  return 'general';
}

function itemClientCost(li: LocalLineItem): number {
  if (li.categoryId === 'custom' && li.customClientUnitPrice !== undefined) {
    return li.qty * li.customClientUnitPrice;
  }
  return li.qty * li.unitPrice * (1 + li.categoryMarkupPct);
}

// ─── Main Component ───────────────────────────────────────

interface Props {
  program: DbProgram;
  location: DbLocation | null;
  allEstimates: DbEstimate[];
  estimate: DbEstimate;
  dbLineItems: DbLineItem[];
  dbSections: DbEstimateSection[];
  markups: DbMarkup[];
  tiers: DbTier[];
  travelRefs: TravelRefData;
  initialTrips: DbTrip[];
  eventName?: string | null;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function DecorEstimateBuilder({
  program, location, allEstimates, estimate, dbLineItems, dbSections, markups, tiers, travelRefs, initialTrips, eventName,
}: Props) {
  const programConfig = useMemo(() => toProgramConfig(program, location), [program, location]);
  const tiersList = useMemo(() => toTiers(tiers), [tiers]);

  const [sections, setSections] = useState<LocalSectionDef[]>(
    dbSections.map((s) => ({ id: s.id, name: s.name, taxBucket: s.tax_bucket, markupPct: s.markup_pct, isBuiltIn: s.is_built_in }))
  );

  const [name, setName] = useState(estimate.name);
  const [discountType, setDiscountType] = useState<'percent' | 'flat' | null>(estimate.discount_type ?? null);
  const [discountValue, setDiscountValue] = useState(estimate.discount_value ?? 0);
  const [taxExempt, setTaxExempt] = useState(estimate.tax_exempt ?? false);

  const initSections = dbSections.map((s) => ({ id: s.id, name: s.name, taxBucket: s.tax_bucket, markupPct: s.markup_pct, isBuiltIn: s.is_built_in }));
  const [lineItems, setLineItems] = useState<LocalLineItem[]>(
    dbLineItems.map((item) => dbItemToLocal(item, markups, initSections))
  );
  const lineItemsRef = useRef(lineItems);
  lineItemsRef.current = lineItems;

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(0);
  const [travelExpenses, setTravelExpenses] = useState(0);
  const [showMath, setShowMath] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkMarkupInput, setBulkMarkupInput] = useState('');

  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionBucket, setNewSectionBucket] = useState<TaxBucket>('equipment');

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
        taxExempt,
      },
      programConfig
    ),
    [name, lineItems, programConfig, discountType, discountValue, taxExempt]
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

  // Compute summary panel breakdown values dynamically from sections
  const floralTaxableClient = useMemo(
    () => lineItems.filter((li) => li.taxBucket === 'equipment' && li.taxType !== 'none').reduce((s, li) => s + itemClientCost(li), 0),
    [lineItems]
  );
  const floralNonTaxableClient = useMemo(
    () => lineItems.filter((li) => li.taxBucket === 'equipment' && li.taxType === 'none').reduce((s, li) => s + itemClientCost(li), 0),
    [lineItems]
  );
  const rentalsTaxableClient = 0;
  const rentalsNonTaxableClient = useMemo(
    () => lineItems.filter((li) => li.taxBucket === 'staffing').reduce((s, li) => s + itemClientCost(li), 0),
    [lineItems]
  );

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

  async function saveTaxExempt(val: boolean) {
    await withSave(() => updateEstimate(estimate.id, program.id, { tax_exempt: val }));
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
      section_id: item.sectionId || null,
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

  const handleAddItem = useCallback((sectionDef: LocalSectionDef, taxType: TaxType) => {
    const tempId = `new-${Date.now()}-${Math.random()}`;
    const maxOrder = lineItemsRef.current
      .filter((li) => li.sectionId === sectionDef.id)
      .reduce((max, li) => Math.max(max, li.sortOrder), -1);

    const newItem: LocalLineItem = {
      id: tempId,
      sectionId: sectionDef.id,
      section: sectionDef.name,
      taxBucket: sectionDef.taxBucket,
      name: '',
      qty: 1,
      unitPrice: 0,
      categoryId: null,
      defaultMarkupPct: sectionDef.markupPct,
      categoryMarkupPct: sectionDef.markupPct,
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

  const handleAddFromTemplate = useCallback((sectionDef: LocalSectionDef, template: DbTemplate) => {
    const tempId = `new-${Date.now()}-${Math.random()}`;
    const maxOrder = lineItemsRef.current
      .filter((li) => li.sectionId === sectionDef.id)
      .reduce((max, li) => Math.max(max, li.sortOrder), -1);
    const newItem: LocalLineItem = {
      id: tempId,
      sectionId: sectionDef.id,
      section: sectionDef.name,
      taxBucket: sectionDef.taxBucket,
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

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedItems((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  const handleToggleAllInSection = useCallback((ids: string[], selected: boolean) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      for (const id of ids) { if (selected) next.add(id); else next.delete(id); }
      return next;
    });
  }, []);

  const handleBulkMarkup = useCallback(() => {
    const pct = parseFloat(bulkMarkupInput);
    if (isNaN(pct) || pct < 0) return;
    const newMarkup = pct / 100;
    const ids = new Set(selectedItems);
    setLineItems((prev) => {
      const next = prev.map((item) =>
        ids.has(item.id) ? { ...item, categoryMarkupPct: newMarkup } : item
      );
      lineItemsRef.current = next;
      return next;
    });
    for (const id of ids) setTimeout(() => handleItemSave(id), 0);
    setBulkMarkupInput('');
    setSelectedItems(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkMarkupInput, selectedItems, handleItemSave]);

  const handleMoveToSection = useCallback((targetSectionId: string) => {
    const ids = new Set(selectedItems);
    const targetSectionDef = sections.find((s) => s.id === targetSectionId);
    if (!targetSectionDef) return;
    const taxType = bucketDefaultTax(targetSectionDef.taxBucket);
    setLineItems((prev) => {
      const next = prev.map((item) =>
        ids.has(item.id) ? { ...item, sectionId: targetSectionDef.id, section: targetSectionDef.name, taxBucket: targetSectionDef.taxBucket, taxType } : item
      );
      lineItemsRef.current = next;
      return next;
    });
    for (const id of ids) setTimeout(() => handleItemSave(id), 0);
    setSelectedItems(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, sections, handleItemSave]);

  const handlePopulateFromExtraction = useCallback((data: ExtractedData) => {
    const decorMarkup = markups.find((m) => m.name === 'Décor & Design');
    const deliveryMarkup = markups.find((m) => m.name === 'Delivery & Logistics');

    const equipSection = sections.find((s) => s.taxBucket === 'equipment');
    const staffingSection = sections.find((s) => s.taxBucket === 'staffing');

    const sectionOrders: Record<string, number> = {};
    function nextOrder(sectionId: string): number {
      if (sectionOrders[sectionId] === undefined) {
        sectionOrders[sectionId] = lineItemsRef.current
          .filter((li) => li.sectionId === sectionId)
          .reduce((max, li) => Math.max(max, li.sortOrder), -1) + 1;
      }
      const order = sectionOrders[sectionId];
      sectionOrders[sectionId] = order + 1;
      return order;
    }

    const toImport: LocalLineItem[] = (data.equipmentItems ?? []).map((item) => {
      let sectionDef: LocalSectionDef | undefined;
      let markup: typeof decorMarkup;
      let taxType: TaxType;

      if (item.section === 'delivery') {
        sectionDef = staffingSection;
        markup = deliveryMarkup;
        taxType = 'none';
      } else {
        // florals, rentals, lighting, signage, or any unrecognized → equipment section
        sectionDef = equipSection;
        markup = decorMarkup;
        taxType = 'general';
      }

      if (!sectionDef) return null;
      return {
        id: `new-${Date.now()}-${Math.random()}`,
        sectionId: sectionDef.id,
        section: sectionDef.name,
        taxBucket: sectionDef.taxBucket,
        name: item.name,
        label: item.label ?? undefined,
        qty: item.qty ?? 1,
        unitPrice: item.unitPrice ?? 0,
        categoryId: markup?.id ?? null,
        defaultMarkupPct: markup?.markup_pct ?? 0.85,
        categoryMarkupPct: markup?.markup_pct ?? 0.85,
        taxType,
        sortOrder: nextOrder(sectionDef.id),
        isNew: true,
      } as LocalLineItem;
    }).filter((x): x is LocalLineItem => x !== null);

    handleImportItems(toImport);
  }, [markups, sections, handleImportItems]);

  // ─── Section management ───────────────────────────────────

  const handleRenameSection = useCallback(async (sectionId: string, newName: string) => {
    setSections((prev) => prev.map((s) => s.id === sectionId ? { ...s, name: newName } : s));
    setLineItems((prev) => prev.map((li) => li.sectionId === sectionId ? { ...li, section: newName } : li));
    const sectionDef = sections.find((s) => s.id === sectionId);
    if (!sectionDef) return;
    await upsertSection({ id: sectionId, estimate_id: estimate.id, name: newName, tax_bucket: sectionDef.taxBucket, markup_pct: sectionDef.markupPct, sort_order: sections.indexOf(sectionDef), is_built_in: sectionDef.isBuiltIn });
    const idsToSave = lineItemsRef.current.filter((li) => li.sectionId === sectionId).map((li) => li.id);
    for (const id of idsToSave) setTimeout(() => handleItemSave(id), 0);
  }, [sections, estimate.id, handleItemSave]);

  const handleDeleteSection = useCallback(async (sectionId: string) => {
    const hasItems = lineItemsRef.current.some((li) => li.sectionId === sectionId);
    if (hasItems) return;
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    await deleteSection(sectionId);
  }, []);

  const handleAddSection = useCallback(async () => {
    const trimmed = newSectionName.trim();
    if (!trimmed) return;
    const markupPct = newSectionBucket === 'fb' ? 0.55 : newSectionBucket === 'venue' ? 0.60 : newSectionBucket === 'staffing' ? 0.90 : 0.85;
    const result = await upsertSection({
      estimate_id: estimate.id,
      name: trimmed,
      tax_bucket: newSectionBucket,
      markup_pct: markupPct,
      sort_order: sections.length,
      is_built_in: false,
    });
    if (result.section) {
      setSections((prev) => [...prev, { id: result.section!.id, name: result.section!.name, taxBucket: result.section!.tax_bucket, markupPct: result.section!.markup_pct, isBuiltIn: false }]);
    }
    setNewSectionName('');
    setShowAddSection(false);
  }, [newSectionName, newSectionBucket, sections.length, estimate.id]);

  // ─── Render helpers ───────────────────────────────────────

  const fieldClass = 'border border-brand-cream rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper focus:border-brand-brown bg-white text-brand-charcoal w-full';
  const labelClass = 'block text-xs font-medium text-brand-charcoal/60 tracking-wide mb-1';

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
          <ExportButtons programId={program.id} programName={program.name} estimateId={estimate.id} estimateName={name} clientName={program.client_name} clientCompany={program.company_name} summary={summary} guestCount={program.guest_count} estimateType="decor" lineItems={lineItems} markups={markups} taxExempt={taxExempt} />
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

          {/* Tax Exempt */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={taxExempt}
                onChange={(e) => { const next = e.target.checked; setTaxExempt(next); saveTaxExempt(next); }}
                className="w-4 h-4 rounded border-brand-cream accent-brand-brown cursor-pointer"
              />
              <span className="text-sm text-gray-700">Tax Exempt</span>
            </label>
            {taxExempt && (
              <span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded border border-amber-400 bg-amber-50 text-amber-700 uppercase">TAX EXEMPT</span>
            )}
          </div>

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

          {/* Line item sections */}
          <div className="bg-white border border-brand-cream rounded-lg p-5 space-y-6">
            {/* Move items action bar */}
            {selectedItems.size > 0 && (
              <div className="bg-brand-offwhite border border-brand-copper/30 rounded-lg px-4 py-2.5 flex items-center gap-3 flex-wrap">
                <span className="text-xs text-brand-charcoal/70">{selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected</span>
                <span className="text-xs text-brand-silver">Move to:</span>
                <select
                  className="text-xs border border-brand-cream rounded px-2 py-1 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) handleMoveToSection(e.target.value); }}
                >
                  <option value="" disabled>Select section…</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <span className="text-xs text-brand-silver">·</span>
                <span className="text-xs text-brand-charcoal/70">Set Markup:</span>
                <div className="relative w-20">
                  <input
                    type="number"
                    min="0"
                    max="500"
                    step="1"
                    value={bulkMarkupInput}
                    onChange={(e) => setBulkMarkupInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleBulkMarkup(); }}
                    placeholder="%"
                    className="text-xs border border-brand-cream rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-copper bg-white text-brand-charcoal w-full text-right pr-5"
                  />
                  <span className="absolute right-2 top-1.5 text-brand-silver text-[10px] pointer-events-none">%</span>
                </div>
                <button type="button" onClick={handleBulkMarkup} className="text-xs px-2 py-1 bg-brand-brown text-white rounded hover:bg-brand-charcoal transition-colors">Apply</button>
                <button
                  type="button"
                  onClick={() => setSelectedItems(new Set())}
                  className="text-xs text-brand-silver hover:text-brand-charcoal ml-auto"
                >Cancel</button>
              </div>
            )}

            {sections.map((sectionDef) => (
              <LineItemSection
                key={sectionDef.id}
                sectionDef={sectionDef}
                items={lineItems.filter((li) => li.sectionId === sectionDef.id)}
                markups={markups}
                defaultTaxType={bucketDefaultTax(sectionDef.taxBucket)}
                guestCount={program.guest_count}
                selectedItems={selectedItems}
                onToggleSelect={handleToggleSelect}
                onToggleAllSelect={handleToggleAllInSection}
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
                onRename={handleRenameSection}
                onDeleteSection={handleDeleteSection}
                location={programConfig.location}
                showMath={showMath}
                taxExempt={taxExempt}
              />
            ))}

            {/* Add Section */}
            <div className="pt-2 border-t border-brand-cream/60">
              {showAddSection ? (
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="text"
                    autoFocus
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddSection(); if (e.key === 'Escape') setShowAddSection(false); }}
                    placeholder="Section name"
                    className="border border-brand-cream rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper bg-white w-40"
                  />
                  <select
                    value={newSectionBucket}
                    onChange={(e) => setNewSectionBucket(e.target.value as TaxBucket)}
                    className="border border-brand-cream rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper bg-white"
                  >
                    <option value="fb">F&B (food/alcohol tax)</option>
                    <option value="equipment">Equipment (general tax)</option>
                    <option value="venue">Venue (general tax)</option>
                    <option value="staffing">Staffing (non-taxable)</option>
                  </select>
                  <button type="button" onClick={handleAddSection} className="px-2 py-1 bg-brand-brown text-white rounded hover:bg-brand-charcoal transition-colors">Add</button>
                  <button type="button" onClick={() => setShowAddSection(false)} className="text-brand-silver/60 hover:text-brand-charcoal transition-colors">Cancel</button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowAddSection(true)} className="text-xs text-brand-silver/60 hover:text-brand-charcoal transition-colors py-1">
                  + Add category section
                </button>
              )}
            </div>
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
