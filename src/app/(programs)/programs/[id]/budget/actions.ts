'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  getProgram,
  getEstimatesForProgram,
  getLineItemsForEstimates,
  getMarkups,
  getTransportAggregatesForProgram,
  getBudgetForProgram,
} from '@/lib/supabase/queries';
import { buildBudgetProgramConfig, deriveEstimateValue } from '@/lib/budget/deriveEstimates';
import { assignTiersByRank, type BudgetMode, modeToToggles, type BudgetMember } from '@/lib/budget/budgetDocument';

function revalidate(programId: string) {
  revalidatePath(`/programs/${programId}/budget`);
}

// ── Derive every estimate's client value for a program ───────────────────────
interface DerivedEstimate {
  id: string;
  name: string;
  eventId: string | null;
  total: number;
  pricePerPerson: number;
}

async function deriveAllEstimateValues(programId: string): Promise<DerivedEstimate[]> {
  const [program, estimates, markups, transportAggs] = await Promise.all([
    getProgram(programId),
    getEstimatesForProgram(programId),
    getMarkups(),
    getTransportAggregatesForProgram(programId),
  ]);
  if (!program) return [];
  const items = await getLineItemsForEstimates(estimates.map((e) => e.id));
  const config = buildBudgetProgramConfig(program, program.location);

  return estimates.map((est) => {
    const estItems = items.filter((li) => li.estimate_id === est.id);
    const agg = transportAggs.find((a) => a.estimate_id === est.id);
    const { total, pricePerPerson } = deriveEstimateValue(est, estItems, markups, config, agg);
    return { id: est.id, name: est.name, eventId: est.event_id, total, pricePerPerson };
  });
}

// ── Create + seed (one line per estimate, grouped by event) ──────────────────
export async function createBudgetDocument(programId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  // Don't duplicate — a program has at most one budget in Phase 1.
  const existing = await getBudgetForProgram(programId);
  if (existing) { revalidate(programId); return {}; }

  const program = await getProgram(programId);
  const derived = await deriveAllEstimateValues(programId);

  const { data: doc, error: docErr } = await supabase
    .from('budget_documents')
    .insert({ program_id: programId, title: program?.name ?? null, status: 'draft' })
    .select('id')
    .single();
  if (docErr || !doc) return { error: docErr?.message ?? 'Could not create budget.' };

  for (let i = 0; i < derived.length; i++) {
    const d = derived[i];
    const { data: line, error: lineErr } = await supabase
      .from('budget_lines')
      .insert({
        budget_document_id: doc.id,
        event_id: d.eventId,
        name: d.name,
        aggregation: 'sum',
        tiered: false,
        is_per_person: false,
        sort_order: i,
      })
      .select('id')
      .single();
    if (lineErr || !line) return { error: lineErr?.message ?? 'Could not seed budget lines.' };

    const { error: memErr } = await supabase.from('budget_line_members').insert({
      budget_line_id: line.id,
      source_estimate_id: d.id,
      derived_value: d.total,
      derived_pp: d.pricePerPerson,
      sort_order: 0,
    });
    if (memErr) return { error: memErr.message };
  }

  revalidate(programId);
  return {};
}

// ── Line field updates ───────────────────────────────────────────────────────
type LinePatch = Partial<{
  name: string;
  is_per_person: boolean;
  guest_count: number | null;
  is_optional: boolean;
  is_included: boolean;
  selected_member_id: string | null;
  notes: string | null;
}>;

export async function updateBudgetLine(lineId: string, programId: string, patch: LinePatch): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('budget_lines')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', lineId);
  if (error) return { error: error.message };
  revalidate(programId);
  return {};
}

