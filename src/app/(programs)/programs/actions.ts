'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import Anthropic from '@anthropic-ai/sdk';
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
}>) {
  const supabase = await createClient();
  const { error } = await supabase.from('programs').update(data).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${id}`);
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

export async function deleteProgram(programId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('programs').delete().eq('id', programId);
  if (error) return { error: error.message };
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

export async function uploadProgramAttachment(
  formData: FormData,
  extractedData?: ExtractedProgramBrief,
): Promise<{ error: string | null; record: ProgramAttachmentRecord | null }> {
  const file = formData.get('file') as File | null;
  const programId = formData.get('programId') as string | null;

  if (!file || !programId) return { error: 'Missing file or programId', record: null };
  if (file.size > 10 * 1024 * 1024) return { error: 'File exceeds 10 MB limit', record: null };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const ext = file.name.split('.').pop() ?? '';
  const storagePath = `programs/${programId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from('estimate-attachments')
    .upload(storagePath, buffer, { contentType: file.type });

  if (uploadError) return { error: uploadError.message, record: null };

  const { data: record, error: dbError } = await supabase
    .from('program_attachments')
    .insert({
      program_id: programId,
      file_name: file.name,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user?.id ?? null,
      extracted_data: extractedData ?? null,
    })
    .select('id, program_id, file_name, storage_path, file_size, mime_type, created_at, extracted_data')
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
    record: {
      ...record,
      url: signedData?.signedUrl ?? '',
      extracted_data: (record.extracted_data as ExtractedProgramBrief | null) ?? null,
    },
  };
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

