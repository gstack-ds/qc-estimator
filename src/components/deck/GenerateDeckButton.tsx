'use client';

import { useState } from 'react';
import { Layers } from 'lucide-react';
import { generateDeckForEstimate, generateDeckForProgram } from '@/app/(programs)/deck/actions';

interface EstimateMode {
  mode: 'estimate';
  estimateId: string;
  filename: string;
}

interface ProgramMode {
  mode: 'program';
  programId: string;
  filename: string;
}

type Props = EstimateMode | ProgramMode;

export default function GenerateDeckButton(props: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const result =
        props.mode === 'estimate'
          ? await generateDeckForEstimate(props.estimateId)
          : await generateDeckForProgram(props.programId);

      if ('error' in result) {
        setError(result.error);
        return;
      }

      // Convert base64 PDF to a download
      const bytes = Uint8Array.from(atob(result.pdf), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${props.filename.replace(/[^\w\s-]/g, '').trim()}_deck.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="flex items-center gap-1.5 text-xs bg-brand-charcoal text-white rounded px-3 py-1.5 hover:bg-brand-brown transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={props.mode === 'program' ? 'Generate PDF deck for all proposal estimates' : 'Generate PDF deck for this estimate'}
      >
        <Layers size={12} />
        {generating ? 'Generating…' : 'Generate Deck'}
      </button>
      {error && (
        <p className="text-xs text-red-500 max-w-xs">{error}</p>
      )}
    </div>
  );
}
