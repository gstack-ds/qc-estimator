'use client';

import { useState, useMemo, useTransition } from 'react';
import type { DbVenue, DbVenueSpace } from '@/lib/supabase/queries';
import { linkVenueToEstimate, createVenue } from '@/app/(programs)/venues/actions';

interface Props {
  estimateId: string;
  programId: string;
  venues: DbVenue[];
  venueSpaces: DbVenueSpace[];
  onSelect: (venueId: string, spaceId: string | null, venueCity: string | null, venueData: DbVenue) => void;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d: string | null) {
  if (!d) return null;
  const [, m] = d.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d.slice(0, 4)}`;
}

export default function VenuePicker({ estimateId, programId, venues, venueSpaces, onSelect }: Props) {
  const [, startTransition] = useTransition();
  const [market, setMarket] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [cName, setCName] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cCity, setCCity] = useState('');
  const [cState, setCState] = useState('');
  const [cError, setCError] = useState<string | null>(null);
  const [cDupId, setCDupId] = useState<string | null>(null);
  const [cDupName, setCDupName] = useState<string | null>(null);
  const [cIsWarning, setCIsWarning] = useState(false);

  // Derive sorted market list from venues.city
  const markets = useMemo(() => {
    const cities = [...new Set(venues.map(v => v.city).filter(Boolean) as string[])].sort();
    return cities;
  }, [venues]);

  // Filter + group venues
  const filtered = useMemo(() => {
    let base = market === 'all' ? venues : venues.filter(v => (v.city ?? '') === market);
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(v => v.name.toLowerCase().includes(q));
    }
    return [...base].sort((a, b) => a.name.localeCompare(b.name));
  }, [venues, market, search]);

  // Group by city for "all markets" view (flat when searching)
  const groups = useMemo((): Array<{ city: string; venues: DbVenue[] }> => {
    if (market !== 'all' || search.trim()) return [{ city: '', venues: filtered }];
    const map = new Map<string, DbVenue[]>();
    for (const v of filtered) {
      const key = v.city ?? '(no market set)';
      const arr = map.get(key) ?? [];
      arr.push(v);
      map.set(key, arr);
    }
    // Sort groups: named markets first (alphabetical), then "(no market set)"
    const sorted: Array<{ city: string; venues: DbVenue[] }> = [];
    [...map.entries()]
      .sort(([a], [b]) => {
        if (a === '(no market set)') return 1;
        if (b === '(no market set)') return -1;
        return a.localeCompare(b);
      })
      .forEach(([city, vs]) => sorted.push({ city, venues: vs }));
    return sorted;
  }, [filtered, market, search]);

  async function selectVenue(venue: DbVenue) {
    const spaces = venueSpaces.filter(s => s.venue_id === venue.id);
    if (spaces.length === 0) {
      startTransition(async () => {
        await linkVenueToEstimate(estimateId, programId, venue.id, null);
      });
      onSelect(venue.id, null, venue.city ?? null, venue);
    } else {
      setExpandedId(prev => prev === venue.id ? null : venue.id);
    }
  }

  async function selectSpace(venue: DbVenue, space: DbVenueSpace | null) {
    const spaceId = space?.id ?? null;
    startTransition(async () => {
      await linkVenueToEstimate(estimateId, programId, venue.id, spaceId);
    });
    onSelect(venue.id, spaceId, venue.city ?? null, venue);
  }

  async function submitCreate(skipNameCheck = false) {
    if (!cName.trim()) { setCError('Venue name is required.'); return; }
    if (!cAddress.trim()) { setCError('Address is required — needed to prevent duplicate venues.'); return; }
    setCError(null);
    setCDupId(null);
    setCDupName(null);
    setCIsWarning(false);

    const result = await createVenue({
      name: cName.trim(),
      address: cAddress.trim(),
      city: cCity.trim() || null,
      state: cState.trim() || null,
      skipNameCheck,
    });

    if ('error' in result) {
      setCError(result.error);
      if (result.existingId) { setCDupId(result.existingId); setCDupName(result.existingName ?? null); }
      if (result.isWarning) setCIsWarning(true);
      return;
    }

    startTransition(async () => {
      await linkVenueToEstimate(estimateId, programId, result.id, null);
    });
    const newVenueData: DbVenue = {
      id: result.id, name: cName.trim(), address: cAddress.trim(),
      city: cCity.trim() || null, state: cState.trim() || null, zip: null,
      service_styles: [], contact_name: null, contact_title: null,
      contact_email: null, contact_phone: null, email_signature: null,
      website: null, market: null, notes: null, last_used_date: null,
      vendor_type: 'venue',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    onSelect(result.id, null, cCity.trim() || null, newVenueData);
  }

  function useDuplicate() {
    if (!cDupId) return;
    const v = venues.find(x => x.id === cDupId);
    if (v) selectVenue(v);
    // If not found (edge case), fallback with minimal data
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto py-6 px-4">
      {/* Heading */}
      <div className="text-center space-y-1">
        <h2 className="text-lg font-serif text-brand-charcoal">Select or create a venue to begin</h2>
        <p className="text-xs text-brand-silver">Line items and pricing are unlocked once a venue is linked.</p>
      </div>

      {/* Market tabs + search */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setMarket('all')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${market === 'all' ? 'bg-brand-charcoal text-white' : 'text-brand-charcoal/60 hover:text-brand-charcoal hover:bg-brand-cream/60'}`}
          >
            All markets
          </button>
          {markets.map(city => (
            <button
              key={city}
              onClick={() => setMarket(city)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${market === city ? 'bg-brand-charcoal text-white' : 'text-brand-charcoal/60 hover:text-brand-charcoal hover:bg-brand-cream/60'}`}
            >
              {city}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search venues…"
          value={search}
          onChange={e => { setSearch(e.target.value); setExpandedId(null); }}
          className="w-full border border-brand-cream rounded px-3 py-2 text-sm bg-white placeholder:text-brand-silver focus:outline-none focus:ring-1 focus:ring-brand-copper"
          autoFocus
        />
      </div>

      {/* Venue list */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <p className="text-sm text-brand-silver text-center py-6">
            No venues in {market === 'all' ? 'the system' : market} yet.
            {' '}<button onClick={() => setShowCreate(true)} className="text-brand-brown underline">Create one</button>
          </p>
        )}

        {groups.map(({ city, venues: gVenues }) => (
          <div key={city || 'flat'}>
            {/* Group header — only in "all markets" grouped view */}
            {city && market === 'all' && !search.trim() && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-silver/70 mb-1.5 px-1">{city}</p>
            )}
            <div className="divide-y divide-brand-cream/60 border border-brand-cream rounded-lg overflow-hidden bg-white">
              {gVenues.map(venue => {
                const spaces = venueSpaces.filter(s => s.venue_id === venue.id);
                const isExpanded = expandedId === venue.id;
                return (
                  <div key={venue.id}>
                    <button
                      type="button"
                      onClick={() => selectVenue(venue)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-brand-offwhite transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-brand-charcoal group-hover:text-brand-brown transition-colors truncate">
                          {venue.name}
                        </div>
                        {venue.address && (
                          <div className="text-xs text-brand-silver truncate">{venue.address}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {venue.last_used_date && (
                          <span className="text-[10px] text-brand-silver/70 bg-brand-cream/60 rounded px-1.5 py-0.5">
                            last: {fmtDate(venue.last_used_date)}
                          </span>
                        )}
                        {spaces.length > 0 && (
                          <span className="text-[10px] text-brand-silver border border-brand-cream rounded px-1.5 py-0.5">
                            {spaces.length} space{spaces.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="text-brand-silver/40 group-hover:text-brand-brown transition-colors text-base">
                          {spaces.length > 0 ? (isExpanded ? '▾' : '▸') : '→'}
                        </span>
                      </div>
                    </button>

                    {/* Space sub-list */}
                    {isExpanded && spaces.length > 0 && (
                      <div className="bg-brand-offwhite border-t border-brand-cream/60 divide-y divide-brand-cream/40">
                        <button
                          type="button"
                          onClick={() => selectSpace(venue, null)}
                          className="w-full flex items-center gap-3 px-6 py-2.5 text-left hover:bg-brand-cream/40 transition-colors text-sm text-brand-silver italic"
                        >
                          No specific space — use venue only
                          <span className="ml-auto text-brand-silver/40">→</span>
                        </button>
                        {spaces.map(space => (
                          <button
                            key={space.id}
                            type="button"
                            onClick={() => selectSpace(venue, space)}
                            className="w-full flex items-center gap-3 px-6 py-2.5 text-left hover:bg-brand-cream/40 transition-colors group"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-brand-charcoal group-hover:text-brand-brown transition-colors">{space.name}</div>
                              {space.fb_minimum > 0 && (
                                <div className="text-xs text-brand-silver">F&B min ${space.fb_minimum.toLocaleString()}</div>
                              )}
                            </div>
                            <span className="text-brand-silver/40 group-hover:text-brand-brown transition-colors text-base flex-shrink-0">→</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Create new venue */}
      {!showCreate ? (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-sm text-brand-brown hover:text-brand-charcoal underline-offset-2 hover:underline transition-colors text-center"
        >
          + Create new venue
        </button>
      ) : (
        <form
          onSubmit={e => { e.preventDefault(); submitCreate(false); }}
          className="border border-amber-200 rounded-lg p-4 bg-amber-50/40 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-brand-charcoal">New venue</p>
            <button type="button" onClick={() => { setShowCreate(false); setCError(null); }} className="text-xs text-brand-silver hover:text-brand-charcoal">Cancel</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-brand-silver mb-0.5">Name *</label>
              <input required value={cName} onChange={e => setCName(e.target.value)}
                className="border border-brand-silver/30 rounded px-2 py-1.5 text-sm w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
                placeholder="The Ballantyne" />
            </div>
            <div>
              <label className="block text-[10px] text-brand-silver mb-0.5">Address *</label>
              <input required value={cAddress} onChange={e => setCAddress(e.target.value)}
                className="border border-brand-silver/30 rounded px-2 py-1.5 text-sm w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
                placeholder="10000 Ballantyne Commons Pkwy" />
            </div>
            <div>
              <label className="block text-[10px] text-brand-silver mb-0.5">City</label>
              <input value={cCity} onChange={e => setCCity(e.target.value)}
                className="border border-brand-silver/30 rounded px-2 py-1.5 text-sm w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
                placeholder="Charlotte" />
            </div>
            <div>
              <label className="block text-[10px] text-brand-silver mb-0.5">State</label>
              <input value={cState} onChange={e => setCState(e.target.value)} maxLength={2}
                className="border border-brand-silver/30 rounded px-2 py-1.5 text-sm w-full bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
                placeholder="NC" />
            </div>
          </div>

          {cError && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 flex flex-wrap items-center gap-2">
              <span>{cError}</span>
              <div className="flex gap-2">
                {cDupId && <button type="button" onClick={useDuplicate} className="underline font-medium">Use {cDupName ?? 'that venue'}</button>}
                {cIsWarning && <button type="button" onClick={() => submitCreate(true)} className="underline font-medium">Create anyway</button>}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={!cName.trim()}
            className="bg-brand-brown text-white text-sm rounded px-4 py-1.5 hover:bg-brand-brown/90 disabled:opacity-50 transition-colors"
          >
            Create & select
          </button>
        </form>
      )}
    </div>
  );
}
