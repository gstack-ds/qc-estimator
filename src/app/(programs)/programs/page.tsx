import Link from 'next/link';
import { getPrograms } from '@/lib/supabase/queries';
import ProgramsTable from '@/components/estimates/ProgramsTable';

export const dynamic = 'force-dynamic';

export default async function ProgramsPage() {
  const programs = await getPrograms();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-2xl font-medium text-brand-charcoal">Programs</h1>
        <Link
          href="/programs/new"
          className="bg-brand-brown text-white text-sm font-medium rounded px-4 py-2 hover:bg-brand-charcoal transition-colors"
        >
          New Program
        </Link>
      </div>
      <ProgramsTable programs={programs} />
    </div>
  );
}
