'use client';

import { useEffect, useState } from 'react';
import {
  type BudgetLine,
  type BudgetMember,
  type BudgetMode,
  type BudgetTier,
  lineMode,
  memberContribution,
  computeLineTotals,
  resolveLineGuests,
} from '@/lib/budget/budgetDocument';

const MODE_OPTIONS: { value: BudgetMode; label: string }[] = [
  { value: 'add_up', label: 'Add up' },
  { value: 'pick_one', label: 'Pick one' },
  { value: 'tiers', label: 'Low/Mid/High' },
];

const TIER_ORDER: Record<BudgetTier, number> = { low: 0, mid: 1, high: 2 };
const TIER_LABEL: Record<BudgetTier, string> = { low: 'Low', mid: 'Mid', high: 'High' };

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

interface Props {
  line: BudgetLine;
  fallbackGuestCount: number;
  selected: boolean;
  onToggleSelect: (lineId: string) => void;
  // local + persisted patches
  patchLine: (lineId: string, patch: Partial<BudgetLine>, persist: boolean) => void;
  patchMember: (memberId: string, patch: Partial<BudgetMember>, persist: boolean) => void;
  setMode: (lineId: string, mode: BudgetMode) => void;
  addMember: (lineId: string) => void;
  deleteMember: (memberId: string) => void;
  deleteLine: (lineId: string) => void;
  breakOut: (lineId: string) => void;
  busy: boolean;
}

