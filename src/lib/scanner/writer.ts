import { createClient } from '@supabase/supabase-js';
import type { ParsedLead } from './types';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

async function resolveOwnerTeamMemberId(suggestedName: string | null): Promise<number | null> {
  if (!suggestedName) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('team_members')
    .select('id, first_name')
    .eq('is_active', true);
  if (error || !data) return null;
  const target = suggestedName.toLowerCase();
  const match = data.find((m: { id: number; first_name: string }) =>
    m.first_name.toLowerCase() === target,
  );
  return match?.id ?? null;
}

export interface WriteLeadInput {
  lead: ParsedLead;
  messageId: string;
  emailLink: string;
  subject: string;
  receivedAt: Date;
  suggestedOwner: string | null;
  batchId: string;
  parseMethod: 'claude' | 'regex';
  parseWarnings: string[];
}

export type WriteLeadResult =
  | { id: string }           // inserted
  | { skipped: string }      // intentional dedup skip
  | null;                    // insert error

export async function writeLead(input: WriteLeadInput): Promise<WriteLeadResult> {
  const supabase = getSupabase();

  // Dedup by client_name + start_date before inserting
  if (input.lead.client_name && input.lead.start_date) {
    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('client_name', input.lead.client_name)
      .eq('start_date', input.lead.start_date);
    if ((count ?? 0) > 0) {
      const reason = `duplicate client_name+start_date: ${input.lead.client_name} / ${input.lead.start_date}`;
      console.log(`[writer] Skipping — ${reason}`);
      return { skipped: reason };
    }
  }

  const resolvedOwner = await resolveOwnerTeamMemberId(input.suggestedOwner);

  const row = {
    ...input.lead,
    original_email_link: input.emailLink,
    suggested_owner: input.suggestedOwner,
    assigned_to: resolvedOwner,
    scan_batch_id: input.batchId,
    parsed_by: input.parseMethod,
    status: 'new_lead',
  };

  const { data, error } = await supabase
    .from('leads')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error('[writer] Failed to insert lead:', error.message, { messageId: input.messageId });
    return null;
  }

  return { id: data.id };
}

export async function leadAlreadyExists(emailLink: string): Promise<boolean> {
  const supabase = getSupabase();
  const { count } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('original_email_link', emailLink);
  return (count ?? 0) > 0;
}
