// Shared presentational renderer for a budget's client-facing layout. Consumes a
// BudgetShareContract and nothing else — so it can ONLY display client-safe values. Used by both
// the in-app Preview (Phase 1, proven clean) and the public share page (Phase 2). No hooks, no
// 'use client', no next/* imports → safe to render in a Server Component and in Vitest.

import {
  type BudgetLine,
  type BudgetDocument,
  type BudgetMember,
  lineMode,
  memberContribution,
  computeLineTotals,
  computeBudgetTotals,
  resolveLineGuests,
  selectedMember,
} from '@/lib/budget/budgetDocument';
import type { BudgetShareContract } from '@/lib/budget/budgetShareContract';

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function BudgetDocumentView({ contract }: { contract: BudgetShareContract }) {
  const { programName, guestCount, events, lines, disclaimers } = contract;
  const doc: BudgetDocument = { id: '', programId: '', title: null, status: '', disclaimers, lines };
  const totals = computeBudgetTotals(doc, guestCount, guestCount);

  const linesByEvent = new Map<string, BudgetLine[]>();
  const unassigned: BudgetLine[] = [];
  for (const l of lines) {
    if (!l.isIncluded) continue;
    if (l.eventId && events.some((e) => e.id === l.eventId)) {
      (linesByEvent.get(l.eventId) ?? linesByEvent.set(l.eventId, []).get(l.eventId)!).push(l);
    } else {
      unassigned.push(l);
    }
  }

  const groups: { key: string; title: string; lines: BudgetLine[] }[] = [
    ...events.filter((e) => (linesByEvent.get(e.id) ?? []).length).map((e) => ({ key: e.id, title: e.name, lines: linesByEvent.get(e.id)! })),
    ...(unassigned.length ? [{ key: '__none__', title: 'Other', lines: unassigned }] : []),
  ];

  return (
    <div className="bg-white border border-brand-cream rounded-xl p-6 md:p-10 max-w-3xl mx-auto font-sans text-brand-charcoal">
      {/* Header */}
      <div className="border-b border-brand-cream pb-5 mb-6">
        <div className="text-[10px] uppercase tracking-[0.18em] text-brand-brown mb-1">Quill Creative Event Design</div>
        <h1 className="font-serif text-3xl font-light text-brand-charcoal">{programName} — Budget Estimate</h1>
        <div className="text-xs text-brand-silver mt-1">{guestCount} guests</div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-px bg-brand-cream border border-brand-cream rounded-lg overflow-hidden mb-7">
        {[
          { label: 'Low estimate', value: totals.low, sub: fmtMoney(guestCount > 0 ? totals.low / guestCount : 0) },
          { label: 'Selected estimate', value: totals.selected, sub: fmtMoney(totals.perPerson) },
          { label: 'High estimate', value: totals.high, sub: fmtMoney(guestCount > 0 ? totals.high / guestCount : 0) },
        ].map((c, i) => (
          <div key={c.label} className={`px-4 py-3 ${i === 1 ? 'bg-brand-charcoal' : 'bg-white'}`} data-budget-total={i === 1 ? totals.selected : undefined}>
            <div className={`text-[10px] uppercase tracking-widest ${i === 1 ? 'text-brand-camel' : 'text-brand-silver'}`}>{c.label}</div>
            <div className={`text-xl font-serif mt-0.5 ${i === 1 ? 'text-white' : 'text-brand-charcoal'}`}>{fmtMoney(c.value)}</div>
            <div className={`text-[10px] mt-0.5 ${i === 1 ? 'text-white/60' : 'text-brand-silver'}`}>{c.sub} per person</div>
          </div>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {groups.map((g) => {
          const subtotal = totals.byEvent[g.key]?.selected ?? 0;
          return (
            <div key={g.key} className="border border-brand-cream rounded-lg overflow-hidden">
              <div className="bg-brand-charcoal px-4 py-2.5">
                <div className="text-sm font-serif text-white">{g.title}</div>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {g.lines.map((line) => (
                    <PreviewLine key={line.id} line={line} fallbackGuestCount={guestCount} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-brand-linen/60 border-t border-brand-cream">
                    <td className="px-4 py-2 text-xs uppercase tracking-widest text-brand-brown font-medium">Section total</td>
                    <td className="px-4 py-2 text-right font-semibold text-brand-charcoal tabular-nums">{fmtMoney(subtotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })}
        {groups.length === 0 && (
          <p className="text-sm text-brand-silver text-center py-8">No line items in this budget yet.</p>
        )}
      </div>

      {/* Program total */}
      <div className="border border-brand-charcoal rounded-lg overflow-hidden mt-6">
        <div className="bg-brand-charcoal px-5 py-3 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest text-brand-camel">Program total — selected estimate</div>
          <div className="text-2xl font-serif text-white">{fmtMoney(totals.selected)}</div>
        </div>
      </div>

      {disclaimers?.trim() && (
        <div className="mt-6 pt-4 border-t border-brand-cream">
          <p className="text-[11px] text-brand-silver leading-relaxed whitespace-pre-wrap">{disclaimers}</p>
        </div>
      )}

      <div className="mt-8 text-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-brand-copper">qceventdesign.com</div>
      </div>
    </div>
  );
}

function PreviewLine({ line, fallbackGuestCount }: { line: BudgetLine; fallbackGuestCount: number }) {
  const mode = lineMode(line);
  const guests = resolveLineGuests(line, fallbackGuestCount);
  const totals = computeLineTotals(line, fallbackGuestCount);

  const ppNote = (m: BudgetMember) =>
    line.isPerPerson ? (
      <div className="text-[11px] text-brand-silver mt-0.5">
        {fmtMoney(m.overrideValue ?? m.derivedPp)}/pp × {guests} guests
      </div>
    ) : null;

  if (mode === 'tiers') {
    const tierMembers = line.members.filter((m) => m.tier);
    return (
      <tr className="border-t border-brand-cream/70 align-top">
        <td className="px-4 py-2.5">
          <div className="text-brand-charcoal">{line.name}</div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1.5">
            {(['low', 'mid', 'high'] as const).map((tier) => {
              const m = tierMembers.find((x) => x.tier === tier);
              if (!m) return null;
              const isSel = selectedMember(line)?.id === m.id;
              return (
                <div key={tier} className={`text-xs ${isSel ? 'text-brand-charcoal font-semibold' : 'text-brand-silver'}`}>
                  <span className="uppercase tracking-wide text-[10px]">{tier}</span>{' '}
                  {m.label ? <span className="italic">{m.label} · </span> : null}
                  {fmtMoney(memberContribution(m, line.isPerPerson, guests))}
                </div>
              );
            })}
          </div>
        </td>
        <td className="px-4 py-2.5 text-right font-semibold text-brand-charcoal tabular-nums whitespace-nowrap">{fmtMoney(totals.selected)}</td>
      </tr>
    );
  }

  if (mode === 'pick_one') {
    const sel = selectedMember(line);
    return (
      <tr className="border-t border-brand-cream/70 align-top">
        <td className="px-4 py-2.5">
          <div className="text-brand-charcoal">{line.name}</div>
          {sel?.label && <div className="text-xs text-brand-silver mt-0.5 italic">{sel.label}</div>}
          {sel && ppNote(sel)}
        </td>
        <td className="px-4 py-2.5 text-right font-semibold text-brand-charcoal tabular-nums whitespace-nowrap">{fmtMoney(totals.selected)}</td>
      </tr>
    );
  }

  // add_up
  return (
    <tr className="border-t border-brand-cream/70 align-top">
      <td className="px-4 py-2.5">
        <div className="text-brand-charcoal">{line.name}</div>
        {line.members.length === 1 && ppNote(line.members[0])}
      </td>
      <td className="px-4 py-2.5 text-right font-semibold text-brand-charcoal tabular-nums whitespace-nowrap">{fmtMoney(totals.selected)}</td>
    </tr>
  );
}