// ── Mode switch (handles tier assignment atomically) ─────────────────────────
export async function setLineMode(lineId: string, programId: string, mode: BudgetMode): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { aggregation, tiered } = modeToToggles(mode);

  const { data: lineRow } = await supabase
    .from('budget_lines')
    .select('is_per_person')
    .eq('id', lineId)
    .single();
  const isPerPerson = lineRow?.is_per_person ?? false;

  const { data: memberRows } = await supabase
    .from('budget_line_members')
    .select('id, tier, derived_value, derived_pp, override_value, sort_order')
    .eq('budget_line_id', lineId)
    .order('sort_order');

  // Map snake_case rows → the BudgetMember shape the pure engine expects.
  const members: BudgetMember[] = (memberRows ?? []).map((r) => ({
    id: r.id as string,
    sourceEstimateId: null,
    tier: r.tier as BudgetMember['tier'],
    label: null,
    derivedValue: Number(r.derived_value),
    derivedPp: Number(r.derived_pp),
    overrideValue: r.override_value == null ? null : Number(r.override_value),
    sourceRemoved: false,
    rank: 0,
    sortOrder: r.sort_order as number,
  }));

  let selectedMemberId: string | null = null;

  if (mode === 'tiers') {
    const tiers = assignTiersByRank(members, isPerPerson);
    const tierById = new Map(tiers.map((t) => [t.id, t.tier]));
    for (const m of members) {
      await supabase.from('budget_line_members').update({ tier: tierById.get(m.id) ?? null }).eq('id', m.id);
    }
    // Default the selected tier to mid (else low).
    selectedMemberId = tiers.find((t) => t.tier === 'mid')?.id ?? tiers.find((t) => t.tier === 'low')?.id ?? null;
  } else {
    // add_up or pick_one — clear tier assignments.
    for (const m of members) {
      if (m.tier !== null) await supabase.from('budget_line_members').update({ tier: null }).eq('id', m.id);
    }
    selectedMemberId = mode === 'pick_one' ? (members[0]?.id ?? null) : null;
  }

  const { error } = await supabase
    .from('budget_lines')
    .update({ aggregation, tiered, selected_member_id: selectedMemberId, updated_at: new Date().toISOString() })
    .eq('id', lineId);
  if (error) return { error: error.message };
  revalidate(programId);
  return {};
}

// ── Member updates ───────────────────────────────────────────────────────────
export async function updateBudgetMember(
  memberId: string,
  programId: string,
  patch: Partial<{ override_value: number | null; label: string | null; tier: 'low' | 'mid' | 'high' | null }>,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('budget_line_members').update(patch).eq('id', memberId);
  if (error) return { error: error.message };
  revalidate(programId);
  return {};
}

// ── Add / delete manual lines & members ──────────────────────────────────────
export async function addManualLine(documentId: string, programId: string, eventId: string | null): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: line, error } = await supabase
    .from('budget_lines')
    .insert({ budget_document_id: documentId, event_id: eventId, name: '', aggregation: 'sum', sort_order: 9999 })
    .select('id')
    .single();
  if (error || !line) return { error: error?.message ?? 'Could not add line.' };
  const { error: memErr } = await supabase
    .from('budget_line_members')
    .insert({ budget_line_id: line.id, source_estimate_id: null, derived_value: 0, derived_pp: 0, sort_order: 0 });
  if (memErr) return { error: memErr.message };
  revalidate(programId);
  return {};
}

export async function addManualMember(lineId: string, programId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('budget_line_members').select('sort_order').eq('budget_line_id', lineId).order('sort_order', { ascending: false }).limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;
  const { error } = await supabase
    .from('budget_line_members')
    .insert({ budget_line_id: lineId, source_estimate_id: null, derived_value: 0, derived_pp: 0, sort_order: nextOrder });
  if (error) return { error: error.message };
  revalidate(programId);
  return {};
}

export async function deleteBudgetLine(lineId: string, programId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('budget_lines').delete().eq('id', lineId);
  if (error) return { error: error.message };
  revalidate(programId);
  return {};
}

export async function deleteBudgetMember(memberId: string, programId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('budget_line_members').delete().eq('id', memberId);
  if (error) return { error: error.message };
  revalidate(programId);
  return {};
}

