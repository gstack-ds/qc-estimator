'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { DbVenue, DbVenueSpace } from '@/lib/supabase/queries';
import { linkVenueToEstimate, saveEstimateAsVenue } from '@/app/(programs)/venues/actions';

interface Props {
  estimateId: string;
  programId: string;
  currentVenueId: string | null;
  currentVenueSpaceId: string | null;
  venues: DbVenue[];
  venueSpaces: DbVenueSpace[];
  // fields to pre-fill "Save to Venues" form
  estimateName: string;
  roomSpace: string;
  fbMinimum: number;
  serviceChargeOverride: number | null;
  gratuityOverride: number | null;
  adminFeeOverride: number | null;
  onAutoFill: (fields: {
    roomSpace?: string;
    fbMinimum?: number;
    serviceChargeOverride?: number | null;
    gratuityOverride?: number | null;
    adminFeeOverride?: number | null;
  }) => void;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function LinkVenuePanel({
  estimateId, programId, currentVenueId, currentVenueSpaceId,
  venues, venueSpaces: initialSpaces,
  estimateName, roomSpace, fbMinimum, serviceChargeOverride, gratuityOverride, adminFeeOverride,
  onAutoFill,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedVenueId, setSelectedVenueId] = useState<string>(currentVenueId ?? '');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(currentVenueSpaceId ?? '');
  const [spaces, setSpaces] = useState<DbVenueSpace[]>(initialSpaces);
  const [showSaveForm, setShowSaveForm] = useState(false);

  // Save-to-venues form state
  const [svName, setSvName] = useState(estimateName);
  const [svCity, setSvCity] = useState('');
  const [svState, setSvState] = useState('');
  const [svSpaceName, setSvSpaceName] = useState(roomSpace || estimateName);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savePending, setSavePending] = useState(false);

  const selectedVenue = venues.find((v) => v.id === selectedVenueId) ?? null;
  const filteredSpaces = spaces.filter((s) => s.venue_id === selectedVenueId);
  const selectedSpace = filteredSpaces.find((s) => s.id === selectedSpaceId) ?? null;

  useEffect(() => {
    setSpaces(initialSpaces);
  }, [initialSpaces]);

  async function handleVenueChange(venueId: string) {
    setSelectedVenueId(venueId);
    setSelectedSpaceId('');
    if (!venueId) {
      startTransition(async () => {
        await linkVenueToEstimate(estimateId, programId, null, null);
      });
      return;
    }
    const venue = venues.find((v) => v.id === venueId);
    const hasSpaces = spaces.some((s) => s.venue_id === venueId);
    if (!hasSpaces && venue) {
      onAutoFill({ roomSpace: venue.name });
      startTransition(async () => {
        await linkVenueToEstimate(estimateId, programId, venueId, null);
      });
    }
  }

  async function handleSpaceSelect(spaceId: string) {
    setSelectedSpaceId(spaceId);
    const space = spaces.find((s) => s.id === spaceId);
    if (spaceId && space) {
      // Auto-fill fields
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
      startTransition(async () => {
        await linkVenueToEstimate(estimateId, programId, selectedVenueId, null);
      });
    }
  }

  async function handleSaveToVenues(e: React.FormEvent) {
    e.preventDefault();
    if (!svName.trim() || !svSpaceName.trim()) return;
    setSavePending(true);
    setSaveError(null);
    const result = await saveEstimateAsVenue(
      estimateId,
      programId,
      { name: svName.trim(), city: svCity.trim() || null, state: svState || null },
      {
        name: svSpaceName.trim(),
        fb_minimum: fbMinimum,
        service_charge_default: serviceChargeOverride,
        gratuity_default: gratuityOverride,
        admin_fee_default: adminFeeOverride,
      },
    );
    setSavePending(false);
    if ('error' in result) {
      setSaveError(result.error);
      return;
    }
    setSelectedVenueId(result.venueId);
    setSelectedSpaceId(result.spaceId);
    setShowSaveForm(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Venue dropdown */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-brand-silver whitespace-nowrap">Linked Venue:</label>
        <select
          value={selectedVenueId}
          onChange={(e) => handleVenueChange(e.target.value)}
          disabled={isPending}
          className="border border-brand-silver/30 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown min-w-[160px] max-w-[220px]"
        >
          <option value="">— None —</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
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
        <span className="text-xs text-brand-silver italic">No spaces added — add them in Venues</span>
      )}

      {/* Last priced badge */}
      {selectedVenue?.last_used_date && (
        <span className="text-xs text-brand-silver bg-brand-cream/50 border border-brand-silver/20 rounded px-2 py-0.5">
          Last priced: {formatDate(selectedVenue.last_used_date)}
        </span>
      )}

      {/* Save to Venues button */}
      {!selectedVenueId && (
        <button
          onClick={() => { setSvName(estimateName); setSvSpaceName(roomSpace || estimateName); setShowSaveForm(!showSaveForm); }}
          className="text-xs text-brand-silver hover:text-brand-brown border border-brand-silver/30 rounded px-2 py-1 hover:border-brand-brown transition-colors whitespace-nowrap"
        >
          Save to Venues
        </button>
      )}

      {/* Save to Venues inline form */}
      {showSaveForm && (
        <form onSubmit={handleSaveToVenues} className="w-full mt-2 bg-brand-cream/30 border border-brand-silver/20 rounded-lg p-3 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-brand-silver mb-1">Venue Name *</label>
            <input
              autoFocus
              value={svName}
              onChange={(e) => setSvName(e.target.value)}
              className="border border-brand-silver/30 rounded px-2 py-1 text-sm w-44 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-silver mb-1">Space / Room *</label>
            <input
              value={svSpaceName}
              onChange={(e) => setSvSpaceName(e.target.value)}
              className="border border-brand-silver/30 rounded px-2 py-1 text-sm w-40 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-silver mb-1">City</label>
            <input
              value={svCity}
              onChange={(e) => setSvCity(e.target.value)}
              className="border border-brand-silver/30 rounded px-2 py-1 text-sm w-28 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
              placeholder="Charlotte"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-silver mb-1">State</label>
            <select
              value={svState}
              onChange={(e) => setSvState(e.target.value)}
              className="border border-brand-silver/30 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
            >
              <option value="">—</option>
              {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
                'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
                'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={savePending || !svName.trim() || !svSpaceName.trim()}
              className="bg-brand-brown text-white text-sm px-3 py-1 rounded hover:bg-brand-brown/90 disabled:opacity-50"
            >
              {savePending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setShowSaveForm(false)} className="text-sm text-brand-silver hover:text-brand-charcoal px-2 py-1">
              Cancel
            </button>
          </div>
          {saveError && <div className="w-full text-xs text-red-600">{saveError}</div>}
        </form>
      )}
    </div>
  );
}
