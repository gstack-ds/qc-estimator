'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { DbBudgetPlanEntry } from '@/lib/supabase/queries';
import {
  addBudgetEntry,
  updateBudgetEntry,
  deleteBudgetEntry,
} from '@/app/(programs)/programs/actions';
import { calculateBudgetRollup } from '@/lib/engine/budgetPlan';

interface EstimateOption { id: string; name: string; type: string }
interface EventOption   { id: string; name: string }

interface Props {
  programId: string;
  initialEntries: DbBudgetPlanEntry[];
  estimates: EstimateOption[];
  events: EventOption[];
  programGuestCount: number;
  /** Map of estimate_id → total client cost (engine-computed). Used for rollup. */
  estimateTotals?: Record<string, number>;
}

// ─── Blank form state ──────────────────────────────────────

function blankPerEvent(): Partial<DbBudgetPlanEntry> {
  return {
    entry_type: 'per_event', label: '', pricing_basis: 'per_person',
    value_low: 0, value_high: 0, guest_low: null, guest_high: null,
    pinned_value: null, linked_estimate_id: null, linked_event_id: null, notes: null,
  };
}

function blankPooled(): Partial<DbBudgetPlanEntry> {
  return {
    entry_type: 'pooled', label: '', pool_total: 0,
    linked_estimate_id: null, linked_event_id: null, notes: null,
  };
}

// ─── Helpers ──────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return '$' + Math.round(n).toLocaleString();
}

function rangeLabel(e: DbBudgetPlanEntry): string {
  if (e.entry_type === 'pooled') return fmt(e.pool_total) + ' pool';
  const basis = e.pricing_basis === 'per_person' ? '/pp' : ' flat';
  if (e.value_low === e.value_high) return fmt(e.value_low) + basis;
  return `${fmt(e.value_low)}–${fmt(e.value_high)}${basis}`;
}

// ─── Row edit form ─────────────────────────────────────────

