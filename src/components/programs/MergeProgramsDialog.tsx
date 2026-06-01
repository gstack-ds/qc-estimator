'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchProgramsByIds, mergePrograms } from '@/app/(programs)/programs/actions';

interface ProgramSnap {
  id: string;
  name: string;
  client_name: string | null;
  event_date: string | null;
  guest_count: number | null;
  company_name: string | null;
  client_hotel: string | null;
  location_id: string | null;
  updated_at: string;
}

interface Props {
  programIds: string[];
  onClose: () => void;
}

type FieldDef = { key: keyof ProgramSnap; label: string };

const COMPARE_FIELDS: FieldDef[] = [
  { key: 'name',         label: 'Program Name' },
  { key: 'client_name',  label: 'Client' },
  { key: 'event_date',   label: 'Event Date' },
  { key: 'guest_count',  label: 'Guest Count' },
  { key: 'company_name', label: 'Company' },
  { key: 'client_hotel', label: 'Client Hotel' },
];

function displayValue(prog: ProgramSnap, key: keyof ProgramSnap): string {
  const val = prog[key];
  if (val == null || val === '') return '—';
  return String(val);
}

export default function MergeProgramsDialog({ programIds, onClose }: Props) {
  const router = useRouter();
  const [programs, setPrograms] = useState<ProgramSnap[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [survivorId, setSurvivorId] = useState('');
  const [fieldChoices, setFieldChoices] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProgramsByIds(programIds).then(({ error: err, programs: progs }) => {
      setLoading(false);
      if (err || !progs) { setFetchError(err ?? 'Failed to load programs'); return; }
      const sorted = [...progs as ProgramSnap[]].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      setPrograms(sorted);
      const defaultSurvivorId = sorted[0]?.id ?? '';
      setSurvivorId(defaultSurvivorId);
      const defaults: Record<string, string> = {};
      COMPARE_FIELDS.forEach(({ key }) => { defaults[key as string] = defaultSurvivorId; });
      setFieldChoices(defaults);
    });
  }, [programIds]);

  function handleSurvivorChange(id: string) {
    setSurvivorId(id);
    const newChoices: Record<string, string> = {};
    COMPARE_FIELDS.forEach(({ key }) => { newChoices[key as string] = id; });
    setFieldChoices(newChoices);
  }

  const differingFields = COMPARE_FIELDS.filter(({ key }) => {
    const vals = programs.map((p) => displayValue(p, key));
    return new Set(vals).size > 1;
  });

  async function handleConfirmMerge() {
    setMerging(true);
    setError(null);
    const duplicateIds = programs.filter((p) => p.id !== survivorId).map((p) => p.id);
    const fieldValues: Record<string, unknown> = {};
    differingFields.forEach(({ key }) => {
      const chosenId = fieldChoices[key as string];
      if (chosenId !== survivorId) {
        const chosen = programs.find((p) => p.id === chosenId)!;
        fieldValues[key as string] = chosen[key] ?? null;
      }
    });
    const { error: err } = await mergePrograms(survivorId, duplicateIds, fieldValues);
    setMerging(false);
    if (err) { setError(err); return; }
    router.push(`/programs/${survivorId}`);
    onClose();
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-lg p-8 text-sm text-brand-silver">Loading programs…</div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-lg p-8">
          <p className="text-sm text-red-600 mb-4">{fetchError}</p>
          <button onClick={onClose} className="text-sm text-brand-silver hover:text-brand-charcoal">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-brand-cream flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-serif text-lg font-medium text-brand-charcoal">Merge {programs.length} Programs</h2>
            <p className="text-xs text-brand-silver mt-0.5">
              Estimates and events from duplicate programs will be moved to the surviving record.
            </p>
          </div>
          <button onClick={onClose} className="text-brand-silver/60 hover:text-brand-charcoal text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          <div>
            <p className="text-xs font-semibold text-brand-charcoal/70 uppercase tracking-wide mb-2">Surviving Record</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${programs.length}, 1fr)` }}>
              {programs.map((prog) => (
                <label
                  key={prog.id}
                  className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    survivorId === prog.id ? 'border-brand-brown bg-brand-cream/30' : 'border-brand-cream hover:border-brand-copper/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="survivor"
                    value={prog.id}
                    checked={survivorId === prog.id}
                    onChange={() => handleSurvivorChange(prog.id)}
                    className="mt-0.5 accent-brand-brown"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-charcoal truncate">{prog.name}</p>
                    <p className="text-xs text-brand-silver truncate">{prog.client_name ?? 'No client'}</p>
                    <p className="text-[10px] text-brand-silver/60 mt-0.5">
                      Updated {new Date(prog.updated_at).toLocaleDateString()}
                      {survivorId === prog.id && <span className="ml-1 text-brand-brown font-semibold">← survivor</span>}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {differingFields.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-brand-charcoal/70 uppercase tracking-wide mb-2">
                Differing Fields ({differingFields.length})
              </p>
              <div className="border border-brand-cream rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-brand-offwhite border-b border-brand-cream">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs text-brand-charcoal/60 font-medium w-28">Field</th>
                      {programs.map((prog) => (
                        <th key={prog.id} className={`text-left px-3 py-2 text-xs font-medium ${survivorId === prog.id ? 'text-brand-brown' : 'text-brand-charcoal/60'}`}>
                          {prog.name}
                          {survivorId === prog.id && <span className="ml-1">(survivor)</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-cream/60">
                    {differingFields.map(({ key, label }) => (
                      <tr key={key as string} className="hover:bg-brand-offwhite/50">
                        <td className="px-3 py-2 text-brand-silver text-xs font-medium">{label}</td>
                        {programs.map((prog) => (
                          <td key={prog.id} className="px-3 py-2">
                            <label className="flex items-start gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`field-${key as string}`}
                                value={prog.id}
                                checked={fieldChoices[key as string] === prog.id}
                                onChange={() => setFieldChoices((prev) => ({ ...prev, [key as string]: prog.id }))}
                                className="mt-0.5 accent-brand-brown flex-shrink-0"
                              />
                              <span className={`text-xs break-words ${fieldChoices[key as string] === prog.id ? 'text-brand-charcoal font-medium' : 'text-brand-charcoal/50'}`}>
                                {displayValue(prog, key)}
                              </span>
                            </label>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-brand-cream flex-shrink-0 flex items-center justify-between">
          {!confirming ? (
            <>
              <button onClick={onClose} className="text-sm text-brand-silver hover:text-brand-charcoal transition-colors">Cancel</button>
              <button
                onClick={() => setConfirming(true)}
                className="px-4 py-2 bg-brand-brown text-white text-sm rounded hover:bg-brand-charcoal transition-colors"
              >
                Review &amp; Confirm →
              </button>
            </>
          ) : (
            <>
              <div className="text-sm text-brand-charcoal/70">
                <span className="font-medium text-red-600">This will permanently delete {programs.length - 1} program{programs.length > 2 ? 's' : ''}.</span>
                {' '}All estimates and events will be moved to the surviving record.
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirming(false)} className="text-sm text-brand-silver hover:text-brand-charcoal px-3 py-2 transition-colors">Back</button>
                <button
                  onClick={handleConfirmMerge}
                  disabled={merging}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {merging ? 'Merging…' : 'Confirm Merge'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
