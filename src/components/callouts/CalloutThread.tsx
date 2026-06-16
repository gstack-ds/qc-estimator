'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { DbCalloutWithReplies, DbTeamMember } from '@/lib/supabase/queries';
import { CALLOUT_CATEGORIES } from '@/lib/callouts/constants';
import { filterToolUsers } from '@/lib/team/toolUsers';
import { raiseCallout } from '@/app/(programs)/callouts/actions';
import CalloutItem from './CalloutItem';

const ACTING_AS_KEY = 'callout-acting-as';

interface Props {
  estimateId: string;
  programId: string;
  eventId: string | null;
  callouts: DbCalloutWithReplies[];
  teamMembers: DbTeamMember[];
  // Estimate's assigned_to — default owner for new callouts + default "acting as".
  defaultOwner: number | null;
}

export default function CalloutThread({ estimateId, programId, eventId, callouts, teamMembers, defaultOwner }: Props) {
  const router = useRouter();
  const actors = filterToolUsers(teamMembers);
  const [actingAs, setActingAs] = useState<number | null>(defaultOwner ?? actors[0]?.id ?? null);
  const [text, setText] = useState('');
  const [category, setCategory] = useState<string>('Other');
  const [busy, startTransition] = useTransition();

  // Remember who you're acting as across sessions (no auth→team_member mapping in v1).
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

  function submit() {
    const body = text.trim();
    if (!body) return;
    setText('');
    startTransition(async () => {
      await raiseCallout({
        estimateId, programId, eventId, text: body, category,
        createdBy: actingAs, owner: defaultOwner,
      });
      router.refresh();
    });
  }

  const open = callouts.filter((c) => c.status === 'open');
  const resolved = callouts.filter((c) => c.status === 'resolved');

  return (
    <div className="space-y-3">
      {/* Acting as */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-brand-silver">Acting as</span>
        <select
          value={actingAs != null ? String(actingAs) : ''}
          onChange={(e) => setActor(e.target.value ? Number(e.target.value) : null)}
          className="border border-brand-cream rounded px-2 py-1 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
        >
          <option value="">—</option>
          {actors.map((m) => (
            <option key={m.id} value={String(m.id)}>{m.first_name} {m.last_name}</option>
          ))}
        </select>
      </div>

      {/* Raise form */}
      <div className="rounded-lg border border-brand-copper/30 bg-brand-copper/5 p-3 space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Raise an issue — describe what you're seeing…"
          className="w-full text-sm border border-brand-cream rounded px-2.5 py-1.5 resize-y bg-white focus:outline-none focus:ring-1 focus:ring-brand-copper"
        />
        <div className="flex items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-xs border border-brand-cream rounded px-2 py-1.5 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
          >
            {CALLOUT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !text.trim()}
            className="ml-auto text-xs font-medium px-3 py-1.5 rounded bg-brand-copper text-white hover:bg-brand-copper/90 disabled:opacity-40 transition-colors"
          >
            Raise callout
          </button>
        </div>
      </div>

      {/* Open */}
      {open.length > 0 && (
        <div className="space-y-2">
          {open.map((c) => (
            <CalloutItem key={c.id} callout={c} programId={programId} teamMembers={teamMembers} actingAs={actingAs} />
          ))}
        </div>
      )}

      {/* Resolved (collapsed-feel, lighter) */}
      {resolved.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-brand-silver/60">Resolved ({resolved.length})</p>
          {resolved.map((c) => (
            <CalloutItem key={c.id} callout={c} programId={programId} teamMembers={teamMembers} actingAs={actingAs} />
          ))}
        </div>
      )}

      {callouts.length === 0 && (
        <p className="text-xs text-brand-silver/70 py-2 text-center">No callouts yet. Raise the first one above.</p>
      )}
    </div>
  );
}
