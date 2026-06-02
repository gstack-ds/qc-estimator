'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PROGRAM_STATUSES, STATUS_LABELS, type ProgramStatus } from '@/lib/programs/constants';
import { updateProgramStatus } from '@/app/(programs)/programs/actions';

interface Props {
  programId: string;
  status: ProgramStatus;
}

export default function ProgramStatusDropdown({ programId, status }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as ProgramStatus;
    startTransition(async () => {
      const { error } = await updateProgramStatus(programId, next);
      if (error) { alert(error); return; }
      router.refresh();
    });
  }

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={isPending}
      className="text-xs border border-brand-cream rounded px-2 py-1 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper disabled:opacity-50"
    >
      {PROGRAM_STATUSES.map((s) => (
        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
      ))}
    </select>
  );
}
