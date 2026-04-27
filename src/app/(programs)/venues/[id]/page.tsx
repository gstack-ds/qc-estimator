import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getVenueWithSpaces } from '@/lib/supabase/queries';
import VenueForm from '@/components/venues/VenueForm';
import SpacesManager from '@/components/venues/SpacesManager';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VenueDetailPage({ params }: Props) {
  const { id } = await params;
  const venue = await getVenueWithSpaces(id);
  if (!venue) notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm mb-6">
        <Link href="/venues" className="text-brand-silver hover:text-brand-brown transition-colors">Venues</Link>
        <span className="text-brand-silver/40 mx-0.5">›</span>
        <span className="font-medium text-brand-charcoal">{venue.name}</span>
      </div>

      {/* Venue fields */}
      <div className="bg-white border border-brand-silver/20 rounded-xl p-6 mb-6">
        <h1 className="text-lg font-serif text-brand-charcoal mb-5">Venue Details</h1>
        <VenueForm venue={venue} />
      </div>

      {/* Spaces */}
      <div className="bg-white border border-brand-silver/20 rounded-xl p-6">
        <SpacesManager venueId={venue.id} initialSpaces={venue.spaces} />
      </div>
    </div>
  );
}
