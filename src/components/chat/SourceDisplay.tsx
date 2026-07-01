'use client';

// Source-display — the LOAD-BEARING guardrail. Renders the ACTUAL retrieved clientSafe rows
// beside each answer, STRUCTURALLY from the data object (no LLM in this path — a model-generated
// display could hallucinate, defeating the purpose). The user reads the real price off these rows
// and does not have to trust the prose. Shows EVERYTHING retrieved (incl. data the prose omitted),
// grouped/labeled by source so a specific number can be verified without hunting.
import { formatField, humanizeKey, isHiddenKey, isEmptyValue, sourceHeader } from '@/lib/chat/sourceFormat';

interface ChatSource {
  tool: string;
  input: unknown;
  data: unknown;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Recursive readable renderer: scalars → labeled "Label: value" rows (currency/percent/date
// formatted); nested objects → labeled sub-groups; arrays of objects → compact stacked rows.
function Readable({ value, keyHint }: { value: unknown; keyHint?: string }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-400">none</span>;
    return (
      <ul className="mt-1 space-y-1">
        {value.map((item, i) => (
          <li key={i} className="rounded border border-gray-100 bg-white/70 px-2 py-1">
            <Readable value={item} />
          </li>
        ))}
      </ul>
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value).filter(([k, v]) => !isHiddenKey(k) && !isEmptyValue(v));
    if (entries.length === 0) return <span className="text-gray-400">—</span>;
    return (
      <dl className="space-y-0.5">
        {entries.map(([k, v]) =>
          isPlainObject(v) || Array.isArray(v) ? (
            <div key={k} className="mt-1">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{humanizeKey(k)}</dt>
              <dd className="pl-2">
                <Readable value={v} keyHint={k} />
              </dd>
            </div>
          ) : (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-gray-500">{humanizeKey(k)}</dt>
              <dd className="text-right font-medium text-brand-charcoal">{formatField(k, v)}</dd>
            </div>
          ),
        )}
      </dl>
    );
  }

  // Bare scalar (rare at top level).
  return <span className="font-medium text-brand-charcoal">{formatField(keyHint ?? '', value)}</span>;
}

export default function SourceDisplay({ sources }: { sources?: ChatSource[] }) {
  // Empty case — explicit, never an ambiguous empty box. Signals the answer isn't backed by records.
  if (!sources || sources.length === 0) {
    return (
      <p className="mt-2 border-t border-gray-100 pt-1.5 text-[11px] italic text-gray-400">
        No source data retrieved — this answer isn't backed by records.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-copper/70">
        Sources ({sources.length}) — the real retrieved data
      </p>
      {sources.map((s, i) => (
        <div key={i} className="rounded-lg border border-brand-copper/15 bg-brand-offwhite/60 p-2 text-[11px] leading-relaxed">
          <div className="mb-1 font-semibold text-brand-charcoal/80">{sourceHeader(s.tool, s.data)}</div>
          <Readable value={s.data} />
        </div>
      ))}
    </div>
  );
}
