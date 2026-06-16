'use client';

import { useRef, useState, useTransition } from 'react';
import { updateEstimate } from '@/app/(programs)/programs/[id]/estimates/actions';

interface Props {
  estimateId: string;
  programId: string;
  initialNotes: string | null;
}

// Internal-only working-notes field shown at the top of every estimate builder.
// Clearly labeled as not client-facing. The value is stored on estimates.internal_notes,
// which is never added to DeckContract or ProposalDocument — it cannot reach a proposal.
export default function InternalNotesField({ estimateId, programId, initialNotes }: Props) {
  const [notes, setNotes] = useState(initialNotes ?? '');
  const lastSaved = useRef(initialNotes ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [, startTransition] = useTransition();

  function handleBlur() {
    const value = notes.trim();
    if (value === lastSaved.current) return;
    setStatus('saving');
    startTransition(async () => {
      await updateEstimate(estimateId, programId, { internal_notes: value || null });
      // Store the trimmed string that was actually persisted, and reflect it in the
      // field, so re-blurring (or editing back to the same trimmed text) won't re-save.
      lastSaved.current = value;
      setNotes(value);
      setStatus('saved');
    });
  }

  return (
    <div className="bg-amber-50/60 border-b border-amber-100 px-6 py-2.5">
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={`internal-notes-${estimateId}`} className="text-[11px] font-medium uppercase tracking-wide text-amber-800/80">
          Internal Notes
          <span className="ml-2 font-normal normal-case tracking-normal text-amber-700/60">— not shown on proposals</span>
        </label>
        {status === 'saving' && <span className="text-[11px] text-amber-700/60">Saving…</span>}
        {status === 'saved' && <span className="text-[11px] text-green-600/80">Saved ✓</span>}
      </div>
      <textarea
        id={`internal-notes-${estimateId}`}
        value={notes}
        onChange={(e) => { setNotes(e.target.value); if (status !== 'idle') setStatus('idle'); }}
        onBlur={handleBlur}
        rows={2}
        placeholder="Status, pricing notes, who's handling it — anything the team needs. Stays internal."
        className="w-full text-sm bg-white/70 border border-amber-200/70 rounded px-2.5 py-1.5 text-brand-charcoal placeholder:text-amber-700/30 focus:outline-none focus:ring-1 focus:ring-amber-300 resize-y"
      />
    </div>
  );
}
