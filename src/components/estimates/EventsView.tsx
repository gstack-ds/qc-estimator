'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateEstimate, reorderEstimates, updateEstimateProposalInclusion } from '@/app/(programs)/programs/[id]/estimates/actions';
import { deleteEvent, updateEvent, updateBudgetEntry } from '@/app/(programs)/programs/actions';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AddEstimateButton from './AddEstimateButton';
import AddEventButton from './AddEventButton';
import AssignedToBadge from './AssignedToBadge';
import type { EstimateCard } from './ComparisonView';
import type { DbBudgetPlanEntry, DbTeamMember } from '@/lib/supabase/queries';
import { compareEstimateToBudget, combineEstimatesToBudget, type ComparisonStatus } from '@/lib/engine/budgetComparison';
import type { BudgetTarget } from '@/lib/engine/budgetComparison';

// ─── Event type display config ────────────────────────────

const EVENT_TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  logistics:          { label: 'Logistics',          bg: 'bg-gray-100',   text: 'text-gray-600' },
  general_session:    { label: 'General Session',    bg: 'bg-blue-100',   text: 'text-blue-700' },
  formal_dinner:      { label: 'Formal Dinner',      bg: 'bg-purple-100', text: 'text-purple-700' },
  experiential:       { label: 'Experiential',       bg: 'bg-green-100',  text: 'text-green-700' },
  excursion:          { label: 'Excursion',           bg: 'bg-orange-100', text: 'text-orange-700' },
  cocktail_reception: { label: 'Cocktail Reception', bg: 'bg-red-100',    text: 'text-red-700' },
  dine_around:        { label: 'Dine Around',        bg: 'bg-orange-100', text: 'text-orange-700' },
  breakfast:          { label: 'Breakfast',           bg: 'bg-amber-100',  text: 'text-amber-700' },
  lunch:              { label: 'Lunch',               bg: 'bg-teal-100',   text: 'text-teal-700' },
  custom:             { label: 'Custom',              bg: 'bg-stone-100',  text: 'text-stone-600' },
};

const EVENT_TYPE_OPTIONS = [
  { value: 'general_session',    label: 'General Session' },
  { value: 'formal_dinner',      label: 'Formal Dinner' },
  { value: 'cocktail_reception', label: 'Cocktail Reception' },
  { value: 'breakfast',          label: 'Breakfast' },
  { value: 'lunch',              label: 'Lunch' },
  { value: 'dine_around',        label: 'Dine Around' },
  { value: 'experiential',       label: 'Experiential' },
  { value: 'excursion',          label: 'Excursion' },
  { value: 'logistics',          label: 'Logistics' },
  { value: 'custom',             label: 'Custom' },
];

function getEventTypeConfig(type: string) {
  return EVENT_TYPE_CONFIG[type] ?? { label: type, bg: 'bg-gray-100', text: 'text-gray-600' };
}

// ─── Types ────────────────────────────────────────────────

export interface EventRow {
  id: string;
  name: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  guest_count: number;
  event_type: string;
  description: string | null;
  cards: EstimateCard[];
  budgetEntry: DbBudgetPlanEntry | null;
  budget_amount: number | null;
  budget_basis: 'overall' | 'per_person' | null;
}

interface Props {
  programId: string;
  events: EventRow[];
  unassignedCards: EstimateCard[];
  programGuestCount: number;
  teamMembers: DbTeamMember[];
}

// ─── Budget comparison helpers ────────────────────────────

function budgetTargetFromEntry(entry: DbBudgetPlanEntry, guestCount: number): BudgetTarget {
  return {
    pricingBasis: entry.pricing_basis,
    valueLow: entry.entry_type === 'pooled' ? (entry.pool_total ?? 0) : entry.value_low,
    valueHigh: entry.entry_type === 'pooled' ? (entry.pool_total ?? 0) : entry.value_high,
    pinnedValue: entry.pinned_value,
    guestCount,
  };
}

function statusColors(status: ComparisonStatus) {
  if (status === 'under') return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
  if (status === 'within_range') return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
  return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
}

