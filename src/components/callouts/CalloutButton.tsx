'use client';

import { useState } from 'react';
import type { DbCalloutWithReplies, DbTeamMember } from '@/lib/supabase/queries';
import CalloutThread from './CalloutThread';

interface Props {
  estimateId: string;
  programId: string;
  eventId: string | null;
  estimateName: string;
  callouts: DbCalloutWithReplies[];
  teamMembers: DbTeamMember[];
  defaultOwner: number | null;
}

// Speech-bubble count badge on an estimate card. Opens a modal with the full callout thread.
export default function CalloutButton({ estimateId, programId, eventId, estimateName, callouts, teamMembers, defaultOwner }: Props) {
  const [open, setOpen] = useState(false);
  const openCount = callouts.filter((c) => c.status === 'open').length;

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen(true); }}
        title={openCount > 0 ? `${openCount} open callout${openCount === 1 ? '' : 's'}` : 'Raise a callout'}
        className={`flex items-center gap-1 h-6 px-1.5 rounded-full text-[11px] font-semibold transition-colors flex-shrink-0 ${
          openCount > 0
            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            : 'border border-dashed border-brand-silver/50 text-brand-silver/60 hover:border-brand-copper hover:text-brand-copper'
        }`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {openCount > 0 ? openCount : '+'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
          <div className="fixed inset-0 bg-brand-charcoal/40" onClick={(e) => { e.preventDefault(); setOpen(false); }} />
          <div className="relative bg-white rounded-xl shadow-xl border border-brand-cream w-full max-w-lg my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-brand-cream">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-brand-charcoal truncate">Callouts — {estimateName}</h3>
                <p className="text-[11px] text-brand-silver">Internal issue log · not shown on proposals</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setOpen(false); }}
                className="text-brand-silver hover:text-brand-charcoal transition-colors flex-shrink-0 ml-3"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              <CalloutThread
                estimateId={estimateId}
                programId={programId}
                eventId={eventId}
                callouts={callouts}
                teamMembers={teamMembers}
                defaultOwner={defaultOwner}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
