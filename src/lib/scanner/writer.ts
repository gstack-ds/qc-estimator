import { createClient } from '@supabase/supabase-js';
import type { ParsedLead } from './types';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
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

export async function writeLead(input: WriteLeadInput): Promise<{ id: string } | null> {
  const supabase = getSupabase();

  const row = {
    ...input.lead,
    original_email_link: input.emailLink,
    suggested_owner: input.suggestedOwner,
    assigned_to: input.suggestedOwner,
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
