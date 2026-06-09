import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getVenueWithSpaces, getEstimatesForVenue, getAttachmentsForVenue, getVendorPhotos,
} from '@/lib/supabase/queries';
import { parseMenus, parseBarOptions, parseInclusions } from '@/lib/vendors/profileTypes';
import VenueForm from '@/components/venues/VenueForm';
import SpacesManager from '@/components/venues/SpacesManager';
import VendorProfileSection from '@/components/venues/VendorProfileSection';
import PhotoGallery from '@/components/venues/PhotoGallery';
import VendorBrochure from '@/components/venues/VendorBrochure';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(val: string | null) {
  if (!val) return '—';
  const [y, m, d] = val.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export default async function VenueDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { view } = await searchParams;
  const isBrochure = view === 'brochure';

  const [venue, estimatesResult, attachmentsResult, photos] = await Promise.all([
    getVenueWithSpaces(id),
    getEstimatesForVenue(id),
    getAttachmentsForVenue(id),
    getVendorPhotos(id),
  ]);
  if (!venue) notFound();

  const isProfileVendor = venue.vendor_type === 'venue' || venue.vendor_type === 'restaurant';
  const menus = parseMenus(venue.menus);
  const barOptions = parseBarOptions(venue.bar_options);
  const inclusions = parseInclusions(venue.inclusions);

  const estimates = estimatesResult.data;
  const attachments = attachmentsResult.data;
  const estimateError = estimatesResult.error;
  const attachmentError = attachmentsResult.error;

  // Group estimates by program
  const programMap = new Map<string, typeof estimates>();
  for (const est of estimates) {
    const arr = programMap.get(est.program_id) ?? [];
    arr.push(est);
    programMap.set(est.program_id, arr);
  }

  return (
    <div
      className={isBrochure ? 'max-w-4xl mx-auto px-6 py-8' : 'max-w-3xl mx-auto px-6 py-8 space-y-6'}
      data-brochure-page={isBrochure ? 'true' : undefined}
    >
      {/* Breadcrumb + view toggle */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-1 text-sm">
          <Link href="/venues" className="text-brand-silver hover:text-brand-brown transition-colors">Vendors</Link>
          <span className="text-brand-silver/40 mx-0.5">›</span>
          <span className="font-medium text-brand-charcoal">{venue.name}</span>
        </div>

        {isProfileVendor && (
          <div className="flex items-center gap-1 bg-brand-offwhite border border-brand-cream rounded-lg p-1">
            <Link
              href={`/venues/${id}`}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                !isBrochure
                  ? 'bg-white text-brand-charcoal shadow-sm font-medium'
                  : 'text-brand-silver hover:text-brand-charcoal'
              }`}
            >
              Edit
            </Link>
            <Link
              href={`/venues/${id}?view=brochure`}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                isBrochure
                  ? 'bg-white text-brand-charcoal shadow-sm font-medium'
                  : 'text-brand-silver hover:text-brand-charcoal'
              }`}
            >
              Brochure
            </Link>
          </div>
        )}
      </div>

      {/* ── Brochure view ───────────────────────────────────────────────── */}
      {isBrochure && isProfileVendor && (
        <VendorBrochure
          venue={venue}
          menus={menus}
          barOptions={barOptions}
          inclusions={inclusions}
          photos={photos}
        />
      )}

      {/* ── Edit view ───────────────────────────────────────────────────── */}
      {!isBrochure && (
        <div className="space-y-6">
          {/* Venue fields */}
          <div className="bg-white border border-brand-silver/20 rounded-xl p-6">
            <h1 className="text-lg font-serif text-brand-charcoal mb-5">Vendor Details</h1>
            <VenueForm venue={venue} />
          </div>

          {/* Spaces */}
          <div className="bg-white border border-brand-silver/20 rounded-xl p-6">
            <SpacesManager venueId={venue.id} initialSpaces={venue.spaces} />
          </div>

          {/* Vendor Profile (venue + restaurant only) */}
          {isProfileVendor && (
            <div className="bg-white border border-brand-silver/20 rounded-xl p-6">
              <h2 className="text-base font-serif text-brand-charcoal mb-5">Profile Content</h2>
              <VendorProfileSection
                vendorId={venue.id}
                initialMenus={menus}
                initialBarOptions={barOptions}
                initialInclusions={inclusions}
                initialProfileNotes={venue.profile_notes ?? ''}
              />
            </div>
          )}

          {/* Photo Gallery (venue + restaurant only) */}
          {isProfileVendor && (
            <div className="bg-white border border-brand-silver/20 rounded-xl p-6">
              <h2 className="text-base font-serif text-brand-charcoal mb-5">Photos</h2>
              <PhotoGallery vendorId={venue.id} initialPhotos={photos} />
            </div>
          )}

          {/* Program History */}
          <div className="bg-white border border-brand-silver/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-serif text-brand-charcoal">Program History</h2>
              <span className="text-xs text-brand-silver">
                {estimateError ? 'Error loading' : `${estimates.length} estimate${estimates.length !== 1 ? 's' : ''} linked`}
              </span>
            </div>

            {estimateError && (
              <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-700 mb-3">
                Query error: {estimateError}
              </div>
            )}

            {!estimateError && estimates.length === 0 && (
              <div className="text-sm text-brand-silver space-y-1">
                <p>No estimates linked to this venue yet.</p>
                <p className="text-xs">When an estimate is linked here via the venue picker in the estimate builder, it will appear in this list.</p>
              </div>
            )}

            {estimates.length > 0 && (
              <div className="space-y-4">
                {[...programMap.entries()].map(([, ests]) => {
                  const first = ests[0];
                  return (
                    <div key={first.program_id} className="border border-brand-cream rounded-lg overflow-hidden">
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
          <div className="bg-white border border-brand-silver/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-serif text-brand-charcoal">Estimate Attachments</h2>
              <span className="text-xs text-brand-silver">
                {attachmentError ? 'Error loading' : `${attachments.length} file${attachments.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            {attachmentError && (
              <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-700 mb-3">
                Query error: {attachmentError}
              </div>
            )}

            {!attachmentError && attachments.length === 0 && (
              <p className="text-sm text-brand-silver">
                No attachments yet. Files uploaded to estimates at this venue will appear here.
              </p>
            )}

            {attachments.length > 0 && (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
