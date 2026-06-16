'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DbCalloutWithReplies, DbTeamMember } from '@/lib/supabase/queries';
import { filterToolUsers } from '@/lib/team/toolUsers';
import CalloutItem, { type CalloutContext } from './CalloutItem';

const ACTING_AS_KEY = 'callout-acting-as';
type Filter = 'open' | 'resolved' | 'all';

interface Props {
  // Callouts already scoped to one event or one program.
  callouts: DbCalloutWithReplies[];
  teamMembers: DbTeamMember[];
  // estimate_id -> source labels + jump link (shows which estimate each callout came from).
  contextByEstimate?: Record<string, CalloutContext>;
  defaultFilter?: Filter;
}

// In-context callout history for an event/program: the post-event debrief surface.
// Default OPEN (what still needs attention); toggle to Resolved or All (the full record).
export default function CalloutsPanel({ callouts, teamMembers, contextByEstimate, defaultFilter = 'open' }: Props) {
  const actors = filterToolUsers(teamMembers);
  const [actingAs, setActingAs] = useState<number | null>(actors[0]?.id ?? null);
  const [filter, setFilter] = useState<Filter>(defaultFilter);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ACTING_AS_KEY);
      if (saved && actors.some((a) => String(a.id) === saved)) setActingAs(Number(saved));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setActor(id: number | null) {
    setActingAs(id);
    try { if (id != null) localStorage.setItem(ACTING_AS_KEY, String(id)); } catch {}
  }

  const openCount = callouts.filter((c) => c.status === 'open').length;
  const resolvedCount = callouts.length - openCount;

  const shown = useMemo(() => {
    const rows = callouts.filter((c) =>
      filter === 'all' ? true : c.status === filter,
    );
    // Open first, then most recent — keeps "what needs attention" on top in the All view.
    return rows.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [callouts, filter]);

  if (callouts.length === 0) return null;

  return (
    <div className="border-t border-brand-cream pt-3 space-y-2.5">
      {/* Summary + filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-brand-charcoal">
          Callouts:{' '}
          <span className={openCount > 0 ? 'text-amber-700' : 'text-brand-silver'}>{openCount} open</span>
          <span className="text-brand-silver"> · {resolvedCount} resolved</span>
        </span>

        <div className="flex bg-brand-offwhite border border-brand-cream rounded-md p-0.5 gap-0.5">
          {(['open', 'resolved', 'all'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors capitalize ${
                filter === f ? 'bg-white text-brand-charcoal shadow-sm font-medium' : 'text-brand-silver hover:text-brand-charcoal'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5 text-[11px]">
          <span className="text-brand-silver">Acting as</span>
          <select
            value={actingAs != null ? String(actingAs) : ''}
            onChange={(e) => setActor(e.target.value ? Number(e.target.value) : null)}
            className="border border-brand-cream rounded px-1.5 py-0.5 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
          >
            <option value="">—</option>
            {actors.map((m) => <option key={m.id} value={String(m.id)}>{m.first_name} {m.last_name}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      {shown.length === 0 ? (
        <p className="text-[11px] text-brand-silver/70 py-1">
          {filter === 'open' ? 'No open callouts — all clear.' : 'Nothing here.'}
        </p>
      ) : (
        <div className="space-y-2">
          {shown.map((c) => (
            <CalloutItem
              key={c.id}
              callout={c}
              programId={c.program_id}
              teamMembers={teamMembers}
              actingAs={actingAs}
              context={contextByEstimate?.[c.estimate_id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