export default function BudgetLineRow({
  line, fallbackGuestCount, selected, onToggleSelect,
  patchLine, patchMember, setMode, addMember, deleteMember, deleteLine, breakOut, busy,
}: Props) {
  const mode = lineMode(line);
  const guests = resolveLineGuests(line, fallbackGuestCount);
  const totals = computeLineTotals(line, fallbackGuestCount);

  // In tiers mode show exactly the Low/Mid/High slots (extras with no tier are hidden here
  // but preserved in data — they reappear in Add up / Pick one).
  const members = mode === 'tiers'
    ? [...line.members].filter((m) => m.tier).sort((a, b) => (TIER_ORDER[a.tier!] ?? 9) - (TIER_ORDER[b.tier!] ?? 9))
    : line.members;

  return (
    <div className={`border rounded-lg p-3 ${line.isIncluded ? 'border-brand-cream bg-white' : 'border-brand-cream/60 bg-brand-offwhite/50 opacity-70'}`}>
      {/* Header row: select, name, include, delete */}
      <div className="flex items-center gap-2 mb-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(line.id)}
          title="Select for combine"
          className="accent-brand-copper cursor-pointer flex-shrink-0"
        />
        <input
          type="text"
          value={line.name}
          placeholder="Line name"
          onChange={(e) => patchLine(line.id, { name: e.target.value }, false)}
          onBlur={(e) => patchLine(line.id, { name: e.target.value }, true)}
          className="flex-1 min-w-0 border border-brand-cream rounded px-2 py-1 text-sm font-medium text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
        />
        <label className="flex items-center gap-1 text-xs text-brand-silver flex-shrink-0 cursor-pointer" title="Counts toward the total">
          <input
            type="checkbox"
            checked={line.isIncluded}
            onChange={(e) => patchLine(line.id, { isIncluded: e.target.checked }, true)}
            className="accent-brand-copper cursor-pointer"
          />
          Counts
        </label>
        <button
          onClick={() => deleteLine(line.id)}
          disabled={busy}
          className="text-brand-silver/50 hover:text-red-500 text-lg leading-none px-1 flex-shrink-0"
          title="Delete line"
        >
          ×
        </button>
      </div>

      {/* Controls: mode, pp + guest count */}
      <div className="flex items-center gap-3 flex-wrap mb-2 pl-6">
        <div className="inline-flex rounded-md border border-brand-cream overflow-hidden">
          {MODE_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => mode !== o.value && setMode(line.id, o.value)}
              disabled={busy}
              className={`text-xs px-2.5 py-1 transition-colors ${
                mode === o.value ? 'bg-brand-copper text-white font-medium' : 'bg-white text-brand-silver hover:text-brand-charcoal'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1 text-xs text-brand-silver cursor-pointer">
          <input
            type="checkbox"
            checked={line.isPerPerson}
            onChange={(e) => patchLine(line.id, { isPerPerson: e.target.checked }, true)}
            className="accent-brand-copper cursor-pointer"
          />
          Per person
        </label>

        {line.isPerPerson && (
          <div className="flex items-center gap-1 text-xs text-brand-silver">
            <span>×</span>
            <input
              type="number"
              min="0"
              value={line.guestCount ?? ''}
              placeholder={String(fallbackGuestCount)}
              onChange={(e) => patchLine(line.id, { guestCount: e.target.value === '' ? null : parseInt(e.target.value) || 0 }, false)}
              onBlur={(e) => patchLine(line.id, { guestCount: e.target.value === '' ? null : parseInt(e.target.value) || 0 }, true)}
              className="w-16 border border-brand-cream rounded px-1.5 py-0.5 text-right focus:outline-none focus:ring-1 focus:ring-brand-copper"
            />
            <span>guests</span>
          </div>
        )}

        {line.members.length > 1 && mode === 'add_up' && (
          <button onClick={() => breakOut(line.id)} disabled={busy} className="text-xs text-brand-brown hover:underline">
            Break out
          </button>
        )}
      </div>

      {/* Members */}
      <div className="space-y-1.5 pl-6">
        {members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            line={line}
            mode={mode}
            guests={guests}
            isSelected={line.selectedMemberId === m.id || (line.aggregation === 'select_one' && line.selectedMemberId == null && line.members[0]?.id === m.id)}
            canDelete={line.members.length > 1}
            onSelect={() => patchLine(line.id, { selectedMemberId: m.id }, true)}
            patchMember={patchMember}
            deleteMember={deleteMember}
            busy={busy}
          />
        ))}
        {mode !== 'tiers' && (
          <button onClick={() => addMember(line.id)} disabled={busy} className="text-xs text-brand-silver hover:text-brand-charcoal">
            + Add {mode === 'add_up' ? 'item' : 'option'}
          </button>
        )}
      </div>

      {/* Line total */}
      <div className="flex justify-end items-baseline gap-3 mt-2 pt-2 border-t border-brand-cream/60 text-sm">
        {mode === 'tiers' && (
          <span className="text-xs text-brand-silver">range {fmtMoney(totals.low)}–{fmtMoney(totals.high)}</span>
        )}
        <span className="text-brand-silver text-xs uppercase tracking-wide">Counts</span>
        <span className="font-semibold text-brand-charcoal tabular-nums">{fmtMoney(totals.selected)}</span>
      </div>
    </div>
  );
}

// ── Member row ──────────────────────────────────────────────────────────────

function MemberRow({
  member, line, mode, guests, isSelected, canDelete, onSelect, patchMember, deleteMember, busy,
}: {
  member: BudgetMember;
  line: BudgetLine;
  mode: BudgetMode;
  guests: number;
  isSelected: boolean;
  canDelete: boolean;
  onSelect: () => void;
  patchMember: (memberId: string, patch: Partial<BudgetMember>, persist: boolean) => void;
  deleteMember: (memberId: string) => void;
  busy: boolean;
}) {
  const derived = line.isPerPerson ? member.derivedPp : member.derivedValue;
  const overridden = member.overrideValue != null;
  const [draft, setDraft] = useState<string>(overridden ? String(member.overrideValue) : '');
  // Re-sync the input when the server value changes (e.g. after a structural refresh).
  useEffect(() => {
    setDraft(member.overrideValue != null ? String(member.overrideValue) : '');
  }, [member.overrideValue]);
  const contribution = memberContribution(member, line.isPerPerson, guests);

  function commit(raw: string) {
    const trimmed = raw.trim();
    const next = trimmed === '' ? null : (parseFloat(trimmed.replace(/[^0-9.]/g, '')) || 0);
    patchMember(member.id, { overrideValue: next }, true);
  }

  return (
    <div className={`flex items-center gap-2 ${mode !== 'add_up' && !isSelected ? 'opacity-50' : ''}`}>
      {/* Selector dot for pick-one / tiers — clicking selects which value counts */}
      {mode !== 'add_up' && (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={isSelected}
          title={isSelected ? 'This value counts toward the total' : 'Click to count this value toward the total'}
          className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
            isSelected ? 'bg-brand-copper border-brand-copper' : 'border-brand-silver/50 hover:border-brand-copper bg-white'
          }`}
        />
      )}

      {/* Tier badge */}
      {mode === 'tiers' && member.tier && (
        <span className="text-[10px] uppercase tracking-widest w-9 text-brand-brown font-medium flex-shrink-0">
          {TIER_LABEL[member.tier]}
        </span>
      )}

      {/* Label (qualitative — e.g. "5-piece", "Design 1") */}
      <input
        type="text"
        value={member.label ?? ''}
        placeholder={mode === 'add_up' ? 'item label' : 'option label'}
        onChange={(e) => patchMember(member.id, { label: e.target.value }, false)}
        onBlur={(e) => patchMember(member.id, { label: e.target.value || null }, true)}
        className="flex-1 min-w-0 border border-brand-cream/70 rounded px-2 py-0.5 text-xs text-brand-charcoal/80 focus:outline-none focus:ring-1 focus:ring-brand-copper/50"
      />

      {/* Value: override input with derived ghost */}
      <div className="relative flex-shrink-0">
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-brand-silver pointer-events-none">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          placeholder={derived ? derived.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0'}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          className={`w-24 border rounded pl-4 pr-1.5 py-0.5 text-xs text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-brand-copper ${
            overridden ? 'border-yellow-300 bg-yellow-50' : 'border-brand-cream'
          }`}
          title={member.sourceRemoved ? 'Source estimate removed — using last value' : `from estimate: ${fmtRate(derived, line.isPerPerson)}`}
        />
        {line.isPerPerson && <span className="absolute -right-5 top-1/2 -translate-y-1/2 text-[10px] text-brand-silver">/pp</span>}
      </div>

      {/* Badges + reset + delete */}
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
        {overridden && (
          <button
            onClick={() => { setDraft(''); patchMember(member.id, { overrideValue: null }, true); }}
            className="text-[10px] text-brand-brown hover:underline"
            title="Reset to the value derived from the estimate"
          >
            edited · reset
          </button>
        )}
        {member.sourceRemoved && (
          <span className="text-[10px] text-amber-600" title="The source estimate was deleted">source removed</span>
        )}
        {line.isPerPerson && (
          <span className="text-[10px] text-brand-silver/70 tabular-nums w-16 text-right" title="rate × guests">= {fmtMoney(contribution)}</span>
        )}
        {canDelete && (
          <button onClick={() => deleteMember(member.id)} disabled={busy} className="text-brand-silver/40 hover:text-red-500 text-sm leading-none" title="Remove">
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function fmtRate(n: number, pp: boolean): string {
  const s = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  return pp ? `${s}/pp` : s;
}
