'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import type { DbLead, DbTeamMember } from '@/lib/supabase/queries';
import { statusToLane, LANE_DOT_CLASSES } from '@/lib/leads/pipeline';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d: string | null) {
  if (!d) return null;
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${day}, ${y}`;
}

interface CardContentProps {
  lead: DbLead;
  teamMembers: DbTeamMember[];
  isOverlay?: boolean;
}

export function LeadCardContent({ lead, teamMembers, isOverlay = false }: CardContentProps) {
  const owner = teamMembers.find(m => m.id === lead.assigned_to);
  const ownerName = owner ? owner.first_name : null;
  const lane = statusToLane(lead.status);
  const dotClass = lane ? LANE_DOT_CLASSES[lane.color] : 'bg-slate-400';

  return (
    <div className={`bg-white border border-brand-cream rounded-lg p-3 space-y-2 select-none ${
      isOverlay ? 'shadow-xl rotate-1 opacity-95' : 'shadow-sm hover:border-brand-copper/40 hover:shadow-md'
    } transition-all`}>
      {/* Header row */}
      <div className="flex items-start gap-2">
        <span className={`mt-[5px] w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} title={lead.status} />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm text-brand-charcoal leading-tight truncate">
            {lead.client_name ?? '—'}
          </div>
          {lead.program_name && (
            <div className="text-xs text-brand-silver truncate mt-0.5">{lead.program_name}</div>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between gap-2 text-xs text-brand-silver">
        <span className="truncate">
          {lead.start_date ? fmtDate(lead.start_date) : <span className="italic">No date</span>}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {lead.guest_count != null && (
            <span className="bg-brand-offwhite border border-brand-cream rounded px-1.5 py-0.5 text-[10px]">
              {lead.guest_count} guests
            </span>
          )}
          {ownerName && (
            <span className="bg-brand-offwhite border border-brand-cream rounded px-1.5 py-0.5 text-[10px]">
              {ownerName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface DraggableCardProps {
  lead: DbLead;
  teamMembers: DbTeamMember[];
}

export default function LeadCard({ lead, teamMembers }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { status: lead.status },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
    >
      <Link
        href={`/leads/${lead.id}`}
        onClick={(e) => {
          // Prevent navigation during drag — only navigate on plain click
          if (isDragging) e.preventDefault();
        }}
        className="block"
        tabIndex={-1}
      >
        <LeadCardContent lead={lead} teamMembers={teamMembers} />
      </Link>
    </div>
  );
}
