'use client';

import { useState } from 'react';
import type { DbTeamMember } from '@/lib/supabase/queries';
import { filterToolUsers, memberInitials } from '@/lib/team/toolUsers';

interface Props {
  assignedTo: number | null;
  teamMembers: DbTeamMember[];
  onAssign: (memberId: number | null) => void;
}

// Compact initials badge + dropdown for assigning an estimate to one of the 5 tool
// users. Internal-only — it lives on the estimate card, never on a client document.
export default function AssignedToBadge({ assignedTo, teamMembers, onAssign }: Props) {
  const [open, setOpen] = useState(false);
  const options = filterToolUsers(teamMembers);
  const current = teamMembers.find((m) => m.id === assignedTo) ?? null;
  const initials = current ? memberInitials(current) : null;

  return (
    <div className="relative ml-auto flex-shrink-0">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        title={current ? `Assigned to ${current.first_name} ${current.last_name}` : 'Assign to a team member'}
        className={
          initials
            ? 'w-6 h-6 rounded-full bg-brand-brown text-white text-[10px] font-semibold flex items-center justify-center hover:bg-brand-brown/90 transition-colors'
            : 'w-6 h-6 rounded-full border border-dashed border-brand-silver/50 text-brand-silver/60 text-xs flex items-center justify-center hover:border-brand-brown hover:text-brand-brown transition-colors'
        }
      >
        {initials ?? '+'}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-20" onClick={(e) => { e.preventDefault(); setOpen(false); }} />
          <div className="absolute right-0 bottom-8 z-30 w-48 bg-white border border-brand-cream rounded-lg shadow-lg py-1">
            <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-brand-silver/60">Assign to</p>
            {options.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={(e) => { e.preventDefault(); onAssign(m.id); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-brand-offwhite flex items-center gap-2 transition-colors ${
                  m.id === assignedTo ? 'font-semibold text-brand-brown' : 'text-brand-charcoal'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-brand-brown/10 text-brand-brown text-[9px] font-semibold flex items-center justify-center flex-shrink-0">
                  {memberInitials(m)}
                </span>
                {m.first_name} {m.last_name}
              </button>
            ))}
            {assignedTo != null && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); onAssign(null); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-brand-silver hover:bg-brand-offwhite border-t border-brand-cream mt-1 transition-colors"
              >
                Unassign
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
