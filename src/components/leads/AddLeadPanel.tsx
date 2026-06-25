'use client';

import { useState } from 'react';
import type { DbTeamMember } from '@/lib/supabase/queries';
import { createLead, type LeadInput } from '@/app/(programs)/leads/actions';
import FlexibleDateInput from './FlexibleDateInput';

const EMPTY: LeadInput = {
  client_name: '', end_company: '', contact_name: '', contact_email: '',
  program_name: '', program_type: '', start_date: '', end_date: '',
  guest_count: null, city: '', state: '', region: '', hotel: '', venue: '',
  lead_source: '', source_commission: null, third_party_commission: null,
  assigned_to: null, special_instructions: '', status: 'new_lead',
};

export default function AddLeadPanel({ teamMembers, onClose, onCreated }: {
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
              <FlexibleDateInput value={form.start_date || null} onChange={(v) => set('start_date', v ?? '')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <FlexibleDateInput value={form.end_date || null} onChange={(v) => set('end_date', v ?? '')} className={inputCls} />
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
