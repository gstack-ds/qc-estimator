import { NextRequest, NextResponse } from 'next/server';
import { renderPdf } from '@/lib/deck/renderPdf';
import type { DeckRenderRequest } from '@/lib/deck/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as DeckRenderRequest;

  if (!body?.slides || !Array.isArray(body.slides) || body.slides.length === 0) {
    return NextResponse.json({ error: 'slides array is required' }, { status: 400 });
  }

  try {
    const pdfBuffer = await renderPdf(body.slides);
    const pdf = pdfBuffer.toString('base64');
    return NextResponse.json({ pdf });
  } catch (e) {
    console.error('[render-deck] failed:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
