'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DetectedEvent } from '@/lib/programs/eventDetection';
import { autoCreateEvents } from '@/app/(programs)/programs/actions';

interface Props {
  programId: string | null;
  detectedEvents: DetectedEvent[];
}

export default function DetectedEventsPanel({ programId, detectedEvents }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [showForceConfirm, setShowForceConfirm] = useState(false);
  const [result, setResult] = useState<{ created: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (detectedEvents.length === 0) return null;

  async function handleCreate(skipDuplicateCheck: boolean) {
    if (!programId) return;
    setCreating(true);
    setError(null);
    const res = await autoCreateEvents(programId, detectedEvents, { skipDuplicateCheck });
    setCreating(false);
    if (res.error) {
      setError(res.error);
    } else if (res.skipped) {
      setShowForceConfirm(true);
    } else {
      setResult({ created: res.created, failed: res.failed });
      router.refresh();
    }
  }

  const canCreate = !!programId;

  return (
    <div className="mt-3 border border-brand-copper/30 rounded-lg bg-brand-copper/5 p-3">
      <p className="text-xs font-semibold text-brand-brown uppercase tracking-wide mb-2">
        Detected events ({detectedEvents.length})
      </p>

      <ul className="space-y-1 mb-3">
        {detectedEvents.map((ev, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-xs text-brand-charcoal bg-white border border-brand-cream rounded px-2.5 py-1.5"
          >
            <div className="flex-1 min-w-0">
              <span className="font-medium">{ev.name}</span>
              {ev.event_date && (
                <span className="text-brand-silver ml-1.5">· {ev.event_date}</span>
              )}
              {ev.guest_count > 0 && (
                <span className="text-brand-silver ml-1.5">· {ev.guest_count} guests</span>
              )}
              {ev.description && (
                <span className="block text-brand-silver/70 text-[10px] mt-0.5 truncate">
                  {ev.description}
                </span>
              )}
            </div>
            <span className="flex-shrink-0 text-[10px] text-brand-silver/70 capitalize mt-0.5 whitespace-nowrap">
              {ev.event_type.replace(/_/g, ' ')}
            </span>
          </li>
        ))}
      </ul>

      {result ? (
        <div className="space-y-1">
          <p className="text-xs text-green-700 font-medium">
            ✓ Created {result.created} event{result.created !== 1 ? 's' : ''}
          </p>
          {result.failed > 0 && (
            <p className="text-xs text-amber-700">
              {result.failed} event{result.failed !== 1 ? 's' : ''} could not be created — refresh and try again.
            </p>
          )}
        </div>
      ) : showForceConfirm ? (
        <div className="space-y-1.5">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            This program already has events. Create these anyway?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowForceConfirm(false); handleCreate(true); }}
              disabled={creating}
              className="text-xs px-3 py-1 rounded bg-brand-brown text-white hover:bg-brand-charcoal disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating…' : 'Create anyway'}
            </button>
            <button
              onClick={() => setShowForceConfirm(false)}
              className="text-xs px-3 py-1 text-brand-charcoal/60 hover:text-brand-charcoal transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => handleCreate(false)}
          disabled={creating || !canCreate}
          title={!canCreate ? 'Create program first' : undefined}
          className="text-xs px-3 py-1.5 rounded border border-brand-copper/40 bg-white hover:bg-brand-copper/10 text-brand-copper disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {creating
            ? 'Creating…'
            : `Create all ${detectedEvents.length} event${detectedEvents.length !== 1 ? 's' : ''}`}
        </button>
      )}

      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}
