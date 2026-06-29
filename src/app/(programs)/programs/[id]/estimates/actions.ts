'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import Anthropic from '@anthropic-ai/sdk';
import type { DocumentBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources';
import type { EstimateType, TaxBucket } from '@/types';
import type { SlideCopyData, TravelResult } from '@/types/slideCopy';
import {
  getTrafficWindow,
  formatDriveLine,
  shouldShowWalking,
  formatWalkLine,
  isSameProperty,
  buildPlanningNotes,
} from '@/lib/slideCopy/travel';

// ─── Estimate details ─────────────────────────────────────

export async function updateEstimate(id: string, programId: string, data: Partial<{
  name: string;
  room_space: string | null;
  fb_minimum: number;
  is_venue_taxable: boolean;
  service_charge_override: number | null;
  gratuity_override: number | null;
  admin_fee_override: number | null;
  venue_contact: string | null;
  menu_notes: string | null;
  include_in_budget: boolean;
  discount_type: 'percent' | 'flat' | null;
  discount_value: number;
  eeg_enabled: boolean;
  eeg_rate: number;
  tax_exempt: boolean;
  food_tax_override: number | null;
  alcohol_tax_override: number | null;
  general_tax_override: number | null;
  // INTERNAL ONLY — assignee + working notes. Never reaches a client-facing document.
  assigned_to: number | null;
  internal_notes: string | null;
}>) {
  const supabase = await createClient();
  const { error } = await supabase.from('estimates').update(data).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${programId}`);
  return { error: null };
}

// Move an estimate to a specific event (or to Unassigned when eventId is null).
// Works for both unassigned estimates and re-homing one from one event to another.
export async function moveEstimateToEvent(
  estimateId: string,
  programId: string,
  eventId: string | null,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('estimates')
    .update({ event_id: eventId, updated_at: new Date().toISOString() })
    .eq('id', estimateId)
    .eq('program_id', programId); // scope to the program — never move an estimate across programs
  if (error) return { error: error.message };
  revalidatePath(`/programs/${programId}`);
  return { error: null };
}

export async function reorderEstimates(programId: string, order: { id: string; sort_order: number }[]) {
  const supabase = await createClient();
  await Promise.all(
    order.map(({ id, sort_order }) =>
      supabase.from('estimates').update({ sort_order }).eq('id', id),
    ),
  );
  revalidatePath(`/programs/${programId}`);
  return { error: null };
}

export async function updateEstimateProposalInclusion(id: string, programId: string, includedInProposal: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('estimates')
    .update({ included_in_proposal: includedInProposal })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${programId}`);
  return { error: null };
}

