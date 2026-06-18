'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  type BudgetDocument,
  type BudgetLine,
  type BudgetMember,
  type BudgetMode,
  computeBudgetTotals,
} from '@/lib/budget/budgetDocument';
import {
  createBudgetDocument,
  updateBudgetLine,
  updateBudgetMember,
  setLineMode,
  addManualLine,
  addManualMember,
  deleteBudgetLine,
  deleteBudgetMember,
  breakOutLine,
  combineLines,
  refreshFromEstimates,
} from '@/app/(programs)/programs/[id]/budget/actions';
import BudgetLineRow from './BudgetLineRow';
import BudgetPreview from './BudgetPreview';

export interface BudgetEventInfo {
  id: string;
  name: string;
  guestCount: number;
}

interface Props {
  programId: string;
  programName: string;
  programGuestCount: number;
  events: BudgetEventInfo[];
  budget: BudgetDocument | null;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

// camelCase line patch → snake_case action payload
function lineDbPatch(patch: Partial<BudgetLine>) {
  const out: Record<string, unknown> = {};
  if ('name' in patch) out.name = patch.name;
  if ('isIncluded' in patch) out.is_included = patch.isIncluded;
  if ('isPerPerson' in patch) out.is_per_person = patch.isPerPerson;
  if ('guestCount' in patch) out.guest_count = patch.guestCount;
  if ('selectedMemberId' in patch) out.selected_member_id = patch.selectedMemberId;
  if ('isOptional' in patch) out.is_optional = patch.isOptional;
  if ('notes' in patch) out.notes = patch.notes;
  return out;
}

export default function BudgetBuilder({ programId, programName, programGuestCount, events, budget }: Props) {
  const router = useRouter();
  const [view, setView] = useState<'build' | 'preview'>('build');
  const [lines, setLines] = useState<BudgetLine[]>(budget?.lines ?? []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  // Re-sync from the server after any structural action (the only thing that ships new props).
  useEffect(() => { setLines(budget?.lines ?? []); }, [budget]);

  const docId = budget?.id ?? null;

  const liveDoc: BudgetDocument | null = useMemo(
    () => (budget ? { ...budget, lines } : null),
    [budget, lines],
  );

  const totals = useMemo(
    () => (liveDoc ? computeBudgetTotals(liveDoc, programGuestCount, programGuestCount) : null),
    [liveDoc, programGuestCount],
  );

  // ── local state helpers ──
  function applyLineLocal(lineId: string, patch: Partial<BudgetLine>) {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)));
  }
  function applyMemberLocal(memberId: string, patch: Partial<BudgetMember>) {
    setLines((prev) => prev.map((l) => ({
      ...l,
      members: l.members.map((m) => (m.id === memberId ? { ...m, ...patch } : m)),
    })));
  }

  function patchLine(lineId: string, patch: Partial<BudgetLine>, persist: boolean) {
    applyLineLocal(lineId, patch);
    if (persist) {
      updateBudgetLine(lineId, programId, lineDbPatch(patch)).then((r) => { if (r.error) setError(r.error); });
    }
  }
  function patchMember(memberId: string, patch: Partial<BudgetMember>, persist: boolean) {
    applyMemberLocal(memberId, patch);
    if (persist) {
      const db: Record<string, unknown> = {};
      if ('overrideValue' in patch) db.override_value = patch.overrideValue;
      if ('label' in patch) db.label = patch.label;
      if ('tier' in patch) db.tier = patch.tier;
      updateBudgetMember(memberId, programId, db).then((r) => { if (r.error) setError(r.error); });
    }
  }

  // ── structural ops: run action, then refresh from server ──
  function runStructural(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) { setError(r.error); return; }
      router.refresh();
    });
  }

  function handleSetMode(lineId: string, mode: BudgetMode) { runStructural(() => setLineMode(lineId, programId, mode)); }
  function handleAddMember(lineId: string) { runStructural(() => addManualMember(lineId, programId)); }
  function handleDeleteMember(memberId: string) { runStructural(() => deleteBudgetMember(memberId, programId)); }
  function handleDeleteLine(lineId: string) {
    if (!confirm('Delete this budget line?')) return;
    runStructural(() => deleteBudgetLine(lineId, programId));
  }
  function handleBreakOut(lineId: string) { runStructural(() => breakOutLine(lineId, programId)); }
  function handleAddLine(eventId: string | null) {
    if (!docId) return;
    runStructural(() => addManualLine(docId, programId, eventId));
  }
  function handleCombine() {
    if (!docId || selected.size < 2) return;
    const ids = [...selected];
    runStructural(async () => { const r = await combineLines(programId, docId, ids); setSelected(new Set()); return r; });
  }
  function handleRefresh() {
    if (!docId) return;
    runStructural(() => refreshFromEstimates(docId, programId));
  }

  function toggleSelect(lineId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId); else next.add(lineId);
      return next;
    });
  }

  // ── Empty state: no budget yet ──
  if (!budget) {
    return (
      <div className="text-center py-16 border border-dashed border-brand-cream rounded-xl bg-brand-offwhite/40">
        <p className="text-brand-charcoal font-medium">No budget yet</p>
        <p className="text-sm text-brand-silver mt-1 mb-5 max-w-md mx-auto">
          Build a client budget from this program’s estimates — one line per estimate, grouped by event. You can combine, set ranges, and override from there.
        </p>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button
          onClick={() => runStructural(() => createBudgetDocument(programId))}
          disabled={busy}
          className="bg-brand-brown text-white text-sm px-5 py-2 rounded-md hover:bg-brand-brown/90 disabled:opacity-50"
        >
          {busy ? 'Building…' : 'Build budget from estimates'}
        </button>
      </div>
    );
  }

  // group lines by event (event order from props), unassigned last
  const linesByEvent = new Map<string, BudgetLine[]>();
  const unassigned: BudgetLine[] = [];
  for (const l of lines) {
    if (l.eventId && events.some((e) => e.id === l.eventId)) {
      (linesByEvent.get(l.eventId) ?? linesByEvent.set(l.eventId, []).get(l.eventId)!).push(l);
    } else {
      unassigned.push(l);
    }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-md border border-brand-cream overflow-hidden">
          {(['build', 'preview'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-sm px-4 py-1.5 capitalize transition-colors ${view === v ? 'bg-brand-charcoal text-white font-medium' : 'bg-white text-brand-silver hover:text-brand-charcoal'}`}
            >
              {v}
            </button>
          ))}
        </div>
        {view === 'build' && (
          <div className="flex items-center gap-2">
            <button onClick={handleRefresh} disabled={busy} className="text-sm text-brand-brown hover:underline disabled:opacity-50">
              Refresh from estimates
            </button>
          </div>
        )}
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

      {/* Headline totals */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-brand-cream border border-brand-cream rounded-lg overflow-hidden">
          {[
            { label: 'Selected', value: fmtMoney(totals.selected) },
            { label: `Per person (${programGuestCount})`, value: fmtMoney(totals.perPerson) },
            { label: 'Low range', value: fmtMoney(totals.low) },
            { label: 'High range', value: fmtMoney(totals.high) },
          ].map((c) => (
            <div key={c.label} className="bg-white px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-brand-silver">{c.label}</div>
              <div className="text-xl font-serif text-brand-charcoal mt-0.5">{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {view === 'preview' ? (
        <BudgetPreview
          programName={programName}
          programGuestCount={programGuestCount}
          events={events}
          lines={lines}
          disclaimers={budget.disclaimers}
        />
      ) : (
        <>
          {/* Combine action bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 bg-brand-charcoal text-white rounded-lg px-4 py-2 text-sm sticky top-2 z-10">
              <span>{selected.size} selected</span>
              <button onClick={handleCombine} disabled={busy || selected.size < 2} className="bg-white/15 hover:bg-white/25 rounded px-3 py-1 disabled:opacity-50">
                Combine into one line
              </button>
              <button onClick={() => setSelected(new Set())} className="text-white/70 hover:text-white ml-auto">Clear</button>
            </div>
          )}

          {/* Event groups */}
          {events.map((ev) => {
            const evLines = linesByEvent.get(ev.id) ?? [];
            return (
              <BudgetEventGroup
                key={ev.id}
                title={ev.name}
                subtitle={`${ev.guestCount} guests`}
                subtotal={totals?.byEvent[ev.id]?.selected ?? 0}
                lines={evLines}
                fallbackGuestCount={programGuestCount}
                selected={selected}
                onToggleSelect={toggleSelect}
                patchLine={patchLine}
                patchMember={patchMember}
                setMode={handleSetMode}
                addMember={handleAddMember}
                deleteMember={handleDeleteMember}
                deleteLine={handleDeleteLine}
                breakOut={handleBreakOut}
                onAddLine={() => handleAddLine(ev.id)}
                busy={busy}
              />
            );
          })}

          {unassigned.length > 0 && (
            <BudgetEventGroup
              title="Unassigned"
              subtitle="not linked to an event"
              subtotal={totals?.byEvent['__none__']?.selected ?? 0}
              lines={unassigned}
              fallbackGuestCount={programGuestCount}
              selected={selected}
              onToggleSelect={toggleSelect}
              patchLine={patchLine}
              patchMember={patchMember}
              setMode={handleSetMode}
              addMember={handleAddMember}
              deleteMember={handleDeleteMember}
              deleteLine={handleDeleteLine}
              breakOut={handleBreakOut}
              onAddLine={() => handleAddLine(null)}
              busy={busy}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Event group ──────────────────────────────────────────────────────────────

function BudgetEventGroup({
  title, subtitle, subtotal, lines, fallbackGuestCount, selected, onToggleSelect,
  patchLine, patchMember, setMode, addMember, deleteMember, deleteLine, breakOut, onAddLine, busy,
}: {
  title: string;
  subtitle: string;
  subtotal: number;
  lines: BudgetLine[];
  fallbackGuestCount: number;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  patchLine: (lineId: string, patch: Partial<BudgetLine>, persist: boolean) => void;
  patchMember: (memberId: string, patch: Partial<BudgetMember>, persist: boolean) => void;
  setMode: (lineId: string, mode: BudgetMode) => void;
  addMember: (lineId: string) => void;
  deleteMember: (memberId: string) => void;
  deleteLine: (lineId: string) => void;
  breakOut: (lineId: string) => void;
  onAddLine: () => void;
  busy: boolean;
}) {
  return (
    <div className="border border-brand-cream rounded-xl overflow-hidden">
      <div className="flex items-center justify-between bg-brand-charcoal px-4 py-2.5">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-brand-camel">{subtitle}</div>
          <div className="text-sm font-serif text-white">{title}</div>
        </div>
        <div className="text-sm text-white tabular-nums">{fmtMoney(subtotal)}</div>
      </div>
      <div className="p-3 space-y-2 bg-brand-offwhite/30">
        {lines.length === 0 && <p className="text-xs text-brand-silver italic px-1 py-2">No lines in this event.</p>}
        {lines.map((line) => (
          <BudgetLineRow
            key={line.id}
            line={line}
            fallbackGuestCount={fallbackGuestCount}
            selected={selected.has(line.id)}
            onToggleSelect={onToggleSelect}
            patchLine={patchLine}
            patchMember={patchMember}
            setMode={setMode}
            addMember={addMember}
            deleteMember={deleteMember}
            deleteLine={deleteLine}
            breakOut={breakOut}
            busy={busy}
          />
        ))}
        <button onClick={onAddLine} disabled={busy} className="text-xs text-brand-brown hover:underline pt-1">
          + Add line
        </button>
      </div>
    </div>
  );
}
