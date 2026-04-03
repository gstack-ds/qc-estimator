import { notFound } from 'next/navigation';
import {
  getProgram,
  getEstimatesForProgram,
  getEstimate,
  getLineItemsForEstimate,
  getMarkups,
  getTiers,
  getTravelRefs,
  getTripsForEstimate,
} from '@/lib/supabase/queries';
import EstimateBuilder from '@/components/estimates/EstimateBuilder';
import AvEstimateBuilder from '@/components/estimates/AvEstimateBuilder';
import DecorEstimateBuilder from '@/components/estimates/DecorEstimateBuilder';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string; estimateId: string }>;
}

export default async function EstimatePage({ params }: Props) {
  const { id: programId, estimateId } = await params;

  const [program, allEstimates, estimate, markups, tiers, travelRefs] = await Promise.all([
    getProgram(programId),
    getEstimatesForProgram(programId),
    getEstimate(estimateId),
    getMarkups(),
    getTiers(),
    getTravelRefs(),
  ]);

  if (!program || !estimate) notFound();

  const [lineItems, initialTrips] = await Promise.all([
    getLineItemsForEstimate(estimateId),
    getTripsForEstimate(estimateId),
  ]);

  const Builder = estimate.type === 'av'
    ? AvEstimateBuilder
    : estimate.type === 'decor'
    ? DecorEstimateBuilder
    : EstimateBuilder;

  return (
    <div className="h-[calc(100vh-49px)] flex flex-col">
      <Builder
        program={program}
        location={program.location}
        allEstimates={allEstimates}
        estimate={estimate}
        dbLineItems={lineItems}
        markups={markups}
        tiers={tiers}
        travelRefs={travelRefs}
        initialTrips={initialTrips}
      />
    </div>
  );
}
