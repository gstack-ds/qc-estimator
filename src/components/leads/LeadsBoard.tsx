'use client';

import { useState, useMemo, useTransition, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { DbLead, DbTeamMember, LinkedProgramSummary } from '@/lib/supabase/queries';
import type { LeadInput } from '@/app/(programs)/leads/actions';
import { updateLead } from '@/app/(programs)/leads/actions';
import { syncProgramStatusFromLead } from '@/app/(programs)/programs/actions';
import {
  PIPELINE_LANES,
  statusToLaneId,
  getLane,
  laneStyles,
  type PipelineLane,
} from '@/lib/leads/pipeline';
import type { LeadStatus } from '@/lib/leads/constants';
import LeadCard, { LeadCardContent } from './LeadCard';

// Lanes collapsed by default (finished records)
const DEFAULT_COLLAPSED = new Set(['completed', 'did_not_book']);
const STORAGE_KEY = 'qc-board-collapsed-lanes';

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {}
  return new Set(DEFAULT_COLLAPSED);
}

function saveCollapsed(collapsed: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]));
  } catch {}
}

// ─── Droppable lane ───────────────────────────────────────
// The entire column (header + cards area) is the droppable target so that
// dropping anywhere in a lane — including the header — registers correctly.

function KanbanLane({
  lane, leads, teamMembers, linkedPrograms, collapsed, onToggleCollapse, onCardUpdate, justMovedId,
}: {
  lane: PipelineLane;
  leads: DbLead[];
  teamMembers: DbTeamMember[];
  linkedPrograms: Record<string, LinkedProgramSummary>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCardUpdate: (leadId: string, patch: Partial<LeadInput>) => void;
  justMovedId: string | null;
}) {
  // Apply setNodeRef to the OUTER column div so the full column is droppable
  const { setNodeRef, isOver } = useDroppable({ id: lane.id });
  const styles = laneStyles(lane.id);

  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        onClick={onToggleCollapse}
        className={`flex flex-col items-center w-10 flex-shrink-0 rounded-lg border border-t-2 cursor-pointer select-none transition-all duration-150 ${
          styles.headerBorder
        } ${isOver
          ? 'bg-brand-copper/15 border-brand-copper/50 scale-[1.02]'
          : 'bg-brand-offwhite/60 border-brand-cream hover:bg-brand-offwhite'
        }`}
      >
        <div className="flex flex-col items-center py-2.5 gap-2 w-full">
          <ChevronRight size={12} className="text-brand-silver flex-shrink-0" />
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`} />
          <span className="text-[10px] font-semibold text-brand-silver bg-brand-cream/80 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
            {leads.length}
          </span>
          <span
            className="text-[9px] font-semibold text-brand-charcoal/60 leading-tight flex-1 flex items-center"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {lane.label}
          </span>
        </div>
      </div>
    );
  }

  return (
    // Full column is the droppable — gives accurate targeting anywhere in the lane
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[220px] w-[220px] flex-shrink-0 rounded-lg transition-all duration-150 ${
        isOver ? 'ring-2 ring-brand-copper/50 ring-offset-1 scale-[1.01]' : ''
      }`}
    >
      {/* Lane header */}
      <div className={`bg-white border border-brand-cream border-t-2 rounded-t-lg px-3 py-2.5 ${styles.headerBorder}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`} />
          <span className="text-xs font-semibold text-brand-charcoal leading-tight flex-1">{lane.label}</span>
          <span className="text-[10px] font-medium text-brand-silver bg-brand-offwhite border border-brand-cream rounded-full px-1.5 py-0.5 flex-shrink-0">
            {leads.length}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
            className="text-brand-silver hover:text-brand-charcoal transition-colors flex-shrink-0 p-0.5 rounded"
            title="Collapse lane"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {/* Cards area */}
      <div
        className={`flex-1 min-h-[200px] p-2 space-y-2 rounded-b-lg border border-t-0 transition-colors duration-150 ${
          isOver
            ? 'bg-brand-copper/5 border-brand-copper/30'
            : 'bg-brand-offwhite/50 border-brand-cream'
        }`}
      >
        {leads.map(lead => (
          <LeadCard
            key={lead.id}
            lead={lead}
            teamMembers={teamMembers}
            laneStatuses={lane.statuses as LeadStatus[]}
            onUpdate={onCardUpdate}
            isJustMoved={lead.id === justMovedId}
            linkedProgram={linkedPrograms[lead.id]}
          />
        ))}
        {leads.length === 0 && (
          <div className={`flex items-center justify-center h-16 text-xs transition-colors duration-150 ${
            isOver ? 'text-brand-copper/60 font-medium' : 'text-brand-silver/50 italic'
          }`}>
            {isOver ? 'Drop here' : 'Empty'}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Board ────────────────────────────────────────────────

interface Props {
  leads: DbLead[];
  teamMembers: DbTeamMember[];
  linkedPrograms: Record<string, LinkedProgramSummary>;
}

const JUST_MOVED_TTL_MS = 3000;

export default function LeadsBoard({ leads, teamMembers, linkedPrograms }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Optimistic local state
  const [localLeads, setLocalLeads] = useState<DbLead[]>(leads);
  useMemo(() => { setLocalLeads(leads); }, [leads]);

  // Collapse state
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(DEFAULT_COLLAPSED));
  useEffect(() => { setCollapsed(loadCollapsed()); }, []);

  // Just-moved tracking — briefly pins the moved card to the top of its destination lane
  const [justMovedId, setJustMovedId] = useState<string | null>(null);
  const justMovedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function markJustMoved(leadId: string) {
    if (justMovedTimer.current) clearTimeout(justMovedTimer.current);
    setJustMovedId(leadId);
    justMovedTimer.current = setTimeout(() => setJustMovedId(null), JUST_MOVED_TTL_MS);
  }

  function toggleCollapse(laneId: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(laneId)) next.delete(laneId); else next.add(laneId);
      saveCollapsed(next);
      return next;
    });
  }

  // Filters
  const [ownerFilter, setOwnerFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Active drag (for overlay)
  const [activeLead, setActiveLead] = useState<DbLead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filtered = useMemo(() => {
    let base = localLeads;
    if (ownerFilter) base = base.filter(l => String(l.assigned_to) === ownerFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(l =>
        (l.client_name ?? '').toLowerCase().includes(q) ||
        (l.program_name ?? '').toLowerCase().includes(q)
      );
    }
    if (dateFrom) base = base.filter(l => l.start_date != null && l.start_date >= dateFrom);
    if (dateTo)   base = base.filter(l => l.start_date != null && l.start_date <= dateTo);
    return base;
  }, [localLeads, ownerFilter, search, dateFrom, dateTo]);

  const leadsByLane = useMemo(() => {
    const map = new Map<string, DbLead[]>(PIPELINE_LANES.map(l => [l.id, []]));
    for (const lead of filtered) {
      const laneId = statusToLaneId(lead.status);
      map.get(laneId)?.push(lead);
    }
    // Sort each lane: just-moved card floats to the top, rest by start_date asc
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        // Just-moved card always first
        if (a.id === justMovedId) return -1;
        if (b.id === justMovedId) return 1;
        // Then sort by start_date ascending, nulls last
        if (!a.start_date && !b.start_date) return 0;
        if (!a.start_date) return 1;
        if (!b.start_date) return -1;
        return a.start_date.localeCompare(b.start_date);
      });
    }
    return map;
  }, [filtered, justMovedId]);

  // Shared update handler
  const handleUpdate = useCallback((leadId: string, patch: Partial<LeadInput>) => {
    setLocalLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...patch } : l));
    startTransition(async () => {
      await updateLead(leadId, patch);
      router.refresh();
    });
  }, [router, startTransition]);

  function handleDragStart({ active }: DragStartEvent) {
    setActiveLead(localLeads.find(l => l.id === active.id) ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveLead(null);
    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;

    // over.id is always a lane ID when using pointerWithin + full-column droppables
    const targetLane = getLane(overId);
    if (!targetLane) return;

    const draggedLead = localLeads.find(l => l.id === leadId);
    if (!draggedLead) return;

    // No-op: dropped back into the same lane
    if (statusToLaneId(draggedLead.status) === targetLane.id) return;

    const newStatus = targetLane.canonicalStatus;
    handleUpdate(leadId, { status: newStatus });
    markJustMoved(leadId);

    const linked = linkedPrograms[leadId];
    if (linked) {
      startTransition(async () => {
        await syncProgramStatusFromLead(linked.id, newStatus);
      });
    }
  }

  const activeMembers = teamMembers.filter(m => m.is_active);
  const hasFilters = ownerFilter || search || dateFrom || dateTo;

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search client or program…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-brand-cream rounded px-3 py-1.5 text-sm bg-white text-brand-charcoal placeholder:text-brand-silver focus:outline-none focus:ring-1 focus:ring-brand-copper w-48"
        />
        <select
          value={ownerFilter}
          onChange={e => setOwnerFilter(e.target.value)}
          className="border border-brand-cream rounded px-2 py-1.5 text-sm bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
        >
          <option value="">All owners</option>
          {activeMembers.map(m => (
            <option key={m.id} value={String(m.id)}>{m.first_name} {m.last_name}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 text-xs text-brand-silver">
          <span>Event date:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-brand-cream rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-copper" />
          <span>–</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-brand-cream rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-copper" />
        </div>
        {hasFilters && (
          <button onClick={() => { setSearch(''); setOwnerFilter(''); setDateFrom(''); setDateTo(''); }}
            className="text-xs text-brand-silver hover:text-brand-charcoal transition-colors">
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-brand-silver">{filtered.length} leads</span>
      </div>

      {/* Board */}
      <div className="overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-2 min-w-max items-start">
            {PIPELINE_LANES.map(lane => (
              <KanbanLane
                key={lane.id}
                lane={lane}
                leads={leadsByLane.get(lane.id) ?? []}
                teamMembers={teamMembers}
                linkedPrograms={linkedPrograms}
                collapsed={collapsed.has(lane.id)}
                onToggleCollapse={() => toggleCollapse(lane.id)}
                onCardUpdate={handleUpdate}
                justMovedId={justMovedId}
              />
            ))}
          </div>

          <DragOverlay
            dropAnimation={{
              duration: 180,
              easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.1)',
            }}
          >
            {activeLead && (
              <div className="w-[210px] rotate-1 opacity-90 drop-shadow-lg">
                <LeadCardContent lead={activeLead} teamMembers={teamMembers} isOverlay />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
