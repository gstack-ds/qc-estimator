'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Sparkles } from 'lucide-react';
import { generateOnsiteBrief } from '@/app/(programs)/programs/actions';

interface Props {
  programId: string;
  hasBrief: boolean;
}

export default function GenerateBriefButton({ programId, hasBrief }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateOnsiteBrief(programId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/programs/${programId}/brief`);
    });
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={handleGenerate}
        disabled={isPending}
        className="flex items-center gap-2 bg-brand-brown text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-brand-charcoal transition-colors disabled:opacity-60"
      >
        <Sparkles size={14} />
        {isPending ? 'Generating…' : hasBrief ? 'Regenerate Brief' : 'Generate Onsite Brief'}
      </button>
      {hasBrief && (
        <a
          href={`/programs/${programId}/brief`}
          className="flex items-center gap-1.5 text-sm text-brand-brown hover:text-brand-charcoal transition-colors underline-offset-2 hover:underline"
        >
          <FileText size={13} />
          View brief
        </a>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
