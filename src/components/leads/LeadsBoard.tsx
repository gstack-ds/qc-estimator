'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { DbLead, DbTeamMember } from '@/lib/supabase/queries';
import type { LeadInput } from '@/app/(programs)/leads/actions';
import { updateLead } from '@/app/(programs)/leads/actions';
import {
  PIPELINE_LANES,
  statusToLaneId,
  getLane,
  LANE_DOT_CLASSES,
  LANE_ACCENT_CLASSES,
} from '@/lib/leads/pipeline';
import LeadCard, { LeadCardContent } from './LeadCard';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d: string | null) {
  if (!d) return null;
  const [, m, day] = d.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${day}`;
}

// ─── Droppable Lane ───────────────────────────────────────

function KanbanLane({
  laneId, label, color, leads, teamMembers,
}: {
  laneId: string;
  label: string;
  color: string;
  leads: DbLead[];
  teamMembers: DbTeamMember[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: laneId });

  return (
    <div className="flex flex-col min-w-[220px] w-[220px] flex-shrink-0">
      {/* Lane header */}
      <div className={`bg-white border border-brand-cream border-t-2 rounded-t-lg px-3 py-2.5 ${LANE_ACCENT_CLASSES[color]}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${LANE_DOT_CLASSES[color]}`} />
          <span className="text-xs font-semibold text-brand-charcoal leading-tight flex-1">{label}</span>
          <span className="text-[10px] font-medium text-brand-silver bg-brand-offwhite border border-brand-cream rounded-full px-1.5 py-0.5 flex-shrink-0">
            {leads.length}
          </span>
        </div>
      </div>

      {/* Cards container */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] p-2 space-y-2 rounded-b-lg border border-t-0 border-brand-cream transition-colors ${
          isOver ? 'bg-brand-copper/5 border-brand-copper/30' : 'bg-brand-offwhite/50'
        }`}
      >
        {leads.map(lead => (
          <LeadCard key={lead.id} lead={lead} teamMembers={teamMembers} />
        ))}
        {leads.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-brand-silver/50 italic">
            Drop here
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
}

export default function LeadsBoard({ leads, teamMembers }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Optimistic local state — starts from server-fetched leads
  const [localLeads, setLocalLeads] = useState<DbLead[]>(leads);

  // Sync with server when parent refreshes (leads prop changes)
  useMemo(() => { setLocalLeads(leads); }, [leads]);

  // Filter state
  const [ownerFilter, setOwnerFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Active drag state (for overlay)
  const [activeLead, setActiveLead] = useState<DbLead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Filtered leads
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

  // Group by lane
  const leadsByLane = useMemo(() => {
    const map = new Map<string, DbLead[]>(PIPELINE_LANES.map(l => [l.id, []]));
    for (const lead of filtered) {
      const laneId = statusToLaneId(lead.status);
      map.get(laneId)?.push(lead);
    }
    // Sort each lane by start_date ascending, nulls last
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        if (!a.start_date && !b.start_date) return 0;
        if (!a.start_date) return 1;
        if (!b.start_date) return -1;
        return a.start_date.localeCompare(b.start_date);
      });
    }
    return map;
  }, [filtered]);

  function handleDragStart({ active }: DragStartEvent) {
    const lead = localLeads.find(l => l.id === active.id);
    setActiveLead(lead ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveLead(null);
    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;

    // Resolve target lane: either dropped directly on a lane or on a card in a lane
    let targetLane = getLane(overId);
    if (!targetLane) {
      // over is a lead id — find its lane
      const overLead = localLeads.find(l => l.id === overId);
      if (overLead) targetLane = getLane(statusToLaneId(overLead.status));
    }
    if (!targetLane) return;

    const draggedLead = localLeads.find(l => l.id === leadId);
    if (!draggedLead) return;

    const currentLaneId = statusToLaneId(draggedLead.status);
    if (currentLaneId === targetLane.id) return; // no-op

    const newStatus = targetLane.canonicalStatus;

    // Optimistic update
    setLocalLeads(prev =>
      prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l)
    );

    // Persist + refresh
    startTransition(async () => {
      await updateLead(leadId, { status: newStatus } as LeadInput);
      router.refresh();
    });
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
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-brand-cream rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-copper"
          />
          <span>–</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border border-brand-cream rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-copper"
          />
        </div>
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setOwnerFilter(''); setDateFrom(''); setDateTo(''); }}
            className="text-xs text-brand-silver hover:text-brand-charcoal transition-colors"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-brand-silver">{filtered.length} leads</span>
      </div>

      {/* Kanban lanes */}
      <div className="overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 min-w-max">
            {PIPELINE_LANES.map(lane => (
              <KanbanLane
                key={lane.id}
                laneId={lane.id}
                label={lane.label}
                color={lane.color}
                leads={leadsByLane.get(lane.id) ?? []}
                teamMembers={teamMembers}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeLead && (
              <div className="w-[210px]">
                <LeadCardContent lead={activeLead} teamMembers={teamMembers} isOverlay />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
