'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DbProgramSummary } from '@/lib/supabase/queries';
import { PROGRAM_STATUSES, STATUS_LABELS, type ProgramStatus } from '@/lib/programs/constants';
import { updateProgramStatus } from '@/app/(programs)/programs/actions';
import MergeProgramsDialog from '@/components/programs/MergeProgramsDialog';

interface Props {
  programs: DbProgramSummary[];
}

const STATUS_TABS: ProgramStatus[] = ['active', 'completed', 'did_not_book'];

type SortKey = 'event_date' | 'name' | 'client_name' | 'updated_at';
type SortDir = 'asc' | 'desc';

function formatDate(val: string | null) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const cellSelectCls =
  'w-full text-xs bg-transparent border border-brand-cream rounded px-1.5 py-1 text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper';

export default function ProgramsTable({ programs }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ProgramStatus>('active');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('event_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const counts = useMemo(() => ({
    active: programs.filter((p) => p.status === 'active').length,
    completed: programs.filter((p) => p.status === 'completed').length,
    did_not_book: programs.filter((p) => p.status === 'did_not_book').length,
  }), [programs]);

  const allTypes = useMemo(() => {
    const types = programs.map((p) => p.program_type).filter((t): t is string => !!t);
    return [...new Set(types)].sort();
  }, [programs]);

  const filtered = useMemo(() => {
    let base = programs.filter((p) => p.status === activeTab);
    if (query.trim()) {
      const q = query.toLowerCase();
      base = base.filter((p) =>
        p.name.toLowerCase().includes(q) || (p.client_name ?? '').toLowerCase().includes(q)
      );
    }
    if (typeFilter) {
      base = base.filter((p) => p.program_type === typeFilter);
    }
    return [...base].sort((a, b) => {
      let av = a[sortKey] ?? '';
      let bv = b[sortKey] ?? '';
      // Nulls always last regardless of direction
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [programs, activeTab, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <span className="ml-1 text-brand-cream">↕</span>;
    return <span className="ml-1 text-brand-copper">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  function handleStatusChange(programId: string, newStatus: ProgramStatus) {
    startTransition(async () => {
      const { error } = await updateProgramStatus(programId, newStatus);
      if (error) { alert(error); return; }
      router.refresh();
    });
  }

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="border-b border-brand-cream pb-3">
        <div className="flex items-center gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSelectedIds(new Set()); }}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-brand-charcoal text-white'
                  : 'text-brand-charcoal/60 hover:text-brand-charcoal hover:bg-brand-cream/50'
              }`}
            >
              {STATUS_LABELS[tab]}
              <span className={`ml-1.5 text-[10px] ${activeTab === tab ? 'opacity-70' : 'text-brand-silver'}`}>
                {counts[tab]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search + type filter + merge */}
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search programs or clients…"
          className="w-full max-w-sm border border-brand-cream rounded px-3 py-2 text-sm bg-white text-brand-charcoal placeholder:text-brand-silver focus:outline-none focus:ring-2 focus:ring-brand-copper focus:border-brand-brown transition-colors"
        />
        {allTypes.length > 0 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-brand-cream rounded px-3 py-2 text-sm bg-white text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-copper focus:border-brand-brown transition-colors"
          >
            <option value="">All types</option>
            {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {selectedIds.size >= 2 && (
          <button
            onClick={() => setShowMergeDialog(true)}
            className="text-xs font-medium rounded px-3 py-2 border border-brand-copper text-brand-copper hover:bg-brand-copper/10 transition-colors whitespace-nowrap"
          >
            Merge {selectedIds.size} selected
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-brand-cream rounded-lg">
          <p className="text-sm text-brand-silver">
            {query ? 'No programs match your search.' : `No ${STATUS_LABELS[activeTab].toLowerCase()} programs.`}
          </p>
          {!query && activeTab === 'active' && (
            <Link href="/programs/new" className="text-brand-brown text-sm hover:text-brand-charcoal mt-2 inline-block transition-colors">
              Create your first program →
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-brand-cream overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-brand-offwhite border-b border-brand-cream">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && filtered.every((p) => selectedIds.has(p.id))}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(filtered.map((p) => p.id)));
                      else setSelectedIds(new Set());
                    }}
                    className="accent-brand-brown"
                  />
                </th>
                <th
                  className="text-left px-4 py-3 font-medium text-brand-charcoal/70 text-xs tracking-wide uppercase cursor-pointer hover:text-brand-charcoal select-none"
                  onClick={() => toggleSort('name')}
                >Program{sortIcon('name')}</th>
                <th
                  className="text-left px-4 py-3 font-medium text-brand-charcoal/70 text-xs tracking-wide uppercase cursor-pointer hover:text-brand-charcoal select-none"
                  onClick={() => toggleSort('client_name')}
                >Client{sortIcon('client_name')}</th>
                <th className="text-right px-4 py-3 font-medium text-brand-charcoal/70 text-xs tracking-wide uppercase w-24">Estimates</th>
                <th className="text-right px-4 py-3 font-medium text-brand-charcoal/70 text-xs tracking-wide uppercase w-32">Latest Total</th>
                <th
                  className="text-left px-4 py-3 font-medium text-brand-charcoal/70 text-xs tracking-wide uppercase w-36 cursor-pointer hover:text-brand-charcoal select-none"
                  onClick={() => toggleSort('event_date')}
                >Event Date{sortIcon('event_date')}</th>
                <th
                  className="text-left px-4 py-3 font-medium text-brand-charcoal/70 text-xs tracking-wide uppercase w-36 cursor-pointer hover:text-brand-charcoal select-none"
                  onClick={() => toggleSort('updated_at')}
                >Last Updated{sortIcon('updated_at')}</th>
                <th className="text-left px-4 py-3 font-medium text-brand-charcoal/70 text-xs tracking-wide uppercase w-36">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-cream/60">
              {filtered.map((program) => (
                <tr
                  key={program.id}
                  className="hover:bg-brand-offwhite transition-colors cursor-pointer"
                  onClick={() => router.push(`/programs/${program.id}`)}
                >
                  <td className="px-4 py-3" onClick={stopProp}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(program.id)}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(program.id); else next.delete(program.id);
                          return next;
                        });
                      }}
                      className="accent-brand-brown"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/programs/${program.id}`}
                      className="font-medium text-brand-brown hover:text-brand-charcoal transition-colors"
                      onClick={stopProp}
                    >
                      {program.name}
                    </Link>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {program.lead_id && (
                        <Link
                          href={`/leads/${program.lead_id}`}
                          onClick={stopProp}
                          className="text-[10px] text-brand-silver hover:text-brand-brown transition-colors"
                        >
                          ← Lead
                        </Link>
                      )}
                      {program.program_type && (
                        <span className="text-[10px] font-medium bg-brand-charcoal/10 text-brand-charcoal/70 rounded px-1.5 py-0.5">
                          {program.program_type}
                        </span>
                      )}
                      {program.staffing_needs_count > 0 && (
                        <span className="text-[10px] font-medium bg-red-100 text-red-700 rounded px-1.5 py-0.5">
                          Staffing: {program.staffing_needs_count} open
                        </span>
                      )}
                      {program.unread_response_count > 0 && (
                        <Link
                          href={`/programs/${program.id}/budget#client-responses`}
                          onClick={stopProp}
                          className="text-[10px] font-semibold bg-amber-500 text-white rounded-full px-2 py-0.5 hover:bg-amber-600 transition-colors"
                        >
                          {program.unread_response_count} new response{program.unread_response_count === 1 ? '' : 's'} →
                        </Link>
                      )}
                    </div>
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
                  <td className="px-4 py-3" onClick={stopProp}>
                    <select
                      value={program.status}
                      onChange={(e) => handleStatusChange(program.id, e.target.value as ProgramStatus)}
                      className={cellSelectCls}
                    >
                      {PROGRAM_STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showMergeDialog && selectedIds.size >= 2 && (
        <MergeProgramsDialog
          programIds={[...selectedIds]}
          onClose={() => { setShowMergeDialog(false); setSelectedIds(new Set()); }}
        />
      )}
    </div>
  );
}
