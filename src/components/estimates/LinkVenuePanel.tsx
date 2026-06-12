'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { DbVenue, DbVenueSpace } from '@/lib/supabase/queries';
import { linkVenueToEstimate } from '@/app/(programs)/venues/actions';

interface Props {
  estimateId: string;
  programId: string;
  venue: DbVenue;
  currentSpaceId: string | null;
  venueSpaces: DbVenueSpace[];
  onSpaceChange: (spaceId: string | null, autoFill: {
    roomSpace?: string;
    fbMinimum?: number;
    serviceChargeOverride?: number | null;
    gratuityOverride?: number | null;
    adminFeeOverride?: number | null;
  }) => void;
  onChangeVenue: () => void;
}

const PRIVACY_COLORS: Record<string, string> = {
  private:    'bg-green-100 text-green-700',
  semi:       'bg-yellow-100 text-yellow-700',
  public:     'bg-blue-100 text-blue-700',
  restaurant: 'bg-orange-100 text-orange-700',
};

function fmt$(n: number | null | undefined) {
  if (n == null) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function LinkVenuePanel({
  estimateId, programId, venue, currentSpaceId, venueSpaces,
  onSpaceChange, onChangeVenue,
}: Props) {
  const [, startTransition] = useTransition();
  const [spaceId, setSpaceId] = useState(currentSpaceId ?? '');
  const spaces = venueSpaces.filter(s => s.venue_id === venue.id);

  function handleSpaceChange(newSpaceId: string) {
    setSpaceId(newSpaceId);
    const space = spaces.find(s => s.id === newSpaceId);
    if (newSpaceId && space) {
      onSpaceChange(newSpaceId, {
        roomSpace: space.name,
        fbMinimum: space.fb_minimum,
        serviceChargeOverride: venue.service_charge_default,
        gratuityOverride: venue.gratuity_default,
        adminFeeOverride: venue.admin_fee_default,
      });
      startTransition(async () => {
        await linkVenueToEstimate(estimateId, programId, venue.id, newSpaceId);
      });
    } else {
      onSpaceChange(null, {});
      startTransition(async () => {
        await linkVenueToEstimate(estimateId, programId, venue.id, null);
      });
    }
  }

  const selectedSpace = spaces.find(s => s.id === spaceId) ?? null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Venue name chip */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium text-brand-charcoal/50 uppercase tracking-wide flex-shrink-0">Venue</span>
          <Link
            href={`/venues/${venue.id}`}
            className="text-sm font-semibold text-brand-charcoal hover:text-brand-brown transition-colors truncate max-w-[200px]"
            title={venue.name}
          >
            {venue.name}
          </Link>
          {venue.city && <span className="text-xs text-brand-silver flex-shrink-0">· {venue.city}</span>}
        </div>

        {/* Space selector */}
        {spaces.length > 0 && (
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-brand-silver flex-shrink-0">Space:</label>
            <select
              value={spaceId}
              onChange={e => handleSpaceChange(e.target.value)}
              className="border border-brand-silver/30 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown max-w-[180px]"
            >
              <option value="">— None —</option>
              {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {/* Change venue link */}
        <button
          type="button"
          onClick={onChangeVenue}
          className="text-xs text-brand-silver hover:text-brand-brown transition-colors ml-auto flex-shrink-0"
        >
          Change venue
        </button>
      </div>

      {/* Space info row */}
      {selectedSpace && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-1 text-xs text-brand-silver">
          {(selectedSpace.capacity_seated != null || selectedSpace.capacity_standing != null) && (
            <span>
              Cap:{' '}
              {selectedSpace.capacity_seated != null && `${selectedSpace.capacity_seated} seated`}
              {selectedSpace.capacity_seated != null && selectedSpace.capacity_standing != null && ' · '}
              {selectedSpace.capacity_standing != null && `${selectedSpace.capacity_standing} standing`}
            </span>
          )}
          {selectedSpace.fb_minimum != null && (
            <span>F&amp;B min: {fmt$(selectedSpace.fb_minimum)}</span>
          )}
          {selectedSpace.privacy_tag && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${PRIVACY_COLORS[selectedSpace.privacy_tag] ?? 'bg-gray-100 text-gray-600'}`}>
              {selectedSpace.privacy_tag.charAt(0).toUpperCase() + selectedSpace.privacy_tag.slice(1)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
