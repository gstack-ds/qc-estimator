// Pure-display status stepper for the unified deal page. Driven by the swappable config in
// src/lib/deal/statusConfig.ts — no interactivity, so it stays a plain (server-renderable)
// component. The 8 forward stages render as a stepper; an aside status (On Hold / Closed-Lost)
// renders a leading badge and leaves the stepper unhighlighted (we don't know how far the deal
// got before it was put on hold / lost).
import type { LeadStatus } from '@/lib/leads/constants';
import { STATUS_LABELS } from '@/lib/leads/constants';
import { ACTIVE_CONFIG, stageStates, asideFor, type DealStage } from '@/lib/deal/statusConfig';

export function StatusProgression({
  status,
  config = ACTIVE_CONFIG,
}: {
  status: LeadStatus;
  config?: DealStage[];
}) {
  const aside = asideFor(status);
  const states = stageStates(config, status);

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={`Status: ${STATUS_LABELS[status]}`}>
      {aside && (
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
            aside.kind === 'on_hold'
              ? 'bg-amber-100 text-amber-800 border border-amber-300'
              : 'bg-slate-600 text-white border border-slate-600'
          }`}
        >
          {aside.kind === 'on_hold' ? `⏸ ${aside.label}` : `✕ Closed — ${aside.label}`}
        </span>
      )}
      {states.map(({ stage, state }) => {
        const cls =
          state === 'current'
            ? 'bg-brand-copper text-white border-brand-copper'
            : state === 'complete'
              ? 'bg-brand-copper/15 text-brand-copper border-brand-copper/30'
              : 'bg-gray-50 text-gray-400 border-gray-200';
        return (
          <span
            key={stage.key}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${cls} ${
              aside ? 'opacity-60' : ''
            }`}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            {stage.label}
          </span>
        );
      })}
    </div>
  );
}
