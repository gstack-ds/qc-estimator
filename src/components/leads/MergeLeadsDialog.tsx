'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DbLead, DbTeamMember } from '@/lib/supabase/queries';
import { mergeLeads } from '@/app/(programs)/leads/actions';
import type { LeadInput } from '@/app/(programs)/leads/actions';

interface Props {
  leads: DbLead[];
  teamMembers: DbTeamMember[];
  onClose: () => void;
}

type FieldDef = { key: keyof DbLead; label: string };

const COMPARE_FIELDS: FieldDef[] = [
  { key: 'client_name',      label: 'Client Name' },
  { key: 'end_company',      label: 'Company' },
  { key: 'end_client',       label: 'End Client' },
  { key: 'contact_name',     label: 'Contact' },
  { key: 'contact_email',    label: 'Email' },
  { key: 'program_name',     label: 'Program Name' },
  { key: 'program_type',     label: 'Program Type' },
  { key: 'start_date',       label: 'Start Date' },
  { key: 'end_date',         label: 'End Date' },
  { key: 'guest_count',      label: 'Guest Count' },
  { key: 'city',             label: 'City' },
  { key: 'state',            label: 'State' },
  { key: 'hotel',            label: 'Hotel' },
  { key: 'venue',            label: 'Venue' },
  { key: 'status',           label: 'Status' },
  { key: 'assigned_to',      label: 'Owner' },
  { key: 'lead_source_type', label: 'Lead Source' },
  { key: 'gdp_advisor',      label: 'GDP Advisor' },
  { key: 'gdp_coordinator',  label: 'GDP Coordinator' },
  { key: 'third_party',      label: 'Third Party' },
  { key: 'special_instructions', label: 'Notes' },
];

function displayValue(lead: DbLead, key: keyof DbLead, teamMembers: DbTeamMember[]): string {
  if (key === 'assigned_to') {
    const m = teamMembers.find((tm) => tm.id === lead.assigned_to);
    return m ? m.first_name : '—';
  }
  const val = lead[key];
  if (val == null || val === '') return '—';
  return String(val);
}

