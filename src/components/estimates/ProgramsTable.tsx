'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { DbProgramSummary } from '@/lib/supabase/queries';

interface Props {
  programs: DbProgramSummary[];
}

function formatDate(val: string | null) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProgramsTable({ programs }: Props) {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? programs.filter((p) => {
        const q = query.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.client_name ?? '').toLowerCase().includes(q)
        );
      })
    : programs;

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by program or client name…"
        className="w-full max-w-sm border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">{query ? 'No programs match your search.' : 'No programs yet.'}</p>
          {!query && (
            <Link href="/programs/new" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
              Create your first program
            </Link>
          )}
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
              {filtered.map((program) => (
                <tr key={program.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/programs/${program.id}`}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      {program.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {program.client_name ? (
                      <span className="text-gray-700">{program.client_name}</span>
                    ) : (
                      <span className="text-gray-400 italic">No client yet</span>
                    )}
                  </td>
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
