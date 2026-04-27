'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DbVenue } from '@/lib/supabase/queries';
import { createVenue, deleteVenue } from '@/app/(programs)/venues/actions';

interface VenueRow extends DbVenue {
  space_count: number;
  capacity_min: number | null;
  capacity_max: number | null;
}

interface Props {
  venues: VenueRow[];
}

const SERVICE_STYLE_OPTIONS = [
  'Plated', 'Buffet', 'Stations', 'Heavy Appetizers', 'Reception', 'Family Style', 'Food Trucks',
];

const ALL_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function VenuesList({ venues }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterStyle, setFilterStyle] = useState('');
  const [filterCapMin, setFilterCapMin] = useState('');
  const [filterCapMax, setFilterCapMax] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');

  const uniqueCities = useMemo(() => {
    const cities = venues.map((v) => v.city).filter(Boolean) as string[];
    return [...new Set(cities)].sort();
  }, [venues]);

  const filtered = useMemo(() => {
    return venues.filter((v) => {
      if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCity && v.city !== filterCity) return false;
      if (filterState && v.state !== filterState) return false;
      if (filterStyle && !v.service_styles.includes(filterStyle)) return false;
      if (filterCapMin) {
        const min = parseInt(filterCapMin);
        const cap = v.capacity_max ?? v.capacity_min ?? 0;
        if (cap < min) return false;
      }
      if (filterCapMax) {
        const max = parseInt(filterCapMax);
        const cap = v.capacity_min ?? v.capacity_max ?? 0;
        if (cap > max) return false;
      }
      return true;
    });
  }, [venues, search, filterCity, filterState, filterStyle, filterCapMin, filterCapMax]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsPending(true);
    const result = await createVenue({ name: newName.trim(), city: newCity || null, state: newState || null });
    setIsPending(false);
    if ('id' in result) {
      setShowAddForm(false);
      setNewName('');
      setNewCity('');
      setNewState('');
      router.push(`/venues/${result.id}`);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will unlink any estimates connected to this venue.`)) return;
    await deleteVenue(id);
    router.refresh();
  }

  return (
    <div>
      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        <div className="flex-1 min-w-[180px]">
          <input
            type="text"
            placeholder="Search venues…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-brand-silver/30 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
          />
        </div>
        <select
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          className="border border-brand-silver/30 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
        >
          <option value="">All Cities</option>
          {uniqueCities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          className="border border-brand-silver/30 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
        >
          <option value="">All States</option>
          {ALL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterStyle}
          onChange={(e) => setFilterStyle(e.target.value)}
          className="border border-brand-silver/30 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
        >
          <option value="">All Service Styles</option>
          {SERVICE_STYLE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-1 text-sm text-brand-silver">
          <span>Capacity:</span>
          <input
            type="number"
            placeholder="min"
            value={filterCapMin}
            onChange={(e) => setFilterCapMin(e.target.value)}
            className="w-16 border border-brand-silver/30 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
          />
          <span>–</span>
          <input
            type="number"
            placeholder="max"
            value={filterCapMax}
            onChange={(e) => setFilterCapMax(e.target.value)}
            className="w-16 border border-brand-silver/30 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
          />
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="ml-auto bg-brand-brown text-white text-sm px-4 py-1.5 rounded hover:bg-brand-brown/90 whitespace-nowrap"
        >
          + Add Venue
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="bg-brand-cream/30 border border-brand-silver/20 rounded-lg p-4 mb-4 flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-brand-silver mb-1">Venue Name *</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="border border-brand-silver/30 rounded px-3 py-1.5 text-sm w-48 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
              placeholder="e.g. The Ballantyne"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-silver mb-1">City</label>
            <input
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              className="border border-brand-silver/30 rounded px-3 py-1.5 text-sm w-36 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
              placeholder="Charlotte"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-silver mb-1">State</label>
            <select
              value={newState}
              onChange={(e) => setNewState(e.target.value)}
              className="border border-brand-silver/30 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
            >
              <option value="">—</option>
              {ALL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending || !newName.trim()}
              className="bg-brand-brown text-white text-sm px-4 py-1.5 rounded hover:bg-brand-brown/90 disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Create & Edit'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-sm text-brand-silver hover:text-brand-charcoal px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-sm text-brand-silver py-12 text-center">
          {venues.length === 0 ? 'No venues yet. Add one to get started.' : 'No venues match your filters.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-silver/20 text-left">
                <th className="pb-2 pr-4 text-xs font-medium text-brand-silver uppercase tracking-wide">Venue</th>
                <th className="pb-2 pr-4 text-xs font-medium text-brand-silver uppercase tracking-wide">City / State</th>
                <th className="pb-2 pr-4 text-xs font-medium text-brand-silver uppercase tracking-wide">Service Styles</th>
                <th className="pb-2 pr-4 text-xs font-medium text-brand-silver uppercase tracking-wide text-right">Spaces</th>
                <th className="pb-2 pr-4 text-xs font-medium text-brand-silver uppercase tracking-wide text-right">Capacity</th>
                <th className="pb-2 text-xs font-medium text-brand-silver uppercase tracking-wide">Last Used</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((venue) => (
                <tr key={venue.id} className="border-b border-brand-silver/10 hover:bg-brand-cream/20 group">
                  <td className="py-2.5 pr-4">
                    <Link href={`/venues/${venue.id}`} className="font-medium text-brand-charcoal hover:text-brand-brown">
                      {venue.name}
                    </Link>
                    {venue.address && (
                      <div className="text-xs text-brand-silver truncate max-w-[200px]">{venue.address}</div>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-brand-charcoal">
                    {[venue.city, venue.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {venue.service_styles.length > 0
                        ? venue.service_styles.map((s) => (
                            <span key={s} className="text-xs bg-brand-cream border border-brand-silver/20 rounded px-1.5 py-0.5">{s}</span>
                          ))
                        : <span className="text-brand-silver">—</span>
                      }
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-brand-charcoal">{venue.space_count || '—'}</td>
                  <td className="py-2.5 pr-4 text-right text-brand-charcoal">
                    {venue.capacity_min !== null || venue.capacity_max !== null
                      ? venue.capacity_min === venue.capacity_max
                        ? (venue.capacity_min ?? venue.capacity_max ?? '—')
                        : `${venue.capacity_min ?? '?'} – ${venue.capacity_max ?? '?'}`
                      : '—'
                    }
                  </td>
                  <td className="py-2.5 pr-4 text-brand-silver">{formatDate(venue.last_used_date)}</td>
                  <td className="py-2.5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDelete(venue.id, venue.name)}
                      className="text-xs text-brand-silver hover:text-red-500 px-2 py-1"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-xs text-brand-silver">
            {filtered.length} of {venues.length} venue{venues.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
