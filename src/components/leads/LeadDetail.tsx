'use client';

import { useState } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';
import type { DbLead, DbTeamMember, LeadStatus } from '@/lib/supabase/queries';
import LeadStatusBadge from './LeadStatusBadge';
import { updateLead, deleteLead, createProgramFromLead, type LeadInput } from '@/app/(programs)/leads/actions';

// ─── Config ───────────────────────────────────────────────

const STATUSES: LeadStatus[] = [
  'tracking_on_hold', 'new_lead', 'proposal_in_progress', 'pending_client_review',
  'negotiations', 'pending_contract_payment', 'under_contract', 'planning',
  'unresponsive', 'post_event_close_out', 'halted', 'planning_not_started',
  'did_not_book', 'completed',
];
const STATUS_LABELS: Record<LeadStatus, string> = {
  tracking_on_hold:         'Tracking / On Hold',
  new_lead:                 'New Lead',
  proposal_in_progress:     'Proposal in Progress',
  pending_client_review:    'Pending Client Review',
  negotiations:             'Negotiations',
  pending_contract_payment: 'Pending Contract/Payment',
  under_contract:           'Under Contract',
  planning:                 'Planning',
  unresponsive:             'Unresponsive',
  post_event_close_out:     'Post Event Close Out',
  halted:                   'Halted',
  planning_not_started:     'Planning Not Started',
  did_not_book:             'Did Not Book',
  completed:                'Completed',
};

const GDP_ADVISOR_OPTIONS = [
  { value: '', label: '—' },
  ...['Shelley', 'Riley', 'Chris', 'Benoit', 'Dawn', 'Maxine'].map((v) => ({ value: v, label: v })),
];
const GDP_COORDINATOR_OPTIONS = [
  { value: '', label: '—' },
  ...['Amy', 'Maria', 'Jessica', 'Michelle', 'Maxime'].map((v) => ({ value: v, label: v })),
];
const THIRD_PARTY_OPTIONS = [
  { value: '', label: '—' },
  ...['American Express', 'MMS', 'Ashfield', 'Bishop McCann', 'Bond Brand Loyalty',
    'Carrousel Travel', 'C2 Events Ltd', 'ConferenceDirect', 'CWT', 'Emota', 'EEG',
    'Sutton Planning', 'The Turner Agency', 'YES', 'MGME', 'Rubra', 'Meet Events',
    'FIRST Agency', 'Marbet', 'DMI', 'World Travel Inc', 'Strategic Site Selection',
    'Pure Event Management', 'Event Strategy Group',
  ].map((v) => ({ value: v, label: v })),
];
const LEAD_SOURCE_TYPE_OPTIONS = [
  { value: '', label: '—' },
  ...['GDP', 'Direct', 'Rubra', 'Conference', 'Sales Coordinator'].map((v) => ({ value: v, label: v })),
];

// ─── Shared styles ─────────────────────────────────────────

const inputCls = 'w-full border border-brand-cream rounded px-2.5 py-1.5 text-sm bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper';
const labelCls = 'block text-[10px] font-medium text-brand-charcoal/50 uppercase tracking-wide mb-0.5';
const sectionCls = 'bg-white border border-brand-cream rounded-lg p-5 space-y-4';
const sectionHeadCls = 'font-serif text-sm font-medium text-brand-charcoal mb-3';
const viewCls = 'min-h-[28px] px-2.5 py-1.5 text-sm rounded cursor-text hover:bg-brand-offwhite border border-transparent hover:border-brand-cream transition-colors text-brand-charcoal';

// ─── Field components ──────────────────────────────────────

