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

// Garbage-collect a client row that no longer has ANY referrer. Call AFTER the lead/program
// has been deleted, passing the deleted record's client_id. Deletes the client ONLY when zero
// leads AND zero programs still point at it — so deleting one half of a shared lead+program
// deal leaves the client intact for the surviving half.
//
// Best-effort + fail-safe: if either reference count can't be confirmed (query error), the
// client is KEPT (we never delete on uncertainty), and a clients-delete error is swallowed so
// it can't block the caller's lead/program deletion.
export async function deleteClientIfOrphaned(
  supabase: SupabaseClient,
  clientId: string | null | undefined,
): Promise<void> {
  if (!clientId) return;
  const leadRes = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId);
  const programRes = await supabase
    .from('programs')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId);
  // Can't confirm it's truly unreferenced → keep it (safer to leave an orphan than to delete a
  // client a lead/program still needs).
  if (leadRes.error || programRes.error) return;
  if ((leadRes.count ?? 0) === 0 && (programRes.count ?? 0) === 0) {
    await supabase.from('clients').delete().eq('id', clientId);
  }
}
