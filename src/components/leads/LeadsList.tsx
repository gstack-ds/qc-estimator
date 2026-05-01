'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { DbLead, DbTeamMember, LeadStatus } from '@/lib/supabase/queries';
import LeadStatusBadge from './LeadStatusBadge';
import { createLead, updateLead, archiveLead, deleteLead, type LeadInput } from '@/app/(programs)/leads/actions';

// ─── Helpers ──────────────────────────────────────────────

const STATUS_LABELS: Record<LeadStatus, string> = {
  new_lead: 'New Lead',
  proposal: 'Proposal',
  under_contract: 'Under Contract',
  archived: 'Archived',
};

const STATUSES: LeadStatus[] = ['new_lead', 'proposal', 'under_contract', 'archived'];

function fmt(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${y}`;
}

function isToday(iso: string): boolean {
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

type SortKey = 'client_name' | 'program_name' | 'region' | 'guest_count' | 'start_date' | 'assigned_to' | 'status' | 'created_at';

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

// ─── Leads List ────────────────────────────────────────────

interface Props {
  leads: DbLead[];
  counts: Record<LeadStatus | 'all', number>;
  teamMembers: DbTeamMember[];
}

export default function LeadsList({ leads, counts, teamMembers }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showAdd, setShowAdd] = useState(false);

  // Local overrides for cells edited inline — avoids full page refresh on each change
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

  async function saveCellChange(leadId: string, field: 'status' | 'assigned_to' | 'start_date', value: string | number | null) {
    setLocalEdits((prev) => {
      const next = new Map(prev);
      next.set(leadId, { ...(next.get(leadId) ?? {}), [field]: value });
      return next;
    });
    if (field === 'status' && value === 'archived') {
      await archiveLead(leadId);
    } else {
      await updateLead(leadId, { [field]: value } as LeadInput);
    }
  }

  const filtered = useMemo(() => {
    let rows = effectiveLeads;
    if (statusFilter !== 'all') rows = rows.filter((l) => l.status === statusFilter);
    if (ownerFilter !== '') rows = rows.filter((l) => l.assigned_to != null && String(l.assigned_to) === ownerFilter);
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [effectiveLeads, statusFilter, ownerFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) { setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortKey(key); setSortDir('asc'); }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <span className="text-brand-cream ml-1">↕</span>;
    return <span className="text-brand-copper ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const memberName = (id: number | null) => {
    if (!id) return null;
    const m = teamMembers.find((t) => t.id === id);
    return m ? `${m.first_name} ${m.last_name}` : null;
  };

  const STATUS_TABS: (LeadStatus | 'all')[] = ['all', 'new_lead', 'proposal', 'under_contract', 'archived'];
  const TAB_LABELS: Record<LeadStatus | 'all', string> = { all: 'All', ...STATUS_LABELS };

  const thCls = 'px-3 py-2 text-left text-[10px] font-medium text-brand-charcoal/50 uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-brand-charcoal select-none';
  const cellSelectCls = 'text-xs border border-brand-cream rounded px-1.5 py-1 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper';

  return (
    <>
      {showAdd && (
        <AddLeadPanel
          teamMembers={teamMembers}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); router.refresh(); }}
        />
      )}

      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-brand-cream pb-3">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-brand-charcoal text-white'
                : 'text-brand-charcoal/60 hover:text-brand-charcoal hover:bg-brand-cream/50'
            }`}
          >
            {TAB_LABELS[s]}
            <span className={`ml-1.5 text-[10px] ${statusFilter === s ? 'opacity-70' : 'text-brand-silver'}`}>
              {counts[s]}
            </span>
          </button>
        ))}

        <div className="ml-auto flex items-center gap-3">
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
          <button
            onClick={() => setShowAdd(true)}
            className="bg-brand-brown text-white text-xs font-medium rounded px-3 py-1.5 hover:bg-brand-charcoal transition-colors"
          >
            + Add Lead
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-brand-silver text-sm">
          {statusFilter === 'all' && !ownerFilter
            ? 'No leads yet. Add one manually or wait for the scanner.'
            : 'No leads match the current filters.'}
        </div>
      ) : (
        <div className="rounded-lg border border-brand-cream overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brand-offwhite border-b border-brand-cream">
              <tr>
                <th className={thCls} onClick={() => toggleSort('client_name')}>Client{sortIcon('client_name')}</th>
                <th className={thCls} onClick={() => toggleSort('program_name')}>Program{sortIcon('program_name')}</th>
                <th className={thCls} onClick={() => toggleSort('region')}>Region{sortIcon('region')}</th>
                <th className={thCls + ' text-right'} onClick={() => toggleSort('guest_count')}>Guests{sortIcon('guest_count')}</th>
                <th className={thCls} onClick={() => toggleSort('start_date')}>Start Date{sortIcon('start_date')}</th>
                <th className={thCls} onClick={() => toggleSort('assigned_to')}>Owner{sortIcon('assigned_to')}</th>
                <th className={thCls} onClick={() => toggleSort('status')}>Status{sortIcon('status')}</th>
                <th className={thCls} onClick={() => toggleSort('created_at')}>Received{sortIcon('created_at')}</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream/60">
              {filtered.map((lead) => {
                const today = isToday(lead.created_at);
                return (
                  <tr
                    key={lead.id}
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    className="cursor-pointer hover:bg-brand-offwhite transition-colors"
                  >
                    <td className="px-3 py-2.5 font-medium text-brand-charcoal">
                      {lead.client_name ?? <span className="text-brand-silver">—</span>}
                      {today && (
                        <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle" title="Received today" />
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-brand-charcoal/80">
                      {lead.program_name ?? <span className="text-brand-silver">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-brand-charcoal/70">{lead.region ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-brand-charcoal/70">
                      {lead.guest_count ?? '—'}
                    </td>

                    {/* Start date — click to edit */}
                    <td className="px-3 py-2.5 text-brand-charcoal/70" onClick={(e) => e.stopPropagation()}>
                      <DateCell
                        leadId={lead.id}
                        value={lead.start_date}
                        onSave={(id, v) => saveCellChange(id, 'start_date', v)}
                      />
                    </td>

                    {/* Owner — inline select */}
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={lead.assigned_to != null ? String(lead.assigned_to) : ''}
                        onChange={(e) => saveCellChange(lead.id, 'assigned_to', e.target.value ? Number(e.target.value) : null)}
                        className={cellSelectCls}
                      >
                        <option value="">— Unassigned —</option>
                        {teamMembers.map((m) => <option key={m.id} value={String(m.id)}>{m.first_name} {m.last_name}</option>)}
                      </select>
                    </td>

                    {/* Status — inline select */}
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={lead.status}
                        onChange={(e) => saveCellChange(lead.id, 'status', e.target.value)}
                        className={cellSelectCls}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                    </td>

                    <td className="px-3 py-2.5 text-brand-silver whitespace-nowrap text-xs">{fmt(lead.created_at.slice(0, 10))}</td>
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleDeleteLead(e, lead.id)}
                        className="text-brand-cream hover:text-red-500 transition-colors p-0.5"
                        title="Delete lead"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