export default function MergeLeadsDialog({ leads, teamMembers, onClose }: Props) {
  const router = useRouter();

  // Sort leads by updated_at desc — most recently updated is the default survivor
  const sorted = [...leads].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  const [survivorId, setSurvivorId] = useState(sorted[0].id);
  const [fieldChoices, setFieldChoices] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    COMPARE_FIELDS.forEach(({ key }) => {
      defaults[key as string] = sorted[0].id;
    });
    return defaults;
  });
  const [confirming, setConfirming] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSurvivorChange(id: string) {
    setSurvivorId(id);
    const survivor = leads.find((l) => l.id === id)!;
    const newChoices: Record<string, string> = {};
    COMPARE_FIELDS.forEach(({ key }) => {
      newChoices[key as string] = id;
    });
    setFieldChoices(newChoices);
  }

  function handleFieldChoice(key: string, leadId: string) {
    setFieldChoices((prev) => ({ ...prev, [key]: leadId }));
  }

  const differingFields = COMPARE_FIELDS.filter(({ key }) => {
    const vals = leads.map((l) => displayValue(l, key, teamMembers));
    return new Set(vals).size > 1;
  });

  async function handleConfirmMerge() {
    setMerging(true);
    setError(null);

    const survivor = leads.find((l) => l.id === survivorId)!;
    const duplicateIds = leads.filter((l) => l.id !== survivorId).map((l) => l.id);

    const fieldValues: LeadInput = {};
    differingFields.forEach(({ key }) => {
      const chosenLeadId = fieldChoices[key as string];
      if (chosenLeadId !== survivorId) {
        const chosenLead = leads.find((l) => l.id === chosenLeadId)!;
        (fieldValues as Record<string, unknown>)[key as string] = chosenLead[key] ?? null;
      }
    });

    const { error: err } = await mergeLeads(survivorId, duplicateIds, fieldValues);
    setMerging(false);
    if (err) { setError(err); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-brand-cream flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-serif text-lg font-medium text-brand-charcoal">Merge {leads.length} Leads</h2>
            <p className="text-xs text-brand-silver mt-0.5">
              Pick a surviving record, then choose which value to keep for each differing field.
            </p>
          </div>
          <button onClick={onClose} className="text-brand-silver/60 hover:text-brand-charcoal text-xl leading-none">×</button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Survivor picker */}
          <div>
            <p className="text-xs font-semibold text-brand-charcoal/70 uppercase tracking-wide mb-2">Surviving Record</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${leads.length}, 1fr)` }}>
              {sorted.map((lead) => (
                <label
                  key={lead.id}
                  className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    survivorId === lead.id
                      ? 'border-brand-brown bg-brand-cream/30'
                      : 'border-brand-cream hover:border-brand-copper/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="survivor"
                    value={lead.id}
                    checked={survivorId === lead.id}
                    onChange={() => handleSurvivorChange(lead.id)}
                    className="mt-0.5 accent-brand-brown"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-charcoal truncate">{lead.client_name ?? '—'}</p>
                    <p className="text-xs text-brand-silver truncate">{lead.program_name ?? 'No program name'}</p>
                    <p className="text-[10px] text-brand-silver/60 mt-0.5">
                      Updated {new Date(lead.updated_at).toLocaleDateString()}
                      {survivorId === lead.id && <span className="ml-1 text-brand-brown font-semibold">← survivor</span>}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Differing fields */}
          {differingFields.length === 0 ? (
            <p className="text-sm text-brand-silver italic">All fields are identical — only the surviving record will be kept.</p>
          ) : (
            <div>
              <p className="text-xs font-semibold text-brand-charcoal/70 uppercase tracking-wide mb-2">
                Differing Fields ({differingFields.length})
              </p>
              <div className="border border-brand-cream rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-brand-offwhite border-b border-brand-cream">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs text-brand-charcoal/60 font-medium w-28">Field</th>
                      {sorted.map((lead) => (
                        <th key={lead.id} className={`text-left px-3 py-2 text-xs font-medium ${survivorId === lead.id ? 'text-brand-brown' : 'text-brand-charcoal/60'}`}>
                          {lead.client_name ?? '—'}
                          {survivorId === lead.id && <span className="ml-1">(survivor)</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-cream/60">
                    {differingFields.map(({ key, label }) => (
                      <tr key={key as string} className="hover:bg-brand-offwhite/50">
                        <td className="px-3 py-2 text-brand-silver text-xs font-medium">{label}</td>
                        {sorted.map((lead) => (
                          <td key={lead.id} className="px-3 py-2">
                            <label className="flex items-start gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`field-${key as string}`}
                                value={lead.id}
                                checked={fieldChoices[key as string] === lead.id}
                                onChange={() => handleFieldChoice(key as string, lead.id)}
                                className="mt-0.5 accent-brand-brown flex-shrink-0"
                              />
                              <span className={`text-xs break-words ${fieldChoices[key as string] === lead.id ? 'text-brand-charcoal font-medium' : 'text-brand-charcoal/50'}`}>
                                {displayValue(lead, key, teamMembers)}
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-brand-cream flex-shrink-0 flex items-center justify-between">
          {!confirming ? (
            <>
              <button onClick={onClose} className="text-sm text-brand-silver hover:text-brand-charcoal transition-colors">
                Cancel
              </button>
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
                <span className="font-medium text-red-600">This will permanently delete {leads.length - 1} lead{leads.length > 2 ? 's' : ''}.</span>
                {' '}Linked programs will be re-pointed to the surviving record.
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirming(false)} className="text-sm text-brand-silver hover:text-brand-charcoal transition-colors px-3 py-2">
                  Back
                </button>
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
