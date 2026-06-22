'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBudgetShare, revokeBudgetShare } from '@/app/(programs)/programs/[id]/budget/actions';
import type { ActiveBudgetShare } from '@/lib/supabase/queries';

interface Props {
  programId: string;
  documentId: string;
  activeShare: ActiveBudgetShare | null;
}

const EXPIRY_OPTIONS = [14, 30, 60];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BudgetSharePanel({ programId, documentId, activeShare }: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [expiryDays, setExpiryDays] = useState(30);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expired = activeShare ? new Date(activeShare.expires_at).getTime() <= Date.now() : false;
  const isLiveActive = !!activeShare && !expired;

  function generate() {
    setError(null);
    setLink(null);
    startTransition(async () => {
      const r = await createBudgetShare(programId, documentId, expiryDays);
      if (r.error || !r.token) { setError(r.error ?? 'Could not create link.'); return; }
      setLink(`${window.location.origin}/b/${r.token}`);
      setCopied(false);
      router.refresh();
    });
  }

  function revoke() {
    if (!activeShare) return;
    if (!confirm('Revoke this link? Anyone who has it will immediately see an "expired" page.')) return;
    setError(null);
    setLink(null);
    startTransition(async () => {
      const r = await revokeBudgetShare(activeShare.id, programId);
      if (r.error) { setError(r.error); return; }
      router.refresh();
    });
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border border-brand-cream rounded-xl p-5 bg-white space-y-4">
      <div>
        <h2 className="text-base font-serif text-brand-charcoal">Client share link</h2>
        <p className="text-xs text-brand-silver mt-0.5">
          A view-only link to the client-facing budget. It’s a snapshot taken when you generate it —
          edit the budget afterward and regenerate to push an update.
        </p>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

      {/* Current share status */}
      {activeShare && (
        <div className={`text-sm rounded-lg px-3 py-2 border ${expired ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-brand-offwhite border-brand-cream text-brand-charcoal'}`}>
          {expired ? 'Link expired' : 'Link active'} · expires {fmtDate(activeShare.expires_at)} ·{' '}
          {activeShare.view_count} view{activeShare.view_count === 1 ? '' : 's'}
          {activeShare.last_viewed_at && ` · last viewed ${fmtDate(activeShare.last_viewed_at)}`}
        </div>
      )}

      {/* Freshly generated link — shown once */}
      {link && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 border border-brand-cream rounded px-2 py-1.5 text-sm text-brand-charcoal bg-brand-offwhite font-mono"
            />
            <button onClick={copy} className="text-sm bg-brand-brown text-white rounded px-3 py-1.5 hover:bg-brand-brown/90 flex-shrink-0">
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
          <p className="text-[11px] text-amber-600">
            Copy this now — for security the full link isn’t shown again. Lost it? Just regenerate.
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-brand-silver">
          Expires in
          <select
            value={expiryDays}
            onChange={(e) => setExpiryDays(parseInt(e.target.value))}
            className="border border-brand-cream rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-copper"
          >
            {EXPIRY_OPTIONS.map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        </label>

        <button
          onClick={generate}
          disabled={busy}
          className="text-sm bg-brand-brown text-white rounded-md px-4 py-1.5 hover:bg-brand-brown/90 disabled:opacity-50"
        >
          {busy ? 'Working…' : isLiveActive ? 'Regenerate link' : 'Generate share link'}
        </button>

        {activeShare && (
          <button onClick={revoke} disabled={busy} className="text-sm text-brand-silver hover:text-red-500 disabled:opacity-50">
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}
