'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateEstimate } from '@/app/(programs)/programs/[id]/estimates/actions';
import { deleteEvent, updateEvent, reorderEvents } from '@/app/(programs)/programs/actions';
import AddEstimateButton from './AddEstimateButton';
import AddEventButton from './AddEventButton';
import type { EstimateCard } from './ComparisonView';

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
  sort_order: number;
  cards: EstimateCard[];
}

interface Props {
  programId: string;
  events: EventRow[];
  unassignedCards: EstimateCard[];
  programGuestCount: number;
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

function reorderArray<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

// ─── Estimate card (mini) ─────────────────────────────────

function EstimateCardItem({
  card,
  programId,
  isLowest,
  isBestMargin,
  onToggle,
}: {
  card: EstimateCard;
  programId: string;
  isLowest: boolean;
  isBestMargin: boolean;
  onToggle: (id: string, next: boolean) => void;
}) {
  return (
    <Link
      href={`/programs/${programId}/estimates/${card.id}`}
      className="relative block bg-white rounded-lg border border-brand-cream p-4 flex flex-col gap-2.5 transition-all hover:shadow-md hover:border-brand-copper/50 cursor-pointer overflow-hidden"
    >
      {isLowest && !isBestMargin && <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />}
      {!isLowest && isBestMargin && <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: '#C19C81' }} />}
      {isLowest && isBestMargin && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500">
          <div className="absolute bottom-0 left-0 right-0 h-1/2" style={{ backgroundColor: '#C19C81' }} />
        </div>
      )}

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

      <div className="flex items-end gap-4">
        <div>
          <p className="font-serif text-lg font-medium text-brand-charcoal">{fmt(card.total)}</p>
          <p className="text-xs text-brand-silver mt-0.5">total estimate</p>
        </div>
        {card.pricePerPerson > 0 && (
          <div>
            <p className="text-sm font-medium text-brand-brown">
              ${card.pricePerPerson.toLocaleString('en-US')}
              <span className="text-xs font-normal text-brand-silver">/pp</span>
            </p>
          </div>
        )}
      </div>

      <div className="space-y-0.5">
        <p className="text-xs text-brand-silver">{card.lineItemCount} line item{card.lineItemCount !== 1 ? 's' : ''}</p>
        {card.total > 0 && (
          <p className="text-xs text-brand-silver/70">QC Margin: {(card.qcMarginPct * 100).toFixed(1)}%</p>
        )}
      </div>

      <div className="border-t border-brand-cream pt-2.5 mt-auto">
        <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.preventDefault()}>
          <div
            onClick={(e) => { e.preventDefault(); onToggle(card.id, !card.includeInBudget); }}
            className={`w-8 h-4 rounded-full transition-colors cursor-pointer flex-shrink-0 ${card.includeInBudget ? 'bg-brand-brown' : 'bg-brand-silver/40'}`}
          >
            <div className={`w-3 h-3 bg-white rounded-full mt-0.5 transition-transform ${card.includeInBudget ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs text-brand-charcoal/70">Include in Budget</span>
        </label>
      </div>
    </Link>
  );
}

// ─── Single event card ────────────────────────────────────

function EventCard({
  event,
  programId,
  cards,
  isDragging,
  isDropTarget,
  onToggle,
  onDelete,
  onUpdate,
  onDragHandleMouseDown,
}: {
  event: EventRow;
  programId: string;
  cards: EstimateCard[];
  isDragging: boolean;
  isDropTarget: boolean;
  onToggle: (id: string, next: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: Partial<EventRow>) => void;
  onDragHandleMouseDown: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state — re-synced from event prop each time edit is opened
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editGuestCount, setEditGuestCount] = useState(0);
  const [editEventType, setEditEventType] = useState('');

  const cfg = getEventTypeConfig(event.event_type);

  const withTotal = cards.filter((c) => c.total > 0);
  const groupLowest = withTotal.length > 1 ? Math.min(...withTotal.map((c) => c.total)) : null;
  const groupBestMargin = withTotal.length > 0 ? Math.max(...withTotal.map((c) => c.qcMarginPct)) : null;

  const dateStr = fmtDate(event.event_date);
  const startStr = fmtTime(event.start_time);
  const endStr = fmtTime(event.end_time);
  const timeStr = startStr && endStr ? `${startStr} – ${endStr}` : startStr ?? endStr;

  function handleEditClick() {
    setEditName(event.name);
    setEditDate(event.event_date ?? '');
    setEditStartTime(event.start_time ?? '');
    setEditEndTime(event.end_time ?? '');
    setEditGuestCount(event.guest_count);
    setEditEventType(event.event_type);
    setIsEditing(true);
  }

  async function handleSave() {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setSaving(true);
    const data = {
      name: trimmed,
      event_date: editDate || null,
      start_time: editStartTime || null,
      end_time: editEndTime || null,
      guest_count: editGuestCount,
      event_type: editEventType,
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

  const editCfg = getEventTypeConfig(editEventType);

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-opacity ${
        isDragging ? 'opacity-40' : 'opacity-100'
      } ${
        isDropTarget ? 'border-brand-brown border-2' : 'border-brand-cream'
      }`}
    >
      {/* Event header */}
      {isEditing ? (
        <div className="bg-brand-cream/40 px-4 py-3 space-y-2">
          {/* Edit row 1: name + type */}
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
          {/* Edit row 2: date, times, guest count, actions */}
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
          {/* Drag handle */}
          <div
            onMouseDown={onDragHandleMouseDown}
            className="cursor-grab text-brand-silver/40 hover:text-brand-silver/80 transition-colors flex-shrink-0 select-none"
            title="Drag to reorder"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm6 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm6 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm6 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
            </svg>
          </div>

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

          {cards.length === 0 ? (
            <p className="text-sm text-brand-silver/70 py-2">No estimates yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cards.map((card) => {
                const isLowest = groupLowest !== null && card.total === groupLowest && card.total > 0;
                const isBestMargin = groupBestMargin !== null && card.qcMarginPct === groupBestMargin && card.total > 0;
                return (
                  <EstimateCardItem
                    key={card.id}
                    card={card}
                    programId={programId}
                    isLowest={isLowest}
                    isBestMargin={isBestMargin}
                    onToggle={onToggle}
                  />
                );
              })}
            </div>
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

export default function EventsView({ programId, events: initialEvents, unassignedCards: initialUnassigned, programGuestCount }: Props) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [unassignedCards, setUnassignedCards] = useState(initialUnassigned);

  // Drag state
  const dragIndexRef = useRef<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // Track which card is currently being dragged for opacity
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  // Controls whether the draggable wrapper is actually draggable (only after handle mousedown)
  const [draggableIdx, setDraggableIdx] = useState<number | null>(null);

  // Flatten all cards for budget calculation
  const allCards = [...events.flatMap((e) => e.cards), ...unassignedCards];
  const budgetTotal = allCards.filter((c) => c.includeInBudget).reduce((sum, c) => sum + c.total, 0);
  const budgetCount = allCards.filter((c) => c.includeInBudget).length;

  async function handleToggle(id: string, next: boolean) {
    setEvents((prev) =>
      prev.map((ev) => ({
        ...ev,
        cards: ev.cards.map((c) => (c.id === id ? { ...c, includeInBudget: next } : c)),
      }))
    );
    setUnassignedCards((prev) => prev.map((c) => (c.id === id ? { ...c, includeInBudget: next } : c)));
    await updateEstimate(id, programId, { include_in_budget: next });
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

  // Drag handlers
  function handleDragStart(idx: number) {
    dragIndexRef.current = idx;
    setDraggingIndex(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndexRef.current !== null && dragIndexRef.current !== idx) {
      setDropIndex(idx);
    }
  }

  function handleDragLeave() {
    setDropIndex(null);
  }

  async function handleDrop(idx: number) {
    const from = dragIndexRef.current;
    if (from === null || from === idx) {
      setDropIndex(null);
      return;
    }
    const reordered = reorderArray(events, from, idx).map((e, i) => ({ ...e, sort_order: i }));
    setEvents(reordered);
    setDropIndex(null);
    dragIndexRef.current = null;
    await reorderEvents(programId, reordered.map((e) => ({ id: e.id, sort_order: e.sort_order })));
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDraggingIndex(null);
    setDropIndex(null);
    setDraggableIdx(null);
  }

  const nextSortOrder = events.length > 0 ? Math.max(...events.map((e) => e.sort_order)) + 1 : 0;

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

      {/* Add event form */}
      <AddEventButton
        programId={programId}
        defaultGuestCount={programGuestCount}
        nextSortOrder={nextSortOrder}
      />

      {/* Empty state */}
      {events.length === 0 && unassignedCards.length === 0 && (
        <div className="text-center py-12 border border-dashed border-brand-cream rounded-lg">
          <p className="text-sm text-brand-silver">No events yet. Add an event to start building estimates.</p>
        </div>
      )}

      {/* Event cards — draggable */}
      {events.map((event, idx) => (
        <div
          key={event.id}
          draggable={draggableIdx === idx}
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDragLeave={handleDragLeave}
          onDrop={() => handleDrop(idx)}
          onDragEnd={handleDragEnd}
        >
          <EventCard
            event={event}
            programId={programId}
            cards={event.cards}
            isDragging={draggingIndex === idx}
            isDropTarget={dropIndex === idx && draggingIndex !== null && draggingIndex !== idx}
            onToggle={handleToggle}
            onDelete={handleDeleteEvent}
            onUpdate={handleUpdateEvent}
            onDragHandleMouseDown={() => setDraggableIdx(idx)}
          />
        </div>
      ))}

      {/* Unassigned estimates (safety net — should be empty after migration) */}
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
                onToggle={handleToggle}
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