// type='percent': stored as decimal (0.065), displayed/edited as percentage (6.5)
function Field({ label, value, field, type = 'text', onSave }:
  { label: string; value: string | number | null; field: keyof LeadInput; type?: string; onSave: (f: keyof LeadInput, v: string | number | boolean | null) => void }
) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function initDraft() {
    if (type === 'percent') {
      setDraft(value != null ? String(Math.round(Number(value) * 10000) / 100) : '');
    } else {
      setDraft(String(value ?? ''));
    }
  }

  function commit() {
    setEditing(false);
    if (type === 'number') {
      onSave(field, draft === '' ? null : parseFloat(draft));
    } else if (type === 'percent') {
      onSave(field, draft === '' ? null : parseFloat(draft) / 100);
    } else {
      onSave(field, draft || null);
    }
  }

  function displayValue(): React.ReactNode {
    if (value == null || value === '') return <span className="text-brand-silver">—</span>;
    if (type === 'percent') return `${(Math.round(Number(value) * 10000) / 100)}%`;
    return String(value);
  }

  if (!editing) {
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <div onClick={() => { initDraft(); setEditing(true); }} className={viewCls}>
          {displayValue()}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        autoFocus
        type={type === 'percent' ? 'number' : type}
        step={type === 'percent' ? '0.1' : undefined}
        className={inputCls}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      />
    </div>
  );
}

