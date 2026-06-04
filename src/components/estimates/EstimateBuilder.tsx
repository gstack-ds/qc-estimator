'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { TaxType, TaxBucket } from '@/types';
import type { DbProgram, DbEstimate, DbEvent, DbLineItem, DbMarkup, DbTier, DbLocation, DbVenue, DbVenueSpace, DbEstimateSection } from '@/lib/supabase/queries';
import type { SlideCopyData } from '@/types/slideCopy';
import {
  calculateVenueEstimate,
  calculateMarginAnalysis,
} from '@/lib/engine/pricing';
import type { ProgramConfig, TeamHoursTier, VenueEstimateInput } from '@/types';
import EstimateNav from './EstimateNav';
import VenuePicker from './VenuePicker';
import LinkVenuePanel from './LinkVenuePanel';
import CopyItemsFromButton from './CopyItemsFromButton';
import LineItemSection from './LineItemSection';
import type { LocalSectionDef } from './LineItemSection';
import SortableSectionItem from './SortableSectionItem';
import SummaryPanel from './SummaryPanel';
import MarginPanel from './MarginPanel';
// TravelPanel removed — team travel is now entered at the program level.
import SlideCopySection from './SlideCopySection';
import AttachmentsPanel from './AttachmentsPanel';
import ExportButtons from './ExportButtons';
import { updateEstimate, upsertLineItem, deleteLineItem, cacheEstimateTotal, saveTemplate, upsertSection, deleteSection, reorderSections, reorderLineItems } from '@/app/(programs)/programs/[id]/estimates/actions';
import { linkVenueToEstimate, syncVenueSpaceDefaults } from '@/app/(programs)/venues/actions';
import { updateProgram } from '@/app/(programs)/programs/actions';
import type { DbTemplate, ExtractedData } from '@/app/(programs)/programs/[id]/estimates/actions';
// TravelRefData, DbTrip no longer imported — travel is program-level.

// ─── Types ───────────────────────────────────────────────

export interface LocalLineItem {
  id: string;
  sectionId: string;          // UUID FK to estimate_sections
  section: string;            // display name (kept in sync with section table)
  taxBucket: TaxBucket;       // from section def — used by engine
  name: string;
  label?: string;
  qty: number;
  unitPrice: number;
  categoryId: string | 'custom' | null;
  defaultMarkupPct: number;    // category reference default (for yellow highlight)
  categoryMarkupPct: number;   // effective markup (override ?? default)
  taxType: TaxType;
  customClientUnitPrice?: number;
  isRevenueItem?: boolean;
  sortOrder: number;
  isNew?: boolean;
  thumbnailUrl?: string | null;
  thumbnailIcon?: string | null;
  packageOptions?: import('@/types').PackageOptions | null;
  selectedPackageId?: string | null;
}

interface LocalEstimate {
  name: string;
  roomSpace: string;
  fbMinimum: number;
  isVenueTaxable: boolean;
  serviceChargeOverride: number | null;
  gratuityOverride: number | null;
  adminFeeOverride: number | null;
  discountType: 'percent' | 'flat' | null;
  discountValue: number;
  taxExempt: boolean;
  foodTaxOverride: number | null;
  alcoholTaxOverride: number | null;
  generalTaxOverride: number | null;
}

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