// ── Combine / break out ──────────────────────────────────────────────────────
export async function combineLines(programId: string, documentId: string, lineIds: string[]): Promise<{ error?: string }> {
  if (lineIds.length < 2) return { error: 'Select at least two lines to combine.' };
  const supabase = await createClient();

  const { data: lines } = await supabase
    .from('budget_lines')
    .select('id, event_id, name, sort_order')
    .eq('budget_document_id', documentId) // scope to this budget — never touch another program's lines
    .in('id', lineIds)
    .order('sort_order');
  if (!lines || lines.length !== lineIds.length) return { error: 'Lines not found for this budget.' };

  const first = lines[0];
  const { data: target, error: tErr } = await supabase
    .from('budget_lines')
    .insert({ budget_document_id: documentId, event_id: first.event_id, name: first.name || 'Combined', aggregation: 'sum', sort_order: first.sort_order })
    .select('id')
    .single();
  if (tErr || !target) return { error: tErr?.message ?? 'Could not combine.' };

  // Move every member of the selected lines onto the new combined line, then delete originals.
  const { error: moveErr } = await supabase
    .from('budget_line_members')
    .update({ budget_line_id: target.id, tier: null })
    .in('budget_line_id', lineIds);
  if (moveErr) return { error: moveErr.message };

  const { error: delErr } = await supabase.from('budget_lines').delete().in('id', lineIds);
  if (delErr) return { error: delErr.message };

  revalidate(programId);
  return {};
}

export async function breakOutLine(lineId: string, programId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: line } = await supabase
    .from('budget_lines').select('id, budget_document_id, event_id, sort_order').eq('id', lineId).single();
  if (!line) return { error: 'Line not found.' };
  const { data: members } = await supabase
    .from('budget_line_members')
    .select('id, source_estimate_id, label, derived_value, derived_pp, override_value, source_removed')
    .eq('budget_line_id', lineId)
    .order('sort_order');
  if (!members || members.length < 2) return { error: 'Nothing to break out — line has one member.' };

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const { data: newLine, error: lErr } = await supabase
      .from('budget_lines')
      .insert({
        budget_document_id: line.budget_document_id,
        event_id: line.event_id,
        name: m.label || '',
        aggregation: 'sum',
        sort_order: line.sort_order + i,
      })
      .select('id')
      .single();
    if (lErr || !newLine) return { error: lErr?.message ?? 'Could not break out.' };
    const { error: mErr } = await supabase.from('budget_line_members').update({ budget_line_id: newLine.id, tier: null }).eq('id', m.id);
    if (mErr) return { error: mErr.message };
  }

  const { error: delErr } = await supabase.from('budget_lines').delete().eq('id', lineId);
  if (delErr) return { error: delErr.message };
  revalidate(programId);
  return {};
}

// ── Refresh from estimates (re-derive values; keep overrides; add new estimates) ──
export async function refreshFromEstimates(documentId: string, programId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const [budget, derived] = await Promise.all([
    getBudgetForProgram(programId),
    deriveAllEstimateValues(programId),
  ]);
  if (!budget) return { error: 'No budget found.' };

  const byEstimate = new Map(derived.map((d) => [d.id, d]));
  const representedEstimateIds = new Set<string>();

  // Re-derive existing members (NOT overrides); flag removed sources.
  for (const line of budget.lines) {
    for (const m of line.members) {
      if (!m.sourceEstimateId) continue;
      representedEstimateIds.add(m.sourceEstimateId);
      const d = byEstimate.get(m.sourceEstimateId);
      if (d) {
        await supabase
          .from('budget_line_members')
          .update({ derived_value: d.total, derived_pp: d.pricePerPerson, source_removed: false })
          .eq('id', m.id);
      } else if (!m.sourceRemoved) {
        await supabase.from('budget_line_members').update({ source_removed: true }).eq('id', m.id);
      }
    }
  }

  // Append estimates not yet represented as new lines.
  let nextOrder = budget.lines.reduce((max, l) => Math.max(max, l.sortOrder), 0) + 1;
  for (const d of derived) {
    if (representedEstimateIds.has(d.id)) continue;
    const { data: line, error: lErr } = await supabase
      .from('budget_lines')
      .insert({ budget_document_id: documentId, event_id: d.eventId, name: d.name, aggregation: 'sum', sort_order: nextOrder++ })
      .select('id')
      .single();
    if (lErr || !line) return { error: lErr?.message ?? 'Could not add new estimate.' };
    const { error: mErr } = await supabase
      .from('budget_line_members')
      .insert({ budget_line_id: line.id, source_estimate_id: d.id, derived_value: d.total, derived_pp: d.pricePerPerson, sort_order: 0 });
    if (mErr) return { error: mErr.message };
  }

  revalidate(programId);
  return {};
}
