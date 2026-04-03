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
        placeholder="Search programs or clients…"
        className="w-full max-w-sm border border-brand-cream rounded px-3 py-2 text-sm bg-white text-brand-charcoal placeholder:text-brand-silver focus:outline-none focus:ring-2 focus:ring-brand-copper focus:border-brand-brown transition-colors"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-brand-cream rounded-lg">
          <p className="text-sm text-brand-silver">{query ? 'No programs match your search.' : 'No programs yet.'}</p>
          {!query && (
            <Link href="/programs/new" className="text-brand-brown text-sm hover:text-brand-charcoal mt-2 inline-block transition-colors">
              Create your first program →
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-brand-cream overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brand-offwhite border-b border-brand-cream">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-brand-charcoal/70 text-xs tracking-wide uppercase">Program</th>
                <th className="text-left px-4 py-3 font-medium text-brand-charcoal/70 text-xs tracking-wide uppercase">Client</th>
                <th className="text-right px-4 py-3 font-medium text-brand-charcoal/70 text-xs tracking-wide uppercase w-24">Estimates</th>
                <th className="text-right px-4 py-3 font-medium text-brand-charcoal/70 text-xs tracking-wide uppercase w-32">Latest Total</th>
                <th className="text-left px-4 py-3 font-medium text-brand-charcoal/70 text-xs tracking-wide uppercase w-36">Event Date</th>
                <th className="text-left px-4 py-3 font-medium text-brand-charcoal/70 text-xs tracking-wide uppercase w-36">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream/60">
              {filtered.map((program) => (
                <tr key={program.id} className="hover:bg-brand-offwhite transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/programs/${program.id}`}
                      className="font-medium text-brand-brown hover:text-brand-charcoal transition-colors"
                    >
                      {program.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {program.client_name ? (
                      <span className="text-brand-charcoal">{program.client_name}</span>
                    ) : (
                      <span className="text-brand-silver italic">No client yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-brand-charcoal/70">{program.estimate_count}</td>
                  <td className="px-4 py-3 text-right">
                    {program.latest_total != null ? (
                      <span className="text-brand-charcoal tabular-nums">
                        ${Math.round(program.latest_total).toLocaleString('en-US')}
                      </span>
                    ) : (
                      <span className="text-brand-silver">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-brand-charcoal/70">{formatDate(program.event_date)}</td>
                  <td className="px-4 py-3 text-brand-silver">{formatDate(program.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
