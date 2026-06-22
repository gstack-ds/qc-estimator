'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ShareLinkRow, ShareLinkStatus } from '@/lib/supabase/queries';
import { revokeShareLink, revokeAllActiveShareLinks } from '@/app/(programs)/share-links/actions';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLE: Record<ShareLinkStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  revoked: 'bg-gray-100 text-gray-500 border-gray-200',
  expired: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function ShareLinksDashboard({ links }: { links: ShareLinkRow[] }) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const activeCount = links.filter((l) => l.status === 'active').length;
  const visible = showAll ? links : links.filter((l) => l.status === 'active');

  function revokeOne(id: string) {
    if (!confirm('Revoke this link? Anyone who has it will immediately see an "expired" page.')) return;
    setError(null);
    startTransition(async () => {
      const r = await revokeShareLink(id);
      if (r.error) { setError(r.error); return; }
      router.refresh();
    });
  }

  function revokeAll() {
    if (activeCount === 0) return;
    if (!confirm(`Revoke ALL ${activeCount} active link${activeCount === 1 ? '' : 's'}? Every client budget link will immediately go dead.`)) return;
    setError(null);
    startTransition(async () => {
      const r = await revokeAllActiveShareLinks();
      if (r.error) { setError(r.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-brand-silver">
          {activeCount} active link{activeCount === 1 ? '' : 's'}
          {showAll && ` · ${links.length} total`}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-brand-silver cursor-pointer">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-brand-copper cursor-pointer" />
            Show revoked &amp; expired
          </label>
          <button
            onClick={revokeAll}
            disabled={busy || activeCount === 0}
            className="text-sm border border-red-200 text-red-600 rounded-md px-3 py-1.5 hover:bg-red-50 disabled:opacity-40"
          >
            Revoke all active
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

      {visible.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-brand-cream rounded-xl bg-white">
          <p className="text-brand-charcoal font-medium">{showAll ? 'No share links yet' : 'No active share links'}</p>
          <p className="text-sm text-brand-silver mt-1">Client budget links are generated from a program’s Budget tab.</p>
        </div>
      ) : (
        <div className="border border-brand-cream rounded-xl overflow-hidden bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-brand-offwhite text-left text-[10px] uppercase tracking-widest text-brand-silver">
                <th className="px-4 py-2.5 font-medium">Program</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Generated</th>
                <th className="px-4 py-2.5 font-medium">Expires</th>
                <th className="px-4 py-2.5 font-medium text-right">Views</th>
                <th className="px-4 py-2.5 font-medium">Last viewed</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id} className="border-t border-brand-cream/70">
                  <td className="px-4 py-2.5 text-brand-charcoal">
                    {l.programId ? (
                      <Link href={`/programs/${l.programId}/budget`} className="hover:text-brand-brown transition-colors">
                        {l.programName}
                      </Link>
                    ) : l.programName}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLE[l.status]}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-brand-silver">{fmtDate(l.createdAt)}</td>
                  <td className="px-4 py-2.5 text-brand-silver">{fmtDate(l.expiresAt)}</td>
                  <td className="px-4 py-2.5 text-right text-brand-charcoal tabular-nums">{l.viewCount}</td>
                  <td className="px-4 py-2.5 text-brand-silver">{l.lastViewedAt ? fmtDate(l.lastViewedAt) : '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    {l.status === 'active' && (
                      <button onClick={() => revokeOne(l.id)} disabled={busy} className="text-xs text-brand-silver hover:text-red-500 disabled:opacity-40">
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