export async function deleteEstimate(id: string, programId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('estimates').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${programId}`);
  return { error: null };
}

export async function duplicateEstimate(sourceId: string, programId: string) {
  const supabase = await createClient();

  // Fetch source estimate
  const { data: source, error: sourceErr } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', sourceId)
    .single();
  if (sourceErr) return { error: sourceErr.message, id: null };

  // Fetch source line items
  const { data: lineItems, error: liErr } = await supabase
    .from('estimate_line_items')
    .select('*')
    .eq('estimate_id', sourceId)
    .order('sort_order');
  if (liErr) return { error: liErr.message, id: null };

  // Count existing to set sort_order
  const { count } = await supabase
    .from('estimates')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', programId);

  // Create new estimate
  const { data: newEstimate, error: newErr } = await supabase
    .from('estimates')
    .insert({
      program_id: programId,
      type: source.type,
      event_id: source.event_id ?? null, // keep the copy under the same event as its source (else it strands in Unassigned)
      name: `${source.name} (copy)`,
      room_space: source.room_space,
      fb_minimum: source.fb_minimum,
      is_venue_taxable: source.is_venue_taxable,
      service_charge_override: source.service_charge_override,
      gratuity_override: source.gratuity_override,
      admin_fee_override: source.admin_fee_override,
      include_in_budget: source.include_in_budget,
      discount_type: source.discount_type ?? null,
      discount_value: source.discount_value ?? 0,
      eeg_enabled: source.eeg_enabled ?? false,
      eeg_rate: source.eeg_rate ?? 0.10,
      sort_order: count ?? 0,
    })
    .select('id')
    .single();
  if (newErr) return { error: newErr.message, id: null };

  // Copy sections, capturing old→new ID mapping for line item FK update
  const { data: srcSections } = await supabase
    .from('estimate_sections')
    .select('id, name, tax_bucket, markup_pct, sort_order, is_built_in')
    .eq('estimate_id', sourceId)
    .order('sort_order');

  const sectionIdMap = new Map<string, string>();
  if (srcSections && srcSections.length > 0) {
    const { data: newSections, error: secErr } = await supabase
      .from('estimate_sections')
      .insert(srcSections.map(({ id: _id, ...rest }) => ({ ...rest, estimate_id: newEstimate.id })))
      .select('id, name');
    if (secErr) return { error: secErr.message, id: null };
    (newSections ?? []).forEach((ns, i) => {
      sectionIdMap.set(srcSections[i].id, ns.id);
    });
  }

  // Copy line items
  if (lineItems && lineItems.length > 0) {
    const { error: copyErr } = await supabase.from('estimate_line_items').insert(
      lineItems.map(({ id: _id, estimate_id: _eid, created_at: _ca, updated_at: _ua, section_id, ...rest }) => ({
        ...rest,
        estimate_id: newEstimate.id,
        section_id: section_id ? (sectionIdMap.get(section_id) ?? null) : null,
      }))
    );
    if (copyErr) return { error: copyErr.message, id: null };
  }

  revalidatePath(`/programs/${programId}`);
  return { error: null, id: newEstimate.id as string };
}

// ─── Estimate Sections ────────────────────────────────────

const DEFAULT_SECTIONS: Record<EstimateType, Array<{ name: string; tax_bucket: TaxBucket; markup_pct: number; sort_order: number }>> = {
  venue: [
    { name: 'F&B', tax_bucket: 'fb', markup_pct: 0.55, sort_order: 0 },
    { name: 'Equipment & Staffing', tax_bucket: 'equipment', markup_pct: 0.65, sort_order: 1 },
    { name: 'Venue Fees', tax_bucket: 'venue', markup_pct: 0.60, sort_order: 2 },
    { name: 'Non-Taxable Staffing', tax_bucket: 'staffing', markup_pct: 0.90, sort_order: 3 },
  ],
  av: [
    { name: 'AV & Production', tax_bucket: 'equipment', markup_pct: 0.65, sort_order: 0 },
    { name: 'Non-Taxable Staffing', tax_bucket: 'staffing', markup_pct: 0.90, sort_order: 1 },
  ],
  decor: [
    { name: 'Florals - Taxable', tax_bucket: 'equipment', markup_pct: 0.85, sort_order: 0 },
    { name: 'Florals - Non-Taxable', tax_bucket: 'staffing', markup_pct: 0.85, sort_order: 1 },
    { name: 'Rentals - Seating', tax_bucket: 'equipment', markup_pct: 0.85, sort_order: 2 },
    { name: 'Rentals - Lounge', tax_bucket: 'equipment', markup_pct: 0.85, sort_order: 3 },
    { name: 'Rentals - Tables', tax_bucket: 'equipment', markup_pct: 0.85, sort_order: 4 },
    { name: 'Rentals - Rugs & Accessories', tax_bucket: 'equipment', markup_pct: 0.85, sort_order: 5 },
    { name: 'Rentals - Non-Taxable', tax_bucket: 'staffing', markup_pct: 0.85, sort_order: 6 },
    { name: 'Non-Taxable Staffing', tax_bucket: 'staffing', markup_pct: 0.90, sort_order: 7 },
  ],
  transportation: [],
  tour: [
    { name: 'Tour & Guide Services', tax_bucket: 'equipment', markup_pct: 0.65, sort_order: 0 },
    { name: 'Transportation', tax_bucket: 'equipment', markup_pct: 0.75, sort_order: 1 },
    { name: 'Non-Taxable Staffing', tax_bucket: 'staffing', markup_pct: 0.90, sort_order: 2 },
  ],
};

export interface DbEstimateSectionAction {
  id: string;
  estimate_id: string;
  name: string;
  tax_bucket: TaxBucket;
  markup_pct: number;
  sort_order: number;
  is_built_in: boolean;
}

export async function ensureDefaultSections(estimateId: string, estimateType: EstimateType): Promise<{ sections: DbEstimateSectionAction[]; error: string | null }> {
  const supabase = await createClient();
  const defaults = DEFAULT_SECTIONS[estimateType];
  if (defaults.length === 0) return { sections: [], error: null };

  const { data, error } = await supabase
    .from('estimate_sections')
    .insert(defaults.map((s) => ({ ...s, estimate_id: estimateId, is_built_in: true })))
    .select('id, estimate_id, name, tax_bucket, markup_pct, sort_order, is_built_in');
  if (error) return { sections: [], error: error.message };
  return { sections: data as DbEstimateSectionAction[], error: null };
}

export async function upsertSection(data: {
  id?: string;
  estimate_id: string;
  name: string;
  tax_bucket: TaxBucket;
  markup_pct: number;
  sort_order: number;
  is_built_in?: boolean;
}): Promise<{ error: string | null; section: DbEstimateSectionAction | null }> {
  const supabase = await createClient();
  const payload = {
    estimate_id: data.estimate_id,
    name: data.name,
    tax_bucket: data.tax_bucket,
    markup_pct: data.markup_pct,
    sort_order: data.sort_order,
    is_built_in: data.is_built_in ?? false,
    ...(data.id ? { id: data.id } : {}),
  };
  const { data: row, error } = await supabase
    .from('estimate_sections')
    .upsert(payload, { onConflict: 'id' })
    .select('id, estimate_id, name, tax_bucket, markup_pct, sort_order, is_built_in')
    .single();
  if (error) return { error: error.message, section: null };
  return { error: null, section: row as DbEstimateSectionAction };
}

export async function deleteSection(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from('estimate_sections').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

// ─── Line Items ──────────────────────────────────────────

export async function upsertLineItem(data: {
  id?: string;
  estimate_id: string;
  section: string;
  section_id?: string | null;
  name: string;
  label?: string | null;
  qty: number;
  unit_price: number;
  category_id: string | null;
  tax_type: string;
  custom_client_unit_price?: number | null;
  markup_override?: number | null;
  is_revenue_item?: boolean;
  sort_order: number;
  thumbnail_url?: string | null;
  thumbnail_icon?: string | null;
  package_options?: import('@/types').PackageOptions | null;
  selected_package_id?: string | null;
}) {
  const supabase = await createClient();

  if (data.id) {
    const { error } = await supabase
      .from('estimate_line_items')
      .update({
        section: data.section,
        section_id: data.section_id ?? null,
        name: data.name,
        label: data.label ?? null,
        qty: data.qty,
        unit_price: data.unit_price,
        category_id: data.category_id,
        tax_type: data.tax_type,
        custom_client_unit_price: data.custom_client_unit_price ?? null,
        markup_override: data.markup_override ?? null,
        is_revenue_item: data.is_revenue_item ?? false,
        sort_order: data.sort_order,
        thumbnail_url: data.thumbnail_url ?? null,
        thumbnail_icon: data.thumbnail_icon ?? null,
        package_options: data.package_options ?? null,
        selected_package_id: data.selected_package_id ?? null,
      })
      .eq('id', data.id);
    if (error) return { error: error.message, id: data.id };
    return { error: null, id: data.id };
  } else {
    const { data: newItem, error } = await supabase
      .from('estimate_line_items')
      .insert({
        estimate_id: data.estimate_id,
        section: data.section,
        section_id: data.section_id ?? null,
        name: data.name,
        label: data.label ?? null,
        qty: data.qty,
        unit_price: data.unit_price,
        category_id: data.category_id,
        tax_type: data.tax_type,
        custom_client_unit_price: data.custom_client_unit_price ?? null,
        markup_override: data.markup_override ?? null,
        is_revenue_item: data.is_revenue_item ?? false,
        sort_order: data.sort_order,
        thumbnail_url: data.thumbnail_url ?? null,
        thumbnail_icon: data.thumbnail_icon ?? null,
        package_options: data.package_options ?? null,
        selected_package_id: data.selected_package_id ?? null,
      })
      .select('id')
      .single();
    if (error) return { error: error.message, id: null };
    return { error: null, id: newItem.id as string };
  }
}

export async function deleteLineItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('estimate_line_items').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

export async function uploadLineItemThumbnail(
  lineItemId: string,
  base64Data: string,
  mimeType: string,
): Promise<{ error: string | null; url: string | null }> {
  const supabase = await createClient();
  const ext = mimeType.split('/')[1] ?? 'jpg';
  const path = `line-item-thumbnails/${lineItemId}.${ext}`;
  const buffer = Buffer.from(base64Data, 'base64');
  const { error } = await supabase.storage
    .from('line-item-thumbnails')
    .upload(path, buffer, { contentType: mimeType, upsert: true });
  if (error) return { error: error.message, url: null };
  const { data } = supabase.storage.from('line-item-thumbnails').getPublicUrl(path);
  return { error: null, url: data.publicUrl };
}

// ─── Estimate Trips ───────────────────────────────────────

export async function upsertTrip(data: {
  estimate_id: string;
  trip_number: number;
  label: string;
  travel_type: string;
  drive_route_id: string | null;
  train_route_id: string | null;
  flight_type_id: string | null;
  last_minute_buffer: boolean;
  staff_count: number;
  nights: number;
  hotel_rate_id: string | null;
  hotel_budget: string;
  per_diem_rate_id: string | null;
  vehicle_rate_id: string | null;
  vehicle_type: string;
  vehicle_service: string;
  vehicle_hours: number;
  custom_vehicle_cost: number;
}) {
  const supabase = await createClient();
  const payload = {
    estimate_id: data.estimate_id,
    trip_number: data.trip_number,
    label: data.label,
    travel_type: data.travel_type,
    drive_route_id: data.drive_route_id,
    train_route_id: data.train_route_id,
    flight_type_id: data.flight_type_id,
    last_minute_buffer: data.last_minute_buffer,
    staff_count: data.staff_count,
    nights: data.nights,
    hotel_rate_id: data.hotel_rate_id,
    hotel_budget: data.hotel_budget,
    per_diem_rate_id: data.per_diem_rate_id,
    vehicle_rate_id: data.vehicle_rate_id,
    vehicle_type: data.vehicle_type,
    vehicle_service: data.vehicle_service,
    vehicle_hours: data.vehicle_hours,
    custom_vehicle_cost: data.custom_vehicle_cost,
  };
  const { error } = await supabase
    .from('estimate_trips')
    .upsert(payload, { onConflict: 'estimate_id,trip_number' });
  if (error) return { error: error.message };
  return { error: null };
}

export async function cacheEstimateTotal(estimateId: string, programId: string, total: number) {
  const supabase = await createClient();
  await supabase.from('estimates').update({ cached_total: total }).eq('id', estimateId);
  await supabase.from('programs').update({ latest_total: total }).eq('id', programId);
  return { error: null };
}

// ─── Attachments ─────────────────────────────────────────

export interface ExtractedMenuOption {
  name: string;
  description?: string;
  tags?: string[];
}

export interface ExtractedMenuItem {
  name: string;
  description?: string;
  pricePerPerson: number;
  packageOptions?: import('@/types').PackageOptions;
  category: 'food' | 'alcohol' | 'na_beverage';
  selections?: string[];
  // Phase 3 — menu selection fields
  tags?: string[];
  needsSelection?: boolean;
  selectionRule?: string;
  maxSelections?: number;
  options?: ExtractedMenuOption[];
  isSampleMenu?: boolean;
}

export interface ExtractedEquipmentItem {
  name: string;
  label?: string;
  description?: string;
  unitPrice: number;
  qty: number;
  section: 'equipment' | 'venue_fee' | 'staffing' | 'labor' | 'florals' | 'rentals' | 'lighting' | 'signage' | 'delivery';
}

export interface ExtractedVenueFee {
  name: string;
  value: number;
  type: 'percentage' | 'flat';
}

export interface ExtractedTransportVehicleRate {
  vehicleType: string;
  hourlyRate: number;
  hourMinimum: number | null;
}

export interface ExtractedTransportScheduleRow {
  serviceDate: string | null;
  vehicleType: string;
  serviceType: 'hourly' | 'transfer';
  startTime: string | null;
  endTime: string | null;
  qty: number;
  notes: string | null;
}

export interface ExtractedData {
  menuItems: ExtractedMenuItem[];
  equipmentItems: ExtractedEquipmentItem[];
  venueFees: ExtractedVenueFee[];
  venueName?: string;
  roomSpace?: string;
  vehicleRates?: ExtractedTransportVehicleRate[];
  scheduleRows?: ExtractedTransportScheduleRow[];
}

export interface AttachmentRecord {
  id: string;
  estimate_id: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  url: string;
  extracted_data: ExtractedData | null;
  line_items_populated: boolean;
  details_populated: boolean;
}

// Client uploads directly to Storage; this action only inserts the DB row.
export async function registerAttachment(data: {
  estimateId: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}): Promise<{ error: string | null; record: AttachmentRecord | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: record, error: dbError } = await supabase
    .from('estimate_attachments')
    .insert({
      estimate_id: data.estimateId,
      file_name: data.fileName,
      storage_path: data.storagePath,
      file_size: data.fileSize,
      mime_type: data.mimeType,
      uploaded_by: user?.id ?? null,
    })
    .select('id, estimate_id, file_name, storage_path, file_size, mime_type, created_at, extracted_data, line_items_populated, details_populated')
    .single();

  if (dbError) return { error: dbError.message, record: null };

  const { data: signedData } = await supabase.storage
    .from('estimate-attachments')
    .createSignedUrl(data.storagePath, 3600);

  return {
    error: null,
    record: { ...record, url: signedData?.signedUrl ?? '' },
  };
}

export async function getAttachmentsForEstimate(estimateId: string): Promise<{ error: string | null; records: AttachmentRecord[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimate_attachments')
    .select('id, estimate_id, file_name, storage_path, file_size, mime_type, created_at, extracted_data, line_items_populated, details_populated')
    .eq('estimate_id', estimateId)
    .order('created_at', { ascending: false });

  if (error) return { error: error.message, records: [] };

  const records = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: signedData } = await supabase.storage
        .from('estimate-attachments')
        .createSignedUrl(row.storage_path, 3600);
      return { ...row, url: signedData?.signedUrl ?? '' };
    })
  );

  return { error: null, records };
}

export async function markAttachmentPopulated(
  id: string,
  field: 'line_items_populated' | 'details_populated',
): Promise<void> {
  const supabase = await createClient();
  await supabase.from('estimate_attachments').update({ [field]: true }).eq('id', id);
}

export async function resetAttachmentPopulatedFlags(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('estimate_attachments').update({ line_items_populated: false, details_populated: false }).eq('id', id);
}

export async function deleteAttachment(id: string, storagePath: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  await supabase.storage.from('estimate-attachments').remove([storagePath]);

  const { error } = await supabase.from('estimate_attachments').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

function getExtractionPrompt(type: 'venue' | 'av' | 'decor' | 'transportation' | 'tour'): string {
  if (type === 'av') {
    return (
      'Extract all audio/visual equipment, labor, and production line items from this AV proposal or BEO. ' +
      'Return ONLY valid JSON with one field: ' +
      'avItems (array: name, description, unitPrice, qty, section: equipment|labor) ' +
      'where section=equipment for gear/hardware and section=labor for crew/technician fees. ' +
      'No markdown, no explanation — raw JSON only.'
    );
  }
  if (type === 'decor') {
    return (
      'Extract all decor, floral, rental, and design line items from this proposal or BEO. ' +
      'Return ONLY valid JSON with one field: ' +
      'decorItems (array: name, label, description, unitPrice, qty, section: florals|rentals|delivery) ' +
      'SECTION RULES — use exactly these values:\n' +
      '  florals = any decorative design element: floral arrangements, centerpieces, entrance installations, ' +
      'arches, backdrops, garlands, wreaths, candles, uplighting, pin spots, signage, props, accent pieces, rugs placed for design, ' +
      'lounge furniture used decoratively. When in doubt, use florals.\n' +
      '  rentals = ONLY physical rental items that are pure furniture/equipment: chairs, barstools, sofas, cocktail tables, ' +
      'dining tables, benches, linens, pipe-and-drape, tenting, staging. Do NOT use rentals for anything decorative.\n' +
      '  delivery = delivery fees, setup fees, strike fees, installation labor, transportation charges.\n' +
      'LABEL RULE: set label to a short team-friendly internal descriptor (e.g. "Centerpieces", "Entrance Arch", ' +
      '"Seating - Chiavari Chairs", "Linens - 60in Round"). Keep it concise (2-5 words).\n' +
      'No markdown, no explanation — raw JSON only.'
    );
  }
  if (type === 'transportation') {
    return (
      'Extract all vehicle types, rates, and service schedule from this transportation quote or proposal. ' +
      'Return ONLY valid JSON with two fields: vehicleRates and scheduleRows. ' +
      'vehicleRates: array of { vehicleType (string, include capacity e.g. "Suburban (6 pax)"), hourlyRate (number, the vendor hourly rate), hourMinimum (number or null) }. ' +
      'If a vehicle has a separate flat airport-transfer rate, add a SECOND entry for that vehicle with vehicleType appended with " - Transfer" (e.g. "Suburban - Transfer"), hourlyRate = the flat transfer rate, hourMinimum = null. ' +
      'scheduleRows: array of { serviceDate (YYYY-MM-DD or null if not specified), vehicleType (must match an entry in vehicleRates exactly), ' +
      'serviceType ("hourly" for time-based runs or "transfer" for flat-rate airport/point-to-point runs), ' +
      'startTime (HH:MM 24hr or null), endTime (HH:MM 24hr or null), qty (number of vehicles, default 1), notes (origin→destination or description, or null) }. ' +
      'Extract every planned run or day in the service schedule as a separate row. ' +
      'Omit gratuity and fuel surcharge — those are not schedule rows. ' +
      'No markdown, no explanation — raw JSON only.'
    );
  }
  return (
    'You are extracting menu data for a corporate event planning team. ' +
    'Return ONLY valid JSON with these fields:\n' +
    '- venueName (string, optional)\n' +
    '- roomSpace (string, optional)\n' +
    '- isSampleMenu (boolean) — true if the PDF is labeled "sample menu," "to be finalized," or similar\n' +
    '- menuItems: array of PRICING PACKAGES — extract EVERY package listed. Do not omit any. Each package:\n' +
    '  { name (e.g. "Plated Dinner", "Cocktail Hour Passed Apps", "Premium Open Bar (3hr)"),\n' +
    '    pricePerPerson (number — use 0 when packageOptions is present),\n' +
    '    category ("food" | "alcohol" | "na_beverage"),\n' +
    '    isSampleMenu (boolean, inherit from top level),\n' +
    '    needsSelection (boolean) — true when PDF says "Choose X", "Select X", "Pick X of", or lists multiple options for a single course position,\n' +
    '    selectionRule (string, e.g. "choose 3") — present only when needsSelection=true,\n' +
    '    maxSelections (number) — parsed from selectionRule, present only when needsSelection=true,\n' +
    '    tags (array of dietary tag strings, e.g. ["GF","VEG"] — apply to the package when all options share the tag),\n' +
    '    options (array) — populate ONLY when needsSelection=true, each option:\n' +
    '      { name (string), description (string, optional), tags (array of dietary tag strings e.g. ["GF","VEG","V","AG"]) },\n' +
    '    selections (array of strings — final dish names when needsSelection=false, for backward compat),\n' +
    '    packageOptions — see PACKAGE GROUP RULES below }\n' +
    'DIETARY TAGS: use standard abbreviations from the PDF (GF=gluten-free, VEG=vegetarian, V=vegan, AG=allergen-noted, DF=dairy-free, NF=nut-free).\n' +
    'GROUPING RULES:\n' +
    '- Prix-fixe/final menu → needsSelection=false, list dishes as selections.\n' +
    '- "Choose X of the following" sections → needsSelection=true, list each option in options array with its tags.\n' +
    '- Bar choices (e.g. "Choose 3 beers") → needsSelection=true, group beers by style in options.\n' +
    '- Bar packages (stated tier price) → needsSelection=false, list inclusions as selections.\n' +
    '- NA beverages → one "Non-Alcoholic Beverages" package.\n' +
    '- venueFees (array: { name, value, type: "percentage"|"flat" }) for service charge, gratuity, admin fee, F&B minimum, room rental.\n' +
    '- equipmentItems: only for AV/staffing/rental line items that are NOT food/beverage.\n' +
    'PACKAGE GROUP RULES — use packageOptions when a PDF presents MULTIPLE ALTERNATIVE complete packages at DIFFERENT prices:\n' +
    '  Examples: "Package A ($85pp) / Package B ($110pp) / Package C ($135pp)", "Gold/Silver/Bronze tiers", "Menu Option 1 / Menu Option 2".\n' +
    '  When detected, produce ONE menuItem (not one per package) with:\n' +
    '    name = shared group label (e.g. "Food Package"),\n' +
    '    pricePerPerson = 0,\n' +
    '    packageOptions: {\n' +
    '      label: (same as name),\n' +
    '      options: [ { id: "a", name: "Package A", description: "...", pricePerPerson: 85, items: ["Dish 1", "Dish 2", ...] }, ... ]\n' +
    '    }\n' +
    '  Use sequential single-letter ids ("a", "b", "c", ...).\n' +
    '  Populate items[] with every dish/course/inclusion listed for that package.\n' +
    '  DISTINGUISH from needsSelection: use packageOptions only when each option is a COMPLETE standalone menu at its OWN price.\n' +
    '  Use needsSelection when you choose N items from one list within a single priced package.\n' +
    'No markdown, no explanation — raw JSON only.'
  );
}

export async function detectPdfMode(
  attachmentId: string,
): Promise<{ error: string | null; mode: 'text' | 'document'; extractedText: string | null }> {
  const supabase = await createClient();

  const { data: rec, error: fetchErr } = await supabase
    .from('estimate_attachments')
    .select('storage_path, mime_type')
    .eq('id', attachmentId)
    .single();
  if (fetchErr || !rec) return { error: fetchErr?.message ?? 'Attachment not found', mode: 'document', extractedText: null };
  if (rec.mime_type !== 'application/pdf') return { error: 'Only PDF files can be extracted', mode: 'document', extractedText: null };

  const { data: fileBlob, error: downloadErr } = await supabase.storage
    .from('estimate-attachments')
    .download(rec.storage_path);
  if (downloadErr || !fileBlob) return { error: downloadErr?.message ?? 'Download failed', mode: 'document', extractedText: null };

  try {
    const { PDFParse } = await import('pdf-parse');
    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const extractedText = result.text?.trim() ?? '';
    if (extractedText.length > 200) {
      return { error: null, mode: 'text', extractedText };
    }
    return { error: null, mode: 'document', extractedText: null };
  } catch {
    return { error: null, mode: 'document', extractedText: null };
  }
}

export async function extractFromText(
  attachmentId: string,
  pdfText: string,
  estimateType: 'venue' | 'av' | 'decor' | 'transportation' | 'tour' = 'venue',
): Promise<{ error: string | null; data: ExtractedData | null }> {
  const supabase = await createClient();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `${getExtractionPrompt(estimateType)}\n\nDocument text:\n${pdfText}`;

  let responseText: string;
  try {
    const textBlock: TextBlockParam = { type: 'text', text: prompt };
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: [textBlock] }],
    });
    responseText = (response.content.find((c) => c.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '';
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'API call failed', data: null };
  }

  let extracted: ExtractedData;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const raw = JSON.parse(jsonMatch?.[0] ?? responseText) as Record<string, unknown>;
    if (estimateType === 'transportation') {
      extracted = {
        menuItems: [],
        equipmentItems: [],
        venueFees: [],
        vehicleRates: Array.isArray(raw.vehicleRates) ? raw.vehicleRates as ExtractedTransportVehicleRate[] : [],
        scheduleRows: Array.isArray(raw.scheduleRows) ? raw.scheduleRows as ExtractedTransportScheduleRow[] : [],
      };
    } else {
      extracted = {
        menuItems: Array.isArray(raw.menuItems) ? raw.menuItems as ExtractedMenuItem[] : [],
        equipmentItems: Array.isArray(raw.equipmentItems) ? raw.equipmentItems as ExtractedEquipmentItem[]
          : Array.isArray(raw.avItems) ? raw.avItems as ExtractedEquipmentItem[]
          : Array.isArray(raw.decorItems) ? raw.decorItems as ExtractedEquipmentItem[]
          : [],
        venueFees: Array.isArray(raw.venueFees) ? raw.venueFees as ExtractedVenueFee[] : [],
        venueName: typeof raw.venueName === 'string' ? raw.venueName : undefined,
        roomSpace: typeof raw.roomSpace === 'string' ? raw.roomSpace : undefined,
      };
    }
  } catch {
    return { error: 'Could not parse extraction response', data: null };
  }

  const { error: updateErr } = await supabase
    .from('estimate_attachments')
    .update({ extracted_data: extracted })
    .eq('id', attachmentId);

  if (updateErr) return { error: updateErr.message, data: null };
  return { error: null, data: extracted };
}

export async function extractAttachmentData(
  attachmentId: string,
  estimateType: 'venue' | 'av' | 'decor' | 'transportation' | 'tour' = 'venue',
): Promise<{ error: string | null; data: ExtractedData | null }> {
  const supabase = await createClient();

  const { data: rec, error: fetchErr } = await supabase
    .from('estimate_attachments')
    .select('storage_path, mime_type')
    .eq('id', attachmentId)
    .single();
  if (fetchErr || !rec) return { error: fetchErr?.message ?? 'Attachment not found', data: null };
  if (rec.mime_type !== 'application/pdf') return { error: 'Only PDF files can be extracted', data: null };

  const { data: fileBlob, error: downloadErr } = await supabase.storage
    .from('estimate-attachments')
    .download(rec.storage_path);
  if (downloadErr || !fileBlob) return { error: downloadErr?.message ?? 'Download failed', data: null };

  const base64 = Buffer.from(await fileBlob.arrayBuffer()).toString('base64');

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let text: string;
  try {
    const docBlock: DocumentBlockParam = {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    };
    const textBlock: TextBlockParam = { type: 'text', text: getExtractionPrompt(estimateType) };
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: [docBlock, textBlock] }],
    });
    text = (response.content.find((c) => c.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '';
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'API call failed', data: null };
  }

  let extracted: ExtractedData;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const raw = JSON.parse(jsonMatch?.[0] ?? text) as Record<string, unknown>;
    if (estimateType === 'transportation') {
      extracted = {
        menuItems: [],
        equipmentItems: [],
        venueFees: [],
        vehicleRates: Array.isArray(raw.vehicleRates) ? raw.vehicleRates as ExtractedTransportVehicleRate[] : [],
        scheduleRows: Array.isArray(raw.scheduleRows) ? raw.scheduleRows as ExtractedTransportScheduleRow[] : [],
      };
    } else {
      extracted = {
        menuItems: Array.isArray(raw.menuItems) ? raw.menuItems as ExtractedMenuItem[] : [],
        equipmentItems: Array.isArray(raw.equipmentItems) ? raw.equipmentItems as ExtractedEquipmentItem[]
          : Array.isArray(raw.avItems) ? raw.avItems as ExtractedEquipmentItem[]
          : Array.isArray(raw.decorItems) ? raw.decorItems as ExtractedEquipmentItem[]
          : [],
        venueFees: Array.isArray(raw.venueFees) ? raw.venueFees as ExtractedVenueFee[] : [],
        venueName: typeof raw.venueName === 'string' ? raw.venueName : undefined,
        roomSpace: typeof raw.roomSpace === 'string' ? raw.roomSpace : undefined,
      };
    }
  } catch {
    return { error: 'Could not parse extraction response', data: null };
  }

  const { error: updateErr } = await supabase
    .from('estimate_attachments')
    .update({ extracted_data: extracted })
    .eq('id', attachmentId);

  if (updateErr) return { error: updateErr.message, data: null };

  return { error: null, data: extracted };
}

// ─── Copy Items From Estimate ─────────────────────────────

export async function getLineItemsForEstimate(estimateId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimate_line_items')
    .select('id, section, section_id, name, label, qty, unit_price, category_id, tax_type, custom_client_unit_price, markup_override, is_revenue_item, sort_order')
    .eq('estimate_id', estimateId)
    .order('sort_order');
  if (error) return { error: error.message, items: [] };
  return { error: null, items: data ?? [] };
}

// ─── Line Item Templates ──────────────────────────────────

export interface DbTemplate {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  category_markup_pct: number | null;
  default_unit_price: number;
  tax_type: string;
  created_by: string | null;
}

export async function getTemplates(): Promise<{ error: string | null; templates: DbTemplate[]; currentUserId: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('line_item_templates')
    .select('id, name, category_id, default_unit_price, tax_type, created_by, category_markups(name, markup_pct)')
    .order('name');
  if (error) return { error: error.message, templates: [], currentUserId: user?.id ?? null };
  return {
    error: null,
    currentUserId: user?.id ?? null,
    templates: (data ?? []).map((row) => {
      const cat = (row.category_markups as unknown) as { name: string; markup_pct: number } | null;
      return {
        id: row.id,
        name: row.name,
        category_id: row.category_id,
        category_name: cat?.name ?? null,
        category_markup_pct: cat?.markup_pct ?? null,
        default_unit_price: row.default_unit_price,
        tax_type: row.tax_type,
        created_by: row.created_by,
      };
    }),
  };
}

export async function saveTemplate(data: {
  name: string;
  category_id: string | null;
  default_unit_price: number;
  tax_type: string;
}): Promise<{ error: string | null; id: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: row, error } = await supabase
    .from('line_item_templates')
    .insert({ ...data, created_by: user?.id ?? null })
    .select('id')
    .single();
  if (error) return { error: error.message, id: null };
  return { error: null, id: row.id as string };
}

export async function deleteTemplate(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  // .select() so we know how many rows were actually removed: an RLS-blocked delete
  // returns no error but 0 rows, and we must not let the caller treat that as success.
  const { data, error } = await supabase
    .from('line_item_templates')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: 'You can only delete templates you created.' };
  }
  return { error: null };
}

// ─── Transportation CRUD ──────────────────────────────────

export async function upsertTransportVehicleRate(data: {
  id?: string;
  estimate_id: string;
  vehicle_type: string;
  hourly_rate: number;
  hour_minimum: number | null;
  sort_order: number;
}): Promise<{ error: string | null; id: string | null }> {
  const supabase = await createClient();
  if (data.id) {
    const { error } = await supabase
      .from('transport_vehicle_rates')
      .update({ vehicle_type: data.vehicle_type, hourly_rate: data.hourly_rate, hour_minimum: data.hour_minimum, sort_order: data.sort_order })
      .eq('id', data.id);
    if (error) return { error: error.message, id: null };
    return { error: null, id: data.id };
  }
  const { data: row, error } = await supabase
    .from('transport_vehicle_rates')
    .insert({ estimate_id: data.estimate_id, vehicle_type: data.vehicle_type, hourly_rate: data.hourly_rate, hour_minimum: data.hour_minimum, sort_order: data.sort_order })
    .select('id')
    .single();
  if (error) return { error: error.message, id: null };
  return { error: null, id: row.id as string };
}

export async function deleteTransportVehicleRate(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from('transport_vehicle_rates').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

export async function upsertTransportScheduleRow(data: {
  id?: string;
  estimate_id: string;
  service_date: string | null;
  vehicle_rate_id: string | null;
  service_type: string;
  spot_time?: string | null;
  start_time: string | null;
  end_time: string | null;
  qty: number;
  our_cost: number;
  client_cost: number;
  notes: string | null;
  sort_order: number;
}): Promise<{ error: string | null; id: string | null }> {
  const supabase = await createClient();
  const { id, ...rest } = data;
  if (id) {
    const { error } = await supabase.from('transport_schedule_rows').update(rest).eq('id', id);
    if (error) return { error: error.message, id: null };
    return { error: null, id };
  }
  const { data: row, error } = await supabase
    .from('transport_schedule_rows')
    .insert(rest)
    .select('id')
    .single();
  if (error) return { error: error.message, id: null };
  return { error: null, id: row.id as string };
}

export async function deleteTransportScheduleRow(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from('transport_schedule_rows').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

export async function updateTransportCommission(estimateId: string, commission: number): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from('estimates').update({ transport_commission: commission }).eq('id', estimateId);
  if (error) return { error: error.message };
  return { error: null };
}

export async function getExportDataForProgram(programId: string) {
  const supabase = await createClient();
  const { data: estimates, error: estErr } = await supabase
    .from('estimates')
    .select('id, name, fb_minimum, is_venue_taxable, service_charge_override, gratuity_override, admin_fee_override')
    .eq('program_id', programId)
    .order('sort_order');
  if (estErr) return { error: estErr.message, data: null };

  const estimateIds = (estimates ?? []).map((e) => e.id as string);
  if (estimateIds.length === 0) return { error: null, data: [] };

  const { data: lineItems, error: liErr } = await supabase
    .from('estimate_line_items')
    .select('id, estimate_id, section, name, qty, unit_price, category_id, tax_type, custom_client_unit_price, markup_override, is_revenue_item, sort_order')
    .in('estimate_id', estimateIds)
    .order('sort_order');
  if (liErr) return { error: liErr.message, data: null };

  const byEstimate = (estimates ?? []).map((est) => ({
    estimate: est,
    lineItems: (lineItems ?? []).filter((li) => li.estimate_id === est.id),
  }));

  return { error: null, data: byEstimate };
}

// ─── Slide Copy ────────────────────────────────────────────


export async function saveSlideCopyData(estimateId: string, data: SlideCopyData): Promise<void> {
  const supabase = await createClient();
  await supabase.from('estimates').update({ slide_copy_data: data }).eq('id', estimateId);
}

// ─── Tour Details ──────────────────────────────────────────

export type { TourDetails, TourCatalogEntry } from '@/lib/tours/types';
import type { TourDetails, TourCatalogEntry } from '@/lib/tours/types';

export async function updateTourDetails(estimateId: string, programId: string, patch: TourDetails): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('estimates')
    .select('tour_details')
    .eq('id', estimateId)
    .single();
  const merged = { ...(existing?.tour_details ?? {}), ...patch };
  const { error } = await supabase
    .from('estimates')
    .update({ tour_details: merged })
    .eq('id', estimateId);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${programId}`);
  return { error: null };
}

