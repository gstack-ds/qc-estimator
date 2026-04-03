'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { duplicateEstimate, deleteEstimate, reorderEstimates } from '@/app/(programs)/programs/[id]/estimates/actions';
import AddEstimateButton from './AddEstimateButton';

interface Estimate {
  id: string;
  name: string;
}

interface Props {
  estimates: Estimate[];
  currentEstimateId: string;
  programId: string;
}

export default function ScenarioTabs({ estimates: initialEstimates, currentEstimateId, programId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tabs, setTabs] = useState<Estimate[]>(initialEstimates);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // ─── Duplicate ────────────────────────────────────────────

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateEstimate(currentEstimateId, programId);
      if (result.id) router.push(`/programs/${programId}/estimates/${result.id}`);
    });
  }

  // ─── Delete ───────────────────────────────────────────────

  function handleDeleteConfirm(id: string) {
    startTransition(async () => {
      await deleteEstimate(id, programId);
      const next = tabs.filter((t) => t.id !== id);
      setTabs(next);
      setConfirmDelete(null);
      // Navigate away if we deleted the active tab
      if (id === currentEstimateId && next.length > 0) {
        router.push(`/programs/${programId}/estimates/${next[0].id}`);
      } else if (next.length === 0) {
        router.push(`/programs/${programId}`);
      }
    });
  }

  // ─── Drag-and-drop reorder ────────────────────────────────

  function handleDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index);
    setDropIndex(index);
    // Transparent drag image so we control the visual ourselves
    const ghost = document.createElement('div');
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || index === dropIndex) return;
    setDropIndex(index);
    // Reorder tabs visually
    const reordered = [...tabs];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    setTabs(reordered);
    setDragIndex(index);
  }

  function handleDragEnd() {
    if (dragIndex === null) return;
    setDragIndex(null);
    setDropIndex(null);
    // Persist new order
    const updates = tabs.map((t, i) => ({ id: t.id, sort_order: i }));
    startTransition(async () => { await reorderEstimates(programId, updates); });
  }

  // ─── Render ───────────────────────────────────────────────

  const canDelete = tabs.length > 1;

  return (
    <div className="flex items-center gap-1 overflow-x-auto select-none">
      {tabs.map((est, index) => {
        const isActive = est.id === currentEstimateId;
        const isDragging = dragIndex === index;
        const isConfirming = confirmDelete === est.id;

        return (
          <div
            key={est.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`group relative flex items-center gap-1 rounded-t-md border-b-2 transition-colors cursor-grab active:cursor-grabbing ${
              isActive
                ? 'border-brand-brown bg-white'
                : 'border-transparent hover:bg-brand-cream/40'
            } ${isDragging ? 'opacity-50' : 'opacity-100'}`}
          >
            {isConfirming ? (
              /* Inline delete confirmation */
              <div className="flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap">
                <span className="text-red-600 font-medium">Delete?</span>
                <button
                  onClick={() => handleDeleteConfirm(est.id)}
                  disabled={isPending}
                  className="text-xs bg-red-600 text-white rounded px-1.5 py-0.5 hover:bg-red-700 disabled:opacity-50"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    if (!isActive) router.push(`/programs/${programId}/estimates/${est.id}`);
                  }}
                  className={`px-3 py-2 text-sm whitespace-nowrap ${
                    isActive ? 'text-brand-brown font-medium' : 'text-brand-silver hover:text-brand-charcoal'
                  }`}
                >
                  {est.name}
                </button>

                {/* Delete × — visible on hover, hidden if only one tab */}
                {canDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(est.id);
                    }}
                    className="mr-1 w-4 h-4 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none flex-shrink-0"
                    title="Delete estimate"
                  >
                    ×
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* Right side actions */}
      <div className="ml-auto flex items-center gap-2 pr-1 flex-shrink-0">
        <button
          onClick={handleDuplicate}
          disabled={isPending}
          className="text-xs text-brand-silver hover:text-brand-charcoal px-2 py-1 rounded hover:bg-brand-cream/40"
          title="Duplicate this estimate"
        >
          Duplicate
        </button>
        <AddEstimateButton programId={programId} />
      </div>
    </div>
  );
}
