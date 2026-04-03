import Link from 'next/link';
import { getPrograms } from '@/lib/supabase/queries';
import ProgramsTable from '@/components/estimates/ProgramsTable';

export const dynamic = 'force-dynamic';

export default async function ProgramsPage() {
  const programs = await getPrograms();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Programs</h1>
        <Link
          href="/programs/new"
          className="bg-blue-600 text-white text-sm font-medium rounded px-4 py-2 hover:bg-blue-700 transition-colors"
        >
          New Program
        </Link>
      </div>
      <ProgramsTable programs={programs} />
    </div>
  );
}
