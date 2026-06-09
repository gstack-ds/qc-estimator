import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { DocumentBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { extractDocxText } from '@/lib/documentExtractor/docxExtract';
import { normalizeExtractedProfile, emptyProfile } from '@/lib/vendors/extractedVendorTypes';

export const maxDuration = 300;

const VALID_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
  'claude-opus-4-8',
] as const;
type Model = (typeof VALID_MODELS)[number];

const FILE_SIZE_LIMIT = 30 * 1024 * 1024;

const VENDOR_EXTRACTION_PROMPT = `You are extracting structured vendor profile data from a document for an event planning company. Return ONLY a JSON object — no markdown, no commentary.

Extract exactly what the document contains. Use empty arrays when data is absent; never invent data.

Return this exact JSON shape:
{
  "vendor": {
    "name": "string or omit if not found",
    "address": "street address or omit",
    "city": "city name or omit",
    "state": "2-letter state code or omit",
    "market": "market/region name (e.g. Charlotte, Nashville) or omit",
    "website": "URL or omit",
    "contact_name": "full name or omit",
    "contact_title": "job title or omit",
    "contact_email": "email address or omit",
    "contact_phone": "phone number or omit",
    "spaces": [
      {
        "name": "space/room name (required)",
        "capacity_seated": 200,
        "capacity_standing": 350,
        "fb_minimum": 15000
      }
    ],
    "menus": [
      {
        "id": "menu-1",
        "name": "menu package name",
        "price_per_person": 95.00,
        "description": "optional description",
        "courses": [
          {
            "id": "course-1",
            "name": "course name (e.g. Appetizers, Entrees)",
            "selection_rule": "Choose 2 (optional)",
            "items": [
              {
                "id": "item-1",
                "name": "dish name",
                "description": "optional",
                "dietary_tags": ["V","VG","GF","DF","NF"],
                "price": null
              }
            ]
          }
        ]
      }
    ],
    "bar_options": [
      {
        "id": "bar-1",
        "name": "bar package name",
        "price_per_person": 45.00,
        "description": "optional",
        "categories": [
          {
            "id": "cat-1",
            "name": "Spirits",
            "brands": ["Absolut","Bacardi"]
          }
        ],
        "notes": "optional"
      }
    ],
    "inclusions": [
      "Tables and chairs included",
      "Day-of coordinator provided"
    ]
  }
}

Notes:
- dietary_tags: only use these exact values: V (Vegetarian), VG (Vegan), GF (Gluten-Free), DF (Dairy-Free), NF (Nut-Free). Omit the field if none apply.
- price fields: use numbers, not strings. Use null if no price listed.
- capacities: use integers. Use null if not stated.
- spaces: include all rooms/event spaces found.
- menus: include all menus/packages found, even if they share the same items. Extract ALL items in each menu.
- inclusions: short plain-English strings only.
- Do NOT include fields with null or empty values unless the field is required.`;

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
      error: `File is ${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB — exceeds the 30 MB limit.`,
    }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let rawResponse: string;

  try {
    if (isPDF) {
      const base64 = fileBuffer.toString('base64');
      const docBlock: DocumentBlockParam = {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      };
      const textBlock: TextBlockParam = { type: 'text', text: VENDOR_EXTRACTION_PROMPT };
      const response = await anthropic.messages.create({
        model: model as Model,
        max_tokens: 16000,
        messages: [{ role: 'user', content: [docBlock, textBlock] }],
      });
      rawResponse = (response.content.find((c) => c.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '';
    } else {
      const docText = await extractDocxText(fileBuffer);
      if (!docText.trim()) {
        return NextResponse.json({ vendor: emptyProfile(), warning: 'No readable text found in this document.' });
      }
      const prompt = `${VENDOR_EXTRACTION_PROMPT}\n\nDocument text follows:\n\n${docText}`;
      const response = await anthropic.messages.create({
        model: model as Model,
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }],
      });
      rawResponse = (response.content.find((c) => c.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '';
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'API call failed';
    console.error('[document-extractor/vendor]', msg);
    return NextResponse.json({ error: `Extraction failed: ${msg}` }, { status: 500 });
  } finally {
    await adminClient.storage.from('estimate-attachments').remove([storagePath]).catch(() => {});
  }

  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? rawResponse) as { vendor?: unknown };
    const vendor = normalizeExtractedProfile(parsed.vendor ?? parsed);
    return NextResponse.json({ vendor });
  } catch {
    return NextResponse.json({ vendor: emptyProfile(), warning: 'Could not parse extraction result.' });
  }
}
