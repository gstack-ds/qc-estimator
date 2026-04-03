'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createEstimate } from '@/app/(programs)/programs/actions';

interface Props {
  programId: string;
}

type EstimateType = 'venue' | 'av';

const TYPE_LABELS: Record<EstimateType, string> = {
  venue: 'Venue',
  av: 'AV',
};

export default function AddEstimateButton({ programId }: Props) {
  const router = useRouter();
  const [type, setType] = useState<EstimateType>('venue');
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    setLoading(true);
    const result = await createEstimate(programId, type);
    if (result.id) router.push(`/programs/${programId}/estimates/${result.id}`);
    else setLoading(false);
  }

  return (
    <div className="flex items-center gap-0 rounded overflow-hidden border border-brand-brown">
      <select
        value={type}
        onChange={(e) => setType(e.target.value as EstimateType)}
        className="bg-white text-brand-brown text-sm font-medium px-3 py-2 border-r border-brand-brown focus:outline-none"
        aria-label="Estimate type"
      >
        {(Object.keys(TYPE_LABELS) as EstimateType[]).map((t) => (
          <option key={t} value={t}>{TYPE_LABELS[t]}</option>
        ))}
        <option value="" disabled>Decor (coming soon)</option>
      </select>
      <button
        onClick={handleAdd}
        disabled={loading}
        className="bg-brand-brown text-white text-sm font-medium px-4 py-2 hover:bg-brand-charcoal disabled:opacity-50 transition-colors"
      >
        {loading ? 'Creating…' : 'Add Estimate'}
      </button>
    </div>
  );
}
