'use client';

import { useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getProgramProposalData } from '@/app/(programs)/programs/[id]/estimates/actions';

export interface ProposalEstimateOption {
  id: string;
  name: string;
  type: string;
  eventName: string | null;
}

interface Props {
  programId: string;
  programName: string;
  estimates: ProposalEstimateOption[];
}

const TYPE_LABEL: Record<string, string> = {
  venue: 'Venue', av: 'AV', decor: 'Décor', tour: 'Tour',
};

function SortableRow({ id, label, sub }: { id: string; label: string; sub: string | null }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="flex items-center gap-2 border border-brand-cream rounded-md px-3 py-2 bg-white"
    >
      <button type="button" {...attributes} {...listeners} className="cursor-grab text-brand-silver hover:text-brand-charcoal select-none" aria-label="Drag to reorder">⠿</button>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-brand-charcoal truncate">{label}</div>
        {sub ? <div className="text-xs text-brand-silver truncate">{sub}</div> : null}
      </div>
    </div>
  );
}

export default function ExportFullProposalButton({ programId, programName, estimates }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function start() {
    // All selected by default; user deselects ones to exclude.
    setSelected(new Set(estimates.map((e) => e.id)));
    setOrder(estimates.map((e) => e.id));
    setStep(1);
    setError(null);
    setOpen(true);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function goReorder() {
    // Preserve any existing drag order for still-selected estimates; append newly-selected ones
    // (in program order). This keeps a prior reorder intact if the user goes Back then Next again.
    setOrder((prev) => {
      const kept = prev.filter((id) => selected.has(id));
      const added = estimates.map((e) => e.id).filter((id) => selected.has(id) && !kept.includes(id));
      return [...kept, ...added];
    });
    setStep(2);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await getProgramProposalData(programId, order);
      if (err || !data) { setError(err ?? 'Could not build the proposal.'); setBusy(false); return; }

      const [{ pdf }, { default: ProgramProposalDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/export/ProgramProposalDocument'),
      ]);
      const logoSrc = window.location.origin + '/images/logo-badge.png';
      const element = ProgramProposalDocument({
        programName: data.programName,
        clientName: data.clientName,
        clientCompany: data.clientCompany,
        proposalDate: data.proposalDate,
        estimates: data.estimates,
        logoSrc,
      });
      const blob = await pdf(element).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${programName} - Full Proposal.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF generation failed.');
    } finally {
      setBusy(false);
    }
  }

  const byId = new Map(estimates.map((e) => [e.id, e]));
  const selectedCount = selected.size;

  return (
    <>
      <button
        onClick={start}
        className="text-sm border border-brand-cream text-brand-charcoal rounded-md px-3 py-1.5 hover:bg-brand-offwhite transition-colors"
      >
        Export Full Proposal
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-brand-cream">
              <h2 className="text-base font-semibold text-brand-charcoal">Export Full Proposal</h2>
              <p className="text-xs text-brand-silver mt-0.5">
                {step === 1 ? 'Step 1 of 2 — choose which estimates to include' : 'Step 2 of 2 — drag to set the order'}
              </p>
            </div>

            <div className="px-5 py-4 overflow-y-auto flex-1">
              {estimates.length === 0 ? (
                <p className="text-sm text-brand-silver">This program has no venue, AV, décor, or tour estimates to include.</p>
              ) : step === 1 ? (
                <div className="space-y-1.5">
                  {estimates.map((e) => (
                    <label key={e.id} className="flex items-center gap-2.5 border border-brand-cream rounded-md px-3 py-2 cursor-pointer hover:bg-brand-offwhite">
                      <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="w-4 h-4 rounded border-brand-cream accent-brand-brown" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-brand-charcoal truncate">{e.name}</div>
                        <div className="text-xs text-brand-silver truncate">
                          {TYPE_LABEL[e.type] ?? e.type}{e.eventName ? ` · ${e.eventName}` : ''}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={order} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5">
                      {order.map((id) => {
                        const e = byId.get(id);
                        if (!e) return null;
                        return <SortableRow key={id} id={id} label={e.name} sub={`${TYPE_LABEL[e.type] ?? e.type}${e.eventName ? ` · ${e.eventName}` : ''}`} />;
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
              {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
            </div>

            <div className="px-5 py-4 border-t border-brand-cream flex items-center justify-between">
              <button onClick={() => (step === 2 ? setStep(1) : setOpen(false))} disabled={busy} className="text-sm text-brand-silver hover:text-brand-charcoal">
                {step === 2 ? '← Back' : 'Cancel'}
              </button>
              {step === 1 ? (
                <button onClick={goReorder} disabled={selectedCount === 0} className="text-sm bg-brand-brown text-white rounded-md px-4 py-1.5 disabled:opacity-50">
                  Next ({selectedCount})
                </button>
              ) : (
                <button onClick={generate} disabled={busy || order.length === 0} className="text-sm bg-brand-brown text-white rounded-md px-4 py-1.5 disabled:opacity-50">
                  {busy ? 'Generating…' : 'Generate PDF'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