interface RowFormProps {
  form: Partial<DbBudgetPlanEntry>;
  onChange: (patch: Partial<DbBudgetPlanEntry>) => void;
  estimates: EstimateOption[];
  events: EventOption[];
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

function EntryForm({ form, onChange, estimates, events, onSave, onCancel, saving }: RowFormProps) {
  const set = (patch: Partial<DbBudgetPlanEntry>) => onChange({ ...form, ...patch });
  const isPooled = form.entry_type === 'pooled';

  return (
    <div className="bg-brand-offwhite border border-brand-cream rounded-lg p-4 space-y-3 text-sm">
      {/* Label */}
      <div className="flex gap-3 items-center">
        <label className="w-28 shrink-0 text-xs text-brand-silver">Label</label>
        <input
          className="flex-1 border border-brand-cream rounded px-2 py-1 bg-white focus:outline-none focus:border-brand-copper text-sm"
          placeholder={isPooled ? 'e.g. AV & Décor Pool' : 'e.g. Emerging Leaders Dinner'}
          value={form.label ?? ''}
          onChange={(e) => set({ label: e.target.value })}
        />
      </div>

      {/* Link estimate */}
      <div className="flex gap-3 items-center">
        <label className="w-28 shrink-0 text-xs text-brand-silver">Link estimate</label>
        <select
          className="flex-1 border border-brand-cream rounded px-2 py-1 bg-white focus:outline-none focus:border-brand-copper text-sm"
          value={form.linked_estimate_id ?? ''}
          onChange={(e) => set({ linked_estimate_id: e.target.value || null })}
        >
          <option value="">— none / needs estimate —</option>
          {estimates.map((est) => (
            <option key={est.id} value={est.id}>{est.name} ({est.type})</option>
          ))}
        </select>
      </div>

      {/* Link event (optional) */}
      {events.length > 0 && (
        <div className="flex gap-3 items-center">
          <label className="w-28 shrink-0 text-xs text-brand-silver">Link event</label>
          <select
            className="flex-1 border border-brand-cream rounded px-2 py-1 bg-white focus:outline-none focus:border-brand-copper text-sm"
            value={form.linked_event_id ?? ''}
            onChange={(e) => set({ linked_event_id: e.target.value || null })}
          >
            <option value="">— none —</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>
      )}

      {isPooled ? (
        /* Pooled: single pool total */
        <div className="flex gap-3 items-center">
          <label className="w-28 shrink-0 text-xs text-brand-silver">Pool total ($)</label>
          <input
            type="number" min="0" step="100"
            className="w-36 border border-brand-cream rounded px-2 py-1 bg-white focus:outline-none focus:border-brand-copper text-sm"
            value={form.pool_total ?? ''}
            onChange={(e) => set({ pool_total: parseFloat(e.target.value) || 0 })}
          />
        </div>
      ) : (
        /* Per-event: pricing basis + value range + guest range */
        <>
          <div className="flex gap-3 items-center">
            <label className="w-28 shrink-0 text-xs text-brand-silver">Pricing basis</label>
            <div className="flex gap-3">
              {(['per_person', 'flat'] as const).map((b) => (
                <label key={b} className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input
                    type="radio" name="pricing_basis" value={b}
                    checked={form.pricing_basis === b}
                    onChange={() => set({ pricing_basis: b })}
                  />
                  {b === 'per_person' ? 'Per person' : 'Flat total'}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 items-center flex-wrap">
            <label className="w-28 shrink-0 text-xs text-brand-silver">
              {form.pricing_basis === 'per_person' ? '$/pp' : '$ flat'} range
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" step="1"
                placeholder="Low"
                className="w-24 border border-brand-cream rounded px-2 py-1 bg-white focus:outline-none focus:border-brand-copper text-sm"
                value={form.value_low ?? ''}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  set({ value_low: v, value_high: Math.max(form.value_high ?? 0, v) });
                }}
              />
              <span className="text-brand-silver text-xs">to</span>
              <input
                type="number" min="0" step="1"
                placeholder="High"
                className="w-24 border border-brand-cream rounded px-2 py-1 bg-white focus:outline-none focus:border-brand-copper text-sm"
                value={form.value_high ?? ''}
                onChange={(e) => set({ value_high: parseFloat(e.target.value) || 0 })}
              />
              <span className="text-xs text-brand-silver">(same = single value)</span>
            </div>
          </div>

          {form.pricing_basis === 'per_person' && (
            <div className="flex gap-3 items-center flex-wrap">
              <label className="w-28 shrink-0 text-xs text-brand-silver">Guest range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="0" step="1"
                  placeholder="Low"
                  className="w-20 border border-brand-cream rounded px-2 py-1 bg-white focus:outline-none focus:border-brand-copper text-sm"
                  value={form.guest_low ?? ''}
                  onChange={(e) => set({ guest_low: parseInt(e.target.value) || null })}
                />
                <span className="text-brand-silver text-xs">to</span>
                <input
                  type="number" min="0" step="1"
                  placeholder="High"
                  className="w-20 border border-brand-cream rounded px-2 py-1 bg-white focus:outline-none focus:border-brand-copper text-sm"
                  value={form.guest_high ?? ''}
                  onChange={(e) => set({ guest_high: parseInt(e.target.value) || null })}
                />
                <span className="text-xs text-brand-silver">(blank = use program count)</span>
              </div>
            </div>
          )}

          <div className="flex gap-3 items-center">
            <label className="w-28 shrink-0 text-xs text-brand-silver">Working target</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" step="1"
                placeholder="Midpoint by default"
                className="w-32 border border-brand-cream rounded px-2 py-1 bg-white focus:outline-none focus:border-brand-copper text-sm"
                value={form.pinned_value ?? ''}
                onChange={(e) => set({ pinned_value: parseFloat(e.target.value) || null })}
              />
              <span className="text-xs text-brand-silver">
                {form.pinned_value == null && form.value_low != null && form.value_high != null && form.value_low + form.value_high > 0
                  ? `(midpoint: ${((form.value_low + form.value_high) / 2).toFixed(0)})`
                  : ''}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Notes */}
      <div className="flex gap-3 items-start">
        <label className="w-28 shrink-0 text-xs text-brand-silver pt-1">Notes</label>
        <textarea
          rows={2}
          className="flex-1 border border-brand-cream rounded px-2 py-1 bg-white focus:outline-none focus:border-brand-copper text-sm resize-none"
          placeholder="Optional notes"
          value={form.notes ?? ''}
          onChange={(e) => set({ notes: e.target.value || null })}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button" onClick={onSave} disabled={saving}
          className="bg-brand-copper text-white text-xs px-4 py-1.5 rounded hover:bg-brand-copper/90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button" onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded border border-brand-cream text-brand-silver hover:text-brand-charcoal"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────

export default function BudgetPlanSection({ programId, initialEntries, estimates, events, programGuestCount, estimateTotals = {} }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [entries, setEntries] = useState<DbBudgetPlanEntry[]>(initialEntries);
  const [addingType, setAddingType] = useState<'per_event' | 'pooled' | null>(null);
  const [addForm, setAddForm] = useState<Partial<DbBudgetPlanEntry>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DbBudgetPlanEntry>>({});
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const rollup = useMemo(
    () => calculateBudgetRollup(entries, estimateTotals, programGuestCount),
    [entries, estimateTotals, programGuestCount]
  );

  function startAdd(type: 'per_event' | 'pooled') {
    setAddingType(type);
    setAddForm(type === 'per_event' ? blankPerEvent() : blankPooled());
    setEditingId(null);
  }

  function startEdit(entry: DbBudgetPlanEntry) {
    setEditingId(entry.id);
    setEditForm({ ...entry });
    setAddingType(null);
  }

  async function handleAdd() {
    setSaving(true);
    const { id: newId, error } = await addBudgetEntry(programId, {
      entry_type: addForm.entry_type ?? 'per_event',
      label: addForm.label ?? '',
      linked_estimate_id: addForm.linked_estimate_id ?? null,
      linked_event_id: addForm.linked_event_id ?? null,
      pricing_basis: addForm.pricing_basis ?? 'per_person',
      value_low: addForm.value_low ?? 0,
      value_high: addForm.value_high ?? 0,
      guest_low: addForm.guest_low ?? null,
      guest_high: addForm.guest_high ?? null,
      pinned_value: addForm.pinned_value ?? null,
      pool_total: addForm.pool_total ?? null,
      sort_order: entries.length,
      notes: addForm.notes ?? null,
    });
    setSaving(false);
    if (!error && newId) {
      const now = new Date().toISOString();
      setEntries((prev) => [...prev, {
        id: newId,
        program_id: programId,
        entry_type: addForm.entry_type ?? 'per_event',
        label: addForm.label ?? '',
        linked_estimate_id: addForm.linked_estimate_id ?? null,
        linked_event_id: addForm.linked_event_id ?? null,
        pricing_basis: addForm.pricing_basis ?? 'per_person',
        value_low: addForm.value_low ?? 0,
        value_high: addForm.value_high ?? 0,
        guest_low: addForm.guest_low ?? null,
        guest_high: addForm.guest_high ?? null,
        pinned_value: addForm.pinned_value ?? null,
        pool_total: addForm.pool_total ?? null,
        sort_order: prev.length,
        notes: addForm.notes ?? null,
        comparison_mode: 'compare_each',
        created_at: now,
        updated_at: now,
      } satisfies DbBudgetPlanEntry]);
      setAddingType(null);
      setAddForm({});
    }
  }

  async function handleEdit() {
    if (!editingId) return;
    setSaving(true);
    const { error } = await updateBudgetEntry(editingId, programId, {
      label: editForm.label,
      linked_estimate_id: editForm.linked_estimate_id,
      linked_event_id: editForm.linked_event_id,
      pricing_basis: editForm.pricing_basis,
      value_low: editForm.value_low,
      value_high: editForm.value_high,
      guest_low: editForm.guest_low,
      guest_high: editForm.guest_high,
      pinned_value: editForm.pinned_value,
      pool_total: editForm.pool_total,
      notes: editForm.notes,
    });
    setSaving(false);
    if (!error) {
      setEntries((prev) => prev.map((e) => e.id === editingId ? { ...e, ...editForm } : e));
      setEditingId(null);
      startTransition(() => router.refresh());
    }
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this budget entry?')) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    startTransition(async () => {
      await deleteBudgetEntry(id, programId);
    });
  }

  return (
    <div className="bg-white border border-brand-cream rounded-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-brand-offwhite/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-brand-charcoal text-sm">Budget Plan</span>
          {entries.length > 0 && (
            <span className="text-xs bg-brand-offwhite text-brand-silver rounded-full px-2 py-0.5">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
          )}
        </div>
        <span className="text-brand-silver text-xs">{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <div className="px-6 pb-6 border-t border-brand-cream space-y-3 pt-4">
          {/* Entry list */}
          {entries.length === 0 && !addingType && (
            <p className="text-sm text-brand-silver">No budget entries yet. Add a per-event target or a shared pool below.</p>
          )}

          {entries.map((entry) => (
            <div key={entry.id}>
              {editingId === entry.id ? (
                <EntryForm
                  form={editForm}
                  onChange={setEditForm}
                  estimates={estimates}
                  events={events}
                  onSave={handleEdit}
                  onCancel={() => setEditingId(null)}
                  saving={saving}
                />
              ) : (
                <div className="flex items-start justify-between gap-4 py-2.5 px-3 rounded-lg hover:bg-brand-offwhite group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-brand-charcoal">
                        {entry.label || <span className="italic text-brand-silver">Untitled</span>}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        entry.entry_type === 'pooled'
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-brand-copper/10 text-brand-copper'
                      }`}>
                        {entry.entry_type === 'pooled' ? 'Pooled' : 'Per Event'}
                      </span>
                      <span className="text-xs text-brand-charcoal/70">{rangeLabel(entry)}</span>
                      {entry.pinned_value != null && entry.entry_type === 'per_event' && (
                        <span className="text-xs text-brand-silver">
                          (working: {fmt(entry.pinned_value)}{entry.pricing_basis === 'per_person' ? '/pp' : ''})
                        </span>
                      )}
                    </div>
                    {entry.linked_estimate_id && (
                      <div className="text-xs text-brand-silver mt-0.5">
                        → {estimates.find((e) => e.id === entry.linked_estimate_id)?.name ?? 'Linked estimate'}
                        {!entry.linked_estimate_id && <span className="text-amber-600"> — needs estimate</span>}
                      </div>
                    )}
                    {!entry.linked_estimate_id && (
                      <div className="text-xs text-amber-600 mt-0.5">Needs estimate</div>
                    )}
                    {entry.notes && (
                      <div className="text-xs text-brand-silver mt-0.5">{entry.notes}</div>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button" onClick={() => startEdit(entry)}
                      className="text-xs text-brand-silver hover:text-brand-charcoal px-2 py-1 rounded hover:bg-brand-cream"
                    >
                      Edit
                    </button>
                    <button
                      type="button" onClick={() => handleDelete(entry.id)}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add form */}
          {addingType && (
            <EntryForm
              form={addForm}
              onChange={setAddForm}
              estimates={estimates}
              events={events}
              onSave={handleAdd}
              onCancel={() => { setAddingType(null); setAddForm({}); }}
              saving={saving}
            />
          )}

          {/* Add buttons */}
          {!addingType && (
            <div className="flex gap-2 pt-1">
              <button
                type="button" onClick={() => startAdd('per_event')}
                className="text-xs border border-brand-copper text-brand-copper rounded px-3 py-1.5 hover:bg-brand-copper hover:text-white transition-colors"
              >
                + Per-Event Target
              </button>
              <button
                type="button" onClick={() => startAdd('pooled')}
                className="text-xs border border-purple-300 text-purple-600 rounded px-3 py-1.5 hover:bg-purple-50 transition-colors"
              >
                + Pooled Budget
              </button>
            </div>
          )}

          {/* Rollup table */}
          {entries.length > 0 && (
            <div className="mt-4 border-t border-brand-cream pt-4">
              <p className="text-xs font-semibold text-brand-charcoal mb-2 uppercase tracking-wide">Budget Rollup</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-brand-silver border-b border-brand-cream">
                      <th className="text-left pb-1.5 font-medium pr-3">Entry</th>
                      <th className="text-right pb-1.5 font-medium pr-3">Low</th>
                      <th className="text-right pb-1.5 font-medium pr-3">High</th>
                      <th className="text-right pb-1.5 font-medium pr-3">Target</th>
                      <th className="text-right pb-1.5 font-medium pr-3">Actual</th>
                      <th className="text-right pb-1.5 font-medium">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rollup.rows.map((row) => (
                      <tr key={row.entryId} className="border-b border-brand-cream/50 hover:bg-brand-offwhite/40">
                        <td className="py-1.5 pr-3 text-brand-charcoal font-medium max-w-[140px] truncate">
                          {row.label || <span className="italic text-brand-silver">Untitled</span>}
                        </td>
                        <td className="py-1.5 pr-3 text-right text-brand-charcoal/70 tabular-nums">{fmt(row.targetLow)}</td>
                        <td className="py-1.5 pr-3 text-right text-brand-charcoal/70 tabular-nums">{fmt(row.targetHigh)}</td>
                        <td className="py-1.5 pr-3 text-right font-medium text-brand-charcoal tabular-nums">{fmt(row.pinnedTarget)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">
                          {row.actualTotal != null ? (
                            <span className="text-brand-charcoal">{fmt(row.actualTotal)}</span>
                          ) : (
                            <span className="text-brand-silver">—</span>
                          )}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {row.variance != null ? (
                            <span className={row.variance > 0 ? 'text-amber-600 font-medium' : row.variance < 0 ? 'text-emerald-600 font-medium' : 'text-brand-silver'}>
                              {row.variance > 0 ? '+' : ''}{fmt(row.variance)}
                            </span>
                          ) : (
                            <span className="text-brand-silver">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-brand-cream font-semibold text-brand-charcoal">
                      <td className="pt-2 pr-3">Total</td>
                      <td className="pt-2 pr-3 text-right tabular-nums">{fmt(rollup.totalLow)}</td>
                      <td className="pt-2 pr-3 text-right tabular-nums">{fmt(rollup.totalHigh)}</td>
                      <td className="pt-2 pr-3 text-right tabular-nums">{fmt(rollup.totalPinnedTarget)}</td>
                      <td className="pt-2 pr-3 text-right tabular-nums">
                        {rollup.totalActual != null ? fmt(rollup.totalActual) : <span className="font-normal text-brand-silver">—</span>}
                      </td>
                      <td className="pt-2 text-right tabular-nums">
                        {rollup.totalActual != null ? (
                          <span className={rollup.totalActual - rollup.totalPinnedTarget > 0 ? 'text-amber-600' : rollup.totalActual - rollup.totalPinnedTarget < 0 ? 'text-emerald-600' : ''}>
                            {rollup.totalActual - rollup.totalPinnedTarget > 0 ? '+' : ''}{fmt(rollup.totalActual - rollup.totalPinnedTarget)}
                          </span>
                        ) : <span className="font-normal text-brand-silver">—</span>}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
