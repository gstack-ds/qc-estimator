'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CalloutWithContext, DbTeamMember } from '@/lib/supabase/queries';
import { CALLOUT_CATEGORIES } from '@/lib/callouts/constants';
import { filterToolUsers } from '@/lib/team/toolUsers';
import CalloutItem from './CalloutItem';

const ACTING_AS_KEY = 'callout-acting-as';

interface Props {
  callouts: CalloutWithContext[];
  teamMembers: DbTeamMember[];
}

type StatusTab = 'open' | 'resolved' | 'all';

export default function CalloutsView({ callouts, teamMembers }: Props) {
  const actors = filterToolUsers(teamMembers);
  const [actingAs, setActingAs] = useState<number | null>(actors[0]?.id ?? null);
  const [tab, setTab] = useState<StatusTab>('open');
  const [programFilter, setProgramFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sortDir, setSortDir] = useState<'newest' | 'oldest'>('newest');

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

  const counts = useMemo(() => ({
    open: callouts.filter((c) => c.status === 'open').length,
    resolved: callouts.filter((c) => c.status === 'resolved').length,
    all: callouts.length,
  }), [callouts]);

  const programNames = useMemo(
    () => [...new Set(callouts.map((c) => c.program_name).filter((x): x is string => !!x))].sort(),
    [callouts],
  );

  const ownerIds = useMemo(
    () => [...new Set(callouts.map((c) => c.owner).filter((x): x is number => x != null))],
    [callouts],
  );

  const filtered = useMemo(() => {
    let rows = callouts.slice();
    if (tab !== 'all') rows = rows.filter((c) => c.status === tab);
    if (programFilter) rows = rows.filter((c) => c.program_name === programFilter);
    if (ownerFilter) rows = rows.filter((c) => String(c.owner ?? '') === ownerFilter);
    if (tagFilter) rows = rows.filter((c) => c.category === tagFilter);
    rows.sort((a, b) =>
      sortDir === 'newest'
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at),
    );
    return rows;
  }, [callouts, tab, programFilter, ownerFilter, tagFilter, sortDir]);

  const nameOf = (id: number) => {
    const m = teamMembers.find((x) => x.id === id);
    return m ? `${m.first_name} ${m.last_name}` : `#${id}`;
  };

  const selectCls = 'text-xs border border-brand-cream rounded px-2 py-1.5 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper';

  return (
    <div className="space-y-4">
      {/* Acting as */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-brand-silver">Acting as</span>
        <select value={actingAs != null ? String(actingAs) : ''} onChange={(e) => setActor(e.target.value ? Number(e.target.value) : null)} className={selectCls}>
          <option value="">—</option>
          {actors.map((m) => <option key={m.id} value={String(m.id)}>{m.first_name} {m.last_name}</option>)}
        </select>
        <span className="text-brand-silver/60 ml-1">replies &amp; resolves are recorded as this person</span>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1">
        {(['open', 'resolved', 'all'] as StatusTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize ${
              tab === t ? 'bg-brand-charcoal text-white' : 'text-brand-charcoal/60 hover:text-brand-charcoal hover:bg-brand-cream/50'
            }`}
          >
            {t}
            <span className={`ml-1.5 text-[10px] ${tab === t ? 'opacity-70' : 'text-brand-silver'}`}>{counts[t]}</span>
          </button>
        ))}
      </div>

      {/* Filters + sort */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className={selectCls}>
          <option value="">All programs</option>
          {programNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className={selectCls}>
          <option value="">All owners</option>
          {ownerIds.map((id) => <option key={id} value={String(id)}>{nameOf(id)}</option>)}
        </select>
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className={selectCls}>
          <option value="">All tags</option>
          {CALLOUT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setSortDir((d) => (d === 'newest' ? 'oldest' : 'newest'))}
          className="text-xs px-2 py-1.5 rounded border border-brand-cream text-brand-charcoal/70 hover:bg-brand-offwhite transition-colors ml-auto"
        >
          {sortDir === 'newest' ? '↓ Newest first' : '↑ Oldest first'}
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-brand-cream rounded-lg">
          <p className="text-sm text-brand-silver">No callouts match these filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <CalloutItem
              key={c.id}
              callout={c}
              programId={c.program_id}
              teamMembers={teamMembers}
              actingAs={actingAs}
              context={{
                programId: c.program_id,
                estimateId: c.estimate_id,
                programName: c.program_name,
                eventName: c.event_name,
                estimateName: c.estimate_name,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
