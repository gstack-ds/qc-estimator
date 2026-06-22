'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { markResponsesViewed } from '@/app/(programs)/programs/[id]/budget/actions';

// When the team opens the Client responses panel and there are NEW (unviewed) responses, clear
// them (shared team pool) and refresh so the nav roll-up badge updates. Runs once per mount; the
// guard + the post-mark refetch (viewed_at now set → unread 0) prevent a re-trigger loop.
export default function MarkResponsesViewed({ programId, unreadCount }: { programId: string; unreadCount: number }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (unreadCount <= 0 || done.current) return;
    done.current = true;
    (async () => {
      const r = await markResponsesViewed(programId);
      if (!r.error) router.refresh();
    })();
  }, [programId, unreadCount, router]);

  return null;
}
