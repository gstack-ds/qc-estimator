'use client';

import { useState } from 'react';

export interface MoveEventOption {
  id: string;
  name: string;
}

interface Props {
  currentEventId: string | null;
  events: MoveEventOption[];
  onMove: (eventId: string | null) => void;
}

// Small "move to event" control on an estimate card. Lets a stranded (Unassigned) estimate
// be assigned to an event, and lets any estimate be re-homed from one event to another.
export default function MoveEstimateButton({ currentEventId, events, onMove }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        title="Move to event"
        className="w-6 h-6 rounded-full border border-dashed border-brand-silver/50 text-brand-silver/60 flex items-center justify-center hover:border-brand-brown hover:text-brand-brown transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7l4-4m0 0l4 4M7 3v14m14-2l-4 4m0 0l-4-4m4 4V7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={(e) => { e.preventDefault(); setOpen(false); }} />
          <div className="absolute right-0 bottom-8 z-30 w-52 bg-white border border-brand-cream rounded-lg shadow-lg py-1 max-h-72 overflow-y-auto">
            <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-brand-silver/60">Move to event</p>
            {events.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={(e) => { e.preventDefault(); if (ev.id !== currentEventId) onMove(ev.id); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-brand-offwhite truncate transition-colors ${
                  ev.id === currentEventId ? 'font-semibold text-brand-brown' : 'text-brand-charcoal'
                }`}
              >
                {ev.id === currentEventId ? '✓ ' : ''}{ev.name}
              </button>
            ))}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); if (currentEventId !== null) onMove(null); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-brand-offwhite border-t border-brand-cream mt-1 transition-colors ${
                currentEventId === null ? 'font-semibold text-brand-brown' : 'text-brand-silver'
              }`}
            >
              {currentEventId === null ? '✓ ' : ''}Unassigned
            </button>
          </div>
        </>
      )}
    </div>
  );
}
