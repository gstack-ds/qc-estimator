import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { DocumentBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { extractDocxText } from '@/lib/documentExtractor/docxExtract';

export const maxDuration = 300;

const VALID_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
  'claude-opus-4-8',
] as const;
type Model = (typeof VALID_MODELS)[number];

// Claude's document API supports up to ~32 MB; stay under it with headroom
const FILE_SIZE_LIMIT = 30 * 1024 * 1024;

const EXTRACTION_PROMPT = `You are extracting structured content from a vendor document for an event planning company.

Extract all meaningful information and organize it into clear labeled sections. Focus on:
- Menu items, food courses, and per-person prices
- Bar packages, beverage options, and drink minimums
- Room/space names, capacities, and descriptions
- F&B minimums, room fees, service charges, and gratuity rates
- Packages and what's included vs. extra cost
- Contact information (name, title, phone, email)
- Any other business-relevant details

Skip purely decorative content, mission statements, and marketing boilerplate. For very long documents with many image-heavy pages, focus on pages that contain readable pricing, menu, or venue detail text.

Return ONLY valid JSON in this exact format — no markdown, no commentary:
{
  "sections": [
    { "title": "Section Name", "content": "Extracted content as plain readable text." }
  ]
}

If the document contains very little readable text (e.g., mostly photos), include a single section titled "Note" with a brief explanation.`;

const LARGE_FILE_HINT = '\n\nThis is a large document. Prioritize pages with readable text content (menus, pricing tables, room specs, contact info). Skip pages that are purely decorative photography or full-page images with no useful text.';

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

  let body: { storagePath?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { storagePath, model = 'claude-sonnet-4-6' } = body;

  if (!storagePath) return NextResponse.json({ error: 'storagePath is required' }, { status: 400 });

  // Security: only allow paths the authenticated user uploaded
  const expectedPrefix = `extractor-temp/${user.id}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: 'Invalid storage path' }, { status: 403 });
  }

  if (!VALID_MODELS.includes(model as Model)) {
    return NextResponse.json({ error: 'Invalid model' }, { status: 400 });
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
      error: `File is ${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB — exceeds the 30 MB limit for text extraction.`,
    }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let rawResponse: string;

  try {
    if (isPDF) {
      const base64 = fileBuffer.toString('base64');
      const largeHint = fileBuffer.length > 5 * 1024 * 1024 ? LARGE_FILE_HINT : '';
      const docBlock: DocumentBlockParam = {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      };
      const textBlock: TextBlockParam = { type: 'text', text: EXTRACTION_PROMPT + largeHint };
      const response = await anthropic.messages.create({
        model: model as Model,
        max_tokens: 8192,
        messages: [{ role: 'user', content: [docBlock, textBlock] }],
      });
      rawResponse = (response.content.find((c) => c.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '';
    } else {
      const docText = await extractDocxText(fileBuffer);
      if (!docText.trim()) {
        return NextResponse.json({
          sections: [{ title: 'Note', content: 'No readable text found in this document. It may consist entirely of images or embedded objects.' }],
        });
      }
      const largeHint = fileBuffer.length > 5 * 1024 * 1024 ? LARGE_FILE_HINT : '';
      const prompt = `${EXTRACTION_PROMPT + largeHint}\n\nDocument text follows:\n\n${docText}`;
      const response = await anthropic.messages.create({
        model: model as Model,
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      });
      rawResponse = (response.content.find((c) => c.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '';
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'API call failed';
    console.error('[document-extractor/text]', msg);
    return NextResponse.json({ error: `Extraction failed: ${msg}` }, { status: 500 });
  } finally {
    // Always clean up the temp file regardless of success or failure
    await adminClient.storage.from('estimate-attachments').remove([storagePath]).catch(() => {});
  }

  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? rawResponse) as { sections: Array<{ title: string; content: string }> };
    if (!Array.isArray(parsed.sections)) throw new Error('sections is not an array');
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({
      sections: [{ title: 'Extracted Content', content: rawResponse }],
    });
  }
}
