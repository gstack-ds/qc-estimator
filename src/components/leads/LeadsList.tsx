'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DbLead, DbTeamMember, LeadStatus, LeadStatusGroup } from '@/lib/supabase/queries';
import { OPEN_STATUSES, PAUSED_STATUSES, CLOSED_STATUSES } from '@/lib/leads/constants';
import LeadStatusBadge from './LeadStatusBadge';
import { createLead, updateLead, bulkArchiveLeads, deleteLead, type LeadInput } from '@/app/(programs)/leads/actions';
import MergeLeadsDialog from './MergeLeadsDialog';

// ─── Constants ─────────────────────────────────────────────

const STATUS_LABELS: Record<LeadStatus, string> = {
  new_lead:                 'New Lead',
  proposal_in_progress:     'Proposal in Progress',
  pending_client_review:    'Pending Client Review',
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

const ALL_STATUSES: LeadStatus[] = [
  'new_lead', 'proposal_in_progress', 'pending_client_review', 'pending_contract_payment',
  'under_contract', 'planning', 'unresponsive', 'post_event_close_out',
  'halted', 'planning_not_started', 'did_not_book', 'completed',
];

const OPEN_SET = new Set<LeadStatus>(OPEN_STATUSES);
const PAUSED_SET = new Set<LeadStatus>(PAUSED_STATUSES);
const CLOSED_SET = new Set<LeadStatus>(CLOSED_STATUSES);

const GDP_ADVISORS = ['', 'Shelley', 'Riley', 'Chris', 'Benoit', 'Dawn', 'Maxine'];
const GDP_COORDINATORS = ['', 'Amy', 'Maria', 'Jessica', 'Michelle', 'Maxime'];
const THIRD_PARTY_OPTIONS = [
  '', 'American Express', 'MMS', 'Ashfield', 'Bishop McCann', 'Bond Brand Loyalty',
  'Carrousel Travel', 'C2 Events Ltd', 'ConferenceDirect', 'CWT', 'Emota', 'EEG',
  'Sutton Planning', 'The Turner Agency', 'YES', 'MGME', 'Rubra', 'Meet Events',
  'FIRST Agency', 'Marbet', 'DMI', 'World Travel Inc', 'Strategic Site Selection',
  'Pure Event Management', 'Event Strategy Group',
];
const LEAD_SOURCE_OPTIONS = ['', 'GDP', 'Direct', 'Rubra', 'Conference', 'Sales Coordinator'];

type SortKey = 'client_name' | 'program_name' | 'city' | 'guest_count' | 'start_date' | 'end_date' | 'status' | 'created_at';

const NEW_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const cellSelectCls = 'text-xs border border-brand-cream rounded px-1.5 py-1 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper';

// ─── Helpers ───────────────────────────────────────────────

function fmt(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${y}`;
}

function location(lead: DbLead): string {
  const parts = [lead.city, lead.state].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

// ─── DateCell ─────────────────────────────────────────────

function DateCell({ leadId, value, onSave }: {
  leadId: string;
  value: string | null;
  onSave: (id: string, v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <input
        autoFocus
        type="date"
        defaultValue={value ?? ''}
        className="border border-brand-copper rounded px-1.5 py-0.5 text-xs w-28 text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
        onBlur={(e) => { onSave(leadId, e.target.value || null); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="whitespace-nowrap cursor-text hover:text-brand-brown transition-colors"
      title="Click to edit"
    >
      {fmt(value)}
    </span>
  );
}

// ─── Add Lead Form ─────────────────────────────────────────

const EMPTY: LeadInput = {
  client_name: '', end_company: '', contact_name: '', contact_email: '',
  program_name: '', program_type: '', start_date: '', end_date: '',
  guest_count: null, city: '', state: '', region: '', hotel: '', venue: '',
  lead_source: '', source_commission: null, third_party_commission: null,
  assigned_to: null, special_instructions: '', status: 'new_lead',
};

function AddLeadPanel({ teamMembers, onClose, onCreated }: {
  teamMembers: DbTeamMember[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState<LeadInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof LeadInput, v: string | number | null) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: err, id } = await createLead(form);
    setSaving(false);
    if (err || !id) { setError(err ?? 'Failed to create lead'); return; }
    onCreated(id);
  }

  const inputCls = 'w-full border border-brand-cream rounded px-2.5 py-1.5 text-sm bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper focus:border-brand-brown';
  const labelCls = 'block text-[10px] font-medium text-brand-charcoal/50 uppercase tracking-wide mb-0.5';

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-16 px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-cream">
          <h2 className="font-serif text-lg font-medium text-brand-charcoal">Add Lead</h2>
          <button onClick={onClose} className="text-brand-silver hover:text-brand-charcoal text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Client Name</label>
              <input className={inputCls} value={form.client_name ?? ''} onChange={(e) => set('client_name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>End Company</label>
              <input className={inputCls} value={form.end_company ?? ''} onChange={(e) => set('end_company', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Contact Name</label>
              <input className={inputCls} value={form.contact_name ?? ''} onChange={(e) => set('contact_name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Contact Email</label>
              <input type="email" className={inputCls} value={form.contact_email ?? ''} onChange={(e) => set('contact_email', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Program Name</label>
              <input className={inputCls} value={form.program_name ?? ''} onChange={(e) => set('program_name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Program Type</label>
              <input className={inputCls} value={form.program_type ?? ''} onChange={(e) => set('program_type', e.target.value)} placeholder="e.g., Corporate Dinner" />
            </div>
            <div>
              <label className={labelCls}>Start Date</label>
              <input type="date" className={inputCls} value={form.start_date ?? ''} onChange={(e) => set('start_date', e.target.value || null)} />
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <input type="date" className={inputCls} value={form.end_date ?? ''} onChange={(e) => set('end_date', e.target.value || null)} />
            </div>
            <div>
              <label className={labelCls}>Guest Count</label>
              <input type="number" min="0" className={inputCls} value={form.guest_count ?? ''} onChange={(e) => set('guest_count', e.target.value ? parseInt(e.target.value) : null)} />
            </div>
            <div>
              <label className={labelCls}>Venue</label>
              <input className={inputCls} value={form.venue ?? ''} onChange={(e) => set('venue', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>City</label>
              <input className={inputCls} value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>State</label>
              <input className={inputCls} value={form.state ?? ''} onChange={(e) => set('state', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Region / Market</label>
              <input className={inputCls} value={form.region ?? ''} onChange={(e) => set('region', e.target.value)} placeholder="e.g., Charlotte, DC" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Lead Source</label>
              <input className={inputCls} value={form.lead_source ?? ''} onChange={(e) => set('lead_source', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Assigned To</label>
              <select className={inputCls} value={form.assigned_to != null ? String(form.assigned_to) : ''} onChange={(e) => set('assigned_to', e.target.value ? Number(e.target.value) : null)}>
                <option value="">— Unassigned —</option>
                {teamMembers.map((m) => <option key={m.id} value={String(m.id)}>{m.first_name} {m.last_name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Special Instructions</label>
            <textarea className={inputCls + ' resize-none'} rows={2} value={form.special_instructions ?? ''} onChange={(e) => set('special_instructions', e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-brand-charcoal/70 hover:text-brand-charcoal transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-brand-brown text-white rounded hover:bg-brand-charcoal transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Lead Card (mobile) ────────────────────────────────────

function LeadCard({ lead, teamMembers, isNew, onSave }: {
  lead: DbLead;
  teamMembers: DbTeamMember[];
  isNew: boolean;
  onSave: (id: string, field: keyof LeadInput, value: string | number | null) => void;
}) {
  return (
    <div className="bg-white border border-brand-cream rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-brand-charcoal flex items-center gap-1.5 flex-wrap">
            <span className="truncate">{lead.client_name ?? <span className="text-brand-silver">—</span>}</span>
            {isNew && (
              <span className="text-[9px] font-semibold bg-brand-copper text-white px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">
                NEW
              </span>
            )}
          </div>
          {lead.program_name && (
            <div className="text-sm text-brand-charcoal/70 mt-0.5 truncate">{lead.program_name}</div>
          )}
          <div className="text-xs text-brand-charcoal/50 mt-0.5">
            {fmt(lead.start_date)}
            {lead.city && ` · ${lead.city}${lead.state ? `, ${lead.state}` : ''}`}
          </div>
        </div>
        <Link
          href={`/leads/${lead.id}`}
          className="text-xs text-brand-brown hover:text-brand-charcoal font-medium transition-colors whitespace-nowrap flex-shrink-0"
        >
          View →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] font-medium text-brand-charcoal/40 uppercase tracking-wide mb-1">Owner</div>
          <select
            value={lead.assigned_to != null ? String(lead.assigned_to) : ''}
            onChange={(e) => onSave(lead.id, 'assigned_to', e.target.value ? Number(e.target.value) : null)}
            className={cellSelectCls + ' w-full'}
          >
            <option value="">—</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={String(m.id)}>{m.first_name}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[10px] font-medium text-brand-charcoal/40 uppercase tracking-wide mb-1">Status</div>
          <select
            value={lead.status}
            onChange={(e) => onSave(lead.id, 'status', e.target.value)}
            className={cellSelectCls + ' w-full'}
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Lead Row ─────────────────────────────────────────────

function LeadRowCells({ lead, teamMembers, isNew, onSave, onDelete }: {
  lead: DbLead;
  teamMembers: DbTeamMember[];
  isNew: boolean;
  onSave: (id: string, field: keyof LeadInput, value: string | number | null) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}) {
  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      {/* Client */}
      <td className="px-3 py-2.5 font-medium text-brand-charcoal whitespace-nowrap sticky left-8 z-10 bg-white group-hover:bg-brand-offwhite transition-colors">
        <span className="flex items-center gap-1.5">
          {lead.client_name ?? <span className="text-brand-silver">—</span>}
          {isNew && (
            <span className="text-[9px] font-semibold bg-brand-copper text-white px-1.5 py-0.5 rounded-full leading-none">
              NEW
            </span>
          )}
        </span>
      </td>

      {/* Program */}
      <td className="px-3 py-2.5 text-brand-charcoal/80 whitespace-nowrap">
        {lead.program_name ?? <span className="text-brand-silver">—</span>}
      </td>

      {/* Location */}
      <td className="px-3 py-2.5 text-brand-charcoal/70 whitespace-nowrap">{location(lead)}</td>

      {/* Guests */}
      <td className="px-3 py-2.5 text-right tabular-nums text-brand-charcoal/70 whitespace-nowrap">
        {lead.guest_count ?? '—'}
      </td>

      {/* Start Date */}
      <td className="px-3 py-2.5 text-brand-charcoal/70" onClick={stopProp}>
        <DateCell leadId={lead.id} value={lead.start_date} onSave={(id, v) => onSave(id, 'start_date', v)} />
      </td>

      {/* End Date */}
      <td className="px-3 py-2.5 text-brand-charcoal/70" onClick={stopProp}>
        <DateCell leadId={lead.id} value={lead.end_date} onSave={(id, v) => onSave(id, 'end_date', v)} />
      </td>

      {/* Owner */}
      <td className="px-3 py-2" onClick={stopProp}>
        <select
          value={lead.assigned_to != null ? String(lead.assigned_to) : ''}
          onChange={(e) => onSave(lead.id, 'assigned_to', e.target.value ? Number(e.target.value) : null)}
          className={cellSelectCls}
        >
          <option value="">—</option>
          {teamMembers.map((m) => <option key={m.id} value={String(m.id)}>{m.first_name}</option>)}
        </select>
      </td>

      {/* Team Support */}
      <td className="px-3 py-2" onClick={stopProp}>
        <select
          value={lead.team_support != null ? String(lead.team_support) : ''}
          onChange={(e) => onSave(lead.id, 'team_support', e.target.value ? Number(e.target.value) : null)}
          className={cellSelectCls}
        >
          <option value="">—</option>
          {teamMembers.map((m) => <option key={m.id} value={String(m.id)}>{m.first_name}</option>)}
        </select>
      </td>

      {/* Status */}
      <td className="px-3 py-2" onClick={stopProp}>
        <select
          value={lead.status}
          onChange={(e) => onSave(lead.id, 'status', e.target.value)}
          className={cellSelectCls}
        >
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </td>

      {/* GDP Advisor */}
      <td className="px-3 py-2" onClick={stopProp}>
        <select
          value={lead.gdp_advisor ?? ''}
          onChange={(e) => onSave(lead.id, 'gdp_advisor', e.target.value || null)}
          className={cellSelectCls}
        >
          {GDP_ADVISORS.map((v) => <option key={v} value={v}>{v || '—'}</option>)}
        </select>
      </td>

      {/* GDP Coordinator */}
      <td className="px-3 py-2" onClick={stopProp}>
        <select
          value={lead.gdp_coordinator ?? ''}
          onChange={(e) => onSave(lead.id, 'gdp_coordinator', e.target.value || null)}
          className={cellSelectCls}
        >
          {GDP_COORDINATORS.map((v) => <option key={v} value={v}>{v || '—'}</option>)}
        </select>
      </td>

      {/* Third Party */}
      <td className="px-3 py-2" onClick={stopProp}>
        <select
          value={lead.third_party ?? ''}
          onChange={(e) => onSave(lead.id, 'third_party', e.target.value || null)}
          className={cellSelectCls}
        >
          {THIRD_PARTY_OPTIONS.map((v) => <option key={v} value={v}>{v || '—'}</option>)}
        </select>
      </td>

      {/* Lead Source */}
      <td className="px-3 py-2" onClick={stopProp}>
        <select
          value={lead.lead_source_type ?? ''}
          onChange={(e) => onSave(lead.id, 'lead_source_type', e.target.value || null)}
          className={cellSelectCls}
        >
          {LEAD_SOURCE_OPTIONS.map((v) => <option key={v} value={v}>{v || '—'}</option>)}
        </select>
      </td>

      {/* Date of Last F/U */}
      <td className="px-3 py-2.5 text-brand-charcoal/70" onClick={stopProp}>
        <DateCell leadId={lead.id} value={lead.date_last_followup} onSave={(id, v) => onSave(id, 'date_last_followup', v)} />
      </td>

      {/* Current Due Date */}
      <td className="px-3 py-2.5 text-brand-charcoal/70" onClick={stopProp}>
        <DateCell leadId={lead.id} value={lead.current_due_date} onSave={(id, v) => onSave(id, 'current_due_date', v)} />
      </td>

      {/* Received */}
      <td className="px-3 py-2.5 text-brand-silver whitespace-nowrap text-xs">{fmt(lead.created_at.slice(0, 10))}</td>

      {/* Delete */}
      <td className="px-2 py-2" onClick={stopProp}>
        <button
          onClick={(e) => onDelete(e, lead.id)}
          className="text-brand-cream hover:text-red-500 transition-colors p-0.5"
          title="Delete lead"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </td>
    </>
  );
}

// ─── Leads List ────────────────────────────────────────────

interface Props {
  leads: DbLead[];
  counts: Record<LeadStatusGroup, number>;
  teamMembers: DbTeamMember[];
}

export default function LeadsList({ leads, counts, teamMembers }: Props) {
  const router = useRouter();
  const [groupFilter, setGroupFilter] = useState<LeadStatusGroup>('open');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('start_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showArchiveOld, setShowArchiveOld] = useState(false);
  const [archiveCutoff, setArchiveCutoff] = useState('2025-12-31');
  const [archiving, setArchiving] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  const [localEdits, setLocalEdits] = useState<Map<string, Partial<DbLead>>>(new Map());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const effectiveLeads = useMemo(
    () => leads
      .filter((l) => !deletedIds.has(l.id))
      .map((l) => { const e = localEdits.get(l.id); return e ? { ...l, ...e } : l; }),
    [leads, localEdits, deletedIds],
  );

  async function handleDeleteLead(e: React.MouseEvent, leadId: string) {
    e.stopPropagation();
    if (!window.confirm('Delete this lead? This cannot be undone.')) return;
    setDeletedIds((prev) => new Set([...prev, leadId]));
    await deleteLead(leadId);
  }

  async function saveCellChange(leadId: string, field: keyof LeadInput, value: string | number | null) {
    setLocalEdits((prev) => {
      const next = new Map(prev);
      next.set(leadId, { ...(next.get(leadId) ?? {}), [field]: value } as Partial<DbLead>);
      return next;
    });
    await updateLead(leadId, { [field]: value } as LeadInput);
  }

  const archiveOldCount = useMemo(
    () => effectiveLeads.filter(
      (l) => l.status !== 'did_not_book' && l.status !== 'completed' &&
             l.start_date != null && l.start_date <= archiveCutoff,
    ).length,
    [effectiveLeads, archiveCutoff],
  );

  async function handleBulkArchive() {
    setArchiving(true);
    const { error } = await bulkArchiveLeads(archiveCutoff);
    setArchiving(false);
    if (error) { alert(error); return; }
    setShowArchiveOld(false);
    router.refresh();
  }

  const nowMs = Date.now();

  const newTodayCount = useMemo(
    () => effectiveLeads.filter((l) => nowMs - new Date(l.created_at).getTime() < NEW_THRESHOLD_MS).length,
    [effectiveLeads, nowMs],
  );

  const displayLeads = useMemo(() => {
    let base = effectiveLeads;
    if (groupFilter === 'open')        base = base.filter((l) => OPEN_SET.has(l.status));
    else if (groupFilter === 'paused') base = base.filter((l) => PAUSED_SET.has(l.status));
    else if (groupFilter === 'closed') base = base.filter((l) => CLOSED_SET.has(l.status));
    if (ownerFilter !== '') base = base.filter((l) => l.assigned_to != null && String(l.assigned_to) === ownerFilter);
    if (dateFrom) base = base.filter((l) => l.created_at.slice(0, 10) >= dateFrom);
    if (dateTo)   base = base.filter((l) => l.created_at.slice(0, 10) <= dateTo);
    if (showNewOnly) base = base.filter((l) => nowMs - new Date(l.created_at).getTime() < NEW_THRESHOLD_MS);

    return [...base].sort((a, b) => {
      const av = a[sortKey as keyof DbLead] ?? '';
      const bv = b[sortKey as keyof DbLead] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [effectiveLeads, groupFilter, ownerFilter, dateFrom, dateTo, showNewOnly, sortKey, sortDir, nowMs]);

  const totalLeads = displayLeads.length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) { setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortKey(key); setSortDir('asc'); }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <span className="text-brand-cream ml-1">↕</span>;
    return <span className="text-brand-copper ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const GROUP_TABS: LeadStatusGroup[] = ['all', 'open', 'paused', 'closed'];
  const GROUP_LABELS: Record<LeadStatusGroup, string> = { all: 'All', open: 'Open', paused: 'Paused', closed: 'Closed' };

  const thCls = 'px-3 py-2 text-left text-[10px] font-medium text-brand-charcoal/50 uppercase tracking-wide whitespace-nowrap select-none';
  const thSortCls = thCls + ' cursor-pointer hover:text-brand-charcoal';

  const colHeaders: { label: string; key?: SortKey }[] = [
    { label: 'Client', key: 'client_name' },
    { label: 'Program', key: 'program_name' },
    { label: 'Location', key: 'city' },
    { label: 'Guests', key: 'guest_count' },
    { label: 'Start Date', key: 'start_date' },
    { label: 'End Date', key: 'end_date' },
    { label: 'Owner' },
    { label: 'Team Support' },
    { label: 'Status', key: 'status' },
    { label: 'GDP Advisor' },
    { label: 'GDP Coordinator' },
    { label: 'Third Party' },
    { label: 'Lead Source' },
    { label: 'Last F/U' },
    { label: 'Due Date' },
    { label: 'Received', key: 'created_at' },
    { label: '' },
  ];

  return (
    <>
      {showAdd && (
        <AddLeadPanel
          teamMembers={teamMembers}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); router.refresh(); }}
        />
      )}

      {/* Group tabs */}
      <div className="border-b border-brand-cream pb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1">
          {GROUP_TABS.map((g) => (
            <button
              key={g}
              onClick={() => setGroupFilter(g)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                groupFilter === g
                  ? 'bg-brand-charcoal text-white'
                  : 'text-brand-charcoal/60 hover:text-brand-charcoal hover:bg-brand-cream/50'
              }`}
            >
              {GROUP_LABELS[g]}
              <span className={`ml-1.5 text-[10px] ${groupFilter === g ? 'opacity-70' : 'text-brand-silver'}`}>
                {counts[g]}
              </span>
            </button>
          ))}

          {newTodayCount > 0 && (
            <button
              onClick={() => setShowNewOnly((v) => !v)}
              className={`ml-2 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                showNewOnly
                  ? 'bg-brand-copper text-white'
                  : 'bg-brand-copper/10 text-brand-copper hover:bg-brand-copper/20'
              }`}
            >
              {newTodayCount} new today
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {teamMembers.length > 0 && (
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="text-xs border border-brand-cream rounded px-2 py-1.5 bg-white text-brand-charcoal/70 focus:outline-none focus:ring-1 focus:ring-brand-copper"
            >
              <option value="">All owners</option>
              {teamMembers.map((m) => <option key={m.id} value={String(m.id)}>{m.first_name} {m.last_name}</option>)}
            </select>
          )}
          {selectedIds.size >= 2 && (
            <button
              onClick={() => setShowMergeDialog(true)}
              className="text-xs font-medium rounded px-3 py-1.5 border border-brand-copper text-brand-copper hover:bg-brand-copper/10 transition-colors"
            >
              Merge {selectedIds.size} selected
            </button>
          )}
          <button
            onClick={() => setShowArchiveOld((v) => !v)}
            className="text-xs font-medium rounded px-3 py-1.5 border border-brand-cream text-brand-charcoal/60 hover:text-brand-charcoal hover:border-brand-charcoal/30 transition-colors"
          >
            Archive Old
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-brand-brown text-white text-xs font-medium rounded px-3 py-1.5 hover:bg-brand-charcoal transition-colors"
          >
            + Add Lead
          </button>
        </div>
      </div>

      {/* Date range filter + Archive Old panel */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 py-2.5 border-b border-brand-cream mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-brand-charcoal/50 uppercase tracking-wide">Received</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-xs border border-brand-cream rounded px-2 py-1 text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
          />
          <span className="text-xs text-brand-charcoal/40">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-xs border border-brand-cream rounded px-2 py-1 text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-[10px] text-brand-copper hover:text-brand-brown transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {showArchiveOld && (
          <div className="ml-auto flex items-center gap-3 pl-4 border-l border-brand-cream">
            <span className="text-xs text-brand-charcoal/60">Archive leads with start date on or before</span>
            <input
              type="date"
              value={archiveCutoff}
              onChange={(e) => setArchiveCutoff(e.target.value)}
              className="text-xs border border-brand-cream rounded px-2 py-1 text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
            />
            <span className="text-xs text-brand-charcoal/50">
              {archiveOldCount} lead{archiveOldCount !== 1 ? 's' : ''} affected
            </span>
            <button
              onClick={handleBulkArchive}
              disabled={archiving || archiveOldCount === 0}
              className="text-xs font-medium bg-brand-charcoal text-white rounded px-3 py-1 hover:bg-brand-brown transition-colors disabled:opacity-40"
            >
              {archiving ? 'Archiving…' : `Archive ${archiveOldCount}`}
            </button>
            <button
              onClick={() => setShowArchiveOld(false)}
              className="text-xs text-brand-charcoal/50 hover:text-brand-charcoal transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {displayLeads.length === 0 ? (
        <div className="text-center py-16 text-brand-silver text-sm">
          {groupFilter === 'all' && !ownerFilter && !dateFrom && !dateTo && !showNewOnly
            ? 'No leads yet. Add one manually or wait for the scanner.'
            : 'No leads match the current filters.'}
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {displayLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                teamMembers={teamMembers}
                isNew={nowMs - new Date(lead.created_at).getTime() < NEW_THRESHOLD_MS}
                onSave={saveCellChange}
              />
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border border-brand-cream overflow-auto max-h-[calc(100vh-300px)]">
            <table className="text-sm">
              <thead className="bg-brand-offwhite border-b border-brand-cream sticky top-0 z-20">
                <tr>
                  <th className={thCls + ' w-8'}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && displayLeads.every((l) => selectedIds.has(l.id))}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(new Set(displayLeads.map((l) => l.id)));
                        else setSelectedIds(new Set());
                      }}
                      className="accent-brand-brown"
                    />
                  </th>
                  {colHeaders.map(({ label, key }) =>
                    key ? (
                      <th
                        key={label}
                        className={thSortCls + (label === 'Client' ? ' sticky left-8 z-30 bg-brand-offwhite' : '')}
                        onClick={() => toggleSort(key)}
                      >
                        {label}{sortIcon(key)}
                      </th>
                    ) : (
                      <th key={label} className={thCls}>{label}</th>
                    )
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-brand-cream/60">
                {displayLeads.map((lead) => (
                  <tr key={lead.id} className="group cursor-pointer hover:bg-brand-offwhite transition-colors" onClick={() => router.push(`/leads/${lead.id}`)}>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(lead.id); else next.delete(lead.id);
                            return next;
                          });
                        }}
                        className="accent-brand-brown"
                      />
                    </td>
                    <LeadRowCells
                      lead={lead}
                      teamMembers={teamMembers}
                      isNew={nowMs - new Date(lead.created_at).getTime() < NEW_THRESHOLD_MS}
                      onSave={saveCellChange}
                      onDelete={handleDeleteLead}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {totalLeads > 0 && (
        <p className="text-[10px] text-brand-silver mt-2 text-right">
          {totalLeads} lead{totalLeads !== 1 ? 's' : ''}
        </p>
      )}

      {showMergeDialog && selectedIds.size >= 2 && (
        <MergeLeadsDialog
          leads={effectiveLeads.filter((l) => selectedIds.has(l.id))}
          teamMembers={teamMembers}
          onClose={() => { setShowMergeDialog(false); setSelectedIds(new Set()); }}
        />
      )}
    </>
  );
}
