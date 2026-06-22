import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProgram, getEventsForProgram, getBudgetForProgram, getActiveBudgetShare, getBudgetResponses } from '@/lib/supabase/queries';
import BudgetBuilder, { type BudgetEventInfo } from '@/components/budget/BudgetBuilder';
import BudgetSharePanel from '@/components/budget/BudgetSharePanel';
import BudgetResponsesPanel from '@/components/budget/BudgetResponsesPanel';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProgramBudgetPage({ params }: Props) {
  const { id } = await params;

  const [program, dbEvents, budget, activeShare, responses] = await Promise.all([
    getProgram(id),
    getEventsForProgram(id),
    getBudgetForProgram(id),
    getActiveBudgetShare(id),
    getBudgetResponses(id),
  ]);
  if (!program) notFound();

  const events: BudgetEventInfo[] = dbEvents.map((e) => ({
    id: e.id,
    name: e.name,
    guestCount: e.guest_count,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link href={`/programs/${id}`} className="text-sm text-brand-silver hover:text-brand-brown transition-colors">
          ← {program.name}
        </Link>
        <h1 className="font-serif text-2xl font-medium text-brand-charcoal mt-1">Budget</h1>
        <p className="text-sm text-brand-silver mt-1">
          Build a client budget from this program’s estimates. Combine, set Low/Mid/High ranges, override values, then preview the client-facing layout.
        </p>
      </div>

      <BudgetBuilder
        programId={id}
        programName={program.name}
        programGuestCount={program.guest_count}
        events={events}
        budget={budget}
      />

      {budget && (
        <BudgetSharePanel programId={id} documentId={budget.id} activeShare={activeShare} />
      )}

      {budget && <BudgetResponsesPanel responses={responses} />}
    </div>
  );
}
