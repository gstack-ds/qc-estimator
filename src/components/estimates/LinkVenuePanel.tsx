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
        serviceChargeOverride: space.service_charge_default,
        gratuityOverride: space.gratuity_default,
        adminFeeOverride: space.admin_fee_default,
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

  return (
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
  );
}
