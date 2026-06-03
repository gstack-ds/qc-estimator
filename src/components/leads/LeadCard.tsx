'use client';

import { useTransition } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import Link from 'next/link';
import type { DbLead, DbTeamMember } from '@/lib/supabase/queries';
import { statusToLane, LANE_DOT_CLASSES } from '@/lib/leads/pipeline';
import { STATUS_LABELS, type LeadStatus } from '@/lib/leads/constants';
import type { LeadInput } from '@/app/(programs)/leads/actions';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d: string | null) {
  if (!d) return null;
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${day}, ${y}`;
}

// ─── Card content (read-only, used for DragOverlay too) ───

interface ContentProps {
  lead: DbLead;
  teamMembers: DbTeamMember[];
  isOverlay?: boolean;
}

export function LeadCardContent({ lead, teamMembers, isOverlay = false }: ContentProps) {
  const owner = teamMembers.find(m => m.id === lead.assigned_to);
  const ownerName = owner ? owner.first_name : null;
  const lane = statusToLane(lead.status);
  const dotClass = lane ? LANE_DOT_CLASSES[lane.color] : 'bg-slate-400';

  return (
    <div className={`bg-white border border-brand-cream rounded-lg p-3 space-y-2 select-none ${
      isOverlay ? 'shadow-xl rotate-1 opacity-95' : 'shadow-sm'
    } transition-all`}>
      <div className="flex items-start gap-2">
        <span className={`mt-[5px] w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} title={STATUS_LABELS[lead.status]} />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm text-brand-charcoal leading-tight truncate">{lead.client_name ?? '—'}</div>
          {lead.program_name && <div className="text-xs text-brand-silver truncate mt-0.5">{lead.program_name}</div>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-brand-silver">
        <span className="truncate">
          {lead.start_date ? fmtDate(lead.start_date) : <span className="italic">No date</span>}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {lead.guest_count != null && (
            <span className="bg-brand-offwhite border border-brand-cream rounded px-1.5 py-0.5 text-[10px]">{lead.guest_count}g</span>
          )}
          {ownerName && (
            <span className="bg-brand-offwhite border border-brand-cream rounded px-1.5 py-0.5 text-[10px]">{ownerName}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Draggable + editable card ────────────────────────────

interface CardProps {
  lead: DbLead;
  teamMembers: DbTeamMember[];
  /** Statuses in this card's current lane (for fine-grained status dropdown) */
  laneStatuses: LeadStatus[];
  onUpdate: (leadId: string, patch: Partial<LeadInput>) => void;
}

export default function LeadCard({ lead, teamMembers, laneStatuses, onUpdate }: CardProps) {
  const [, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { status: lead.status },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const lane = statusToLane(lead.status);
  const dotClass = lane ? LANE_DOT_CLASSES[lane.color] : 'bg-slate-400';
  const ownerName = teamMembers.find(m => m.id === lead.assigned_to)?.first_name ?? null;
  const activeMembers = teamMembers.filter(m => m.is_active);

  // Stop pointer events from bubbling to drag listeners when interacting with controls
  const noPropagate = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();

  function handleField(field: keyof LeadInput, value: string | number | null) {
    onUpdate(lead.id, { [field]: value } as Partial<LeadInput>);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="bg-white border border-brand-cream rounded-lg shadow-sm hover:border-brand-copper/40 hover:shadow-md transition-all overflow-hidden">

        {/* Drag handle — grip icon, top-right, visible on hover */}
        <div
          {...listeners}
          {...attributes}
          onPointerDown={(e) => { e.stopPropagation(); }}
          className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-30 hover:!opacity-60 cursor-grab active:cursor-grabbing p-1 rounded"
          title="Drag to move"
        >
          <GripVertical size={12} className="text-brand-charcoal" />
        </div>

        {/* Card body — navigates to detail page */}
        <Link
          href={`/leads/${lead.id}`}
          onClick={(e) => { if (isDragging) e.preventDefault(); }}
          className="block p-3 space-y-2 select-none"
          tabIndex={-1}
        >
          <div className="flex items-start gap-2 pr-4">
            <span className={`mt-[5px] w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} title={STATUS_LABELS[lead.status]} />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm text-brand-charcoal leading-tight truncate">{lead.client_name ?? '—'}</div>
              {lead.program_name && <div className="text-xs text-brand-silver truncate mt-0.5">{lead.program_name}</div>}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-brand-silver">
            <span className="truncate">
              {lead.start_date ? fmtDate(lead.start_date) : <span className="italic">No date</span>}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {lead.guest_count != null && (
                <span className="bg-brand-offwhite border border-brand-cream rounded px-1.5 py-0.5 text-[10px]">{lead.guest_count}g</span>
              )}
              {ownerName && (
                <span className="bg-brand-offwhite border border-brand-cream rounded px-1.5 py-0.5 text-[10px]">{ownerName}</span>
              )}
            </div>
          </div>
        </Link>

        {/* Inline edit controls — appear on hover, don't trigger navigation */}
        <div
          className="hidden group-hover:block border-t border-brand-cream/60 bg-brand-offwhite/70 px-2 py-1.5 space-y-1"
          onPointerDown={noPropagate}
          onClick={noPropagate}
        >
          {/* Fine-grained status (statuses within this lane) */}
          {laneStatuses.length > 1 && (
            <select
              value={lead.status}
              onChange={e => handleField('status', e.target.value)}
              className="w-full text-[10px] border border-brand-cream rounded px-1.5 py-0.5 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
              title="Status"
            >
              {laneStatuses.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          )}
          {/* Owner */}
          <select
            value={lead.assigned_to != null ? String(lead.assigned_to) : ''}
            onChange={e => handleField('assigned_to', e.target.value ? Number(e.target.value) : null)}
            className="w-full text-[10px] border border-brand-cream rounded px-1.5 py-0.5 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
            title="Owner"
          >
            <option value="">— Owner —</option>
            {activeMembers.map(m => (
              <option key={m.id} value={String(m.id)}>{m.first_name} {m.last_name}</option>
            ))}
          </select>
          {/* Event date */}
          <input
            type="date"
            value={lead.start_date?.slice(0, 10) ?? ''}
            onChange={e => handleField('start_date', e.target.value || null)}
            className="w-full text-[10px] border border-brand-cream rounded px-1.5 py-0.5 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
            title="Event date"
          />
        </div>
      </div>
    </div>
  );
}
