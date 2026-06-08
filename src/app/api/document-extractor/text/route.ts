import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { DocumentBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources';
import { createClient } from '@/lib/supabase/server';
import { extractDocxText } from '@/lib/documentExtractor/docxExtract';

export const maxDuration = 300;

const VALID_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
  'claude-opus-4-8',
] as const;
type Model = (typeof VALID_MODELS)[number];

const FILE_SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB

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
  const model = (formData.get('model') as string | null) ?? 'claude-sonnet-4-6';

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!VALID_MODELS.includes(model as Model)) {
    return NextResponse.json({ error: 'Invalid model' }, { status: 400 });
  }
  if (file.size > FILE_SIZE_LIMIT) {
    return NextResponse.json({ error: `File exceeds 50 MB limit (got ${(file.size / 1024 / 1024).toFixed(1)} MB)` }, { status: 400 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let rawResponse: string;

  try {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const base64 = fileBuffer.toString('base64');
      const docBlock: DocumentBlockParam = {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      };
      const textBlock: TextBlockParam = { type: 'text', text: EXTRACTION_PROMPT };
      const response = await anthropic.messages.create({
        model: model as Model,
        max_tokens: 8192,
        messages: [{ role: 'user', content: [docBlock, textBlock] }],
      });
      rawResponse = (response.content.find((c) => c.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '';
    } else {
      // DOCX — extract XML text, pass as plain text to Claude
      const docText = await extractDocxText(fileBuffer);
      if (!docText.trim()) {
        return NextResponse.json({
          sections: [{ title: 'Note', content: 'No readable text found in this document. It may consist entirely of images or embedded objects.' }],
        });
      }
      const prompt = `${EXTRACTION_PROMPT}\n\nDocument text follows:\n\n${docText}`;
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
  }

  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? rawResponse) as { sections: Array<{ title: string; content: string }> };
    if (!Array.isArray(parsed.sections)) throw new Error('sections is not an array');
    return NextResponse.json(parsed);
  } catch {
    // Return raw response as a single section rather than failing silently
    return NextResponse.json({
      sections: [{ title: 'Extracted Content', content: rawResponse }],
    });
  }
}
