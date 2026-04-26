'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import Anthropic from '@anthropic-ai/sdk';
import type { DocumentBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources';

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
}>) {
  const supabase = await createClient();
  const { error } = await supabase.from('estimates').update(data).eq('id', id);
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
      name: `${source.name} (copy)`,
      room_space: source.room_space,
      fb_minimum: source.fb_minimum,
      is_venue_taxable: source.is_venue_taxable,
      service_charge_override: source.service_charge_override,
      gratuity_override: source.gratuity_override,
      admin_fee_override: source.admin_fee_override,
      include_in_budget: source.include_in_budget,
      sort_order: count ?? 0,
    })
    .select('id')
    .single();
  if (newErr) return { error: newErr.message, id: null };

  // Copy line items
  if (lineItems && lineItems.length > 0) {
    const { error: copyErr } = await supabase.from('estimate_line_items').insert(
      lineItems.map(({ id: _id, estimate_id: _eid, created_at: _ca, updated_at: _ua, ...rest }) => ({
        ...rest,
        estimate_id: newEstimate.id,
      }))
    );
    if (copyErr) return { error: copyErr.message, id: null };
  }

  revalidatePath(`/programs/${programId}`);
  return { error: null, id: newEstimate.id as string };
}

export async function reorderEstimates(programId: string, updates: { id: string; sort_order: number }[]) {
  const supabase = await createClient();
  await Promise.all(
    updates.map(({ id, sort_order }) =>
      supabase.from('estimates').update({ sort_order }).eq('id', id)
    )
  );
  revalidatePath(`/programs/${programId}`);
  return { error: null };
}

// ─── Line Items ──────────────────────────────────────────

