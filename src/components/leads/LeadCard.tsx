'use client';

import { useTransition } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import Link from 'next/link';
import type { DbLead, DbTeamMember, LinkedProgramSummary } from '@/lib/supabase/queries';
import { statusToLane, laneStyles } from '@/lib/leads/pipeline';
import { STATUS_LABELS, type LeadStatus } from '@/lib/leads/constants';
import type { LeadInput } from '@/app/(programs)/leads/actions';
import FlexibleDateInput from './FlexibleDateInput';

// Ordered statuses for the inline dropdown — active pipeline first, then closed
const ACTIVE_STATUSES: LeadStatus[] = [
  'tracking_on_hold', 'new_lead', 'proposal_in_progress', 'pending_client_review',
  'negotiations', 'pending_contract_payment', 'under_contract', 'post_event_close_out',
  'completed', 'did_not_book', 'unresponsive',
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d: string | null) {
  if (!d) return null;
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${day}, ${y}`;
}
function fmtDateShort(d: string | null) {
  if (!d) return null;
  const [, m, day] = d.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${day}`;
}
function dueDateUrgency(d: string | null): 'overdue' | 'soon' | null {
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d + 'T00:00:00');
  const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'overdue';
  if (diff <= 3) return 'soon';
  return null;
}

// ─── Read-only content (used for DragOverlay) ─────────────

interface ContentProps {
  lead: DbLead;
  teamMembers: DbTeamMember[];
  isOverlay?: boolean;
  linkedProgram?: LinkedProgramSummary;
}

