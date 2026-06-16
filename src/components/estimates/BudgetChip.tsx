'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateEvent } from '@/app/(programs)/programs/actions';
import type { ResolvedBudget } from '@/lib/budget/resolveBudget';

interface Props {
  programId: string;
  eventId: string | null;
  eventBudgetAmount: number | null;
  eventBudgetBasis: 'overall' | 'per_person' | null;
  resolved: ResolvedBudget;
}

// The Budget value in the estimate snapshot bar. Shows the unified resolved budget, and—when the
// budget lives on the event (or isn't set yet)—lets the user set/edit it inline. Plan-entry and
// pooled budgets link to the Budget Plan section (that's where they're edited).
export default function BudgetChip({ programId, eventId, eventBudgetAmount, eventBudgetBasis, resolved }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(eventBudgetAmount != null ? String(eventBudgetAmount) : '');
  const [basis, setBasis] = useState<'overall' | 'per_person'>(eventBudgetBasis ?? 'overall');
  const [, startTransition] = useTransition();

  // Editable inline only when the budget is event-level (or unset on an estimate that has an event).
  const inlineEditable = eventId != null && (resolved.source === 'event' || resolved.source === 'none');
  const linkToPlan = resolved.source === 'estimate_entry' || resolved.source === 'event_entry' || resolved.source === 'pooled';

  function save() {
    if (!eventId) return;
    const parsed = amount.trim() === '' ? null : parseFloat(amount);
    const cleanAmount = parsed != null && !isNaN(parsed) && parsed > 0 ? parsed : null;
    startTransition(async () => {
      await updateEvent(eventId, programId, {
        budget_amount: cleanAmount,
        budget_basis: cleanAmount != null ? basis : null,
      });
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <span className="text-brand-silver">$</span>
        <input
          type="number"
          min={0}
          value={amount}
          autoFocus
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          className="w-20 border border-brand-cream rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-copper"
          placeholder="Amount"
        />
        <div className="flex border border-brand-cream rounded overflow-hidden">
          {(['overall', 'per_person'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBasis(b)}
              className={`px-1.5 py-0.5 text-[10px] transition-colors ${basis === b ? 'bg-brand-brown text-white' : 'text-brand-silver hover:text-brand-charcoal'}`}
            >
              {b === 'overall' ? 'Total' : '/pp'}
            </button>
          ))}
        </div>
        <button type="button" onClick={save} className="text-[11px] font-medium text-brand-brown hover:underline">Save</button>
        <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-brand-silver hover:text-brand-charcoal">Cancel</button>
      </span>
    );
  }

  // Plan-entry / pooled → link to the Budget Plan section (edited there).
  if (linkToPlan && resolved.label) {
    return (
      <a href={`/programs/${programId}#budget-plan`} className="font-medium text-brand-brown hover:underline">
        {resolved.label}
      </a>
    );
  }

  // Event-level budget → click to edit inline.
  if (resolved.source === 'event' && resolved.label) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="font-medium text-brand-brown hover:underline" title="Edit event budget">
        {resolved.label}
      </button>
    );
  }

  // No budget set.
  if (inlineEditable) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="font-medium text-brand-copper hover:underline">
        + Set budget
      </button>
    );
  }
  // Unassigned estimate (no event) — can't set an event budget here.
  return <span className="text-brand-silver italic font-normal" title="Assign this estimate to an event to set a budget">No budget set</span>;
}
