// Read-only program-side summaries for the deal page (Phase 2B). Each summary is compact and
// LINKS OUT to the existing editable workspace (estimate builder, budget page, program page) —
// so Alex sees everything unified AND can still reach the real tools. 2C replaces these with
// the real interactive components wired for inline editing. Server components (no actions).
import Link from 'next/link';
import type { DbEvent, DbEstimate, DbStaffingRole, DbBudgetPlanEntry, DbTravelItem } from '@/lib/supabase/queries';
import type { DbProgramDocument } from '@/lib/programs/documentTypes';
import { fmtDate, fmtCurrency, orDash } from '@/lib/deal/format';

const empty = (msg: string) => <p className="text-sm text-gray-400">{msg}</p>;

function timeRange(start: string | null, end: string | null): string {
  if (start && end) return ` · ${start}–${end}`;
  if (start || end) return ` · ${start ?? end}`;
  return '';
}

export function EventsSummary({
  programId,
  events,
  estimates,
}: {
  programId: string;
  events: DbEvent[];
  estimates: DbEstimate[];
}) {
  const byEvent = (eventId: string | null) => estimates.filter((e) => e.event_id === eventId);
  const unassigned = byEvent(null);

  if (events.length === 0 && estimates.length === 0) return empty('No events or estimates yet.');

  return (
    <div className="space-y-5">
      {events.map((ev) => {
        const ests = byEvent(ev.id);
        return (
          // per-event anchor for the breadcrumb jump
          <section key={ev.id} id={`event-${ev.id}`} className="scroll-mt-40 rounded-lg border border-gray-150 bg-gray-50/50 p-3">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-brand-charcoal">{orDash(ev.name)}</span>
              <span className="text-xs text-gray-500">
                {fmtDate(ev.event_date)}
                {timeRange(ev.start_time, ev.end_time)} · {ev.guest_count} guests
              </span>
            </div>
            <EstimateList programId={programId} estimates={ests} />
          </section>
        );
      })}

      {unassigned.length > 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 p-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Unassigned estimates</div>
          <EstimateList programId={programId} estimates={unassigned} />
        </div>
      )}
    </div>
  );
}

function EstimateList({ programId, estimates }: { programId: string; estimates: DbEstimate[] }) {
  if (estimates.length === 0) return <p className="text-xs text-gray-400">No estimates.</p>;
  return (
    <ul className="divide-y divide-gray-100">
      {estimates.map((est) => (
        <li key={est.id} className="flex items-center justify-between gap-3 py-1.5">
          <span className="flex items-center gap-2">
            <span className="rounded bg-brand-charcoal/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-brand-charcoal/60">
              {est.type}
            </span>
            <span className="text-sm text-brand-charcoal">{orDash(est.name)}</span>
            {est.include_in_budget && <span className="text-[10px] text-brand-copper">in budget</span>}
          </span>
          <Link
            href={`/programs/${programId}/estimates/${est.id}`}
            className="text-xs font-medium text-brand-copper hover:underline whitespace-nowrap"
          >
            Open →
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function StaffingSummary({
  staffing,
  teamMap,
}: {
  staffing: DbStaffingRole[];
  teamMap: Record<number, string>;
}) {
  if (staffing.length === 0) return empty('No staffing roles yet.');
  return (
    <ul className="divide-y divide-gray-100">
      {staffing.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5 text-sm">
          <span className="font-medium text-brand-charcoal">{orDash(r.role)}</span>
          <span className="text-gray-500">
            {r.assigned_to != null ? orDash(teamMap[r.assigned_to]) : 'Unassigned'} ·{' '}
            <span className="capitalize">{r.status.replace(/_/g, ' ')}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function BudgetSummary({
  programId,
  entries,
}: {
  programId: string;
  entries: DbBudgetPlanEntry[];
}) {
  if (entries.length === 0) return empty('No budget plan yet.');
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-gray-100">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5 text-sm">
            <span className="font-medium text-brand-charcoal">{orDash(e.label)}</span>
            <span className="text-gray-500">
              {fmtCurrency(e.value_low)}–{fmtCurrency(e.value_high)} · {e.pricing_basis.replace(/_/g, ' ')}
            </span>
          </li>
        ))}
      </ul>
      <Link href={`/programs/${programId}/budget`} className="text-xs font-medium text-brand-copper hover:underline">
        Open budget builder →
      </Link>
    </div>
  );
}

export function DocumentsSummary({ documents }: { documents: DbProgramDocument[] }) {
  if (documents.length === 0) return empty('No documents.');
  return (
    <ul className="divide-y divide-gray-100">
      {documents.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
          <span className="text-brand-charcoal break-all">{orDash(d.file_name)}</span>
          <span className="text-xs text-gray-400">{orDash(d.category)}</span>
        </li>
      ))}
    </ul>
  );
}

export function TravelSummary({ travel }: { travel: DbTravelItem[] }) {
  if (travel.length === 0) return empty('No travel items.');
  return (
    <ul className="divide-y divide-gray-100">
      {travel.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
          <span className="text-brand-charcoal">{orDash(t.description)}</span>
          <span className="text-xs text-gray-500">
            {t.qty} × {fmtCurrency(t.unit_price)}
          </span>
        </li>
      ))}
    </ul>
  );
}