export function LeadCardContent({ lead, teamMembers, isOverlay = false, linkedProgram }: ContentProps) {
  const lane = statusToLane(lead.status);
  const styles = laneStyles(lane?.id ?? 'did_not_book');
  const owner = teamMembers.find(m => m.id === lead.assigned_to);

  return (
    <div className={`border rounded-lg overflow-hidden select-none ${styles.cardBg} ${
      isOverlay ? 'shadow-xl rotate-1 opacity-95' : 'shadow-sm'
    }`}>
      <div className={`border-l-4 ${styles.cardBorder} p-3 space-y-2`}>
        <div className="flex items-start gap-2">
          <span className={`mt-[5px] w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`} title={STATUS_LABELS[lead.status]} />
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
              <span className="bg-white/70 border border-brand-cream rounded px-1.5 py-0.5 text-[10px]">{lead.guest_count}g</span>
            )}
            {owner && (
              <span className="bg-white/70 border border-brand-cream rounded px-1.5 py-0.5 text-[10px]">{owner.first_name}</span>
            )}
          </div>
        </div>
        {lead.current_due_date && (() => {
          const urgency = dueDateUrgency(lead.current_due_date);
          return (
            <div className={`text-[10px] font-medium px-1.5 py-0.5 rounded inline-block ${
              urgency === 'overdue' ? 'bg-red-100 text-red-700' :
              urgency === 'soon'   ? 'bg-amber-100 text-amber-700' :
              'bg-white/60 text-brand-silver'
            }`}>
              Due {fmtDateShort(lead.current_due_date)}
            </div>
          );
        })()}
        {linkedProgram && (
          <div className="text-[9px] font-semibold text-brand-copper truncate">→ {linkedProgram.name}</div>
        )}
        {linkedProgram?.program_type && (
          <span className="inline-block text-[9px] font-medium bg-brand-charcoal/10 text-brand-charcoal/70 rounded px-1.5 py-0.5">
            {linkedProgram.program_type}
          </span>
        )}
        {linkedProgram?.staffing_needs_count != null && linkedProgram.staffing_needs_count > 0 && (
          <span className="inline-block text-[9px] font-medium bg-red-100 text-red-700 rounded px-1.5 py-0.5">
            Staffing: {linkedProgram.staffing_needs_count} open
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Draggable + inline-editable card ────────────────────

interface CardProps {
  lead: DbLead;
  teamMembers: DbTeamMember[];
  laneStatuses: LeadStatus[];
  onUpdate: (leadId: string, patch: Partial<LeadInput>) => void;
  isJustMoved?: boolean;
  linkedProgram?: LinkedProgramSummary;
}

export default function LeadCard({ lead, teamMembers, laneStatuses, onUpdate, isJustMoved = false, linkedProgram }: CardProps) {
  const [, startTransition] = useTransition();
  void startTransition; // suppress unused warning — kept for parity with server actions pattern
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { status: lead.status },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const lane = statusToLane(lead.status);
  const styles = laneStyles(lane?.id ?? 'did_not_book');
  const activeMembers = teamMembers.filter(m => m.is_active);

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
      <div className={`border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${styles.cardBg} ${
        isJustMoved
          ? 'border-brand-copper ring-2 ring-brand-copper/40 ring-offset-1'
          : 'border-brand-cream'
      }`}>
        <div className={`border-l-4 ${styles.cardBorder}`}>

          {/* Drag handle */}
          <div
            {...listeners}
            {...attributes}
            className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-30 hover:!opacity-60 cursor-grab active:cursor-grabbing p-1 rounded"
            title="Drag"
          >
            <GripVertical size={12} className="text-brand-charcoal" />
          </div>

          {/* Card body */}
          <Link
            href={`/leads/${lead.id}`}
            onClick={(e) => { if (isDragging) e.preventDefault(); }}
            className="block p-3 space-y-2 select-none"
            tabIndex={-1}
          >
            <div className="flex items-start gap-2 pr-5">
              <span className={`mt-[5px] w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`} title={STATUS_LABELS[lead.status]} />
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
                  <span className="bg-white/70 border border-brand-cream rounded px-1.5 py-0.5 text-[10px]">{lead.guest_count}g</span>
                )}
                {teamMembers.find(m => m.id === lead.assigned_to) && (
                  <span className="bg-white/70 border border-brand-cream rounded px-1.5 py-0.5 text-[10px]">
                    {teamMembers.find(m => m.id === lead.assigned_to)!.first_name}
                  </span>
                )}
              </div>
            </div>
            {lead.current_due_date && (() => {
              const urgency = dueDateUrgency(lead.current_due_date);
              return (
                <div className={`text-[10px] font-medium px-1.5 py-0.5 rounded inline-block ${
                  urgency === 'overdue' ? 'bg-red-100 text-red-700' :
                  urgency === 'soon'   ? 'bg-amber-100 text-amber-700' :
                  'bg-white/60 text-brand-silver'
                }`}>
                  Due {fmtDateShort(lead.current_due_date)}
                </div>
              );
            })()}
            {/* Program type badge */}
            {linkedProgram?.program_type && (
              <span className="inline-block text-[9px] font-medium bg-brand-charcoal/10 text-brand-charcoal/60 rounded px-1.5 py-0.5">
                {linkedProgram.program_type}
              </span>
            )}
            {/* Staffing needs badge */}
            {linkedProgram?.staffing_needs_count != null && linkedProgram.staffing_needs_count > 0 && (
              <span className="inline-block text-[9px] font-medium bg-red-100 text-red-700 rounded px-1.5 py-0.5">
                Staffing: {linkedProgram.staffing_needs_count} open
              </span>
            )}
          </Link>

          {/* Converted-lead banner */}
          {linkedProgram && (
            <Link
              href={`/programs/${linkedProgram.id}`}
              onPointerDown={noPropagate}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-3 py-1 bg-brand-copper/10 border-t border-brand-copper/15 hover:bg-brand-copper/20 transition-colors"
            >
              <span className="text-[9px] font-semibold text-brand-copper truncate">→ {linkedProgram.name}</span>
            </Link>
          )}

          {/* Inline edit controls — always show status dropdown, hover-revealed */}
          <div
            className="hidden group-hover:block border-t border-brand-cream/60 bg-white/60 px-2 py-1.5 space-y-1"
            onPointerDown={noPropagate}
            onClick={noPropagate}
          >
            <select
              value={lead.status}
              onChange={e => handleField('status', e.target.value)}
              className="w-full text-[10px] border border-brand-cream rounded px-1.5 py-0.5 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
              title="Status"
            >
              {ACTIVE_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
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
            <FlexibleDateInput
              label="Event date"
              value={lead.start_date?.slice(0, 10) ?? null}
              onChange={v => handleField('start_date', v)}
              className="w-full text-xs border border-brand-cream rounded px-1.5 py-0.5 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
            />
            <FlexibleDateInput
              label="Due date"
              value={lead.current_due_date?.slice(0, 10) ?? null}
              onChange={v => handleField('current_due_date', v)}
              className="w-full text-xs border border-brand-cream rounded px-1.5 py-0.5 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
