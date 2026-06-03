'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import Anthropic from '@anthropic-ai/sdk';
import type { ProgramStatus } from '@/lib/programs/constants';
import type { DocumentBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources';

// ─── Programs ────────────────────────────────────────────

export async function createProgram(data: {
  name: string;
  client_name?: string | null;
  event_date?: string | null;
  guest_count?: number;
  service_style?: string | null;
  alcohol_type?: string | null;
  event_time?: string | null;
  event_start_time?: string | null;
  event_end_time?: string | null;
  company_name?: string | null;
  client_hotel?: string | null;
  location_id?: string | null;
  cc_processing_fee?: number;
  client_commission?: number;
  gdp_commission_enabled?: boolean;
  service_charge_default?: number;
  gratuity_default?: number;
  admin_fee_default?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: program, error } = await supabase
    .from('programs')
    .insert({ ...data, created_by: user?.id })
    .select('id')
    .single();

  if (error) return { error: error.message, id: null };
  revalidatePath('/programs');
  return { error: null, id: program.id as string };
}

export async function updateProgram(id: string, data: Partial<{
  name: string;
  client_name: string | null;
  event_date: string | null;
  guest_count: number;
  service_style: string | null;
  alcohol_type: string | null;
  event_time: string | null;
  event_start_time: string | null;
  event_end_time: string | null;
  company_name: string | null;
  client_hotel: string | null;
  location_id: string | null;
  cc_processing_fee: number;
  client_commission: number;
  gdp_commission_enabled: boolean;
  gdp_commission_rate: number;
  service_charge_default: number;
  gratuity_default: number;
  admin_fee_default: number;
  include_travel_in_production_fee: boolean;
}>) {
  const supabase = await createClient();
  const { error } = await supabase.from('programs').update(data).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${id}`);
  return { error: null };
}

// ─── Program documents ────────────────────────────────────

import type { DocumentCategory } from '@/lib/programs/documentTypes';

export async function registerProgramDocument(data: {
  programId: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: DocumentCategory;
  notes?: string | null;
}): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: doc, error } = await supabase
    .from('program_documents')
    .insert({
      program_id: data.programId,
      file_name: data.fileName,
      storage_path: data.storagePath,
      file_size: data.fileSize,
      mime_type: data.mimeType,
      category: data.category,
      notes: data.notes ?? null,
      uploaded_by: user?.id ?? null,
    })
    .select('id')
    .single();
  if (error) return { id: null, error: error.message };
  revalidatePath(`/programs/${data.programId}`);
  return { id: doc.id as string, error: null };
}

export async function updateProgramDocument(
  id: string,
  programId: string,
  data: Partial<{ category: DocumentCategory; notes: string | null }>,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('program_documents')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${programId}`);
  return { error: null };
}