// ─── Tour Catalog ─────────────────────────────────────────

export async function getTourCatalog(): Promise<TourCatalogEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tour_catalog')
    .select('id, name, tour_details, notes, created_at')
    .order('name');
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    tour_details: (row.tour_details as TourDetails) ?? {},
    notes: row.notes ?? null,
    created_at: row.created_at,
  }));
}

export async function saveTourTemplate(
  name: string,
  tourDetails: TourDetails
): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tour_catalog')
    .insert({ name, tour_details: tourDetails })
    .select('id')
    .single();
  if (error) return { id: null, error: error.message };
  return { id: data.id as string, error: null };
}

export async function deleteTourTemplate(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from('tour_catalog').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

interface MapsDistanceResponse {
  rows: { elements: { status: string; distance?: { value: number }; duration?: { value: number } }[] }[];
  status: string;
}

async function fetchMapsDistance(origin: string, destination: string, mode: 'driving' | 'walking'): Promise<{ distanceMeters: number; durationSeconds: number } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=${mode}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[Maps] HTTP ${res.status} for ${mode}:`, await res.text().catch(() => ''));
    return null;
  }
  const data = await res.json() as MapsDistanceResponse;
  const el = data?.rows?.[0]?.elements?.[0];
  if (!el || el.status !== 'OK' || !el.distance || !el.duration) {
    console.error(`[Maps] Element status for ${mode}:`, el?.status ?? 'missing', JSON.stringify(data?.status));
    return null;
  }
  const distanceMeters = el.distance.value;
  const durationSeconds = el.duration.value;
  console.log(`[Maps ${mode}] "${origin}" → "${destination}" | ${distanceMeters}m | ${(distanceMeters / 1609.344).toFixed(2)}mi | ${Math.round(durationSeconds / 60)}min`);
  return { distanceMeters, durationSeconds };
}

export async function getTravelTime(
  hotelAddress: string,
  venueAddress: string,
  eventDate: string,   // YYYY-MM-DD
  startTime: string,   // HH:MM or HH:MM:SS
  hotelName: string,
): Promise<{ error: string | null; result: TravelResult | null }> {
  if (!hotelAddress || !venueAddress) {
    return { error: 'Both hotel and venue addresses are required.', result: null };
  }

  if (isSameProperty(hotelName, venueAddress)) {
    return {
      error: null,
      result: {
        distanceMiles: 0,
        baseDriveMins: 0,
        baseWalkMins: 0,
        isSameProperty: true,
        driveLine: 'On-site, no transportation needed',
        walkLine: null,
        planningNotes: 'Venue is on-site at the client hotel. No transportation required.',
        calculatedAt: new Date().toISOString(),
      },
    };
  }

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return { error: 'Google Maps API key is not configured. Ask your admin to add GOOGLE_MAPS_API_KEY in Vercel environment variables.', result: null };
  }

  const [driving, walking] = await Promise.all([
    fetchMapsDistance(hotelAddress, venueAddress, 'driving'),
    fetchMapsDistance(hotelAddress, venueAddress, 'walking'),
  ]);

  if (!driving) {
    return { error: 'Travel time calculation failed. Verify that the Distance Matrix API is enabled in Google Cloud Console and billing is active on the project.', result: null };
  }

  const distanceMiles = driving.distanceMeters / 1609.344;
  const baseDriveMins = Math.round(driving.durationSeconds / 60);
  const baseWalkMins = walking ? Math.round(walking.durationSeconds / 60) : null;

  // Determine traffic window from event date + start time
  const d = new Date(eventDate + 'T12:00:00');
  const dayOfWeek = d.getDay();
  const hour = parseInt(startTime.split(':')[0], 10);
  const window = getTrafficWindow(hour, dayOfWeek);

  const driveLine = formatDriveLine(distanceMiles, baseDriveMins, window);
  const showWalk = baseWalkMins !== null && shouldShowWalking(distanceMiles, baseWalkMins);
  const walkLine = showWalk && baseWalkMins !== null ? formatWalkLine(baseWalkMins) : null;

  const maxDriveMins = Math.round(baseDriveMins * window.maxMultiplier);
  const planningNotes = buildPlanningNotes({ startTime, maxDriveMins, distanceMiles, dayOfWeek, hotelName });

  return {
    error: null,
    result: {
      distanceMiles,
      baseDriveMins,
      baseWalkMins,
      isSameProperty: false,
      driveLine,
      walkLine,
      planningNotes,
      calculatedAt: new Date().toISOString(),
    },
  };
}

// ─── Venue Description Generator ─────────────────────────

const VENUE_BIO_SYSTEM = `You write venue descriptions for QC Event Design, a corporate event planning company.
Style: Warm, grounded, confident. Clear and creative without being over-polished.
Rules:
- 3 to 5 sentences only
- No em dashes or en dashes — use commas or periods
- Oxford comma always
- Avoid: decor, set up, tear down, stuff, things, party
- Avoid unless they genuinely fit: curated, elevated, immersive, unforgettable, one-of-a-kind
- Lead with what makes the venue distinctive, not generic praise
- Do NOT write a header or title — output the paragraph only`;

export async function generateVenueBio(opts: {
  venueName: string;
  venueUrl?: string;
  city?: string;
  eventType?: string;
}): Promise<{ error: string | null; bio: string | null; sqftHint?: string; capacityHint?: string }> {
  let sourceContent = '';
  let sqftHint: string | undefined;
  let capacityHint: string | undefined;

  if (opts.venueUrl) {
    try {
      const res = await fetch(opts.venueUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const html = await res.text();
        // Strip tags, collapse whitespace, take first 4000 chars
        const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 4000);
        sourceContent = `Venue website content:\n${text}`;
        // Extract sqft/capacity hints from page text
        const sqftMatch = text.match(/(\d[\d,]+)\s*(?:sq\.?\s*ft\.?|square feet)/i);
        if (sqftMatch) sqftHint = sqftMatch[1].replace(',', '');
        const capMatch = text.match(/(?:capacity|seats?|holds?)\s*(?:up to\s*)?(\d[\d,]+)/i);
        if (capMatch) capacityHint = capMatch[1].replace(',', '');
      }
    } catch {
      // Fetch failed — fall through to name-based generation
    }
  }

  const userPrompt = sourceContent
    ? `Write a 3 to 5 sentence venue description for ${opts.venueName}${opts.city ? ` in ${opts.city}` : ''} for a ${opts.eventType ?? 'corporate event'}.\n\n${sourceContent}`
    : `Write a 3 to 5 sentence venue description for ${opts.venueName}${opts.city ? ` in ${opts.city}` : ''} for a ${opts.eventType ?? 'corporate event'}. Base it on general knowledge of this venue. End with a note: "Verify accuracy — no venue website was provided."`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: VENUE_BIO_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const bio = (response.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text?.trim() ?? null;
    return { error: null, bio, sqftHint, capacityHint };
  } catch (e) {
    return { error: String(e), bio: null };
  }
}

// ─── Reorder helpers ──────────────────────────────────────

export async function reorderSections(updates: { id: string; sortOrder: number }[]): Promise<void> {
  const supabase = await createClient();
  await Promise.all(
    updates.map(({ id, sortOrder }) =>
      supabase.from('estimate_sections').update({ sort_order: sortOrder }).eq('id', id)
    )
  );
}

export async function reorderLineItems(updates: { id: string; sortOrder: number }[]): Promise<void> {
  const supabase = await createClient();
  await Promise.all(
    updates.map(({ id, sortOrder }) =>
      supabase.from('estimate_line_items').update({ sort_order: sortOrder }).eq('id', id)
    )
  );
}
