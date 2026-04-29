import { notFound } from 'next/navigation';
import {
  getProgram,
  getEstimatesForProgram,
  getEstimate,
  getEvent,
  getLineItemsForEstimate,
  getMarkups,
  getTiers,
  getTravelRefs,
  getTripsForEstimate,
  getTransportVehicleRates,
  getTransportScheduleRows,
  getVenues,
  getAllVenueSpaces,
} from '@/lib/supabase/queries';
import EstimateBuilder from '@/components/estimates/EstimateBuilder';
import AvEstimateBuilder from '@/components/estimates/AvEstimateBuilder';
import DecorEstimateBuilder from '@/components/estimates/DecorEstimateBuilder';
import TransportationEstimateBuilder from '@/components/estimates/TransportationEstimateBuilder';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string; estimateId: string }>;
}

export default async function EstimatePage({ params }: Props) {
  const { id: programId, estimateId } = await params;

  const [program, allEstimates, estimate, markups, tiers, travelRefs, venues] = await Promise.all([
    getProgram(programId),
    getEstimatesForProgram(programId),
    getEstimate(estimateId),
    getMarkups(),
    getTiers(),
    getTravelRefs(),
    getVenues(),
  ]);

  if (!program || !estimate) notFound();

  const event = estimate.event_id ? await getEvent(estimate.event_id) : null;
  const eventName = event?.name ?? null;
  // Override program guest count with the event's guest count when set
  const effectiveProgram = event?.guest_count
    ? { ...program, guest_count: event.guest_count }
    : program;

  if (estimate.type === 'transportation') {
    const [initialTrips, vehicleRates, scheduleRows] = await Promise.all([
      getTripsForEstimate(estimateId),
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
          travelRefs={travelRefs}
          initialTrips={initialTrips}
          tiers={tiers}
          eventName={eventName}
        />
      </div>
    );
  }

  const [lineItems, initialTrips, venueSpaces] = await Promise.all([
    getLineItemsForEstimate(estimateId),
    getTripsForEstimate(estimateId),
    estimate.type === 'venue' ? getAllVenueSpaces() : Promise.resolve([]),
  ]);

  if (estimate.type === 'venue') {
    return (
      <div className="h-[calc(100vh-49px)] flex flex-col">
        <EstimateBuilder
          program={effectiveProgram}
          location={program.location}
          allEstimates={allEstimates}
          estimate={estimate}
          dbLineItems={lineItems}
          markups={markups}
          tiers={tiers}
          travelRefs={travelRefs}
          initialTrips={initialTrips}
          eventName={eventName}
          venues={venues}
          venueSpaces={venueSpaces}
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
        markups={markups}
        tiers={tiers}
        travelRefs={travelRefs}
        initialTrips={initialTrips}
        eventName={eventName}
      />
    </div>
  );
}
