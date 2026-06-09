import type { DbBudgetPlanEntry } from '@/lib/supabase/queries';

interface SnapshotEvent {
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  guest_count: number;
}

interface Props {
  programId: string;
  guestCount: number;
  event: SnapshotEvent | null;
  programDateRange?: { start: string | null; end: string | null } | null;
  budgetPlanEntry: DbBudgetPlanEntry | null;
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

function fmtBudget(entry: DbBudgetPlanEntry): string {
  const pp = entry.pricing_basis === 'per_person';
  const suffix = pp ? '/pp' : '';

  if (entry.entry_type === 'pooled') {
    const pool = entry.pool_total ?? 0;
    return `$${Math.round(pool).toLocaleString('en-US')} pooled`;
  }

  const low = entry.value_low;
  const high = entry.value_high;

  const fmt = (v: number) =>
    pp ? `$${v.toLocaleString('en-US')}` : `$${Math.round(v).toLocaleString('en-US')}`;

  if (low === high) return `${fmt(low)}${suffix}`;
  return `${fmt(low)}–${fmt(high)}${suffix}`;
}

export default function EstimateSnapshotBar({ programId, guestCount, event, programDateRange, budgetPlanEntry }: Props) {
  const dateStr = event?.event_date
    ? fmtDate(event.event_date)
    : programDateRange?.start
      ? fmtDate(programDateRange.start)
      : null;

  const startStr = fmtTime(event?.start_time ?? null);
  const endStr = fmtTime(event?.end_time ?? null);
  const timeStr = startStr && endStr ? `${startStr}–${endStr}` : startStr ?? endStr ?? null;

  const budgetStr = budgetPlanEntry ? fmtBudget(budgetPlanEntry) : null;

  const chips: { label: string; value: string; href?: string }[] = [];

  if (dateStr) chips.push({ label: 'Event date', value: dateStr });
  if (timeStr) chips.push({ label: 'Time', value: timeStr });
  if (guestCount > 0) chips.push({ label: 'Guests', value: guestCount.toLocaleString('en-US') });
  chips.push({
    label: 'Budget',
    value: budgetStr ?? 'No budget set',
    href: budgetStr ? `/programs/${programId}#budget-plan` : undefined,
  });

  return (
    <div className="flex-shrink-0 bg-brand-offwhite border-b border-brand-cream px-4 py-2 flex items-center gap-4 flex-wrap text-xs">
      {chips.map((chip) => (
        <span key={chip.label} className="flex items-center gap-1">
          <span className="text-brand-silver/60 uppercase tracking-wide text-[10px] font-medium">{chip.label}</span>
          {chip.href ? (
            <a
              href={chip.href}
              className={`font-medium text-brand-brown hover:underline ${chip.value === 'No budget set' ? 'text-brand-silver italic font-normal' : ''}`}
            >
              {chip.value}
            </a>
          ) : (
            <span className={`font-medium text-brand-charcoal ${chip.value === 'No budget set' ? 'text-brand-silver italic font-normal' : ''}`}>
              {chip.value}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
