import { notFound } from 'next/navigation';
import {
  getProgram,
  getEstimatesForProgram,
  getEstimate,
  getLineItemsForEstimate,
  getMarkups,
  getTiers,
} from '@/lib/supabase/queries';
import EstimateBuilder from '@/components/estimates/EstimateBuilder';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string; estimateId: string }>;
}

export default async function EstimatePage({ params }: Props) {
  const { id: programId, estimateId } = await params;

  const [program, allEstimates, estimate, markups, tiers] = await Promise.all([
    getProgram(programId),
    getEstimatesForProgram(programId),
    getEstimate(estimateId),
    getMarkups(),
    getTiers(),
  ]);

  if (!program || !estimate) notFound();

  const lineItems = await getLineItemsForEstimate(estimateId);

  return (
    <div className="h-[calc(100vh-49px)] flex flex-col">
      <EstimateBuilder
        program={program}
        location={program.location}
        allEstimates={allEstimates}
        estimate={estimate}
        dbLineItems={lineItems}
        markups={markups}
        tiers={tiers}
      />
    </div>
  );
}
