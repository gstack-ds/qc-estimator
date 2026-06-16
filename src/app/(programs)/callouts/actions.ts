'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Re-render both the source program page (card badges/threads) and the dedicated page + nav badge.
function revalidateCallouts(programId?: string) {
  revalidatePath('/callouts');
  if (programId) revalidatePath(`/programs/${programId}`);
}

// Raise a new callout on an estimate. owner defaults to the estimate's assigned_to when not provided.
export async function raiseCallout(input: {
  estimateId: string;
  programId: string;
  eventId: string | null;
  text: string;
  category: string | null;
  createdBy: number | null;
  owner?: number | null;
}): Promise<{ id: string | null; error: string | null }> {
  const text = input.text.trim();
  if (!text) return { id: null, error: 'Callout text is required.' };

  const supabase = await createClient();

  let owner = input.owner ?? null;
  if (input.owner === undefined) {
    const { data: est } = await supabase
      .from('estimates')
      .select('assigned_to')
      .eq('id', input.estimateId)
      .maybeSingle();
    owner = (est?.assigned_to as number | null) ?? null;
  }

  const { data, error } = await supabase
    .from('callouts')
    .insert({
      estimate_id: input.estimateId,
      program_id: input.programId,
      event_id: input.eventId,
      text,
      category: input.category,
      created_by: input.createdBy,
      owner,
      status: 'open',
    })
    .select('id')
    .single();

  if (error) return { id: null, error: error.message };
  revalidateCallouts(input.programId);
  return { id: data.id as string, error: null };
}

export async function addCalloutReply(input: {
  calloutId: string;
  programId: string;
  author: number | null;
  text: string;
}): Promise<{ id: string | null; error: string | null }> {
  const text = input.text.trim();
  if (!text) return { id: null, error: 'Reply text is required.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('callout_replies')
    .insert({ callout_id: input.calloutId, author: input.author, text })
    .select('id')
    .single();

  if (error) return { id: null, error: error.message };
  // Best-effort: bump the parent callout's updated_at so "recently active" ordering reflects the
  // reply. The reply already succeeded; a failure here (e.g. callout deleted) is intentionally ignored.
  await supabase
    .from('callouts')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.calloutId)
    .then(() => {}, () => {});
  revalidateCallouts(input.programId);
  return { id: data.id as string, error: null };
}

export async function resolveCallout(
  calloutId: string,
  programId: string,
  resolvedBy: number | null,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('callouts')
    .update({ status: 'resolved', resolved_by: resolvedBy, resolved_at: new Date().toISOString() })
    .eq('id', calloutId);
  if (error) return { error: error.message };
  revalidateCallouts(programId);
  return { error: null };
}

export async function reopenCallout(
  calloutId: string,
  programId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('callouts')
    .update({ status: 'open', resolved_by: null, resolved_at: null })
    .eq('id', calloutId);
  if (error) return { error: error.message };
  revalidateCallouts(programId);
  return { error: null };
}

// Update the category tag on an existing callout (inline single-select on the thread).
export async function updateCalloutCategory(
  calloutId: string,
  programId: string,
  category: string | null,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from('callouts').update({ category }).eq('id', calloutId);
  if (error) return { error: error.message };
  revalidateCallouts(programId);
  return { error: null };
}