function dbItemToLocal(item: DbLineItem, markups: DbMarkup[], sections: LocalSectionDef[]): LocalLineItem {
  const isCustom = item.custom_client_unit_price !== null;
  const markup = markups.find((m) => m.id === item.category_id);
  const defaultMarkupPct = isCustom ? 0 : (markup?.markup_pct ?? 0.5);
  const effectiveMarkupPct = isCustom ? 0 : (item.markup_override ?? defaultMarkupPct);
  // Resolve section: prefer FK match, fall back to name match
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
    thumbnailUrl: item.thumbnail_url,
    thumbnailIcon: item.thumbnail_icon,
    packageOptions: item.package_options,
    selectedPackageId: item.selected_package_id,
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
  dbSections: DbEstimateSection[];
  markups: DbMarkup[];
  tiers: DbTier[];
  /** Sum of program_travel_items (qty × unit_price). */
  programTravelTotal?: number;
  includeTravelInProductionFee?: boolean;
  eventName?: string | null;
  event?: DbEvent | null;
  initialSlideCopyData?: SlideCopyData | null;
  venues?: DbVenue[];
  venueSpaces?: DbVenueSpace[];
  allLocations?: DbLocation[];
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function EstimateBuilder({
  program, location, allEstimates, estimate, dbLineItems, dbSections, markups, tiers, eventName,
  event = null, initialSlideCopyData = null, venues = [], venueSpaces = [], allLocations = [],
  programTravelTotal = 0, includeTravelInProductionFee = false,
}: Props) {
  const router = useRouter();
  const programConfig = useMemo(() => toProgramConfig(program, location), [program, location]);
  const tiersList = useMemo(() => toTiers(tiers), [tiers]);
  const venueName = useMemo(() => venues.find((v) => v.id === estimate.venue_id)?.name, [venues, estimate.venue_id]);
  const venueSpaceName = useMemo(() => venueSpaces.find((vs) => vs.id === estimate.venue_space_id)?.name, [venueSpaces, estimate.venue_space_id]);
  const venueAddress = useMemo(() => {
    const v = venues.find((vn) => vn.id === estimate.venue_id);
    if (!v) return undefined;
    // Always lead with venue name so the Maps API geocodes to the place, not just
    // the city centroid (which would be ~1 mile off for short urban routes).
    const parts = [v.name, v.address, v.city, v.state].filter(Boolean);
    return parts.join(', ') || undefined;
  }, [venues, estimate.venue_id]);

  // Sections state
  const [sections, setSections] = useState<LocalSectionDef[]>(
    dbSections.map((s) => ({
      id: s.id,
      name: s.name,
      taxBucket: s.tax_bucket,
      markupPct: s.markup_pct,
      isBuiltIn: s.is_built_in,
      sortOrder: s.sort_order,
    }))
  );

  // Estimate header state
  const [est, setEst] = useState<LocalEstimate>({
    name: estimate.name,
    roomSpace: estimate.room_space ?? '',
    fbMinimum: estimate.fb_minimum,
    isVenueTaxable: estimate.is_venue_taxable,
    serviceChargeOverride: estimate.service_charge_override,
    gratuityOverride: estimate.gratuity_override,
    adminFeeOverride: estimate.admin_fee_override,
    discountType: estimate.discount_type ?? null,
    discountValue: estimate.discount_value ?? 0,
    taxExempt: estimate.tax_exempt ?? false,
    foodTaxOverride: estimate.food_tax_override ?? null,
    alcoholTaxOverride: estimate.alcohol_tax_override ?? null,
    generalTaxOverride: estimate.general_tax_override ?? null,
  });

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkMarkupInput, setBulkMarkupInput] = useState('');

  // Line items state
  const initSections = dbSections.map((s) => ({
    id: s.id, name: s.name, taxBucket: s.tax_bucket, markupPct: s.markup_pct, isBuiltIn: s.is_built_in, sortOrder: s.sort_order,
  }));
  const [lineItems, setLineItems] = useState<LocalLineItem[]>(
    dbLineItems.map((item) => dbItemToLocal(item, markups, initSections))
  );
  const lineItemsRef = useRef(lineItems);
  lineItemsRef.current = lineItems;

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(0);
  // Travel is now program-level — comes from props, not local state.
  const travelExpenses = programTravelTotal;
  const [showMath, setShowMath] = useState(false);

  const [pendingSlideMenuData, setPendingSlideMenuData] = useState<import('@/types/slideCopy').MenuCourse[] | null>(null);
  const slideCopyRef = useRef<HTMLDivElement | null>(null);
  const [linkedVenueId, setLinkedVenueId] = useState<string | null>(estimate.venue_id);
  const [linkedSpaceId, setLinkedSpaceId] = useState<string | null>(estimate.venue_space_id);
  const [linkedVenueData, setLinkedVenueData] = useState<DbVenue | null>(
    venues.find(v => v.id === estimate.venue_id) ?? null
  );
  const [locationSuggestion, setLocationSuggestion] = useState<{ locationId: string; locationName: string } | null>(null);

  function handleVenueSelect(venueId: string, spaceId: string | null, venueCity: string | null, venueData: DbVenue) {
    setLinkedVenueId(venueId);
    setLinkedSpaceId(spaceId);
    setLinkedVenueData(venueData);
    // Auto-fill room space from venue name when no space specified
    if (!spaceId) handleVenueAutoFill({ roomSpace: venueData.name });
    // Location suggestion
    if (venueCity && allLocations.length > 0) {
      const cityLower = venueCity.toLowerCase();
      const matches = allLocations.filter(l => l.name.toLowerCase().includes(cityLower));
      if (matches.length === 1 && matches[0].id !== program.location_id) {
        setLocationSuggestion({ locationId: matches[0].id, locationName: matches[0].name });
      } else if (matches.length === 0 && venueCity) {
        setLocationSuggestion({ locationId: '', locationName: `No tax location found for "${venueCity}" — add one in Admin → Reference Data` });
      }
    }
    router.refresh();
  }

  async function handleClearVenue() {
    await linkVenueToEstimate(estimate.id, program.id, null, null);
    setLinkedVenueId(null);
    setLinkedSpaceId(null);
    setLinkedVenueData(null);
    setLocationSuggestion(null);
  }

  async function syncSpaceOnBlur() {
    if (!linkedSpaceId || !linkedVenueId) return;
    syncVenueSpaceDefaults(linkedSpaceId, linkedVenueId, {
      fbMinimum: est.fbMinimum,
      serviceChargeDefault: est.serviceChargeOverride,
      gratuityDefault: est.gratuityOverride,
      adminFeeDefault: est.adminFeeOverride,
    });
  }

  function handleVenueAutoFill(fields: {
    roomSpace?: string;
    fbMinimum?: number;
    serviceChargeOverride?: number | null;
    gratuityOverride?: number | null;
    adminFeeOverride?: number | null;
  }) {
    const patch: Partial<LocalEstimate> = {};
    if (fields.roomSpace !== undefined) patch.roomSpace = fields.roomSpace;
    if (fields.fbMinimum !== undefined) patch.fbMinimum = fields.fbMinimum;
    if (fields.serviceChargeOverride !== undefined) patch.serviceChargeOverride = fields.serviceChargeOverride;
    if (fields.gratuityOverride !== undefined) patch.gratuityOverride = fields.gratuityOverride;
    if (fields.adminFeeOverride !== undefined) patch.adminFeeOverride = fields.adminFeeOverride;
    if (Object.keys(patch).length > 0) {
      updateEstField(patch);
      saveEstimate(patch);
    }
  }

  // ─── Engine ─────────────────────────────────────────────

  const venueInput = useMemo((): VenueEstimateInput => ({
    name: est.name,
    fbMinimum: est.fbMinimum,
    isVenueTaxable: est.isVenueTaxable,
    serviceCharge: resolveOverride(est.serviceChargeOverride, program.service_charge_default),
    gratuity: resolveOverride(est.gratuityOverride, program.gratuity_default),
    adminFee: resolveOverride(est.adminFeeOverride, program.admin_fee_default),
    lineItems: toEngineLineItems(lineItems),
    discount: est.discountType && est.discountValue > 0
      ? { type: est.discountType, value: est.discountValue }
      : null,
    taxExempt: est.taxExempt,
    foodTaxOverride: est.foodTaxOverride,
    alcoholTaxOverride: est.alcoholTaxOverride,
    generalTaxOverride: est.generalTaxOverride,
    travelTotal: programTravelTotal,
    includeTravelInProductionFee,
  }), [est, lineItems, program, programTravelTotal, includeTravelInProductionFee]);

  // Effective location: merges location rates with per-estimate overrides.
  // Passed to LineItemSection and ExportButtons so the tax column and PDF
  // reflect the overridden rates (same name, different rate values).
  const effectiveLocation = useMemo(() => ({
    ...programConfig.location,
    foodTaxRate: est.foodTaxOverride ?? programConfig.location.foodTaxRate,
    alcoholTaxRate: est.alcoholTaxOverride ?? programConfig.location.alcoholTaxRate,
    generalTaxRate: est.generalTaxOverride ?? programConfig.location.generalTaxRate,
  }), [programConfig.location, est.foodTaxOverride, est.alcoholTaxOverride, est.generalTaxOverride]);

  const summary = useMemo(
    () => calculateVenueEstimate(venueInput, programConfig),
    [venueInput, programConfig]
  );

  const marginAnalysis = useMemo(
    () => calculateMarginAnalysis(summary, programConfig, tiersList, travelExpenses),
    [summary, programConfig, tiersList, travelExpenses]
  );

  const mathRates = useMemo(() => ({
    serviceChargeRate: resolveOverride(est.serviceChargeOverride, program.service_charge_default),
    gratuityRate: resolveOverride(est.gratuityOverride, program.gratuity_default),
    adminFeeRate: resolveOverride(est.adminFeeOverride, program.admin_fee_default),
    ccProcessingFee: programConfig.ccProcessingFee,
    clientCommissionRate: programConfig.clientCommission,
    foodTaxRate: programConfig.location.foodTaxRate,
    alcoholTaxRate: programConfig.location.alcoholTaxRate,
    generalTaxRate: programConfig.location.generalTaxRate,
  }), [est, program, programConfig]);

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
      discount_type: merged.discountType,
      discount_value: merged.discountValue,
      tax_exempt: merged.taxExempt,
      food_tax_override: merged.foodTaxOverride,
      alcohol_tax_override: merged.alcoholTaxOverride,
      general_tax_override: merged.generalTaxOverride,
    }));
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
      thumbnail_url: item.thumbnailUrl ?? null,
      thumbnail_icon: item.thumbnailIcon ?? null,
      package_options: item.packageOptions ?? null,
      selected_package_id: item.selectedPackageId ?? null,
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

    // Save to DB immediately so we get an id
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
      defaultMarkupPct: template.category_markup_pct ?? 0.5,
      categoryMarkupPct: template.category_markup_pct ?? 0.5,
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

  // ─── Category move ────────────────────────────────────────

  // Default tax type per tax bucket — fb sections default to 'food'; staffing to 'none'; rest to 'general'
  function bucketDefaultTax(taxBucket: TaxBucket): TaxType {
    if (taxBucket === 'fb') return 'food';
    if (taxBucket === 'staffing') return 'none';
    return 'general';
  }

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
    for (const id of ids) {
      setTimeout(() => handleItemSave(id), 0);
    }
    setSelectedItems(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, sections, handleItemSave]);

  const handlePopulateFromExtraction = useCallback((data: ExtractedData) => {
    const cateringMarkup = markups.find((m) => m.name === 'Catering & F&B');
    const avMarkup = markups.find((m) => m.name === 'AV & Production');
    const venueMarkup = markups.find((m) => m.name === 'Venues & Room Rentals');
    const staffingMarkup = markups.find((m) => m.name === 'Staffing & Labor');

    const fbSection = sections.find((s) => s.taxBucket === 'fb');
    const equipSection = sections.find((s) => s.taxBucket === 'equipment');
    const venueSection = sections.find((s) => s.taxBucket === 'venue');
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

    const toImport: LocalLineItem[] = [];

    if (fbSection) {
      data.menuItems.forEach((item) => {
        const taxType: TaxType = item.category === 'alcohol' ? 'alcohol' : item.category === 'food' ? 'food' : 'none';
        toImport.push({
          id: `new-${Date.now()}-${Math.random()}`,
          sectionId: fbSection.id,
          section: fbSection.name,
          taxBucket: fbSection.taxBucket,
          name: item.packageOptions?.label ?? item.name,
          qty: program.guest_count,
          unitPrice: item.pricePerPerson ?? 0,
          categoryId: cateringMarkup?.id ?? null,
          defaultMarkupPct: cateringMarkup?.markup_pct ?? 0.55,
          categoryMarkupPct: cateringMarkup?.markup_pct ?? 0.55,
          taxType,
          sortOrder: nextOrder(fbSection.id),
          isNew: true,
          packageOptions: item.packageOptions ?? null,
          selectedPackageId: null,
        });
      });
    }

    (data.equipmentItems ?? []).forEach((item) => {
      let sectionDef: LocalSectionDef | undefined;
      let markup: typeof avMarkup;
      let taxType: TaxType;
      if (item.section === 'venue_fee') {
        sectionDef = venueSection;
        markup = venueMarkup;
        taxType = 'general';
      } else if (item.section === 'staffing') {
        sectionDef = staffingSection;
        markup = staffingMarkup;
        taxType = 'none';
      } else {
        sectionDef = equipSection;
        markup = avMarkup;
        taxType = 'general';
      }
      if (!sectionDef) return;
      toImport.push({
        id: `new-${Date.now()}-${Math.random()}`,
        sectionId: sectionDef.id,
        section: sectionDef.name,
        taxBucket: sectionDef.taxBucket,
        name: item.name,
        qty: item.qty ?? 1,
        unitPrice: item.unitPrice ?? 0,
        categoryId: markup?.id ?? null,
        defaultMarkupPct: markup?.markup_pct ?? 0.5,
        categoryMarkupPct: markup?.markup_pct ?? 0.5,
        taxType,
        sortOrder: nextOrder(sectionDef.id),
        isNew: true,
      });
    });

    handleImportItems(toImport);
  }, [markups, sections, program.guest_count, handleImportItems]);

  const handleLoadMenuToSlide = useCallback((data: ExtractedData) => {
    const courses = (data.menuItems ?? []).filter(
      (item) => item.category === 'food' || item.category === 'alcohol' || item.category === 'na_beverage'
    ).map((item) => {
      // Package group: treat each package option as a selectable choice
      if (item.packageOptions) {
        const options = item.packageOptions.options.map((pkg) => ({
          name: pkg.name,
          description: pkg.description,
          tags: [] as string[],
          selected: false,
          locked: false,
        }));
        return { name: item.packageOptions.label, selectionRule: 'choose 1', maxSelections: 1, scenario: 'needs_selection' as const, options };
      }
      const scenario: 'final' | 'needs_selection' = item.needsSelection ? 'needs_selection' : 'final';
      const options = item.options?.map((o: { name: string; description?: string; tags?: string[] }) => ({
        name: o.name,
        tags: o.tags ?? [],
        description: o.description,
        selected: false,
        locked: false,
      })) ?? (item.selections ?? []).map((s: string) => ({
        name: s,
        tags: item.tags ?? [],
        selected: !item.needsSelection,
        locked: !item.needsSelection,
      }));
      return { name: item.name, selectionRule: item.selectionRule, maxSelections: item.maxSelections, scenario, options };
    });
    setPendingSlideMenuData(courses);
    setTimeout(() => {
      slideCopyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  function handlePopulateEstimateDetails(data: ExtractedData) {
    const fees = data.venueFees;
    function findFee(...keywords: string[]) {
      return fees.find((f) => keywords.some((kw) => f.name.toLowerCase().includes(kw)));
    }
    const patch: Partial<LocalEstimate> = {};
    if (data.venueName) patch.name = data.venueName;
    if (data.roomSpace) patch.roomSpace = data.roomSpace;
    const fbMin = findFee('f&b minimum', 'food & beverage minimum', 'fb minimum', 'food minimum', 'beverage minimum');
    if (fbMin && fbMin.type === 'flat') patch.fbMinimum = fbMin.value;
    const svcCharge = findFee('service charge');
    if (svcCharge && svcCharge.type === 'percentage') patch.serviceChargeOverride = svcCharge.value / 100;
    const gratuityFee = findFee('gratuity');
    if (gratuityFee && gratuityFee.type === 'percentage') patch.gratuityOverride = gratuityFee.value / 100;
    const adminFee = findFee('admin fee', 'admin');
    if (adminFee && adminFee.type === 'percentage') patch.adminFeeOverride = adminFee.value / 100;
    if (Object.keys(patch).length > 0) {
      updateEstField(patch);
      saveEstimate(patch);
    }
  }

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

  // ─── Section management ───────────────────────────────────

  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionBucket, setNewSectionBucket] = useState<TaxBucket>('equipment');

  const handleRenameSection = useCallback(async (sectionId: string, newName: string) => {
    setSections((prev) => prev.map((s) => s.id === sectionId ? { ...s, name: newName } : s));
    setLineItems((prev) => prev.map((li) => li.sectionId === sectionId ? { ...li, section: newName } : li));
    const sectionDef = sections.find((s) => s.id === sectionId);
    if (!sectionDef) return;
    await upsertSection({ id: sectionId, estimate_id: estimate.id, name: newName, tax_bucket: sectionDef.taxBucket, markup_pct: sectionDef.markupPct, sort_order: sectionDef.sortOrder, is_built_in: sectionDef.isBuiltIn });
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
    const name = newSectionName.trim();
    if (!name) return;
    const markupPct = newSectionBucket === 'fb' ? 0.55 : newSectionBucket === 'venue' ? 0.60 : newSectionBucket === 'staffing' ? 0.90 : 0.65;
    const result = await upsertSection({
      estimate_id: estimate.id,
      name,
      tax_bucket: newSectionBucket,
      markup_pct: markupPct,
      sort_order: sections.length,
      is_built_in: false,
    });
    if (result.section) {
      setSections((prev) => [...prev, { id: result.section!.id, name: result.section!.name, taxBucket: result.section!.tax_bucket, markupPct: result.section!.markup_pct, isBuiltIn: false, sortOrder: result.section!.sort_order }]);
    }
    setNewSectionName('');
    setShowAddSection(false);
  }, [newSectionName, newSectionBucket, sections.length, estimate.id]);

  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSectionDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex).map((s, i) => ({ ...s, sortOrder: i }));
      reorderSections(reordered.map((s) => ({ id: s.id, sortOrder: s.sortOrder })));
      return reordered;
    });
  }, []);

  const handleReorderItems = useCallback(async (sectionId: string, newOrderedItems: LocalLineItem[]) => {
    const reordered = newOrderedItems.map((li, i) => ({ ...li, sortOrder: i }));
    setLineItems((prev) => [...prev.filter((li) => li.sectionId !== sectionId), ...reordered]);
    await reorderLineItems(reordered.map((li) => ({ id: li.id, sortOrder: li.sortOrder })));
  }, []);

  // ─── Render ───────────────────────────────────────────────

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
          estimateName={est.name}
        />
        {linkedVenueId && (
          <div className="flex items-center gap-3 flex-shrink-0">
            <CopyItemsFromButton
              currentEstimateId={estimate.id}
              otherEstimates={allEstimates.map((e) => ({ id: e.id, name: e.name }))}
              markups={markups}
              onImport={handleImportItems}
            />
            <ExportButtons
              programId={program.id}
              programName={program.name}
              estimateId={estimate.id}
              estimateName={est.name}
              clientName={program.client_name}
              clientCompany={program.company_name}
              summary={summary}
              guestCount={program.guest_count}
              lineItems={lineItems}
              orderedSections={[...sections].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.name)}
              markups={markups}
              taxExempt={est.taxExempt}
              location={effectiveLocation}
            />
            <button
              onClick={() => setShowMath(v => !v)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${showMath ? 'border-brand-copper/60 bg-brand-offwhite text-brand-brown' : 'border-brand-cream bg-white text-brand-charcoal/70 hover:text-brand-charcoal hover:bg-brand-offwhite'}`}
            >
              {showMath ? 'Hide Math' : 'Show Math'}
            </button>
            <div className="text-xs flex items-center gap-3">
              {saveState === 'saving' && <span className="text-brand-silver">Saving…</span>}
              {saveState === 'saved' && <span className="text-green-600">Saved</span>}
              {saveState === 'error' && <span className="text-red-500">{saveError}</span>}
            </div>
          </div>
        )}
      </div>

      {/* VenuePicker — shown when no venue is linked */}
      {!linkedVenueId && (
        <div className="flex-1 overflow-y-auto bg-brand-offwhite">
          <VenuePicker
            estimateId={estimate.id}
            programId={program.id}
            venues={venues}
            venueSpaces={venueSpaces}
            onSelect={handleVenueSelect}
          />
        </div>
      )}

      {/* Full estimate builder — shown once venue is linked */}
      {linkedVenueId && linkedVenueData && <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Compact venue indicator */}
          <div className="bg-white border border-brand-cream rounded-lg px-5 py-3">
            <LinkVenuePanel
              estimateId={estimate.id}
              programId={program.id}
              venue={linkedVenueData}
              currentSpaceId={linkedSpaceId}
              venueSpaces={venueSpaces}
              onSpaceChange={(spaceId, autoFill) => {
                setLinkedSpaceId(spaceId);
                handleVenueAutoFill(autoFill);
              }}
              onChangeVenue={handleClearVenue}
            />
          </div>

          {/* Estimate details */}
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
                  placeholder="e.g., Ballroom A, Summer Reception"
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

            {/* Tax location suggestion / diagnostic banner */}
            {locationSuggestion && (
              <div className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                locationSuggestion.locationId
                  ? 'bg-blue-50 border border-blue-200 text-blue-800'
                  : 'bg-amber-50 border border-amber-200 text-amber-800'
              }`}>
                <span className="flex-1">{
                  locationSuggestion.locationId
                    ? <>Tax location suggested: <strong>{locationSuggestion.locationName}</strong></>
                    : locationSuggestion.locationName
                }</span>
                {locationSuggestion.locationId && (
                  <button
                    onClick={async () => {
                      await updateProgram(program.id, { location_id: locationSuggestion.locationId });
                      setLocationSuggestion(null);
                      router.refresh();
                    }}
                    className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    Apply
                  </button>
                )}
                <button
                  onClick={() => setLocationSuggestion(null)}
                  className="text-current/50 hover:text-current text-base leading-none flex-shrink-0"
                  aria-label="Dismiss"
                >
                  &times;
                </button>
              </div>
            )}

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
                    onBlur={() => { saveEstimate({ fbMinimum: est.fbMinimum }); syncSpaceOnBlur(); }}
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
                      onBlur={() => { saveEstimate({ serviceChargeOverride: est.serviceChargeOverride }); syncSpaceOnBlur(); }}
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
                      onBlur={() => { saveEstimate({ gratuityOverride: est.gratuityOverride }); syncSpaceOnBlur(); }}
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
                      onBlur={() => { saveEstimate({ adminFeeOverride: est.adminFeeOverride }); syncSpaceOnBlur(); }}
                      className={feeInputClass(est.adminFeeOverride, defaultAdmin)}
                    />
                    <span className="absolute right-2 top-1.5 text-brand-silver text-xs pointer-events-none">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Client Discount */}
            <div className="flex items-center gap-3 pt-1">
              <label className={labelClass + ' mb-0'}>Client Discount</label>
              <div className="flex items-center gap-1.5 border border-brand-cream rounded overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => { const t: 'percent' | 'flat' = est.discountType === 'percent' ? 'flat' : 'percent'; updateEstField({ discountType: t }); saveEstimate({ discountType: t }); }}
                  className={`px-2 py-1 transition-colors ${est.discountType === 'percent' ? 'bg-brand-brown text-white' : 'text-brand-silver hover:bg-brand-offwhite'}`}
                >%</button>
                <button
                  type="button"
                  onClick={() => { const t: 'percent' | 'flat' = est.discountType === 'flat' ? 'percent' : 'flat'; updateEstField({ discountType: t }); saveEstimate({ discountType: t }); }}
                  className={`px-2 py-1 transition-colors ${est.discountType === 'flat' ? 'bg-brand-brown text-white' : 'text-brand-silver hover:bg-brand-offwhite'}`}
                >$</button>
              </div>
              <div className="relative w-28">
                {est.discountType === 'flat' && <span className="absolute left-2 top-1.5 text-gray-400 text-sm pointer-events-none">$</span>}
                <input
                  type="number"
                  min="0"
                  step={est.discountType === 'percent' ? '0.5' : '1'}
                  value={est.discountValue === 0 ? '' : (est.discountType === 'percent' ? parseFloat((est.discountValue * 100).toFixed(4)) : est.discountValue)}
                  onChange={(e) => {
                    const raw = parseFloat(e.target.value) || 0;
                    const val = est.discountType === 'percent' ? raw / 100 : raw;
                    updateEstField({ discountValue: val });
                  }}
                  onBlur={() => saveEstimate({ discountValue: est.discountValue })}
                  className={fieldClass + (est.discountType === 'flat' ? ' pl-5' : '') + (est.discountValue > 0 ? ' border-brand-copper bg-brand-offwhite' : '')}
                  placeholder="0"
                  disabled={!est.discountType}
                />
                {est.discountType === 'percent' && <span className="absolute right-2 top-1.5 text-brand-silver text-xs pointer-events-none">%</span>}
              </div>
              {est.discountValue > 0 && <span className="text-xs text-brand-copper">−${Math.round(summary.discountAmount).toLocaleString()}</span>}
              {(est.discountType || est.discountValue > 0) && (
                <button
                  type="button"
                  className="text-xs text-brand-silver/60 hover:text-red-500 transition-colors"
                  onClick={() => { updateEstField({ discountType: null, discountValue: 0 }); saveEstimate({ discountType: null, discountValue: 0 }); }}
                >Clear</button>
              )}
            </div>
            {/* Tax Exempt */}
            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={est.taxExempt}
                  onChange={(e) => {
                    const next = e.target.checked;
                    updateEstField({ taxExempt: next });
                    saveEstimate({ taxExempt: next });
                  }}
                  className="w-4 h-4 rounded border-brand-cream accent-brand-brown cursor-pointer"
                />
                <span className="text-sm text-gray-700">Tax Exempt</span>
              </label>
              {est.taxExempt && (
                <span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded border border-amber-400 bg-amber-50 text-amber-700 uppercase">TAX EXEMPT</span>
              )}
            </div>

            {/* Tax Rate Overrides */}
            <div className="pt-1 border-t border-brand-cream/60">
              <label className={labelClass + ' mb-2'}>
                Tax Rate Overrides
                <span className="ml-1 font-normal text-brand-silver">(leave blank to use location defaults)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['food', 'alcohol', 'general'] as const).map((type) => {
                  const key = `${type}TaxOverride` as 'foodTaxOverride' | 'alcoholTaxOverride' | 'generalTaxOverride';
                  const locKey = `${type}TaxRate` as 'foodTaxRate' | 'alcoholTaxRate' | 'generalTaxRate';
                  const defaultRate = programConfig.location[locKey];
                  const val = est[key];
                  return (
                    <div key={type}>
                      <label className={labelClass}>
                        {type === 'food' ? 'Food Tax' : type === 'alcohol' ? 'Alcohol Tax' : 'General Tax'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={val !== null ? parseFloat((val * 100).toFixed(4)) : ''}
                          placeholder={`${parseFloat((defaultRate * 100).toFixed(3))}% (default)`}
                          onChange={(e) => {
                            const v = e.target.value === '' ? null : parseFloat(e.target.value) / 100;
                            updateEstField({ [key]: v } as Partial<LocalEstimate>);
                          }}
                          onBlur={() => saveEstimate({ [key]: est[key] } as Partial<LocalEstimate>)}
                          className={`border rounded px-2 py-1.5 pr-6 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper text-brand-charcoal w-full text-right ${
                            val !== null
                              ? 'border-yellow-300 bg-yellow-50 focus:border-yellow-400'
                              : 'border-brand-cream bg-white'
                          }`}
                        />
                        <span className="absolute right-2 top-1.5 text-brand-silver text-xs pointer-events-none">%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Attachments */}
          <AttachmentsPanel estimateId={estimate.id} onPopulateLineItems={handlePopulateFromExtraction} onPopulateEstimateDetails={handlePopulateEstimateDetails} onLoadMenuToSlide={handleLoadMenuToSlide} />

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
            {/* Move action bar */}
            {selectedItems.size > 0 && (
              <div className="flex items-center gap-3 bg-brand-offwhite border border-brand-copper/30 rounded px-3 py-2 text-sm flex-wrap">
                <span className="text-brand-charcoal font-medium">{selectedItems.size} selected</span>
                <span className="text-brand-silver">·</span>
                <span className="text-brand-charcoal/70">Move to:</span>
                <select
                  className="border border-brand-cream rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper bg-white text-brand-charcoal"
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) handleMoveToSection(e.target.value); }}
                >
                  <option value="" disabled>— Section —</option>
                  {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <span className="text-brand-silver">·</span>
                <span className="text-brand-charcoal/70">Set Markup:</span>
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
                    className="border border-brand-cream rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper bg-white text-brand-charcoal w-full text-right pr-5"
                  />
                  <span className="absolute right-2 top-1.5 text-brand-silver text-xs pointer-events-none">%</span>
                </div>
                <button
                  type="button"
                  onClick={handleBulkMarkup}
                  className="text-xs px-2 py-1 bg-brand-brown text-white rounded hover:bg-brand-charcoal transition-colors"
                >Apply</button>
                <button
                  type="button"
                  className="text-xs text-brand-silver/60 hover:text-red-500 ml-auto transition-colors"
                  onClick={() => setSelectedItems(new Set())}
                >Clear selection</button>
              </div>
            )}
            <DndContext sensors={sectionSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {sections.map((sectionDef) => (
                  <SortableSectionItem key={sectionDef.id} id={sectionDef.id}>
                    {(dragHandle) => (
                      <LineItemSection
                        sectionDef={sectionDef}
                        dragHandle={dragHandle}
                        items={lineItems.filter((li) => li.sectionId === sectionDef.id).sort((a, b) => a.sortOrder - b.sortOrder)}
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
                        onReorderItems={handleReorderItems}
                        location={effectiveLocation}
                        showMath={showMath}
                        taxExempt={est.taxExempt}
                      />
                    )}
                  </SortableSectionItem>
                ))}
              </SortableContext>
            </DndContext>
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

          {/* Slide Copy */}
          <>
          <div ref={slideCopyRef}>
            <SlideCopySection
              estimate={estimate}
              program={program}
              event={event}
              summary={summary}
              lineItems={lineItems}
              sections={sections}
              initialData={initialSlideCopyData}
              venueName={venueName}
              venueSpaceName={venueSpaceName}
              venueAddress={venueAddress}
              pendingMenuData={pendingSlideMenuData}
              onPendingMenuConsumed={() => setPendingSlideMenuData(null)}
            />
          </div>

          {/* Travel is now managed at the program level (program page → Travel & Transportation section). */}
          {travelExpenses > 0 && (
            <div className="bg-brand-offwhite border border-brand-cream rounded-lg px-4 py-3 text-xs text-brand-silver">
              Travel &amp; Transportation: <span className="font-medium text-brand-charcoal">
                ${Math.round(travelExpenses).toLocaleString()}
              </span>
              {includeTravelInProductionFee
                ? ' — included in production fee'
                : ' — tracked, not billed (edit on program page)'}
            </div>
          )}
          </>
        </div>

        {/* Right sidebar — summary + margin */}
        <div className="w-72 flex-shrink-0 border-l border-brand-cream bg-brand-offwhite overflow-y-auto p-4 space-y-4">
          <SummaryPanel summary={summary} guestCount={program.guest_count} fbMinimum={est.fbMinimum} sections={sections} showMath={showMath} mathRates={mathRates} />
          <MarginPanel margin={marginAnalysis} summary={summary} showMath={showMath} />
        </div>
      </div>}
    </div>
  );
}
