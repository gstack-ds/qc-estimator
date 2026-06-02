'use client';

import { useState, useTransition, useEffect } from 'react';
import type { DbVenue, DbVenueSpace } from '@/lib/supabase/queries';
import { linkVenueToEstimate, createVenue } from '@/app/(programs)/venues/actions';

interface Props {
  estimateId: string;
  programId: string;
  currentVenueId: string | null;
  currentVenueSpaceId: string | null;
  venues: DbVenue[];
  venueSpaces: DbVenueSpace[];
  onAutoFill: (fields: {
    roomSpace?: string;
    fbMinimum?: number;
    serviceChargeOverride?: number | null;
    gratuityOverride?: number | null;
    adminFeeOverride?: number | null;
  }) => void;
  // venueCity is passed as the 3rd arg so callers can do location auto-suggest
  // even for venues just created (not yet in the venues prop array)
  onLinkChange?: (venueId: string | null, spaceId: string | null, venueCity?: string | null) => void;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  const [, m, ] = dateStr.slice(0, 10).split('-').map(Number);
  const y = dateStr.slice(0, 4);
  return `${MONTHS[m - 1]} ${y}`;
}

const ADD_NEW_SENTINEL = '__add_new__';

export default function LinkVenuePanel({
  estimateId, programId, currentVenueId, currentVenueSpaceId,
  venues, venueSpaces: initialSpaces,
  onAutoFill, onLinkChange,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const [selectedVenueId, setSelectedVenueId] = useState<string>(currentVenueId ?? '');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(currentVenueSpaceId ?? '');
  const [spaces, setSpaces] = useState<DbVenueSpace[]>(initialSpaces);

  // Add new venue form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isNameWarning, setIsNameWarning] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [duplicateName, setDuplicateName] = useState<string | null>(null);

  useEffect(() => {
    if (currentVenueId && currentVenueId !== selectedVenueId) {
      setSelectedVenueId(currentVenueId);
    }
  }, [currentVenueId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentVenueSpaceId && currentVenueSpaceId !== selectedSpaceId) {
      setSelectedSpaceId(currentVenueSpaceId);
    }
  }, [currentVenueSpaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSpaces(initialSpaces);
  }, [initialSpaces]);

  const selectedVenue = venues.find((v) => v.id === selectedVenueId) ?? null;
  const filteredSpaces = spaces.filter((s) => s.venue_id === selectedVenueId);

  async function handleVenueChange(value: string) {
    if (value === ADD_NEW_SENTINEL) {
      setShowAddForm(true);
      return;
    }

    setSelectedVenueId(value);
    setSelectedSpaceId('');
    const venue = venues.find((v) => v.id === value) ?? null;
    onLinkChange?.(value || null, null, venue?.city ?? null);

    if (!value) {
      startTransition(async () => {
        await linkVenueToEstimate(estimateId, programId, null, null);
      });
      return;
    }

    const hasSpaces = spaces.some((s) => s.venue_id === value);
    if (!hasSpaces && venue) {
      onAutoFill({ roomSpace: venue.name });
      startTransition(async () => {
        await linkVenueToEstimate(estimateId, programId, value, null);
      });
    }
  }

  async function handleSpaceSelect(spaceId: string) {
    setSelectedSpaceId(spaceId);
    const space = spaces.find((s) => s.id === spaceId);
    if (spaceId && space) {
      onLinkChange?.(selectedVenueId || null, spaceId, selectedVenue?.city ?? null);
      onAutoFill({
        roomSpace: space.name,
        fbMinimum: space.fb_minimum,
        serviceChargeOverride: space.service_charge_default,
        gratuityOverride: space.gratuity_default,
        adminFeeOverride: space.admin_fee_default,
      });
      startTransition(async () => {
        await linkVenueToEstimate(estimateId, programId, selectedVenueId, spaceId);
      });
    } else if (selectedVenueId) {
      onLinkChange?.(selectedVenueId || null, null, selectedVenue?.city ?? null);
      startTransition(async () => {
        await linkVenueToEstimate(estimateId, programId, selectedVenueId, null);
      });
    }
  }

  async function submitVenue(skipNameCheck = false) {
    if (!newName.trim() || !newAddress.trim()) return;
    setAddError(null);
    setIsNameWarning(false);
    setDuplicateId(null);
    setDuplicateName(null);

    const result = await createVenue({
      name: newName.trim(),
      address: newAddress.trim(),
      city: newCity.trim() || null,
      state: newState.trim() || null,
      skipNameCheck,
    });

    if ('error' in result) {
      setAddError(result.error);
      if (result.existingId) {
        setDuplicateId(result.existingId);
        setDuplicateName(result.existingName ?? null);
      }
      if (result.isWarning) setIsNameWarning(true);
      return;
    }

    // Link the new venue to this estimate
    startTransition(async () => {
      await linkVenueToEstimate(estimateId, programId, result.id, null);
    });
    setSelectedVenueId(result.id);
    onLinkChange?.(result.id, null, newCity.trim() || null);
    onAutoFill({ roomSpace: newName.trim() });
    setShowAddForm(false);
    setNewName('');
    setNewAddress('');
    setNewCity('');
    setNewState('');
  }

  async function handleAddVenue(e: React.FormEvent) {
    e.preventDefault();
    await submitVenue(false);
  }

  function handleUseDuplicate() {
    if (!duplicateId) return;
    handleVenueChange(duplicateId);
    setShowAddForm(false);
    setAddError(null);
    setDuplicateId(null);
    setNewName('');
    setNewAddress('');
    setNewCity('');
    setNewState('');
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Venue dropdown — "Add new venue" is last option */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-brand-charcoal whitespace-nowrap">
            Venue <span className="text-red-400">*</span>
          </label>
          <select
            value={selectedVenueId}
            onChange={(e) => handleVenueChange(e.target.value)}
            disabled={isPending || showAddForm}
            className={`border rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown min-w-[180px] max-w-[280px] ${
              !selectedVenueId ? 'border-amber-400 text-brand-silver' : 'border-brand-silver/30 text-brand-charcoal'
            }`}
          >
            <option value="">— Select venue —</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}{v.last_used_date ? ` (last: ${formatDate(v.last_used_date)})` : ''}
              </option>
            ))}
            <option value={ADD_NEW_SENTINEL}>+ Add new venue…</option>
          </select>
        </div>

        {/* Space dropdown — only when venue selected and has spaces */}
        {selectedVenueId && filteredSpaces.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-brand-silver whitespace-nowrap">Space:</label>
            <select
              value={selectedSpaceId}
              onChange={(e) => handleSpaceSelect(e.target.value)}
              disabled={isPending}
              className="border border-brand-silver/30 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown min-w-[140px] max-w-[200px]"
            >
              <option value="">— Select —</option>
              {filteredSpaces.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
        {selectedVenueId && filteredSpaces.length === 0 && (
          <span className="text-xs text-brand-silver italic">No spaces — add in Venues</span>
        )}
      </div>

      {/* Inline add-venue form — shown when "Add new venue…" selected */}
      {showAddForm && (
        <form
          onSubmit={handleAddVenue}
          className="bg-brand-cream/30 border border-amber-200 rounded-lg p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-brand-charcoal">Add new venue</p>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setAddError(null); }}
              className="text-xs text-brand-silver hover:text-brand-charcoal"
            >
              Cancel
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div>
              <label className="block text-[10px] text-brand-silver mb-0.5">Name *</label>
              <input
                autoFocus
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="border border-brand-silver/30 rounded px-2 py-1 text-xs w-44 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
                placeholder="e.g. The Ballantyne"
              />
            </div>
            <div>
              <label className="block text-[10px] text-brand-silver mb-0.5">Address *</label>
              <input
                required
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="border border-brand-silver/30 rounded px-2 py-1 text-xs w-52 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
                placeholder="123 Main St"
              />
            </div>
            <div>
              <label className="block text-[10px] text-brand-silver mb-0.5">City</label>
              <input
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                className="border border-brand-silver/30 rounded px-2 py-1 text-xs w-28 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
                placeholder="Charlotte"
              />
            </div>
            <div>
              <label className="block text-[10px] text-brand-silver mb-0.5">State</label>
              <input
                value={newState}
                onChange={(e) => setNewState(e.target.value)}
                className="border border-brand-silver/30 rounded px-2 py-1 text-xs w-16 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
                placeholder="NC"
                maxLength={2}
              />
            </div>
          </div>

          {addError && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 flex flex-wrap items-center gap-2">
              <span>{addError}</span>
              <div className="flex gap-2 flex-wrap">
                {duplicateId && (
                  <button type="button" onClick={handleUseDuplicate} className="underline font-medium hover:text-amber-900">
                    Use {duplicateName ?? 'that venue'}
                  </button>
                )}
                {isNameWarning && (
                  <button type="button" onClick={() => submitVenue(true)} className="underline font-medium hover:text-amber-900">
                    Proceed anyway
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || !newName.trim() || !newAddress.trim()}
            className="text-xs bg-brand-brown text-white rounded px-3 py-1 hover:bg-brand-brown/90 disabled:opacity-50 transition-colors"
          >
            Add venue
          </button>
        </form>
      )}
    </div>
  );
}
