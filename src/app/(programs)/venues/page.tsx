import { getVenues, getAllVenueSpaces, getVenueStats } from '@/lib/supabase/queries';
import VenuesList from '@/components/venues/VenuesList';

export const dynamic = 'force-dynamic';

export default async function VenuesPage() {
  const [venues, allSpaces, stats] = await Promise.all([getVenues(), getAllVenueSpaces(), getVenueStats()]);

  const spacesByVenue = new Map<string, typeof allSpaces>();
  for (const space of allSpaces) {
    const arr = spacesByVenue.get(space.venue_id) ?? [];
    arr.push(space);
    spacesByVenue.set(space.venue_id, arr);
  }

  const statsMap = new Map(stats.map((s) => [s.venue_id, s]));

  const venueRows = venues.map((venue) => {
    const spaces = spacesByVenue.get(venue.id) ?? [];
    const capacities = spaces
      .flatMap((s) => [s.capacity_seated, s.capacity_standing])
      .filter((c): c is number => c !== null);
    const stat = statsMap.get(venue.id);
    return {
      ...venue,
      space_count: spaces.length,
      capacity_min: capacities.length ? Math.min(...capacities) : null,
      capacity_max: capacities.length ? Math.max(...capacities) : null,
      program_count: stat?.program_count ?? 0,
      file_count: stat?.file_count ?? 0,
    };
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-serif text-brand-charcoal">Venues</h1>
        <p className="text-sm text-brand-silver mt-1">Manage venue details and spaces for reuse across estimates.</p>
      </div>
      <VenuesList venues={venueRows} />
    </div>
  );
}