function fmtDelta(delta: number, pricingBasis: 'per_person' | 'flat') {
  const sign = delta >= 0 ? '+' : '−';
  const suffix = pricingBasis === 'per_person' ? '/pp' : '';
  return `${sign}$${Math.round(Math.abs(delta)).toLocaleString('en-US')}${suffix}`;
}

// ─── Formatting helpers ───────────────────────────────────

function fmt(val: number) {
  return '$' + Math.round(val).toLocaleString('en-US');
}

function fmtDate(d: string | null) {
  if (!d) return null;
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} ${parseInt(day)}, ${y}`;
}

function fmtTime(t: string | null) {
  if (!t) return null;
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}:${mStr} ${ampm}`;
}

// ─── DeltaInfo ────────────────────────────────────────────

interface DeltaInfo {
  delta: number;
  status: ComparisonStatus;
  budgetLow: number;
  budgetHigh: number;
  pricingBasis: 'per_person' | 'flat';
}

// ─── Sortable estimate card wrapper ──────────────────────

function SortableEstimateCard({ card, programId, isLowest, isBestMargin, onToggleBudget, onToggleProposal, onAssign, teamMembers, eventGuestCount, delta }: {
  card: EstimateCard;
  programId: string;
  isLowest: boolean;
  isBestMargin: boolean;
  onToggleBudget: (id: string, next: boolean) => void;
  onToggleProposal: (id: string, next: boolean) => void;
  onAssign: (id: string, memberId: number | null) => void;
  teamMembers: DbTeamMember[];
  eventGuestCount?: number;
  delta?: DeltaInfo;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <EstimateCardItem
        card={card}
        programId={programId}
        isLowest={isLowest}
        isBestMargin={isBestMargin}
        onToggleBudget={onToggleBudget}
        onToggleProposal={onToggleProposal}
        onAssign={onAssign}
        teamMembers={teamMembers}
        eventGuestCount={eventGuestCount}
        delta={delta}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// ─── Estimate card (mini) ─────────────────────────────────

function EstimateCardItem({
  card,
  programId,
  isLowest,
  isBestMargin,
  onToggleBudget,
  onToggleProposal,
  onAssign,
  teamMembers,
  eventGuestCount,
  delta: deltaInfo,
  dragHandleProps,
}: {
  card: EstimateCard;
  programId: string;
  isLowest: boolean;
  isBestMargin: boolean;
  onToggleBudget: (id: string, next: boolean) => void;
  onToggleProposal: (id: string, next: boolean) => void;
  onAssign: (id: string, memberId: number | null) => void;
  teamMembers: DbTeamMember[];
  eventGuestCount?: number;
  delta?: DeltaInfo;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const displayedPricePerPerson = eventGuestCount && eventGuestCount > 0
    ? Math.ceil(card.total / eventGuestCount)
    : card.pricePerPerson;
  return (
    <div className="relative bg-white rounded-lg border border-brand-cream overflow-hidden">
      {/* Drag handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="absolute top-2 right-2 cursor-grab text-brand-silver/40 hover:text-brand-silver/80 transition-colors z-10"
          onClick={(e) => e.preventDefault()}
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm6 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm6 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm6 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
          </svg>
        </div>
      )}
      <Link
        href={`/programs/${programId}/estimates/${card.id}`}
        className="relative block p-4 flex flex-col gap-2.5 transition-all hover:shadow-md cursor-pointer"
      >
        {/* Accent bars */}
        {isLowest && !isBestMargin && <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />}
        {!isLowest && isBestMargin && <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: '#C19C81' }} />}
        {isLowest && isBestMargin && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500">
            <div className="absolute bottom-0 left-0 right-0 h-1/2" style={{ backgroundColor: '#C19C81' }} />
          </div>
        )}

        {/* Name + badges */}
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium text-brand-charcoal text-sm leading-snug">{card.name}</span>
          {(isLowest || isBestMargin) && (
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {isLowest && (
                <span className="text-xs bg-green-100 text-green-800 font-medium px-1.5 py-0.5 rounded">Lowest</span>
              )}
              {isBestMargin && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: '#C19C81', color: 'white' }}>Best Margin</span>
              )}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="flex items-end gap-4">
          <div>
            <p className="font-serif text-lg font-medium text-brand-charcoal">{fmt(card.total)}</p>
            <p className="text-xs text-brand-silver mt-0.5">total estimate</p>
          </div>
          {displayedPricePerPerson > 0 && (
            <div>
              <p className="text-sm font-medium text-brand-brown">
                ${displayedPricePerPerson.toLocaleString('en-US')}
                <span className="text-xs font-normal text-brand-silver">/pp</span>
              </p>
            </div>
          )}
        </div>

        {/* Line item count + QC Margin */}
        <div className="space-y-0.5">
          <p className="text-xs text-brand-silver">{card.lineItemCount} line item{card.lineItemCount !== 1 ? 's' : ''}</p>
          {card.total > 0 && (
            <p className="text-xs text-brand-silver/70">QC Margin: {(card.qcMarginPct * 100).toFixed(1)}%</p>
          )}
        </div>

        {/* Budget delta badge */}
        {deltaInfo && card.total > 0 && (
          <div className={`text-xs font-medium px-2 py-1 rounded border ${statusColors(deltaInfo.status).bg} ${statusColors(deltaInfo.status).text} ${statusColors(deltaInfo.status).border}`}>
            {fmtDelta(deltaInfo.delta, deltaInfo.pricingBasis)} vs budget
          </div>
        )}
      </Link>

      {/* Toggles: budget + proposal */}
      <div className="border-t border-brand-cream px-4 py-2.5 flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.preventDefault()}>
          <div
            onClick={(e) => { e.preventDefault(); onToggleBudget(card.id, !card.includeInBudget); }}
            className={`w-8 h-4 rounded-full transition-colors cursor-pointer flex-shrink-0 ${card.includeInBudget ? 'bg-brand-brown' : 'bg-brand-silver/40'}`}
          >
            <div className={`w-3 h-3 bg-white rounded-full mt-0.5 transition-transform ${card.includeInBudget ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs text-brand-charcoal/70">In Budget</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.preventDefault()}>
          <div
            onClick={(e) => { e.preventDefault(); onToggleProposal(card.id, !card.includedInProposal); }}
            className={`w-8 h-4 rounded-full transition-colors cursor-pointer flex-shrink-0 ${card.includedInProposal ? 'bg-brand-copper' : 'bg-brand-silver/40'}`}
          >
            <div className={`w-3 h-3 bg-white rounded-full mt-0.5 transition-transform ${card.includedInProposal ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs text-brand-charcoal/70">In Proposal</span>
        </label>
        <AssignedToBadge
          assignedTo={card.assignedTo}
          teamMembers={teamMembers}
          onAssign={(memberId) => onAssign(card.id, memberId)}
        />
      </div>
    </div>
  );
}

// ─── Single event card ────────────────────────────────────

function EventCard({
  event,
  programId,
  cards,
  onToggleBudget,
  onToggleProposal,
  onAssign,
  teamMembers,
  onDelete,
  onUpdate,
}: {
  event: EventRow;
  programId: string;
  cards: EstimateCard[];
  onToggleBudget: (id: string, next: boolean) => void;
  onToggleProposal: (id: string, next: boolean) => void;
  onAssign: (id: string, memberId: number | null) => void;
  teamMembers: DbTeamMember[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: Partial<EventRow>) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedExcluded, setExpandedExcluded] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<'compare_each' | 'combine'>(
    event.budgetEntry?.comparison_mode ?? 'compare_each'
  );

  // Maintain local display order, initialized from sortOrder
  const [cardOrder, setCardOrder] = useState<string[]>(() =>
    [...cards].sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.id)
  );

  // Keep order in sync when cards array changes (new cards added, existing removed)
  useEffect(() => {
    const cardIds = new Set(cards.map((c) => c.id));
    setCardOrder((prev) => [
      ...prev.filter((id) => cardIds.has(id)),
      ...[...cards]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => c.id)
        .filter((id) => !prev.includes(id)),
    ]);
  }, [cards]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const orderedCards = cardOrder.map((id) => cards.find((c) => c.id === id)).filter(Boolean) as EstimateCard[];
  const includedCards = orderedCards.filter((c) => c.includedInProposal);
  const excludedCards = orderedCards.filter((c) => !c.includedInProposal);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editGuestCount, setEditGuestCount] = useState(0);
  const [editEventType, setEditEventType] = useState('');
  const [editBudgetAmount, setEditBudgetAmount] = useState('');
  const [editBudgetBasis, setEditBudgetBasis] = useState<'overall' | 'per_person'>('overall');

  const cfg = getEventTypeConfig(event.event_type);

  const withTotal = cards.filter((c) => c.total > 0);
  const groupLowest = withTotal.length > 1 ? Math.min(...withTotal.map((c) => c.total)) : null;
  const groupBestMargin = withTotal.length > 0 ? Math.max(...withTotal.map((c) => c.qcMarginPct)) : null;

  const dateStr = fmtDate(event.event_date);
  const startStr = fmtTime(event.start_time);
  const endStr = fmtTime(event.end_time);
  const timeStr = startStr && endStr ? `${startStr} – ${endStr}` : startStr ?? endStr;

  const guestCount = event.guest_count > 0 ? event.guest_count : undefined;
  const budgetTarget = event.budgetEntry
    ? budgetTargetFromEntry(event.budgetEntry, event.guest_count > 0 ? event.guest_count : 0)
    : null;

  // Event-level budget takes precedence over budget plan entry for compare_each badges.
  const eventBudgetTarget: BudgetTarget | null =
    event.budget_amount !== null && event.budget_amount > 0
      ? {
          pricingBasis: event.budget_basis === 'per_person' ? 'per_person' : 'flat',
          valueLow: event.budget_amount,
          valueHigh: event.budget_amount,
          pinnedValue: event.budget_amount,
          guestCount: event.guest_count,
        }
      : null;

  const activeBudgetTarget = eventBudgetTarget ?? budgetTarget;
  const combineResult = activeBudgetTarget && !eventBudgetTarget && comparisonMode === 'combine'
    ? combineEstimatesToBudget(cards, activeBudgetTarget)
    : null;

  function handleEditClick() {
    setEditName(event.name);
    setEditDate(event.event_date ?? '');
    setEditStartTime(event.start_time ?? '');
    setEditEndTime(event.end_time ?? '');
    setEditGuestCount(event.guest_count);
    setEditEventType(event.event_type);
    setEditBudgetAmount(event.budget_amount !== null ? String(event.budget_amount) : '');
    setEditBudgetBasis(event.budget_basis ?? 'overall');
    setIsEditing(true);
  }

  async function handleSave() {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setSaving(true);
    const parsedBudget = editBudgetAmount !== '' ? parseFloat(editBudgetAmount) : null;
    const data = {
      name: trimmed,
      event_date: editDate || null,
      start_time: editStartTime || null,
      end_time: editEndTime || null,
      guest_count: editGuestCount,
      event_type: editEventType,
      budget_amount: parsedBudget,
      budget_basis: parsedBudget !== null && parsedBudget > 0 ? editBudgetBasis : null,
    };
    await updateEvent(event.id, programId, data);
    onUpdate(event.id, data);
    setIsEditing(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${event.name}" and unlink its ${cards.length} estimate${cards.length !== 1 ? 's' : ''}? The estimates will not be deleted.`)) return;
    setDeleting(true);
    onDelete(event.id);
  }

  async function handleEstimateDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = cardOrder.indexOf(String(active.id));
    const newIdx = cardOrder.indexOf(String(over.id));
    const newOrder = arrayMove(cardOrder, oldIdx, newIdx);
    setCardOrder(newOrder);
    await reorderEstimates(programId, newOrder.map((id, idx) => ({ id, sort_order: idx })));
  }

  const editCfg = getEventTypeConfig(editEventType);

  return (
    <div className="border rounded-lg overflow-hidden border-brand-cream">
      {/* Event header */}
      {isEditing ? (
        <div className="bg-brand-cream/40 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 border border-brand-cream rounded px-2 py-1 text-sm focus:outline-none focus:border-brand-brown min-w-0"
              placeholder="Event name"
              autoFocus
            />
            <select
              value={editEventType}
              onChange={(e) => setEditEventType(e.target.value)}
              className={`border border-brand-cream rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-brown ${editCfg.bg} ${editCfg.text}`}
            >
              {EVENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="border border-brand-cream rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-brown"
            />
            <input
              type="time"
              value={editStartTime}
              onChange={(e) => setEditStartTime(e.target.value)}
              className="border border-brand-cream rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-brown w-28"
            />
            <span className="text-xs text-brand-silver">–</span>
            <input
              type="time"
              value={editEndTime}
              onChange={(e) => setEditEndTime(e.target.value)}
              className="border border-brand-cream rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-brown w-28"
            />
            <input
              type="number"
              min={0}
              value={editGuestCount}
              onChange={(e) => setEditGuestCount(parseInt(e.target.value) || 0)}
              className="border border-brand-cream rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-brown w-20"
              placeholder="Guests"
            />
            <div className="flex items-center gap-1 border border-brand-cream rounded overflow-hidden flex-shrink-0">
              <span className="text-xs text-brand-silver px-1.5">$</span>
              <input
                type="number"
                min={0}
                value={editBudgetAmount}
                onChange={(e) => setEditBudgetAmount(e.target.value)}
                className="py-1 text-xs focus:outline-none w-20 border-l border-brand-cream px-1.5"
                placeholder="Budget"
              />
              <div className="flex border-l border-brand-cream">
                {(['overall', 'per_person'] as const).map((basis) => (
                  <button
                    key={basis}
                    type="button"
                    onClick={() => setEditBudgetBasis(basis)}
                    className={`text-xs px-2 py-1 transition-colors ${editBudgetBasis === basis ? 'bg-brand-brown text-white' : 'text-brand-silver hover:text-brand-charcoal'}`}
                  >
                    {basis === 'overall' ? 'Total' : '/pp'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={handleSave}
                disabled={saving || !editName.trim()}
                className="bg-brand-brown text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-brand-charcoal disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs text-brand-silver hover:text-brand-charcoal px-2 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-brand-cream/40 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-brand-charcoal/50 hover:text-brand-charcoal transition-colors flex-shrink-0"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <svg className={`w-4 h-4 transition-transform ${expanded ? '' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
            {cfg.label}
          </span>

          <div className="flex-1 min-w-0">
            <button
              onClick={handleEditClick}
              className="font-medium text-brand-charcoal text-sm hover:text-brand-brown transition-colors text-left"
            >
              {event.name}
            </button>
            {(dateStr || timeStr) && (
              <span className="text-xs text-brand-silver ml-2">
                {[dateStr, timeStr].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>

          <span className="text-xs text-brand-silver flex-shrink-0">
            {event.guest_count > 0 ? `${event.guest_count.toLocaleString()} guests` : ''}
          </span>

          {event.budget_amount !== null && event.budget_amount > 0 && (
            <span className="text-xs bg-brand-charcoal/8 text-brand-charcoal/50 border border-brand-cream rounded px-1.5 py-0.5 flex-shrink-0">
              ${event.budget_amount.toLocaleString('en-US')}{event.budget_basis === 'per_person' ? '/pp' : ''}
            </span>
          )}

          <button
            onClick={handleEditClick}
            className="text-brand-silver hover:text-brand-charcoal transition-colors flex-shrink-0 text-xs"
          >
            Edit
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-brand-silver hover:text-red-500 transition-colors flex-shrink-0 text-xs disabled:opacity-40"
          >
            {deleting ? '…' : 'Delete'}
          </button>
        </div>
      )}

      {/* Event body */}
      {!isEditing && expanded && (
        <div className="p-4 space-y-4">
          {event.description && (
            <p className="text-xs text-brand-silver">{event.description}</p>
          )}

          {/* Comparison mode toggle — hidden when event has its own budget */}
          {event.budgetEntry && !eventBudgetTarget && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-brand-silver/60 font-medium uppercase tracking-wide">Budget mode</span>
              <div className="flex bg-brand-offwhite border border-brand-cream rounded-md p-0.5 gap-0.5">
                {(['compare_each', 'combine'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={async () => {
                      setComparisonMode(mode);
                      if (event.budgetEntry) {
                        await updateBudgetEntry(event.budgetEntry.id, event.budgetEntry.program_id, { comparison_mode: mode });
                      }
                    }}
                    className={`text-xs px-2.5 py-1 rounded transition-colors ${
                      comparisonMode === mode
                        ? 'bg-white text-brand-charcoal shadow-sm font-medium'
                        : 'text-brand-silver hover:text-brand-charcoal'
                    }`}
                  >
                    {mode === 'compare_each' ? 'Compare each' : 'Combine'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {cards.length === 0 ? (
            <p className="text-sm text-brand-silver/70 py-2">No estimates yet.</p>
          ) : (
            <>
              {/* Included in proposal — sortable */}
              {includedCards.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEstimateDragEnd}>
                  <SortableContext items={includedCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {includedCards.map((card) => {
                        const isLowest = groupLowest !== null && card.total === groupLowest && card.total > 0;
                        const isBestMargin = groupBestMargin !== null && card.qcMarginPct === groupBestMargin && card.total > 0;
                        let deltaInfo: DeltaInfo | undefined;
                        if (activeBudgetTarget && (eventBudgetTarget || comparisonMode === 'compare_each') && card.includeInBudget && card.total > 0) {
                          const result = compareEstimateToBudget(card.id, card.total, event.guest_count, activeBudgetTarget);
                          deltaInfo = { delta: result.delta, status: result.status, budgetLow: result.budgetLow, budgetHigh: result.budgetHigh, pricingBasis: result.pricingBasis };
                        }
                        return (
                          <SortableEstimateCard
                            key={card.id}
                            card={card}
                            programId={programId}
                            isLowest={isLowest}
                            isBestMargin={isBestMargin}
                            onToggleBudget={onToggleBudget}
                            onToggleProposal={onToggleProposal}
                            onAssign={onAssign}
                            teamMembers={teamMembers}
                            eventGuestCount={guestCount}
                            delta={deltaInfo}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {/* Not in proposal — collapsed by default */}
              {excludedCards.length > 0 && (
                <div className="border border-dashed border-brand-silver/30 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedExcluded((v) => !v)}
                    className="w-full px-3 py-2 flex items-center gap-2 text-xs text-brand-silver/60 hover:text-brand-silver/80 transition-colors"
                  >
                    <svg className={`w-3 h-3 transition-transform ${expandedExcluded ? '' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <span>{excludedCards.length} not in proposal</span>
                  </button>
                  {expandedExcluded && (
                    <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {excludedCards.map((card) => (
                        <EstimateCardItem
                          key={card.id}
                          card={card}
                          programId={programId}
                          isLowest={false}
                          isBestMargin={false}
                          onToggleBudget={onToggleBudget}
                          onToggleProposal={onToggleProposal}
                          onAssign={onAssign}
                          teamMembers={teamMembers}
                          eventGuestCount={guestCount}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Combine mode: summary banner */}
              {combineResult && (
                <div className={`rounded-lg border px-4 py-3 space-y-2 ${statusColors(combineResult.status).bg} ${statusColors(combineResult.status).border}`}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className={`font-medium ${statusColors(combineResult.status).text}`}>
                        Combined: ${Math.round(combineResult.combinedTotal).toLocaleString('en-US')}
                      </span>
                      <span className="text-brand-silver/60 text-xs">of ${Math.round(combineResult.budgetPinned).toLocaleString('en-US')} budget</span>
                      {combineResult.budgetLow !== combineResult.budgetHigh && (
                        <span className="text-brand-silver/50 text-xs">(range: ${Math.round(combineResult.budgetLow).toLocaleString('en-US')}–${Math.round(combineResult.budgetHigh).toLocaleString('en-US')})</span>
                      )}
                    </div>
                    <span className={`text-xs font-medium ${statusColors(combineResult.status).text}`}>
                      {combineResult.remaining >= 0
                        ? `$${Math.round(combineResult.remaining).toLocaleString('en-US')} remaining`
                        : `$${Math.round(Math.abs(combineResult.remaining)).toLocaleString('en-US')} over`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        combineResult.status === 'over' ? 'bg-red-400' :
                        combineResult.status === 'within_range' ? 'bg-amber-400' :
                        'bg-green-400'
                      }`}
                      style={{ width: `${Math.min(combineResult.pctConsumed * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end pt-1">
            <AddEstimateButton programId={programId} eventId={event.id} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main EventsView ──────────────────────────────────────

export default function EventsView({ programId, events: initialEvents, unassignedCards: initialUnassigned, programGuestCount, teamMembers }: Props) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [unassignedCards, setUnassignedCards] = useState(initialUnassigned);

  useEffect(() => { setEvents(initialEvents); }, [initialEvents]);
  useEffect(() => { setUnassignedCards(initialUnassigned); }, [initialUnassigned]);

  const allCards = [...events.flatMap((e) => e.cards), ...unassignedCards];
  const budgetTotal = allCards.filter((c) => c.includeInBudget).reduce((sum, c) => sum + c.total, 0);
  const budgetCount = allCards.filter((c) => c.includeInBudget).length;

  async function handleToggleBudget(id: string, next: boolean) {
    setEvents((prev) =>
      prev.map((ev) => ({
        ...ev,
        cards: ev.cards.map((c) => (c.id === id ? { ...c, includeInBudget: next } : c)),
      }))
    );
    setUnassignedCards((prev) => prev.map((c) => (c.id === id ? { ...c, includeInBudget: next } : c)));
    await updateEstimate(id, programId, { include_in_budget: next });
  }

  async function handleToggleProposal(id: string, next: boolean) {
    setEvents((prev) =>
      prev.map((ev) => ({
        ...ev,
        cards: ev.cards.map((c) => (c.id === id ? { ...c, includedInProposal: next } : c)),
      }))
    );
    setUnassignedCards((prev) => prev.map((c) => (c.id === id ? { ...c, includedInProposal: next } : c)));
    await updateEstimateProposalInclusion(id, programId, next);
  }

  async function handleAssign(id: string, memberId: number | null) {
    setEvents((prev) =>
      prev.map((ev) => ({
        ...ev,
        cards: ev.cards.map((c) => (c.id === id ? { ...c, assignedTo: memberId } : c)),
      }))
    );
    setUnassignedCards((prev) => prev.map((c) => (c.id === id ? { ...c, assignedTo: memberId } : c)));
    await updateEstimate(id, programId, { assigned_to: memberId });
  }

  async function handleDeleteEvent(id: string) {
    await deleteEvent(id, programId);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    router.refresh();
  }

  function handleUpdateEvent(id: string, data: Partial<EventRow>) {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...data } : e))
    );
  }

  return (
    <div className="space-y-4">
      {/* Budget banner */}
      {budgetCount > 0 && (
        <div className="bg-brand-cream border border-brand-copper/40 rounded-lg px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-brand-charcoal">Total Budget</span>
            <span className="text-xs text-brand-brown ml-2">
              {budgetCount} estimate{budgetCount !== 1 ? 's' : ''} included
            </span>
          </div>
          <span className="font-serif text-lg font-medium text-brand-charcoal">{fmt(budgetTotal)}</span>
        </div>
      )}

      {/* Add event */}
      <AddEventButton
        programId={programId}
        defaultGuestCount={programGuestCount}
        nextSortOrder={events.length}
      />

      {/* Empty state */}
      {events.length === 0 && unassignedCards.length === 0 && (
        <div className="text-center py-12 border border-dashed border-brand-cream rounded-lg">
          <p className="text-sm text-brand-silver">No events yet. Add an event to start building estimates.</p>
        </div>
      )}

      {/* Events — sorted by date from server, no manual reorder */}
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          programId={programId}
          cards={event.cards}
          onToggleBudget={handleToggleBudget}
          onToggleProposal={handleToggleProposal}
          onAssign={handleAssign}
          teamMembers={teamMembers}
          onDelete={handleDeleteEvent}
          onUpdate={handleUpdateEvent}
        />
      ))}

      {/* Unassigned estimates */}
      {unassignedCards.length > 0 && (
        <div className="border border-dashed border-brand-cream rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-semibold text-brand-charcoal/50 uppercase tracking-widest">Unassigned Estimates</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unassignedCards.map((card) => (
              <EstimateCardItem
                key={card.id}
                card={card}
                programId={programId}
                isLowest={false}
                isBestMargin={false}
                onToggleBudget={handleToggleBudget}
                onToggleProposal={handleToggleProposal}
                onAssign={handleAssign}
                teamMembers={teamMembers}
              />
            ))}
          </div>
          <div className="flex justify-end">
            <AddEstimateButton programId={programId} eventId={null} />
          </div>
        </div>
      )}
    </div>
  );
}
