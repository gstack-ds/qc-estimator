import { createClient } from '@supabase/supabase-js';
import type { ParsedLead } from './types';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

function toDisplayName(email: string): string {
  const prefix = email.split('@')[0];
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

async function resolveOwnerDisplayName(suggestedName: string | null): Promise<string | null> {
  if (!suggestedName) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error || !data?.users?.length) return suggestedName;
  const target = suggestedName.toLowerCase();
  for (const user of data.users) {
    const name: string = user.user_metadata?.full_name ||
      (user.email ? toDisplayName(user.email) : '');
    if (!name) continue;
    const nameLower = name.toLowerCase();
    if (nameLower === target || nameLower.startsWith(target + ' ') || nameLower.startsWith(target)) {
      return name;
    }
  }
  return suggestedName;
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

  const resolvedOwner = await resolveOwnerDisplayName(input.suggestedOwner);

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
