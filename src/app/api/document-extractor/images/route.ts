import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { extractPDFImages } from '@/lib/documentExtractor/pdfImages';
import { extractDocxImages } from '@/lib/documentExtractor/docxExtract';

export const maxDuration = 60;

const FILE_SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB

// Module-level admin client — service role bypasses RLS for storage reads/deletes
const adminClient = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { storagePath?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { storagePath } = body;
  if (!storagePath) return NextResponse.json({ error: 'storagePath is required' }, { status: 400 });

  // Security: only allow paths the authenticated user uploaded
  const expectedPrefix = `extractor-temp/${user.id}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: 'Invalid storage path' }, { status: 403 });
  }

  const pathLower = storagePath.toLowerCase();
  const isPDF = pathLower.endsWith('.pdf');
  const isDOCX = pathLower.endsWith('.docx');
  if (!isPDF && !isDOCX) {
    return NextResponse.json({ error: 'Only PDF and .docx files are supported' }, { status: 400 });
  }

  // Download from storage (service role bypasses RLS)
  const { data: blob, error: downloadError } = await adminClient.storage
    .from('estimate-attachments')
    .download(storagePath);

  if (downloadError || !blob) {
    const msg = downloadError?.message ?? 'File not found';
    return NextResponse.json({ error: `Storage download failed: ${msg}` }, { status: 500 });
  }

  const fileBuffer = Buffer.from(await blob.arrayBuffer());

  if (fileBuffer.length > FILE_SIZE_LIMIT) {
    await adminClient.storage.from('estimate-attachments').remove([storagePath]).catch(() => {});
    return NextResponse.json({
      error: `File is ${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB — exceeds the 50 MB limit.`,
    }, { status: 400 });
  }

  try {
    let extracted: Array<{ name: string; mimeType: string; data: Buffer }>;

    if (isPDF) {
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
  } finally {
    // Always clean up the temp file
    await adminClient.storage.from('estimate-attachments').remove([storagePath]).catch(() => {});
  }
}
