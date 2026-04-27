'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateEstimate } from '@/app/(programs)/programs/[id]/estimates/actions';
import { deleteEvent } from '@/app/(programs)/programs/actions';
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
  onToggle,
  onDelete,
}: {
  event: EventRow;
  programId: string;
  cards: EstimateCard[];
  onToggle: (id: string, next: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const cfg = getEventTypeConfig(event.event_type);

  const withTotal = cards.filter((c) => c.total > 0);
  const groupLowest = withTotal.length > 1 ? Math.min(...withTotal.map((c) => c.total)) : null;
  const groupBestMargin = withTotal.length > 0 ? Math.max(...withTotal.map((c) => c.qcMarginPct)) : null;

  const dateStr = fmtDate(event.event_date);
  const startStr = fmtTime(event.start_time);
  const endStr = fmtTime(event.end_time);
  const timeStr = startStr && endStr ? `${startStr} – ${endStr}` : startStr ?? endStr;

  async function handleDelete() {
    if (!confirm(`Delete "${event.name}" and unlink its ${cards.length} estimate${cards.length !== 1 ? 's' : ''}? The estimates will not be deleted.`)) return;
    setDeleting(true);
    onDelete(event.id);
  }

  return (
    <div className="border border-brand-cream rounded-lg overflow-hidden">
      {/* Event header */}
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
          <span className="font-medium text-brand-charcoal text-sm">{event.name}</span>
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
          onClick={handleDelete}
          disabled={deleting}
          className="text-brand-silver hover:text-red-500 transition-colors flex-shrink-0 text-xs disabled:opacity-40"
          aria-label="Delete event"
        >
          {deleting ? '…' : 'Delete'}
        </button>
      </div>

      {/* Event body */}
      {expanded && (
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

      {/* Event cards */}
      {events.length === 0 && unassignedCards.length === 0 && (
        <div className="text-center py-12 border border-dashed border-brand-cream rounded-lg">
          <p className="text-sm text-brand-silver">No events yet. Add an event to start building estimates.</p>
        </div>
      )}

      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          programId={programId}
          cards={event.cards}
          onToggle={handleToggle}
          onDelete={handleDeleteEvent}
        />
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
