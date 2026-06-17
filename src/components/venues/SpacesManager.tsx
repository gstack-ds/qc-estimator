'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { DbVenueSpace } from '@/lib/supabase/queries';
import { createVenueSpace, updateVenueSpace, deleteVenueSpace } from '@/app/(programs)/venues/actions';
import { PRIVACY_TAG_OPTIONS, type SpacePrivacyTag } from '@/lib/vendors/constants';

interface Props {
  venueId: string;
  initialSpaces: DbVenueSpace[];
}

interface SpaceForm {
  name: string;
  capacity_seated: string;
  capacity_standing: string;
  fb_minimum: string;
  room_fee: string;
  privacy_tag: SpacePrivacyTag | '';
  is_suggested: boolean;
  notes: string;
}

const emptyForm: SpaceForm = {
  name: '', capacity_seated: '', capacity_standing: '',
  fb_minimum: '', room_fee: '',
  privacy_tag: '',
  is_suggested: false,
  notes: '',
};

function spaceToForm(s: DbVenueSpace): SpaceForm {
  return {
    name: s.name,
    capacity_seated: s.capacity_seated?.toString() ?? '',
    capacity_standing: s.capacity_standing?.toString() ?? '',
    fb_minimum: s.fb_minimum.toString(),
    room_fee: s.room_fee.toString(),
    privacy_tag: (s.privacy_tag as SpacePrivacyTag) ?? '',
    is_suggested: s.is_suggested,
    notes: s.notes ?? '',
  };
}

function formToPayload(f: SpaceForm) {
  return {
    name: f.name.trim(),
    capacity_seated: f.capacity_seated ? parseInt(f.capacity_seated) : null,
    capacity_standing: f.capacity_standing ? parseInt(f.capacity_standing) : null,
    fb_minimum: parseFloat(f.fb_minimum) || 0,
    room_fee: parseFloat(f.room_fee) || 0,
    privacy_tag: f.privacy_tag || null,
    is_suggested: f.is_suggested,
    notes: f.notes.trim() || null,
  };
}

function SpaceFormFields({ form, onChange }: { form: SpaceForm; onChange: (f: SpaceForm) => void }) {
  const set = (k: keyof SpaceForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-brand-silver mb-1">Space / Room Name *</label>
          <input value={form.name} onChange={set('name')} className="w-full border border-brand-silver/30 rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown text-sm" placeholder="e.g. Grand Ballroom" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-brand-silver mb-1">Seated Cap.</label>
            <input type="number" value={form.capacity_seated} onChange={set('capacity_seated')} className="w-full border border-brand-silver/30 rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown text-sm" placeholder="200" />
          </div>
          <div>
            <label className="block text-xs text-brand-silver mb-1">Standing Cap.</label>
            <input type="number" value={form.capacity_standing} onChange={set('capacity_standing')} className="w-full border border-brand-silver/30 rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown text-sm" placeholder="350" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-brand-silver mb-1">Privacy</label>
          <select value={form.privacy_tag} onChange={set('privacy_tag')} className="w-full border border-brand-silver/30 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown text-sm">
            <option value="">—</option>
            {PRIVACY_TAG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-silver mb-1">F&B Minimum</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-brand-silver">$</span>
            <input type="number" value={form.fb_minimum} onChange={set('fb_minimum')} className="w-full border border-brand-silver/30 rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown text-sm pl-5" placeholder="0" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-brand-silver mb-1">Room Fee</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-brand-silver">$</span>
            <input type="number" value={form.room_fee} onChange={set('room_fee')} className="w-full border border-brand-silver/30 rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown text-sm pl-5" placeholder="0" />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs text-brand-silver mb-1">Notes</label>
        <textarea value={form.notes} onChange={set('notes')} rows={2} className="w-full border border-brand-silver/30 rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown text-sm resize-none" placeholder="Any notes about this space…" />
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.is_suggested}
          onChange={(e) => onChange({ ...form, is_suggested: e.target.checked })}
          className="accent-brand-copper cursor-pointer"
        />
        <span className="text-sm text-brand-charcoal">Suggested space</span>
        <span className="text-xs text-brand-silver">— highlighted first on the venue card</span>
      </label>
    </div>
  );
}

