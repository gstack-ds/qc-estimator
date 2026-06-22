// Alex's view of client-submitted budget versions (Phase 3). Authenticated, internal.
// Append-only: every submitted version is shown, newest first. Manual review — selections are NOT
// auto-applied to the estimate. Notes are rendered as plain text (React escapes by default).

import type { BudgetResponseView } from '@/lib/supabase/queries';

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
const TIER_LABEL: Record<string, string> = { low: 'Low', mid: 'Mid', high: 'High' };

export default function BudgetResponsesPanel({ responses }: { responses: BudgetResponseView[] }) {
  if (responses.length === 0) {
    return (
      <div className="border border-brand-cream rounded-xl p-5 bg-white">
        <h2 className="text-base font-serif text-brand-charcoal">Client responses</h2>
        <p className="text-sm text-brand-silver mt-1">
          No responses yet. When a client adjusts and submits the share link, their versions appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-brand-cream rounded-xl p-5 bg-white space-y-4">
      <div>
        <h2 className="text-base font-serif text-brand-charcoal">Client responses</h2>
        <p className="text-xs text-brand-silver mt-0.5">
          {responses.length} submitted version{responses.length === 1 ? '' : 's'}, newest first. Review and apply changes manually.
        </p>
      </div>

      <div className="space-y-3">
        {responses.map((r, i) => (
          <div key={r.id} className="border border-brand-cream rounded-lg overflow-hidden">
            <div className="bg-brand-offwhite px-4 py-2.5 flex items-center justify-between">
              <div className="text-sm text-brand-charcoal">
                {i === 0 && <span className="text-[10px] uppercase tracking-widest text-brand-copper mr-2">Latest</span>}
                Submitted {fmtDateTime(r.submittedAt)}
              </div>
              <div className="text-sm">
                <span className="text-brand-silver text-xs uppercase tracking-wide mr-2">Their total</span>
                <span className="font-semibold text-brand-charcoal tabular-nums">{fmtMoney(r.computedTotal)}</span>
              </div>
            </div>

            <div className="px-4 py-3 space-y-3 text-sm">
              {/* Selections */}
              {r.lineSelections.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-brand-brown mb-1">Selections</div>
                  <ul className="space-y-0.5">
                    {r.lineSelections.map((s) => (
                      <li key={s.lineId} className="text-brand-charcoal/85">
                        {r.lineNames[s.lineId] ?? 'Line'}:{' '}
                        {s.tier && <span>{TIER_LABEL[s.tier] ?? s.tier}</span>}
                        {s.tier && s.guestCount != null && ' · '}
                        {s.guestCount != null && <span>{s.guestCount} guests</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Category targets vs their computed per-event total */}
              {r.categoryTargets.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-brand-brown mb-1">Their target budgets</div>
                  <ul className="space-y-0.5">
                    {r.categoryTargets.map((t) => {
                      const actual = r.computedByEvent[t.eventId] ?? 0;
                      const delta = actual - t.amount; // + = over their target
                      return (
                        <li key={t.eventId} className="text-brand-charcoal/85 flex flex-wrap gap-x-2">
                          <span>{r.eventNames[t.eventId] ?? 'Section'}:</span>
                          <span className="text-brand-silver">target {fmtMoney(t.amount)}</span>
                          <span className="text-brand-silver">· est. {fmtMoney(actual)}</span>
                          <span className={delta > 0 ? 'text-red-600' : 'text-emerald-700'}>
                            {delta > 0 ? `over by ${fmtMoney(delta)}` : delta < 0 ? `under by ${fmtMoney(-delta)}` : 'on target'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Notes — plain text, escaped by React */}
              {r.notes && (
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-brand-brown mb-1">Notes</div>
                  <p className="text-brand-charcoal/85 whitespace-pre-wrap">{r.notes}</p>
                </div>
              )}

              {r.lineSelections.length === 0 && r.categoryTargets.length === 0 && !r.notes && (
                <p className="text-brand-silver italic">Submitted with no changes from the defaults.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
