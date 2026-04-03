'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteProgram } from '@/app/(programs)/programs/actions';

interface Props {
  programId: string;
}

export default function DeleteProgramButton({ programId }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setDeleting(true);
    const result = await deleteProgram(programId);
    if (result.error) {
      setDeleting(false);
      setConfirming(false);
    } else {
      router.push('/programs');
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Delete this program and all its estimates?</span>
        <button
          onClick={() => setConfirming(false)}
          className="text-sm px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={deleting}
          className="text-sm px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-sm px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50"
    >
      Delete Program
    </button>
  );
}