export default function SpacesManager({ venueId, initialSpaces }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [spaces, setSpaces] = useState(initialSpaces);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SpaceForm>(emptyForm);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<SpaceForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  function handleEditStart(space: DbVenueSpace) {
    setEditingId(space.id);
    setEditForm(spaceToForm(space));
  }

  function handleEditSave(spaceId: string) {
    if (!editForm.name.trim()) return;
    startTransition(async () => {
      const result = await updateVenueSpace(spaceId, venueId, formToPayload(editForm));
      if (result.error) { setError(result.error); return; }
      setSpaces((prev) => prev.map((s) => s.id === spaceId ? { ...s, ...formToPayload(editForm), name: editForm.name.trim() } as DbVenueSpace : s));
      setEditingId(null);
      router.refresh();
    });
  }

  function handleDelete(spaceId: string, spaceName: string) {
    if (!confirm(`Delete "${spaceName}"?`)) return;
    startTransition(async () => {
      await deleteVenueSpace(spaceId, venueId);
      setSpaces((prev) => prev.filter((s) => s.id !== spaceId));
    });
  }

  function handleAdd() {
    if (!addForm.name.trim()) return;
    startTransition(async () => {
      const result = await createVenueSpace(venueId, formToPayload(addForm));
      if ('error' in result) { setError(result.error); return; }
      setShowAdd(false);
      setAddForm(emptyForm);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium text-brand-charcoal">Spaces & Rooms</h2>
        <button
          onClick={() => { setShowAdd(true); setAddForm(emptyForm); }}
          className="text-sm text-brand-brown hover:underline"
        >
          + Add Space
        </button>
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

      {showAdd && (
        <div className="bg-brand-cream/30 border border-brand-silver/20 rounded-lg p-4 mb-4">
          <SpaceFormFields form={addForm} onChange={setAddForm} />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAdd}
              disabled={isPending || !addForm.name.trim()}
              className="bg-brand-brown text-white text-sm px-4 py-1.5 rounded hover:bg-brand-brown/90 disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save Space'}
            </button>
            <button onClick={() => setShowAdd(false)} className="text-sm text-brand-silver hover:text-brand-charcoal px-3 py-1.5">
              Cancel
            </button>
          </div>
        </div>
      )}

      {spaces.length === 0 && !showAdd ? (
        <div className="text-sm text-brand-silver py-6 text-center border border-dashed border-brand-silver/20 rounded-lg">
          No spaces yet. Add one to enable auto-fill in estimate builders.
        </div>
      ) : (
        <div className="space-y-3">
          {spaces.map((space) => (
            <div key={space.id} className="border border-brand-silver/20 rounded-lg p-4 bg-white">
              {editingId === space.id ? (
                <>
                  <SpaceFormFields form={editForm} onChange={setEditForm} />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleEditSave(space.id)}
                      disabled={isPending || !editForm.name.trim()}
                      className="bg-brand-brown text-white text-sm px-4 py-1.5 rounded hover:bg-brand-brown/90 disabled:opacity-50"
                    >
                      {isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-sm text-brand-silver hover:text-brand-charcoal px-3 py-1.5">
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-brand-charcoal">{space.name}</span>
                      {space.is_suggested && (
                        <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-brand-copper/40 text-brand-copper bg-brand-copper/5 font-medium">
                          Suggested
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-brand-silver mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                      {space.capacity_seated !== null && <span>Seated: {space.capacity_seated}</span>}
                      {space.capacity_standing !== null && <span>Standing: {space.capacity_standing}</span>}
                      {space.fb_minimum > 0 && <span>F&B Min: ${space.fb_minimum.toLocaleString()}</span>}
                      {space.room_fee > 0 && <span>Room Fee: ${space.room_fee.toLocaleString()}</span>}
                      {space.privacy_tag && <span>{PRIVACY_TAG_OPTIONS.find((o) => o.value === space.privacy_tag)?.label ?? space.privacy_tag}</span>}
                    </div>
                    {space.notes && <div className="text-xs text-brand-silver mt-1 italic">{space.notes}</div>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => handleEditStart(space)} className="text-xs text-brand-silver hover:text-brand-charcoal px-2 py-1 rounded hover:bg-brand-cream/40">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(space.id, space.name)} className="text-xs text-brand-silver hover:text-red-500 px-2 py-1 rounded hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