function TextAreaField({ label, value, field, onSave }:
  { label: string; value: string | null; field: keyof LeadInput; onSave: (f: keyof LeadInput, v: string | number | boolean | null) => void }
) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function commit() {
    setEditing(false);
    onSave(field, draft || null);
  }

  if (!editing) {
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <div
          onClick={() => { setDraft(value ?? ''); setEditing(true); }}
          className="min-h-[36px] px-2.5 py-1.5 text-sm rounded cursor-text hover:bg-brand-offwhite border border-transparent hover:border-brand-cream transition-colors text-brand-charcoal whitespace-pre-wrap"
        >
          {value ? value : <span className="text-brand-silver">—</span>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <textarea
        autoFocus
        rows={3}
        className={inputCls + ' resize-none'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
    </div>
  );
}

function SelectField({ label, value, field, options, onSave }: {
  label: string;
  value: string | null;
  field: keyof LeadInput;
  options: { value: string; label: string }[];
  onSave: (f: keyof LeadInput, v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const display = options.find((o) => o.value === (value ?? ''))?.label ?? null;

  if (!editing) {
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <div onClick={() => setEditing(true)} className={viewCls + ' cursor-pointer'}>
          {display && value ? display : <span className="text-brand-silver">—</span>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select
        autoFocus
        defaultValue={value ?? ''}
        onChange={(e) => {
          onSave(field, e.target.value || null);
          setEditing(false);
        }}
        onBlur={() => setEditing(false)}
        className={inputCls}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────

interface Props {
  lead: DbLead;
  /** All programs created from this lead — ordered most-recent first. May be empty. */
  linkedPrograms: { id: string; name: string; event_date: string | null }[];
  teamMembers: DbTeamMember[];
}

export default function LeadDetail({ lead: initialLead, linkedPrograms, teamMembers }: Props) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [creatingProgram, setCreatingProgram] = useState(false);
  const [progError, setProgError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(field: keyof LeadInput, value: string | number | boolean | null) {
    const patch: LeadInput = { [field]: value } as LeadInput;
    setLead((prev) => ({ ...prev, [field]: value }));
    const { error } = await updateLead(lead.id, patch);
    if (error) setSaveError(error);
  }

  async function handleStatusChange(status: LeadStatus) {
    await updateLead(lead.id, { status });
    setLead((prev) => ({ ...prev, status }));
    router.refresh();
  }

  async function handleCreateProgram() {
    setCreatingProgram(true);
    setProgError(null);
    const { error, programId } = await createProgramFromLead(lead.id);
    setCreatingProgram(false);
    if (error || !programId) { setProgError(error ?? 'Failed'); return; }
    router.push(`/programs/${programId}`);
  }

  async function handleDelete() {
    await deleteLead(lead.id);
    router.push('/leads');
  }

  const f = (field: keyof LeadInput, label: string, type: string = 'text') => (
    <Field label={label} value={(lead as unknown as Record<string, unknown>)[field as string] as string | number | null} field={field} type={type} onSave={save} />
  );
  const tf = (field: keyof LeadInput, label: string) => (
    <TextAreaField label={label} value={(lead as unknown as Record<string, unknown>)[field as string] as string | null} field={field} onSave={save} />
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => router.push('/leads')} className="text-xs text-brand-silver hover:text-brand-charcoal mb-2 transition-colors">
            ← All Leads
          </button>
          <h1 className="font-serif text-2xl font-medium text-brand-charcoal">
            {lead.client_name || lead.program_name || 'Untitled Lead'}
          </h1>
          {lead.end_company && (
            <p className="text-sm text-brand-charcoal/60 mt-0.5">{lead.end_company}</p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {lead.original_email_link && (
            <a
              href={lead.original_email_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded border border-brand-cream bg-white hover:bg-brand-offwhite text-brand-charcoal/70 hover:text-brand-charcoal transition-colors"
            >
              View Email ↗
            </a>
          )}
          {lead.parsed_by && (
            <span className="text-[10px] text-brand-silver border border-brand-cream rounded px-2 py-1">
              Parsed by {lead.parsed_by}
            </span>
          )}
        </div>
      </div>

      {saveError && <p className="text-sm text-red-500">{saveError}</p>}

      {/* Status + Owner row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <label className={labelCls}>Status</label>
          <select
            value={lead.status}
            onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
            className="border border-brand-cream rounded px-2.5 py-1.5 text-sm bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Assigned To</label>
          <select
            value={lead.assigned_to != null ? String(lead.assigned_to) : ''}
            onChange={(e) => save('assigned_to', e.target.value ? Number(e.target.value) : null)}
            className="border border-brand-cream rounded px-2.5 py-1.5 text-sm bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
          >
            <option value="">— Unassigned —</option>
            {teamMembers.map((m) => <option key={m.id} value={String(m.id)}>{m.first_name} {m.last_name}</option>)}
          </select>
          {lead.suggested_owner && (
            <p className="text-[10px] text-brand-silver mt-0.5">Suggested: {lead.suggested_owner}</p>
          )}
        </div>

        <div>
          <label className={labelCls}>Team Support</label>
          <select
            value={lead.team_support != null ? String(lead.team_support) : ''}
            onChange={(e) => save('team_support', e.target.value ? Number(e.target.value) : null)}
            className="border border-brand-cream rounded px-2.5 py-1.5 text-sm bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
          >
            <option value="">— None —</option>
            {teamMembers.map((m) => <option key={m.id} value={String(m.id)}>{m.first_name} {m.last_name}</option>)}
          </select>
        </div>

        <div className="ml-auto">
          <LeadStatusBadge status={lead.status} />
        </div>
      </div>

      {/* Linked program — one per lead (UNIQUE constraint: migration 034) */}
      <div className="bg-brand-offwhite border border-brand-cream rounded-lg p-4 space-y-3">
        {linkedPrograms.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-brand-charcoal/60 uppercase tracking-wide">Linked Program</p>
            {linkedPrograms.map(prog => (
              <div key={prog.id} className="flex items-center gap-2">
                <a
                  href={`/programs/${prog.id}`}
                  className="text-sm font-medium text-brand-brown hover:text-brand-charcoal transition-colors"
                >
                  {prog.name} →
                </a>
                {prog.event_date && (
                  <span className="text-xs text-brand-silver">{prog.event_date.slice(0, 10)}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm text-brand-charcoal font-medium">Ready to build this estimate?</p>
              <p className="text-xs text-brand-charcoal/60 mt-0.5">Creates a program pre-filled with lead data and marks this lead as Proposal in Progress.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleCreateProgram}
                disabled={creatingProgram}
                className="text-sm font-medium bg-brand-brown text-white rounded px-4 py-1.5 hover:bg-brand-charcoal transition-colors disabled:opacity-50"
              >
                {creatingProgram ? 'Creating…' : 'Create Program →'}
              </button>
              {progError && <p className="text-xs text-red-500">{progError}</p>}
            </div>
          </>
        )}
      </div>

      {/* Client Info */}
      <div className={sectionCls}>
        <h2 className={sectionHeadCls}>Client Info</h2>
        <div className="grid grid-cols-2 gap-4">
          {f('client_name', 'Client Name')}
          {f('end_company', 'End Company')}
          {f('end_client', 'End Client')}
          {f('contact_name', 'Contact Name')}
          {f('client_contact_name', 'Client Contact Name')}
          {f('contact_email', 'Contact Email')}
          {f('contact_role', 'Contact Role')}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Returning Client"
            value={lead.returning_client == null ? '' : String(lead.returning_client)}
            field="returning_client"
            options={[
              { value: '', label: 'Unknown' },
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ]}
            onSave={(f, v) => save(f, v === '' || v == null ? null : v === 'true')}
          />
        </div>
      </div>

      {/* Program Details */}
      <div className={sectionCls}>
        <h2 className={sectionHeadCls}>Program Details</h2>
        <div className="grid grid-cols-2 gap-4">
          {f('program_name', 'Program Name')}
          {f('program_type', 'Program Type')}
          {f('guest_count', 'Guest Count', 'number')}
          {f('num_nights', 'Number of Nights', 'number')}
        </div>
        {tf('program_description', 'Program Description')}
      </div>

      {/* Dates & Logistics */}
      <div className={sectionCls}>
        <h2 className={sectionHeadCls}>Dates & Logistics</h2>
        <div className="grid grid-cols-3 gap-4">
          {f('start_date', 'Start Date', 'date')}
          {f('end_date', 'End Date', 'date')}
          {f('rain_date', 'Rain Date', 'date')}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {f('date_last_followup', 'Date of Last Follow-Up', 'date')}
          {f('current_due_date', 'Current Due Date', 'date')}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {f('hotel', 'Hotel')}
          {f('venue', 'Venue')}
        </div>
      </div>

      {/* Location */}
      <div className={sectionCls}>
        <h2 className={sectionHeadCls}>Location</h2>
        <div className="grid grid-cols-3 gap-4">
          {f('city', 'City')}
          {f('state', 'State')}
          {f('region', 'Region / Market')}
        </div>
      </div>

      {/* Source & Commission */}
      <div className={sectionCls}>
        <h2 className={sectionHeadCls}>Source & Commission</h2>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Lead Source Type"
            value={lead.lead_source_type}
            field="lead_source_type"
            options={LEAD_SOURCE_TYPE_OPTIONS}
            onSave={(f, v) => save(f, v || null)}
          />
          {f('lead_source', 'Lead Source (raw)')}
          {f('source_commission', 'Source Commission %', 'percent')}
          {f('gdp_commission', 'GDP Commission %', 'percent')}
          {f('extra_commission', 'Extra Commission %', 'percent')}
          {f('source_advisor', 'Source Advisor')}
          {f('source_coordinator', 'Source Coordinator')}
          {f('sales_coordinator', 'Sales Coordinator')}
        </div>
        {tf('commission_notes', 'Commission Notes')}
        {tf('billing_notes', 'Billing Notes')}
      </div>

      {/* GDP & Third Party */}
      <div className={sectionCls}>
        <h2 className={sectionHeadCls}>GDP & Third Party</h2>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="GDP Advisor"
            value={lead.gdp_advisor}
            field="gdp_advisor"
            options={GDP_ADVISOR_OPTIONS}
            onSave={(f, v) => save(f, v || null)}
          />
          <SelectField
            label="GDP Coordinator"
            value={lead.gdp_coordinator}
            field="gdp_coordinator"
            options={GDP_COORDINATOR_OPTIONS}
            onSave={(f, v) => save(f, v || null)}
          />
          <SelectField
            label="Third Party"
            value={lead.third_party}
            field="third_party"
            options={THIRD_PARTY_OPTIONS}
            onSave={(f, v) => save(f, v || null)}
          />
          {f('third_party_company', 'Third-Party Company')}
          {f('third_party_contact', 'Third-Party Contact')}
          {f('third_party_commission', 'Third-Party Commission %', 'percent')}
        </div>
        {tf('third_party_comm_notes', 'Third-Party Commission Notes')}
      </div>

      {/* Notes */}
      <div className={sectionCls}>
        <h2 className={sectionHeadCls}>Notes</h2>
        {tf('special_instructions', 'Special Instructions')}
      </div>

      {/* Danger zone */}
      <div className="border border-red-100 rounded-lg p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand-charcoal">Delete this lead</p>
          <p className="text-xs text-brand-charcoal/60">Permanently removes the lead. Cannot be undone.</p>
        </div>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-brand-charcoal/70">Are you sure?</span>
            <button onClick={handleDelete} className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-xs text-brand-charcoal/70 hover:text-brand-charcoal transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors">
            Delete Lead
          </button>
        )}
      </div>
    </div>
  );
}
