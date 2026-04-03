import Link from 'next/link';
import { getPrograms } from '@/lib/supabase/queries';

export const dynamic = 'force-dynamic';

function formatDate(val: string | null) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

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

      {programs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">No programs yet.</p>
          <Link href="/programs/new" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
            Create your first program
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Program</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-24">Estimates</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">Event Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {programs.map((program) => (
                <tr key={program.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/programs/${program.id}`}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      {program.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{program.client_name ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{program.estimate_count}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(program.event_date)}</td>
                  <td className="px-4 py-3 text-gray-400">{formatDate(program.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
