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
    email_message_id: input.messageId,
    email_link: input.emailLink,
    email_subject: input.subject,
    received_at: input.receivedAt.toISOString(),
    suggested_owner: input.suggestedOwner,
    assigned_to: input.suggestedOwner,
    scan_batch_id: input.batchId,
    parse_method: input.parseMethod,
    parse_warnings: input.parseWarnings,
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

export async function leadAlreadyExists(messageId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { count } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('email_message_id', messageId);
  return (count ?? 0) > 0;
}
