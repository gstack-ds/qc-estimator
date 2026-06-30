// Async client-row write helpers for the clients normalize (Phase 2A).
// Each helper takes the supabase client as an arg so BOTH the app (session client via
// @/lib/supabase/server) and the scanner (service-role client via @supabase/supabase-js)
// can call them — same pattern as the MCP server. No next/headers import → scanner-safe.
//
// All helpers are best-effort: on a clients-table error they return null so the caller
// still creates its lead/program (client_id just stays null). Phase 2A is additive — a
// clients-table hiccup must never block lead/program creation.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  clientRowFromLead,
  clientRowFromProgram,
  type LeadClientSource,
  type ProgramClientSource,
} from './clientFields';

export async function createClientFromLead(
  supabase: SupabaseClient,
  lead: LeadClientSource,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('clients')
    .insert(clientRowFromLead(lead))
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id as string;
}

export async function createClientFromProgram(
  supabase: SupabaseClient,
  program: ProgramClientSource,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('clients')
    .insert(clientRowFromProgram(program))
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id as string;
}

// The client_id a converted program should SHARE with its lead. Reuses the lead's
// existing client_id (the normal Phase-2A path); if the lead predates the write path and
// has none, creates one from the lead, stamps it on the lead, and returns it. This is the
// mechanism behind "the deal becomes ONE client once converted" — program + lead point at
// the same clients row, never two.
export async function ensureLeadClientId(
  supabase: SupabaseClient,
  lead: LeadClientSource & { id: string; client_id?: string | null },
): Promise<string | null> {
  if (lead.client_id) return lead.client_id;
  const clientId = await createClientFromLead(supabase, lead);
  if (!clientId) return null;
  // If we can't stamp the new client_id onto the lead, return null so the program ALSO
  // gets null — both sides stay consistent rather than splitting (lead null, program set).
  const { error } = await supabase.from('leads').update({ client_id: clientId }).eq('id', lead.id);
  if (error) return null;
  return clientId;
}
