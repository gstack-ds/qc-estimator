'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DbCalloutWithReplies, DbTeamMember } from '@/lib/supabase/queries';
import { categoryClasses } from '@/lib/callouts/constants';
import {
  addCalloutReply,
  resolveCallout,
  reopenCallout,
} from '@/app/(programs)/callouts/actions';

export interface CalloutContext {
  programId: string;
  estimateId: string;
  programName: string | null;
  eventName: string | null;
  estimateName: string | null;
}

interface Props {
  callout: DbCalloutWithReplies;
  programId: string;
  teamMembers: DbTeamMember[];
  actingAs: number | null;
  // When present, shows the source program/event/estimate + a jump link (dedicated page).
  context?: CalloutContext;
}

function nameOf(members: DbTeamMember[], id: number | null): string {
  if (id == null) return 'Unknown';
  const m = members.find((x) => x.id === id);
  return m ? `${m.first_name} ${m.last_name}` : 'Unknown';
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function CalloutItem({ callout, programId, teamMembers, actingAs, context }: Props) {
  const router = useRouter();
  const [reply, setReply] = useState('');
  const [busy, startTransition] = useTransition();
  const resolved = callout.status === 'resolved';

  function submitReply() {
    const text = reply.trim();
    if (!text) return;
    setReply('');
    startTransition(async () => {
      await addCalloutReply({ calloutId: callout.id, programId, author: actingAs, text });
      router.refresh();
    });
  }

  function toggleResolved() {
    startTransition(async () => {
      if (resolved) await reopenCallout(callout.id, programId);
      else await resolveCallout(callout.id, programId, actingAs);
      router.refresh();
    });
  }

  return (
    <div className={`rounded-lg border p-3 ${resolved ? 'border-brand-cream bg-brand-offwhite/50' : 'border-brand-cream bg-white'}`}>
      {/* Top row: category + status + jump (page only) */}
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        {callout.category && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${categoryClasses(callout.category)}`}>
            {callout.category}
          </span>
        )}
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${resolved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {resolved ? 'Resolved' : 'Open'}
        </span>
        {context && (
          <Link
            href={`/programs/${context.programId}/estimates/${context.estimateId}`}
            className="ml-auto text-[10px] font-semibold text-brand-copper hover:underline truncate max-w-[60%]"
          >
            → {[context.programName, context.eventName, context.estimateName].filter(Boolean).join(' · ') || 'source'}
          </Link>
        )}
      </div>

      {/* Issue text */}
      <p className={`text-sm whitespace-pre-wrap ${resolved ? 'text-brand-charcoal/60' : 'text-brand-charcoal'}`}>{callout.text}</p>

      {/* Meta */}
      <p className="text-[11px] text-brand-silver mt-1">
        Raised by {nameOf(teamMembers, callout.created_by)} · {fmtWhen(callout.created_at)}
        {callout.owner != null && <> · owner {nameOf(teamMembers, callout.owner)}</>}
        {resolved && callout.resolved_at && <> · resolved by {nameOf(teamMembers, callout.resolved_by)}</>}
      </p>

      {/* Replies */}
      {callout.replies.length > 0 && (
        <div className="mt-2 space-y-1.5 border-l-2 border-brand-cream pl-3">
          {callout.replies.map((r) => (
            <div key={r.id} className="text-xs">
              <span className="font-medium text-brand-charcoal">{nameOf(teamMembers, r.author)}</span>
              <span className="text-brand-silver"> · {fmtWhen(r.created_at)}</span>
              <p className="text-brand-charcoal/80 whitespace-pre-wrap">{r.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-2 flex items-end gap-2">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitReply(); }}
          rows={1}
          placeholder="Reply…"
          className="flex-1 text-xs border border-brand-cream rounded px-2 py-1.5 resize-y focus:outline-none focus:ring-1 focus:ring-brand-copper"
        />
        <button
          type="button"
          onClick={submitReply}
          disabled={busy || !reply.trim()}
          className="text-xs font-medium px-2.5 py-1.5 rounded border border-brand-copper text-brand-copper hover:bg-brand-copper/10 disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          Reply
        </button>
        <button
          type="button"
          onClick={toggleResolved}
          disabled={busy}
          className={`text-xs font-medium px-2.5 py-1.5 rounded transition-colors whitespace-nowrap ${
            resolved
              ? 'border border-brand-cream text-brand-silver hover:text-brand-charcoal'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {resolved ? 'Reopen' : 'Resolve'}
        </button>
      </div>
    </div>
  );
}
