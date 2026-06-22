'use client';

// Client-capture form on the PUBLIC share page. Lets the client adjust tier per tiered line,
// guest count per per-person line, a target budget per event, and leave notes — then submit a
// version back. It posts ONLY references (line IDs, tier names, counts) to the respond endpoint;
// the server recomputes the authoritative total from the locked snapshot. The live preview here
// reuses validateResponse so it matches the server exactly, but it is UX only.

import { useMemo, useState } from 'react';
import {
  type BudgetShareContract,
} from '@/lib/budget/budgetShareContract';
import {
  type BudgetTier,
  lineMode,
  memberContribution,
  resolveLineGuests,
  selectedMember,
} from '@/lib/budget/budgetDocument';
import {
  validateResponse,
  type RespondPayload,
  GUEST_MIN,
  GUEST_MAX,
  NOTES_MAX,
} from '@/lib/budget/budgetResponse';

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const TIER_ORDER: BudgetTier[] = ['low', 'mid', 'high'];
const TIER_LABEL: Record<BudgetTier, string> = { low: 'Low', mid: 'Mid', high: 'High' };

interface Props {
  contract: BudgetShareContract;
  token: string;
}

export default function BudgetRespondForm({ contract, token }: Props) {
  // Local selection state, seeded from the snapshot's defaults.
  const [tierByLine, setTierByLine] = useState<Record<string, BudgetTier>>(() => {
    const out: Record<string, BudgetTier> = {};
    for (const l of contract.lines) {
      if (lineMode(l) === 'tiers') {
        const sel = selectedMember(l);
        if (sel?.tier) out[l.id] = sel.tier;
      }
    }
    return out;
  });
  const [guestByLine, setGuestByLine] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const l of contract.lines) {
      if (l.isPerPerson) out[l.id] = resolveLineGuests(l, contract.guestCount);
    }
    return out;
  });
  const [targetByEvent, setTargetByEvent] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Build the payload the way we'd submit it (and feed it through the SAME validator for preview).
  const payload: RespondPayload = useMemo(() => {
    const lineSelections: RespondPayload['lineSelections'] = [];
    for (const l of contract.lines) {
      const entry: { lineId: string; tier?: BudgetTier; guestCount?: number } = { lineId: l.id };
      if (tierByLine[l.id]) entry.tier = tierByLine[l.id];
      if (l.isPerPerson && guestByLine[l.id]) entry.guestCount = guestByLine[l.id];
      if (entry.tier !== undefined || entry.guestCount !== undefined) lineSelections.push(entry);
    }
    const categoryTargets: RespondPayload['categoryTargets'] = [];
    for (const [eventId, raw] of Object.entries(targetByEvent)) {
      const amount = parseFloat(raw);
      if (!isNaN(amount) && amount >= 0) categoryTargets.push({ eventId, amount });
    }
    return { lineSelections, categoryTargets, notes };
  }, [contract.lines, tierByLine, guestByLine, targetByEvent, notes]);

  const preview = useMemo(() => validateResponse(contract, payload), [contract, payload]);

  const adjustableLines = contract.lines.filter((l) => l.isIncluded && (lineMode(l) === 'tiers' || l.isPerPerson));

  async function handleSubmit() {
    setStatus('submitting');
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/budget/${encodeURIComponent(token)}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data?.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }
      setStatus('done');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="bg-white border border-brand-cream rounded-xl p-8 max-w-3xl mx-auto mt-6 text-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-brand-brown mb-2">Quill Creative Event Design</div>
        <h2 className="font-serif text-2xl text-brand-charcoal">Thank you — your selections were sent</h2>
        <p className="text-sm text-brand-silver mt-2">
          Your event planner has received your version. You can close this page or submit another update.
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-5 text-sm text-brand-brown hover:underline"
        >
          Make further changes
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-brand-cream rounded-xl p-6 md:p-8 max-w-3xl mx-auto mt-6">
      <div className="border-b border-brand-cream pb-4 mb-5">
        <h2 className="font-serif text-2xl font-light text-brand-charcoal">Customize &amp; send back</h2>
        <p className="text-sm text-brand-silver mt-1">
          Choose your options below and send your version to your event planner. Nothing is final — this just shares your preferences.
        </p>
      </div>

      {adjustableLines.length > 0 && (
        <div className="space-y-5">
          {adjustableLines.map((l) => {
            const guests = guestByLine[l.id] ?? resolveLineGuests(l, contract.guestCount);
            return (
              <div key={l.id} className="border border-brand-cream rounded-lg p-4">
                <div className="font-medium text-brand-charcoal mb-2">{l.name}</div>

                {lineMode(l) === 'tiers' && (
                  <div className="flex flex-wrap gap-2">
                    {TIER_ORDER.map((tier) => {
                      const m = l.members.find((mm) => mm.tier === tier);
                      if (!m) return null;
                      const active = (tierByLine[l.id] ?? selectedMember(l)?.tier) === tier;
                      return (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => setTierByLine((p) => ({ ...p, [l.id]: tier }))}
                          className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
                            active ? 'bg-brand-charcoal text-white border-brand-charcoal' : 'bg-white text-brand-charcoal border-brand-cream hover:border-brand-brown'
                          }`}
                        >
                          {TIER_LABEL[tier]}
                          {m.label ? ` · ${m.label}` : ''} · {fmtMoney(memberContribution(m, l.isPerPerson, guests))}
                        </button>
                      );
                    })}
                  </div>
                )}

                {l.isPerPerson && (
                  <div className="flex items-center gap-2 text-sm text-brand-charcoal mt-1">
                    <span className="text-brand-silver">Guests:</span>
                    <input
                      type="number"
                      min={GUEST_MIN}
                      max={GUEST_MAX}
                      value={guestByLine[l.id] ?? ''}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setGuestByLine((p) => ({ ...p, [l.id]: isNaN(v) ? GUEST_MIN : Math.min(GUEST_MAX, Math.max(GUEST_MIN, v)) }));
                      }}
                      className="w-24 border border-brand-cream rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-brand-copper"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Per-event target budgets */}
      {contract.events.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-brand-charcoal mb-2">Your target budget (optional)</h3>
          <p className="text-xs text-brand-silver mb-3">Let your planner know what you’re hoping to spend in each area.</p>
          <div className="space-y-2">
            {contract.events.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-brand-charcoal">{ev.name}</span>
                <span className="text-brand-silver">$</span>
                <input
                  type="number"
                  min={0}
                  placeholder="—"
                  value={targetByEvent[ev.id] ?? ''}
                  onChange={(e) => setTargetByEvent((p) => ({ ...p, [ev.id]: e.target.value }))}
                  className="w-32 border border-brand-cream rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-brand-copper"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="mt-6">
        <h3 className="text-sm font-medium text-brand-charcoal mb-2">Notes or questions (optional)</h3>
        <textarea
          value={notes}
          maxLength={NOTES_MAX}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Anything you'd like your planner to know…"
          className="w-full border border-brand-cream rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper resize-y"
        />
        <div className="text-[10px] text-brand-silver text-right mt-0.5">{notes.length}/{NOTES_MAX}</div>
      </div>

      {/* Live preview total + submit */}
      <div className="mt-6 pt-4 border-t border-brand-cream flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-brand-silver">Your estimate</div>
          <div className="text-2xl font-serif text-brand-charcoal">{fmtMoney(preview.computedTotal)}</div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={status === 'submitting'}
          className="bg-brand-brown text-white text-sm px-6 py-2.5 rounded-md hover:bg-brand-brown/90 disabled:opacity-50"
        >
          {status === 'submitting' ? 'Sending…' : 'Send my selections'}
        </button>
      </div>

      {status === 'error' && errorMsg && (
        <p className="text-sm text-red-600 mt-3 text-right">{errorMsg}</p>
      )}
    </div>
  );
}
