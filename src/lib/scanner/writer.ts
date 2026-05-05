import { createClient } from '@supabase/supabase-js';
import type { ParsedLead } from './types';

// ─── Dropdown normalization ────────────────────────────────

const GDP_ADVISORS = ['Shelley', 'Riley', 'Chris', 'Benoit', 'Dawn', 'Maxine'];
const GDP_COORDINATORS = ['Amy', 'Maria', 'Jessica', 'Michelle', 'Maxime'];
const THIRD_PARTY_OPTIONS = [
  'American Express', 'MMS', 'Ashfield', 'Bishop McCann', 'Bond Brand Loyalty',
  'Carrousel Travel', 'C2 Events Ltd', 'ConferenceDirect', 'CWT', 'Emota', 'EEG',
  'Sutton Planning', 'The Turner Agency', 'YES', 'MGME', 'Rubra', 'Meet Events',
  'FIRST Agency', 'Marbet', 'DMI', 'World Travel Inc', 'Strategic Site Selection',
  'Pure Event Management', 'Event Strategy Group',
];
const LEAD_SOURCE_OPTIONS = ['GDP', 'Direct', 'Rubra', 'Conference', 'Sales Coordinator'];

function matchOption(raw: string | null | undefined, options: string[]): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  const exact = options.find((o) => o.toLowerCase() === lower);
  if (exact) return exact;
  // First token match — handles "Shelley Smith" → "Shelley"
  const firstToken = lower.split(/\s+/)[0];
  const byToken = options.find((o) => o.toLowerCase() === firstToken);
  if (byToken) return byToken;
  // Substring match in either direction
  const partial = options.find((o) => lower.includes(o.toLowerCase()) || o.toLowerCase().includes(lower));
  return partial ?? null;
}

function normalizeLeadSource(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (lower.includes('gdp') || lower.includes('global')) return 'GDP';
  if (lower.includes('direct')) return 'Direct';
  if (lower.includes('rubra')) return 'Rubra';
  if (lower.includes('conference')) return 'Conference';
  if (lower.includes('sales coordinator') || lower.includes('sales coord')) return 'Sales Coordinator';
  return matchOption(raw, LEAD_SOURCE_OPTIONS);
}

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
    // Map ParsedLead field names → migration 020 column names, normalized to dropdown values
    gdp_advisor:     matchOption(input.lead.source_advisor, GDP_ADVISORS),
    gdp_coordinator: matchOption(input.lead.source_coordinator, GDP_COORDINATORS),
    third_party:     matchOption(input.lead.third_party_company, THIRD_PARTY_OPTIONS),
    lead_source_type: normalizeLeadSource(input.lead.lead_source),
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
