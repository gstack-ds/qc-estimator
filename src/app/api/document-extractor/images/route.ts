import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractPDFImages } from '@/lib/documentExtractor/pdfImages';
import { extractDocxImages } from '@/lib/documentExtractor/docxExtract';

export const maxDuration = 60;

const FILE_SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > FILE_SIZE_LIMIT) {
    return NextResponse.json({ error: `File exceeds 50 MB limit (got ${(file.size / 1024 / 1024).toFixed(1)} MB)` }, { status: 400 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  try {
    let extracted: Array<{ name: string; mimeType: string; data: Buffer }>;

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      extracted = extractPDFImages(fileBuffer);
    } else {
      extracted = await extractDocxImages(fileBuffer);
    }

    const images = extracted.map((img) => ({
      name: img.name,
      mimeType: img.mimeType,
      dataUrl: `data:${img.mimeType};base64,${img.data.toString('base64')}`,
    }));

    return NextResponse.json({ images });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Image extraction failed';
    console.error('[document-extractor/images]', msg);
    return NextResponse.json({ error: `Extraction failed: ${msg}` }, { status: 500 });
  }
}
