import type { DbBudgetPlanEntry } from '@/lib/supabase/queries';
import { resolveEstimateBudget } from '@/lib/budget/resolveBudget';
import BudgetChip from './BudgetChip';

interface SnapshotEvent {
  id?: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  guest_count: number;
  budget_amount?: number | null;
  budget_basis?: 'overall' | 'per_person' | null;
}

interface Props {
  programId: string;
  guestCount: number;
  event: SnapshotEvent | null;
  programDateRange?: { start: string | null; end: string | null } | null;
  budgetPlanEntry: DbBudgetPlanEntry | null;
  // All Budget Plan entries for the program — used to resolve event-linked + pooled budgets.
  budgetEntries?: DbBudgetPlanEntry[];
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(d: string | null) {
  if (!d) return null;
  const [, m, day] = d.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${day}`;
}

function fmtTime(t: string | null) {
  if (!t) return null;
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${mStr}${ampm}`;
}

export default function EstimateSnapshotBar({ programId, guestCount, event, programDateRange, budgetPlanEntry, budgetEntries = [] }: Props) {
  const dateStr = event?.event_date
    ? fmtDate(event.event_date)
    : programDateRange?.start
      ? fmtDate(programDateRange.start)
      : null;

  const startStr = fmtTime(event?.start_time ?? null);
  const endStr = fmtTime(event?.end_time ?? null);
  const timeStr = startStr && endStr ? `${startStr}–${endStr}` : startStr ?? endStr ?? null;

  // Unified budget — same precedence the per-person comparison badge uses, so they always agree.
  const resolved = resolveEstimateBudget({
    estimateEntry: budgetPlanEntry,
    eventId: event?.id ?? null,
    eventBudgetAmount: event?.budget_amount ?? null,
    eventBudgetBasis: event?.budget_basis ?? null,
    entries: budgetEntries,
  });

  const chips: { label: string; value: string }[] = [];
  if (dateStr) chips.push({ label: 'Event date', value: dateStr });
  if (timeStr) chips.push({ label: 'Time', value: timeStr });
  if (guestCount > 0) chips.push({ label: 'Guests', value: guestCount.toLocaleString('en-US') });

  return (
    <div className="flex-shrink-0 bg-brand-offwhite border-b border-brand-cream px-4 py-2 flex items-center gap-4 flex-wrap text-xs">
      {chips.map((chip) => (
        <span key={chip.label} className="flex items-center gap-1">
          <span className="text-brand-silver/60 uppercase tracking-wide text-[10px] font-medium">{chip.label}</span>
          <span className="font-medium text-brand-charcoal">{chip.value}</span>
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="text-brand-silver/60 uppercase tracking-wide text-[10px] font-medium">Budget</span>
        <BudgetChip
          programId={programId}
          eventId={event?.id ?? null}
          eventBudgetAmount={event?.budget_amount ?? null}
          eventBudgetBasis={event?.budget_basis ?? null}
          resolved={resolved}
        />
      </span>
    </div>
  );
}
