'use client';

import { useState, useTransition, useEffect } from 'react';
import type { DbVenue, DbVenueSpace } from '@/lib/supabase/queries';
import { linkVenueToEstimate } from '@/app/(programs)/venues/actions';

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
  onLinkChange?: (venueId: string | null, spaceId: string | null) => void;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  const [, m, ] = dateStr.slice(0, 10).split('-').map(Number);
  const y = dateStr.slice(0, 4);
  return `${MONTHS[m - 1]} ${y}`;
}

export default function LinkVenuePanel({
  estimateId, programId, currentVenueId, currentVenueSpaceId,
  venues, venueSpaces: initialSpaces,
  onAutoFill, onLinkChange,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const [selectedVenueId, setSelectedVenueId] = useState<string>(currentVenueId ?? '');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(currentVenueSpaceId ?? '');
  const [spaces, setSpaces] = useState<DbVenueSpace[]>(initialSpaces);

  // Sync when parent updates venue link (e.g. after auto-link)
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

  async function handleVenueChange(venueId: string) {
    setSelectedVenueId(venueId);
    setSelectedSpaceId('');
    onLinkChange?.(venueId || null, null);
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
      onLinkChange?.(selectedVenueId || null, spaceId);
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
      onLinkChange?.(selectedVenueId || null, null);
      startTransition(async () => {
        await linkVenueToEstimate(estimateId, programId, selectedVenueId, null);
      });
    }
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
    </div>
  );
}
