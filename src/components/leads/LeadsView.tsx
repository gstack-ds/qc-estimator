'use client';

import { useState, useEffect } from 'react';
import type { DbLead, DbTeamMember } from '@/lib/supabase/queries';
import type { LeadStatusGroup } from '@/lib/leads/constants';
import LeadsList from './LeadsList';
import LeadsBoard from './LeadsBoard';

const STORAGE_KEY = 'qc-leads-view';

type ViewMode = 'table' | 'board';

interface Props {
  leads: DbLead[];
  counts: Record<LeadStatusGroup, number>;
  teamMembers: DbTeamMember[];
}

export default function LeadsView({ leads, counts, teamMembers }: Props) {
  const [view, setView] = useState<ViewMode>('board');

  // Load persisted view on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'table' || saved === 'board') setView(saved);
    } catch {}
  }, []);

  function switchView(next: ViewMode) {
    setView(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  }

  return (
    <div>
      {/* View toggle */}
      <div className="flex items-center gap-1 mb-5">
        <div className="flex border border-brand-cream rounded overflow-hidden">
          <button
            onClick={() => switchView('table')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'table'
                ? 'bg-brand-charcoal text-white'
                : 'bg-white text-brand-charcoal/60 hover:text-brand-charcoal hover:bg-brand-offwhite'
            }`}
          >
            Table
          </button>
          <button
            onClick={() => switchView('board')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-brand-cream ${
              view === 'board'
                ? 'bg-brand-charcoal text-white'
                : 'bg-white text-brand-charcoal/60 hover:text-brand-charcoal hover:bg-brand-offwhite'
            }`}
          >
            Board
          </button>
        </div>
      </div>

      {view === 'table'
        ? <LeadsList leads={leads} counts={counts} teamMembers={teamMembers} />
        : <LeadsBoard leads={leads} teamMembers={teamMembers} />
      }
    </div>
  );
}
