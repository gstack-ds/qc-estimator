import { notFound } from 'next/navigation';
import {
  getProgram,
  getEstimatesForProgram,
  getEstimate,
  getEstimateSections,
  getEvent,
  getLineItemsForEstimate,
  getMarkups,
  getTiers,
  getTransportVehicleRates,
  getTransportScheduleRows,
  getVenues,
  getAllVenueSpaces,
  getLocations,
  getTravelItems,
} from '@/lib/supabase/queries';
import { ensureDefaultSections } from '@/app/(programs)/programs/[id]/estimates/actions';
import EstimateBuilder from '@/components/estimates/EstimateBuilder';
import type { SlideCopyData } from '@/types/slideCopy';
import AvEstimateBuilder from '@/components/estimates/AvEstimateBuilder';
import DecorEstimateBuilder from '@/components/estimates/DecorEstimateBuilder';
import TransportationEstimateBuilder from '@/components/estimates/TransportationEstimateBuilder';
import TourEstimateBuilder from '@/components/estimates/TourEstimateBuilder';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string; estimateId: string }>;
}

export default async function EstimatePage({ params }: Props) {
  const { id: programId, estimateId } = await params;

  const [program, allEstimates, estimate, markups, tiers, venues, allLocations, travelItems] = await Promise.all([
    getProgram(programId),
    getEstimatesForProgram(programId),
    getEstimate(estimateId),
    getMarkups(),
    getTiers(),
    getVenues(),
    getLocations(),
    getTravelItems(programId),
  ]);

  if (!program || !estimate) notFound();

  const event = estimate.event_id ? await getEvent(estimate.event_id) : null;
  const eventName = event?.name ?? null;
  const effectiveProgram = event?.guest_count
    ? { ...program, guest_count: event.guest_count }
    : program;

  // Compute program-level travel total from travel items
  const programTravelTotal = travelItems.reduce((s, it) => s + it.qty * it.unit_price, 0);

  if (estimate.type === 'transportation') {
    const [vehicleRates, scheduleRows] = await Promise.all([
      getTransportVehicleRates(estimateId),
      getTransportScheduleRows(estimateId),
    ]);
    return (
      <div className="h-[calc(100vh-49px)] flex flex-col">
        <TransportationEstimateBuilder
          program={effectiveProgram}
          location={program.location}
          allEstimates={allEstimates}
          estimate={estimate}
          vehicleRates={vehicleRates}
          scheduleRows={scheduleRows}
          tiers={tiers}
          eventName={eventName}
          programTravelTotal={programTravelTotal}
          includeTravelInProductionFee={program.include_travel_in_production_fee ?? false}
        />
      </div>
    );
  }

  const [lineItems, venueSpaces, rawSections] = await Promise.all([
    getLineItemsForEstimate(estimateId),
    estimate.type === 'venue' ? getAllVenueSpaces() : Promise.resolve([]),
    getEstimateSections(estimateId),
  ]);

  let dbSections = rawSections;
  if (dbSections.length === 0 && estimate.type !== 'transportation') {
    const { sections } = await ensureDefaultSections(estimateId, estimate.type as import('@/types').EstimateType);
    dbSections = sections.map((s) => ({ ...s, tax_bucket: s.tax_bucket as 'fb' | 'equipment' | 'venue' | 'staffing' }));
  }

  if (estimate.type === 'venue') {
    return (
      <div className="h-[calc(100vh-49px)] flex flex-col">
        <EstimateBuilder
          program={effectiveProgram}
          location={program.location}
          allEstimates={allEstimates}
          estimate={estimate}
          dbLineItems={lineItems}
          dbSections={dbSections}
          markups={markups}
          tiers={tiers}
          eventName={eventName}
          event={event}
          initialSlideCopyData={estimate.slide_copy_data as SlideCopyData | null}
          venues={venues}
          venueSpaces={venueSpaces}
          allLocations={allLocations}
          programTravelTotal={programTravelTotal}
          includeTravelInProductionFee={program.include_travel_in_production_fee ?? false}
        />
      </div>
    );
  }

  if (estimate.type === 'tour') {
    return (
      <div className="h-[calc(100vh-49px)] flex flex-col">
        <TourEstimateBuilder
          program={effectiveProgram}
          location={program.location}
          allEstimates={allEstimates}
          estimate={estimate}
          dbLineItems={lineItems}
          dbSections={dbSections}
          markups={markups}
          tiers={tiers}
          eventName={eventName}
          programTravelTotal={programTravelTotal}
          includeTravelInProductionFee={program.include_travel_in_production_fee ?? false}
        />
      </div>
    );
  }

  const Builder = estimate.type === 'av'
    ? AvEstimateBuilder
    : DecorEstimateBuilder;

  return (
    <div className="h-[calc(100vh-49px)] flex flex-col">
      <Builder
        program={effectiveProgram}
        location={program.location}
        allEstimates={allEstimates}
        estimate={estimate}
        dbLineItems={lineItems}
        dbSections={dbSections}
        markups={markups}
        tiers={tiers}
        eventName={eventName}
        programTravelTotal={programTravelTotal}
        includeTravelInProductionFee={program.include_travel_in_production_fee ?? false}
      />
    </div>
  );
}
