'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markResponseViewed, markResponsesViewed } from '@/app/(programs)/programs/[id]/budget/actions';

// Deliberate mark-as-read controls. A response is cleared ONLY when the team explicitly acts —
// never on the panel merely scrolling into view. "Mark as read" clears one response; the header
// "Mark all as read" clears the rest. Both refresh so the nav roll-up badge updates.

export function MarkReadButton({ responseId, programId }: { responseId: string; programId: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => start(async () => {
        const r = await markResponseViewed(responseId, programId);
        if (r.error) { console.error('Mark response read failed:', r.error); return; }
        router.refresh();
      })}
      className="text-xs text-brand-brown hover:underline disabled:opacity-50"
    >
      {busy ? 'Marking…' : 'Mark as read'}
    </button>
  );
}

export function MarkAllReadButton({ programId }: { programId: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => start(async () => {
        const r = await markResponsesViewed(programId);
        if (r.error) { console.error('Mark all read failed:', r.error); return; }
        router.refresh();
      })}
      className="text-xs text-brand-silver hover:text-brand-charcoal disabled:opacity-50"
    >
      Mark all as read
    </button>
  );
}