export async function upsertLineItem(data: {
  id?: string;
  estimate_id: string;
  section: string;
  name: string;
  qty: number;
  unit_price: number;
  category_id: string | null;
  tax_type: string;
  custom_client_unit_price?: number | null;
  markup_override?: number | null;
  sort_order: number;
}) {
  const supabase = await createClient();

  if (data.id) {
    const { error } = await supabase
      .from('estimate_line_items')
      .update({
        section: data.section,
        name: data.name,
        qty: data.qty,
        unit_price: data.unit_price,
        category_id: data.category_id,
        tax_type: data.tax_type,
        custom_client_unit_price: data.custom_client_unit_price ?? null,
        markup_override: data.markup_override ?? null,
        sort_order: data.sort_order,
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
        name: data.name,
        qty: data.qty,
        unit_price: data.unit_price,
        category_id: data.category_id,
        tax_type: data.tax_type,
        custom_client_unit_price: data.custom_client_unit_price ?? null,
        markup_override: data.markup_override ?? null,
        sort_order: data.sort_order,
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

export interface ExtractedMenuItem {
  name: string;
  description?: string;
  pricePerPerson: number;
  category: 'food' | 'alcohol' | 'na_beverage';
}

export interface ExtractedEquipmentItem {
  name: string;
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

export interface ExtractedData {
  menuItems: ExtractedMenuItem[];
  equipmentItems: ExtractedEquipmentItem[];
  venueFees: ExtractedVenueFee[];
  venueName?: string;
  roomSpace?: string;
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
}

const ACCEPTED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function uploadAttachment(formData: FormData): Promise<{ error: string | null; record: AttachmentRecord | null }> {
  const file = formData.get('file') as File | null;
  const estimateId = formData.get('estimateId') as string | null;

  if (!file || !estimateId) return { error: 'Missing file or estimateId', record: null };
  if (file.size > MAX_FILE_SIZE) return { error: 'File exceeds 10 MB limit', record: null };
  if (!ACCEPTED_MIME_TYPES.has(file.type)) return { error: 'File type not allowed', record: null };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const ext = file.name.split('.').pop() ?? '';
  const storagePath = `${estimateId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from('estimate-attachments')
    .upload(storagePath, buffer, { contentType: file.type });

  if (uploadError) return { error: uploadError.message, record: null };

  const { data: record, error: dbError } = await supabase
    .from('estimate_attachments')
    .insert({
      estimate_id: estimateId,
      file_name: file.name,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user?.id ?? null,
    })
    .select('id, estimate_id, file_name, storage_path, file_size, mime_type, created_at, extracted_data')
    .single();

  if (dbError) {
    await supabase.storage.from('estimate-attachments').remove([storagePath]);
    return { error: dbError.message, record: null };
  }

  const { data: signedData } = await supabase.storage
    .from('estimate-attachments')
    .createSignedUrl(storagePath, 3600);

  return {
    error: null,
    record: { ...record, url: signedData?.signedUrl ?? '' },
  };
}

export async function getAttachmentsForEstimate(estimateId: string): Promise<{ error: string | null; records: AttachmentRecord[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimate_attachments')
    .select('id, estimate_id, file_name, storage_path, file_size, mime_type, created_at, extracted_data')
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

export async function deleteAttachment(id: string, storagePath: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  await supabase.storage.from('estimate-attachments').remove([storagePath]);

  const { error } = await supabase.from('estimate_attachments').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

function getExtractionPrompt(type: 'venue' | 'av' | 'decor'): string {
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
      'decorItems (array: name, description, unitPrice, qty, section: florals|rentals|lighting|signage|delivery) ' +
      'where florals=flowers/plants/arrangements, rentals=furniture/chairs/tables/linens, ' +
      'lighting=uplighting/pin spots/candles, signage=printed/custom signage, delivery=setup/strike/delivery fees. ' +
      'No markdown, no explanation — raw JSON only.'
    );
  }
  return (
    'Extract all menu items, prices, equipment, staffing, and fees from this BEO or venue proposal. ' +
    'Also extract any venue fees mentioned (service charge, gratuity, admin fee, F&B minimum, room rental), ' +
    'plus the venue name and room/space name if present. ' +
    'Return ONLY valid JSON with these fields: ' +
    'venueName (string, optional), roomSpace (string, optional), ' +
    'menuItems (array: name, description, pricePerPerson, category: food|alcohol|na_beverage), ' +
    'equipmentItems (array: name, description, unitPrice, qty, section: equipment|venue_fee|staffing) ' +
    'where equipment=AV/lighting/tech rentals, venue_fee=room rental/facility charges, staffing=banquet staff/setup labor, ' +
    'venueFees (array: name, value, type: percentage|flat). ' +
    'No markdown, no explanation — raw JSON only.'
  );
}

export async function extractAttachmentData(
  attachmentId: string,
  estimateType: 'venue' | 'av' | 'decor' = 'venue',
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
      max_tokens: 4096,
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
  } catch {
    return { error: 'Could not parse extraction response', data: null };
  }

  await supabase
    .from('estimate_attachments')
    .update({ extracted_data: extracted })
    .eq('id', attachmentId);

  return { error: null, data: extracted };
}

// ─── Copy Items From Estimate ─────────────────────────────

export async function getLineItemsForEstimate(estimateId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimate_line_items')
    .select('id, section, name, qty, unit_price, category_id, tax_type, custom_client_unit_price, markup_override, sort_order')
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

export async function getTemplates(): Promise<{ error: string | null; templates: DbTemplate[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('line_item_templates')
    .select('id, name, category_id, default_unit_price, tax_type, created_by, category_markups(name, markup_pct)')
    .order('name');
  if (error) return { error: error.message, templates: [] };
  return {
    error: null,
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
  const { error } = await supabase.from('line_item_templates').delete().eq('id', id);
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
    .select('id, estimate_id, section, name, qty, unit_price, category_id, tax_type, custom_client_unit_price, markup_override, sort_order')
    .in('estimate_id', estimateIds)
    .order('sort_order');
  if (liErr) return { error: liErr.message, data: null };

  const byEstimate = (estimates ?? []).map((est) => ({
    estimate: est,
    lineItems: (lineItems ?? []).filter((li) => li.estimate_id === est.id),
  }));

  return { error: null, data: byEstimate };
}
