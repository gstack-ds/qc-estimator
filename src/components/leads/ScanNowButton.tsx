'use client';

import { useState } from 'react';

interface Toast {
  message: string;
  isError: boolean;
}

export default function ScanNowButton() {
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  function showToast(message: string, isError: boolean) {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleScan() {
    setScanning(true);
    try {
      const res = await fetch('/api/scanner/run', { method: 'POST' });
      const data: { leadsCreated?: number; emailsFound?: number; errors?: string[]; error?: string } = await res.json();
      if (!res.ok) {
        showToast(data.error ?? 'Scan failed', true);
        return;
      }
      const { leadsCreated = 0, errors = [] } = data;
      if (leadsCreated > 0) {
        showToast(`${leadsCreated} new lead${leadsCreated === 1 ? '' : 's'} found`, false);
      } else if (errors.length > 0) {
        showToast(`Scan completed with ${errors.length} error${errors.length === 1 ? '' : 's'}`, true);
      } else {
        showToast('No new leads', false);
      }
    } catch {
      showToast('Network error — scan failed', true);
    } finally {
      setScanning(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-brown text-white rounded hover:bg-brand-charcoal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scanning ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Scanning…
            </>
          ) : 'Scan Now'}
        </button>
        <span className="text-[10px] text-brand-silver">Auto-scans daily at 7am, 11am, 2pm, 4pm ET</span>
      </div>

      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium text-white ${toast.isError ? 'bg-red-600' : 'bg-brand-charcoal'}`}>
          {toast.message}
        </div>
      )}
    </>
  );
}
