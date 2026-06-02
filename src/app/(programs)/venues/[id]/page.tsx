import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getVenueWithSpaces, getEstimatesForVenue, getAttachmentsForVenue } from '@/lib/supabase/queries';
import VenueForm from '@/components/venues/VenueForm';
import SpacesManager from '@/components/venues/SpacesManager';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(val: string | null) {
  if (!val) return '—';
  const [y, m, d] = val.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export default async function VenueDetailPage({ params }: Props) {
  const { id } = await params;
  const [venue, estimates, attachments] = await Promise.all([
    getVenueWithSpaces(id),
    getEstimatesForVenue(id),
    getAttachmentsForVenue(id),
  ]);
  if (!venue) notFound();

  // Group estimates by program
  const programMap = new Map<string, typeof estimates>();
  for (const est of estimates) {
    const arr = programMap.get(est.program_id) ?? [];
    arr.push(est);
    programMap.set(est.program_id, arr);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm">
        <Link href="/venues" className="text-brand-silver hover:text-brand-brown transition-colors">Venues</Link>
        <span className="text-brand-silver/40 mx-0.5">›</span>
        <span className="font-medium text-brand-charcoal">{venue.name}</span>
      </div>

      {/* Venue fields */}
      <div className="bg-white border border-brand-silver/20 rounded-xl p-6">
        <h1 className="text-lg font-serif text-brand-charcoal mb-5">Venue Details</h1>
        <VenueForm venue={venue} />
      </div>

      {/* Spaces */}
      <div className="bg-white border border-brand-silver/20 rounded-xl p-6">
        <SpacesManager venueId={venue.id} initialSpaces={venue.spaces} />
      </div>

      {/* Program History */}
      <div className="bg-white border border-brand-silver/20 rounded-xl p-6">
        <h2 className="text-base font-serif text-brand-charcoal mb-4">Program History</h2>
        {estimates.length === 0 ? (
          <p className="text-sm text-brand-silver">No estimates linked to this venue yet.</p>
        ) : (
          <div className="space-y-4">
            {[...programMap.entries()].map(([, ests]) => {
              const first = ests[0];
              return (
                <div key={first.program_id} className="border border-brand-cream rounded-lg overflow-hidden">
                  {/* Program header */}
                  <div className="bg-brand-offwhite px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <Link
                        href={`/programs/${first.program_id}`}
                        className="text-sm font-medium text-brand-brown hover:text-brand-charcoal transition-colors"
                      >
                        {first.program_name}
                      </Link>
                      {first.client_name && (
                        <span className="text-xs text-brand-silver ml-2">{first.client_name}</span>
                      )}
                    </div>
                    {first.event_date && (
                      <span className="text-xs text-brand-silver">{formatDate(first.event_date)}</span>
                    )}
                  </div>
                  {/* Estimates list */}
                  <div className="divide-y divide-brand-cream/60">
                    {ests.map((est) => (
                      <div key={est.id} className="px-4 py-2 flex items-center justify-between text-sm">
                        <Link
                          href={`/programs/${est.program_id}/estimates/${est.id}`}
                          className="text-brand-charcoal hover:text-brand-brown transition-colors"
                        >
                          {est.name}
                        </Link>
                        <span className="text-xs text-brand-silver capitalize">{est.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="bg-white border border-brand-silver/20 rounded-xl p-6">
          <h2 className="text-base font-serif text-brand-charcoal mb-4">Estimate Attachments</h2>
          <div className="space-y-1.5">
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-3 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-silver flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-brand-charcoal">{att.file_name}</span>
                <span className="text-brand-silver text-xs">
                  via{' '}
                  <Link href={`/programs/${att.program_id}`} className="hover:text-brand-brown transition-colors">
                    {att.program_name}
                  </Link>
                </span>
                <span className="text-brand-silver/50 text-xs ml-auto">{formatDate(att.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
