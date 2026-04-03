import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getProgram, getLocations, getEstimatesForProgram } from '@/lib/supabase/queries';
import ProgramForm from '@/components/estimates/ProgramForm';
import { createEstimate } from '@/app/(programs)/programs/actions';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProgramPage({ params }: Props) {
  const { id } = await params;
  const [program, locations, estimates] = await Promise.all([
    getProgram(id),
    getLocations(),
    getEstimatesForProgram(id),
  ]);

  if (!program) notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/programs" className="text-sm text-gray-400 hover:text-gray-600">← Programs</Link>
          <h1 className="text-lg font-semibold text-gray-900 mt-1">{program.name}</h1>
        </div>
      </div>

      <ProgramForm program={program} locations={locations} mode="edit" />

      {/* Estimates */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Venue Estimates</h2>
          <form
            action={async () => {
              'use server';
              const result = await createEstimate(id);
              if (result.id) redirect(`/programs/${id}/estimates/${result.id}`);
            }}
          >
            <button
              type="submit"
              className="bg-blue-600 text-white text-sm font-medium rounded px-4 py-2 hover:bg-blue-700 transition-colors"
            >
              Add Estimate
            </button>
          </form>
        </div>

        {estimates.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-gray-200 rounded-lg">
            <p className="text-sm text-gray-400">No estimates yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Estimate Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-36">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {estimates.map((est) => (
                  <tr key={est.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/programs/${id}/estimates/${est.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {est.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(est.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
