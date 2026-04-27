'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { duplicateEstimate, deleteEstimate } from '@/app/(programs)/programs/[id]/estimates/actions';

interface Props {
  programId: string;
  programName: string;
  eventName?: string | null;
  estimateId: string;
  estimateName: string;
}

export default function EstimateNav({ programId, programName, eventName, estimateId, estimateName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateEstimate(estimateId, programId);
      if (result.id) router.push(`/programs/${programId}/estimates/${result.id}`);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteEstimate(estimateId, programId);
      router.push(`/programs/${programId}`);
    });
  }

  return (
    <div className="flex items-center gap-4 flex-1 min-w-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm min-w-0 flex-1 overflow-hidden">
        <Link href="/programs" className="text-brand-silver hover:text-brand-brown transition-colors flex-shrink-0">
          Programs
        </Link>
        <span className="text-brand-silver/40 flex-shrink-0 mx-0.5">›</span>
        <Link href={`/programs/${programId}`} className="text-brand-silver hover:text-brand-brown transition-colors truncate max-w-[140px]">
          {programName}
        </Link>
        {eventName && (
          <>
            <span className="text-brand-silver/40 flex-shrink-0 mx-0.5">›</span>
            <span className="text-brand-charcoal/50 truncate max-w-[120px]">{eventName}</span>
          </>
        )}
        <span className="text-brand-silver/40 flex-shrink-0 mx-0.5">›</span>
        <span className="font-medium text-brand-charcoal truncate">{estimateName || 'Untitled'}</span>
      </div>

      {/* Duplicate + Delete */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {confirmDelete ? (
          <>
            <span className="text-xs text-red-600 font-medium whitespace-nowrap">Delete estimate?</span>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-xs bg-red-600 text-white rounded px-2 py-1 hover:bg-red-700 disabled:opacity-50 ml-1"
            >
              {isPending ? '…' : 'Yes'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-brand-silver hover:text-brand-charcoal px-1.5 py-1"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleDuplicate}
              disabled={isPending}
              className="text-xs text-brand-silver hover:text-brand-charcoal px-2 py-1 rounded hover:bg-brand-cream/40 disabled:opacity-50 whitespace-nowrap"
            >
              Duplicate
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-brand-silver hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 whitespace-nowrap"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