export async function deleteProgramDocument(
  id: string,
  programId: string,
  storagePath: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  await supabase.storage.from('estimate-attachments').remove([storagePath]);
  const { error } = await supabase.from('program_documents').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${programId}`);
  return { error: null };
}

// ─── Onsite Brief ─────────────────────────────────────────

export async function generateOnsiteBrief(
  programId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // ── 1. Load all program data ──────────────────────────────
  const [programData, estimates, events, travelItems, documents] = await Promise.all([
    supabase.from('programs').select(`
      id, name, client_name, company_name, event_date, event_start_time, event_end_time,
      guest_count, service_style, alcohol_type, client_hotel,
      cc_processing_fee, client_commission, gdp_commission_enabled, gdp_commission_rate,
      service_charge_default, gratuity_default, admin_fee_default,
      third_party_commissions, include_travel_in_production_fee,
      location:locations(id, name, food_tax_rate, alcohol_tax_rate, general_tax_rate)
    `).eq('id', programId).single(),
    supabase.from('estimates').select('*').eq('program_id', programId).eq('type', 'venue').order('sort_order').limit(1),
    supabase.from('events').select('*').eq('program_id', programId).order('sort_order'),
    supabase.from('program_travel_items').select('*').eq('program_id', programId).order('sort_order'),
    supabase.from('program_documents').select('id, file_name, storage_path, category, mime_type').eq('program_id', programId),
  ]);

  if (programData.error || !programData.data) {
    return { error: programData.error?.message ?? 'Program not found' };
  }

  const program = programData.data as unknown as import('@/lib/supabase/queries').DbProgramWithLocation;
  const venueEstimate = (estimates.data ?? [])[0] as import('@/lib/supabase/queries').DbEstimate | undefined ?? null;
  const eventsList = (events.data ?? []) as import('@/lib/supabase/queries').DbEvent[];
  const travelList = (travelItems.data ?? []) as import('@/lib/supabase/queries').DbTravelItem[];
  const programTravelTotal = travelList.reduce((s, it) => s + it.qty * it.unit_price, 0);

  // ── 2. Load venue + space if linked ──────────────────────
  let venue: import('@/lib/supabase/queries').DbVenue | null = null;
  let venueSpace: import('@/lib/supabase/queries').DbVenueSpace | null = null;
  if (venueEstimate?.venue_id) {
    const vr = await supabase.from('venues').select('*').eq('id', venueEstimate.venue_id).maybeSingle();
    if (vr.data) venue = vr.data as unknown as import('@/lib/supabase/queries').DbVenue;
    if (venueEstimate.venue_space_id) {
      const sr = await supabase.from('venue_spaces').select('*').eq('id', venueEstimate.venue_space_id).maybeSingle();
      if (sr.data) venueSpace = sr.data as unknown as import('@/lib/supabase/queries').DbVenueSpace;
    }
  }

  // ── 3. Run engine for financial summary if we have an estimate ──
  let summary: import('@/types').EstimateSummary | null = null;
  let programConfig: import('@/types').ProgramConfig | null = null;
  if (venueEstimate) {
    const { data: lineItemsData } = await supabase
      .from('estimate_line_items').select('*').eq('estimate_id', venueEstimate.id);
    const { data: markupsData } = await supabase.from('category_markups').select('id, markup_pct');
    const { data: sectionsData } = await supabase
      .from('estimate_sections').select('*').eq('estimate_id', venueEstimate.id);

    if (lineItemsData && markupsData) {
      const loc = program.location as unknown as { id: string; name: string; food_tax_rate: number; alcohol_tax_rate: number; general_tax_rate: number } | null;
      programConfig = {
        guestCount: program.guest_count,
        location: loc ? {
          id: loc.id, name: loc.name,
          foodTaxRate: loc.food_tax_rate,
          alcoholTaxRate: loc.alcohol_tax_rate,
          generalTaxRate: loc.general_tax_rate,
        } : { id: '', name: '', foodTaxRate: 0, alcoholTaxRate: 0, generalTaxRate: 0 },
        ccProcessingFee: program.cc_processing_fee,
        clientCommission: program.client_commission,
        gdpCommissionEnabled: program.gdp_commission_enabled,
        gdpCommissionRate: program.gdp_commission_rate,
        serviceChargeDefault: program.service_charge_default,
        gratuityDefault: program.gratuity_default,
        adminFeeDefault: program.admin_fee_default,
        thirdPartyCommissions: program.third_party_commissions ?? [],
      };

      const sectionNames = new Map((sectionsData ?? []).map(s => [s.id, s.name]));
      const lineItems = lineItemsData.map(li => {
        const markupObj = markupsData.find(m => m.id === li.category_id);
        const effectiveMarkup = li.markup_override ?? markupObj?.markup_pct ?? 0.5;
        const isCustom = li.custom_client_unit_price != null;
        const sectionName = sectionNames.get(li.section_id) ?? li.section ?? 'Other';
        const taxBucket: import('@/types').TaxBucket =
          sectionName.includes('F&B') ? 'fb'
          : sectionName.includes('Venue') ? 'venue'
          : (sectionName.includes('Staff') || sectionName.includes('Non-Tax')) ? 'staffing'
          : 'equipment';
        return {
          id: li.id,
          section: sectionName,
          taxBucket,
          name: li.name,
          qty: li.qty,
          unitPrice: li.unit_price,
          categoryMarkupPct: isCustom ? 0 : effectiveMarkup,
          taxType: li.tax_type as import('@/types').TaxType,
          isRevenueItem: li.is_revenue_item,
          clientCostOverride: isCustom ? li.qty * li.custom_client_unit_price! : undefined,
        };
      });

      const { calculateVenueEstimate } = await import('@/lib/engine/pricing');
      const sc = venueEstimate.service_charge_override ?? program.service_charge_default;
      const gr = venueEstimate.gratuity_override ?? program.gratuity_default;
      const af = venueEstimate.admin_fee_override ?? program.admin_fee_default;
      const discount = venueEstimate.discount_type && venueEstimate.discount_value > 0
        ? { type: venueEstimate.discount_type, value: venueEstimate.discount_value }
        : null;

      summary = calculateVenueEstimate({
        name: venueEstimate.name,
        fbMinimum: venueEstimate.fb_minimum,
        isVenueTaxable: venueEstimate.is_venue_taxable,
        serviceCharge: sc,
        gratuity: gr,
        adminFee: af,
        lineItems,
        discount,
        taxExempt: venueEstimate.tax_exempt,
        travelTotal: programTravelTotal,
        includeTravelInProductionFee: program.include_travel_in_production_fee,
        foodTaxOverride: venueEstimate.food_tax_override,
        alcoholTaxOverride: venueEstimate.alcohol_tax_override,
        generalTaxOverride: venueEstimate.general_tax_override,
      }, programConfig);
    }
  }

  // ── 4. Build structured sections ─────────────────────────
  const { buildStructuredSections } = await import('@/lib/briefs/structured');
  const { emptyBrief } = await import('@/lib/briefs/types');
  const brief = emptyBrief();

  const structured = buildStructuredSections({
    program,
    events: eventsList,
    venueEstimate,
    venue,
    venueSpace,
    summary,
    programConfig,
    travelItems: travelList,
    programTravelTotal,
  });

  // Merge structured sections into brief
  for (const [key, section] of Object.entries(structured)) {
    if (section) {
      (brief as Record<string, unknown>)[key] = section;
    }
  }

  // AI sections get placeholder text until Phase 2 synthesis
  const docList = (documents.data ?? []).map((d: { file_name: string; category: string }) => `• ${d.file_name} (${d.category})`).join('\n');
  const aiPlaceholder = (hint: string) =>
    `[AI DRAFT PENDING]\n${hint}\n\nDocuments available:\n${docList || '(none uploaded yet)'}\n\nTo generate AI content, use the Regenerate button.`;

  if (!brief.menuBar.content) brief.menuBar.content = aiPlaceholder('Menu & bar details — AI will read uploaded menu PDFs');
  if (!brief.dietaryRestrictions.content) brief.dietaryRestrictions.content = aiPlaceholder('Dietary restrictions — AI will cross-reference menu PDFs and estimate notes');
  if (!brief.dayOfLogistics.content) brief.dayOfLogistics.content = aiPlaceholder('Day-of timeline, load-in, contacts — AI will synthesize from emails and documents');
  if (!brief.contractTerms.content) brief.contractTerms.content = aiPlaceholder('Key contract terms — AI will read uploaded contract PDF');
  if (!brief.openItems.content) brief.openItems.content = aiPlaceholder('Open items and TBDs — AI will flag unconfirmed details across all sources');
  if (!brief.summary.content) brief.summary.content = aiPlaceholder('Plain-language summary paragraph for the onsite lead');

  // ── 5. Save to DB ─────────────────────────────────────────
  const { upsertProgramBrief } = await import('@/lib/supabase/queries');
  const { error: saveErr } = await upsertProgramBrief(programId, brief);
  if (saveErr) return { error: saveErr };

  revalidatePath(`/programs/${programId}`);
  revalidatePath(`/programs/${programId}/brief`);
  return { error: null };
}

export async function saveBriefSection(
  programId: string,
  sectionKey: string,
  content: string,
): Promise<{ error: string | null }> {
  const { updateBriefSection } = await import('@/lib/supabase/queries');
  const result = await updateBriefSection(programId, sectionKey, content);
  if (!result.error) revalidatePath(`/programs/${programId}/brief`);
  return result;
}

// ─── Program travel items ─────────────────────────────────

export async function addTravelItem(programId: string): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('program_travel_items')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', programId);
  const { data, error } = await supabase
    .from('program_travel_items')
    .insert({ program_id: programId, description: '', qty: 1, unit_price: 0, sort_order: count ?? 0 })
    .select('id')
    .single();
  if (error) return { id: null, error: error.message };
  revalidatePath(`/programs/${programId}`);
  return { id: data.id as string, error: null };
}

export async function updateTravelItem(
  id: string,
  programId: string,
  data: Partial<{ description: string; qty: number; unit_price: number; sort_order: number }>,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('program_travel_items')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${programId}`);
  return { error: null };
}

