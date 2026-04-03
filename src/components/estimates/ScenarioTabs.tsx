'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createEstimate } from '@/app/(programs)/programs/actions';
import { duplicateEstimate } from '@/app/(programs)/programs/[id]/estimates/actions';

interface Props {
  estimates: { id: string; name: string }[];
  currentEstimateId: string;
  programId: string;
}

export default function ScenarioTabs({ estimates, currentEstimateId, programId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAddEstimate() {
    startTransition(async () => {
      const result = await createEstimate(programId);
      if (result.id) {
        router.push(`/programs/${programId}/estimates/${result.id}`);
      }
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateEstimate(currentEstimateId, programId);
      if (result.id) {
        router.push(`/programs/${programId}/estimates/${result.id}`);
      }
    });
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {estimates.map((est) => (
        <button
          key={est.id}
          onClick={() => {
            if (est.id !== currentEstimateId) {
              router.push(`/programs/${programId}/estimates/${est.id}`);
            }
          }}
          className={`px-4 py-2 text-sm rounded-t-md whitespace-nowrap border-b-2 transition-colors ${
            est.id === currentEstimateId
              ? 'border-blue-600 text-blue-700 bg-white font-medium'
              : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100'
          }`}
        >
          {est.name}
        </button>
      ))}

      <button
        onClick={handleAddEstimate}
        disabled={isPending}
        className="px-3 py-2 text-sm text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-t-md border-b-2 border-transparent transition-colors"
        title="New estimate"
      >
        +
      </button>

      <div className="ml-auto flex items-center gap-2 pr-1">
        <button
          onClick={handleDuplicate}
          disabled={isPending}
          className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          title="Duplicate this estimate"
        >
          Duplicate
        </button>
      </div>
    </div>
  );
}