export async function deleteTravelItem(id: string, programId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from('program_travel_items').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${programId}`);
  return { error: null };
}

// ─── Estimates ────────────────────────────────────────────

export async function createEstimate(programId: string, type: 'venue' | 'av' | 'decor' | 'transportation' = 'venue', eventId?: string | null) {
  const supabase = await createClient();

  // Count existing estimates to set sort_order
  const { count } = await supabase
    .from('estimates')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', programId);

  const defaultName = type === 'av' ? 'New AV Estimate'
    : type === 'decor' ? 'New Decor Estimate'
    : type === 'transportation' ? 'New Transportation Estimate'
    : 'New Estimate';

  const { data: estimate, error } = await supabase
    .from('estimates')
    .insert({
      program_id: programId,
      event_id: eventId ?? null,
      type,
      name: defaultName,
      fb_minimum: 0,
      is_venue_taxable: type === 'venue',
      ...(type === 'av' || type === 'decor' ? {
        service_charge_override: 0,
        gratuity_override: 0,
        admin_fee_override: 0,
      } : {}),
      ...(type === 'transportation' ? { transport_commission: 0 } : {}),
      sort_order: (count ?? 0),
    })
    .select('id')
    .single();

  if (error) return { error: error.message, id: null };

  // For venue estimates, seed default line items
  if (type === 'venue') {
    // Look up the categories we need
    const { data: markups } = await supabase
      .from('category_markups')
      .select('id, name')
      .in('name', ['Catering & F&B', 'Staffing & Labor']);

    const fbMarkup = markups?.find((m) => m.name === 'Catering & F&B');
    const staffingMarkup = markups?.find((m) => m.name === 'Staffing & Labor');

    // Prefer event guest count so default quantities match the event, not the program
    const guestCount = await (async () => {
      if (eventId) {
        const { data: ev } = await supabase.from('events').select('guest_count').eq('id', eventId).single();
        if (ev && ev.guest_count > 0) return ev.guest_count;
      }
      const { data: prog } = await supabase.from('programs').select('guest_count').eq('id', programId).single();
      return prog?.guest_count ?? 1;
    })();

    const defaultItems = [
      { section: 'F&B', name: 'Per Person Food',  qty: guestCount, unit_price: 0, category_id: fbMarkup?.id ?? null, tax_type: 'food',    sort_order: 0 },
      { section: 'F&B', name: 'Bar Package',       qty: guestCount, unit_price: 0, category_id: fbMarkup?.id ?? null, tax_type: 'alcohol', sort_order: 1 },
      { section: 'F&B', name: 'NA Beverages',      qty: guestCount, unit_price: 0, category_id: fbMarkup?.id ?? null, tax_type: 'food',    sort_order: 2 },
      { section: 'Non-Taxable Staffing', name: 'QC Event Staff', qty: 1, unit_price: 0, category_id: staffingMarkup?.id ?? null, tax_type: 'none', sort_order: 0 },
    ];

    await supabase.from('estimate_line_items').insert(
      defaultItems.map((item) => ({ ...item, estimate_id: estimate.id }))
    );
  }

  revalidatePath(`/programs/${programId}`);
  return { error: null, id: estimate.id as string };
}

export async function updateProgramStatus(id: string, status: ProgramStatus): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const archived_at = (status === 'completed' || status === 'did_not_book')
    ? new Date().toISOString()
    : null;
  const { error } = await supabase.from('programs').update({ status, archived_at }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/programs');
  revalidatePath(`/programs/${id}`);
  return { error: null };
}

export async function deleteProgram(programId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('programs').delete().eq('id', programId);
  if (error) return { error: error.message };
  revalidatePath('/programs');
  return { error: null };
}

export async function fetchProgramsByIds(ids: string[]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('programs')
    .select('id, name, client_name, event_date, guest_count, company_name, client_hotel, location_id, updated_at')
    .in('id', ids);
  if (error) return { error: error.message, programs: null };
  return { error: null, programs: data ?? [] };
}

export async function mergePrograms(
  survivingId: string,
  duplicateIds: string[],
  fieldValues: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  if (Object.keys(fieldValues).length > 0) {
    const { error } = await supabase.from('programs').update(fieldValues).eq('id', survivingId);
    if (error) return { error: error.message };
  }

  // Move estimates and events from duplicates to survivor
  if (duplicateIds.length > 0) {
    const { error: estErr } = await supabase
      .from('estimates')
      .update({ program_id: survivingId })
      .in('program_id', duplicateIds);
    if (estErr) return { error: estErr.message };

    const { error: evtErr } = await supabase
      .from('events')
      .update({ program_id: survivingId })
      .in('program_id', duplicateIds);
    if (evtErr) return { error: evtErr.message };

    const { error: delErr } = await supabase.from('programs').delete().in('id', duplicateIds);
    if (delErr) return { error: delErr.message };
  }

  revalidatePath('/programs');
  return { error: null };
}

// ─── Program Attachments ──────────────────────────────────

export interface ExtractedProgramBrief {
  eventName?: string;
  clientName?: string;
  companyName?: string;
  eventDate?: string;
  guestCount?: number;
  serviceStyle?: string;
  alcoholType?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  clientHotel?: string;
  locationHint?: string;
  venueName?: string;
  roomSpace?: string;
  notes?: string;
}

export interface ProgramAttachmentRecord {
  id: string;
  program_id: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  url: string;
  extracted_data: ExtractedProgramBrief | null;
}

const BRIEF_EXTRACTION_PROMPT =
  'Extract event planning details from this document. ' +
  'Return JSON with fields: eventName (the name or title of the event/program), ' +
  'clientName, companyName, eventDate (YYYY-MM-DD), guestCount, ' +
  'serviceStyle (Plated/Buffet/Family Style/Stations), alcoholType (Full Bar/Beer & Wine/None), ' +
  'eventStartTime (24hr format HH:MM, e.g. "17:00"), eventEndTime (24hr format HH:MM, e.g. "22:00"), ' +
  'clientHotel, locationHint (city and state of the event, e.g. "Charlotte, NC"), ' +
  'venueName, roomSpace, notes. ' +
  'Only include fields you can find — omit any that aren\'t in the document. ' +
  'No markdown, no explanation — raw JSON only.';

export async function extractProgramBrief(
  formData: FormData,
): Promise<{ error: string | null; data: ExtractedProgramBrief | null }> {
  const file = formData.get('file') as File | null;
  if (!file) return { error: 'No file provided', data: null };
  if (file.type !== 'application/pdf') return { error: 'Only PDF files are supported', data: null };
  if (file.size > 10 * 1024 * 1024) return { error: 'File exceeds 10 MB limit', data: null };

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let text: string;
  try {
    const docBlock: DocumentBlockParam = {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    };
    const textBlock: TextBlockParam = { type: 'text', text: BRIEF_EXTRACTION_PROMPT };
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: [docBlock, textBlock] }],
    });
    text = (response.content.find((c) => c.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '';
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'API call failed', data: null };
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch?.[0] ?? text) as ExtractedProgramBrief;
    return { error: null, data };
  } catch {
    return { error: 'Could not parse extraction response', data: null };
  }
}

// Client uploads directly to Storage; this action only inserts the DB row.
export async function registerProgramAttachment(data: {
  programId: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  extractedData?: ExtractedProgramBrief | null;
}): Promise<{ error: string | null; record: ProgramAttachmentRecord | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: record, error: dbError } = await supabase
    .from('program_attachments')
    .insert({
      program_id: data.programId,
      file_name: data.fileName,
      storage_path: data.storagePath,
      file_size: data.fileSize,
      mime_type: data.mimeType,
      uploaded_by: user?.id ?? null,
      extracted_data: data.extractedData ?? null,
    })
    .select('id, program_id, file_name, storage_path, file_size, mime_type, created_at, extracted_data')
    .single();

  if (dbError) return { error: dbError.message, record: null };

  const { data: signedData } = await supabase.storage
    .from('estimate-attachments')
    .createSignedUrl(data.storagePath, 3600);

  return {
    error: null,
    record: {
      ...record,
      url: signedData?.signedUrl ?? '',
      extracted_data: (record.extracted_data as ExtractedProgramBrief | null) ?? null,
    },
  };
}

// Extraction counterpart: downloads from Storage (service role), calls Claude, returns brief.
export async function extractProgramBriefFromPath(
  storagePath: string,
): Promise<{ error: string | null; data: ExtractedProgramBrief | null }> {
  const supabase = await createClient();

  const { data: fileBlob, error: downloadErr } = await supabase.storage
    .from('estimate-attachments')
    .download(storagePath);
  if (downloadErr || !fileBlob) return { error: downloadErr?.message ?? 'Download failed', data: null };

  const base64 = Buffer.from(await fileBlob.arrayBuffer()).toString('base64');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let text: string;
  try {
    const docBlock: DocumentBlockParam = {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    };
    const textBlock: TextBlockParam = { type: 'text', text: BRIEF_EXTRACTION_PROMPT };
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: [docBlock, textBlock] }],
    });
    text = (response.content.find((c) => c.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '';
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'API call failed', data: null };
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch?.[0] ?? text) as ExtractedProgramBrief;
    return { error: null, data };
  } catch {
    return { error: 'Could not parse extraction response', data: null };
  }
}

export async function getProgramAttachments(programId: string): Promise<{ error: string | null; records: ProgramAttachmentRecord[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('program_attachments')
    .select('id, program_id, file_name, storage_path, file_size, mime_type, created_at, extracted_data')
    .eq('program_id', programId)
    .order('created_at', { ascending: false });

  if (error) return { error: error.message, records: [] };

  const records = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: signedData } = await supabase.storage
        .from('estimate-attachments')
        .createSignedUrl(row.storage_path, 3600);
      return {
        ...row,
        url: signedData?.signedUrl ?? '',
        extracted_data: (row.extracted_data as ExtractedProgramBrief | null) ?? null,
      };
    })
  );

  return { error: null, records };
}

export async function deleteProgramAttachment(id: string, storagePath: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  await supabase.storage.from('estimate-attachments').remove([storagePath]);
  const { error } = await supabase.from('program_attachments').delete().eq('id', id);
  if (error) return { error: error.message };
  return { error: null };
}

// ─── Events ───────────────────────────────────────────────

export async function createEvent(programId: string, data: {
  name: string;
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  guest_count: number;
  event_type: string;
  description?: string | null;
  sort_order?: number;
}): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from('events')
    .insert({ program_id: programId, ...data })
    .select('id')
    .single();
  if (error) return { id: null, error: error.message };
  revalidatePath(`/programs/${programId}`);
  return { id: row.id as string, error: null };
}

export async function updateEvent(id: string, programId: string, data: Partial<{
  name: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  guest_count: number;
  event_type: string;
  description: string | null;
  sort_order: number;
}>): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from('events').update(data).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${programId}`);
  return { error: null };
}

export async function deleteEvent(id: string, programId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${programId}`);
  return { error: null };
}

export async function reorderEvents(programId: string, updates: { id: string; sort_order: number }[]): Promise<void> {
  const supabase = await createClient();
  await Promise.all(
    updates.map(({ id, sort_order }) =>
      supabase.from('events').update({ sort_order }).eq('id', id)
    )
  );
  revalidatePath(`/programs/${programId}`);
}

