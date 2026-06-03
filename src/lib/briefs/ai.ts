/**
 * AI synthesis for the Onsite Brief — calls Claude API with uploaded documents
 * and relevant Gmail threads, returns drafted section content.
 *
 * This module is server-only (uses ANTHROPIC_API_KEY + GMAIL_* env vars).
 */

import Anthropic from '@anthropic-ai/sdk';
import type { DocumentBlockParam } from '@anthropic-ai/sdk/resources';

const MAX_EMAIL_CHARS = 12_000; // rough cap to stay within token budget
const MAX_DOC_BYTES   = 20 * 1024 * 1024; // 20 MB per file

// ─── Gmail search ──────────────────────────────────────────

interface EmailSnippet {
  subject: string;
  body: string;
  receivedAt: string;
}

async function searchGmailForProgram(
  clientName: string | null,
  venueName: string | null,
  programName: string,
): Promise<EmailSnippet[]> {
  if (!process.env.GMAIL_REFRESH_TOKEN || !process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    return [];
  }

  try {
    const { google } = await import('googleapis');
    const auth = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob',
    );
    auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

    const gmail = google.gmail({ version: 'v1', auth });

    // Build a broad search query using any combination of identifiers
    const terms = [programName, clientName, venueName].filter(Boolean).map(t => `"${t}"`);
    if (terms.length === 0) return [];
    const q = `(${terms.join(' OR ')}) newer_than:180d -subject:"out of office" -subject:"unsubscribe"`;

    const listRes = await gmail.users.messages.list({ userId: 'me', q, maxResults: 15 });
    const messages = listRes.data.messages ?? [];

    const snippets: EmailSnippet[] = [];
    for (const msg of messages.slice(0, 10)) {
      if (!msg.id) continue;
      try {
        const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
        const headers = full.data.payload?.headers ?? [];
        const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value ?? '(no subject)';
        const date = headers.find(h => h.name?.toLowerCase() === 'date')?.value ?? '';

        // Extract plain-text body
        function extractText(payload: typeof full.data.payload): string {
          if (!payload) return '';
          if (payload.mimeType === 'text/plain' && payload.body?.data) {
            return Buffer.from(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
          }
          for (const part of payload.parts ?? []) {
            const t = extractText(part as typeof full.data.payload);
            if (t) return t;
          }
          return '';
        }

        const body = extractText(full.data.payload).slice(0, 3000);
        if (body) snippets.push({ subject, body, receivedAt: date });
      } catch {
        // skip individual message failures
      }
    }
    return snippets;
  } catch {
    return [];
  }
}

// ─── Document loading from Supabase Storage ────────────────

interface LoadedDoc {
  fileName: string;
  category: string;
  mimeType: string;
  base64: string;
}

async function loadDocumentsFromStorage(
  storagePaths: { storagePath: string; fileName: string; category: string; mimeType: string }[],
): Promise<LoadedDoc[]> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const loaded: LoadedDoc[] = [];
  for (const doc of storagePaths) {
    try {
      const { data: blob, error } = await supabase.storage
        .from('estimate-attachments')
        .download(doc.storagePath);
      if (error || !blob) continue;
      const buf = await blob.arrayBuffer();
      if (buf.byteLength > MAX_DOC_BYTES) continue; // skip oversized files
      const base64 = Buffer.from(buf).toString('base64');
      loaded.push({ fileName: doc.fileName, category: doc.category, mimeType: doc.mimeType, base64 });
    } catch {
      // skip files that fail to load
    }
  }
  return loaded;
}

// ─── Claude synthesis ──────────────────────────────────────

export interface AiSynthesisInput {
  programName: string;
  clientName: string | null;
  venueName: string | null;
  eventDate: string | null;
  guestCount: number;
  structuredContext: string; // the structured sections as text context
  documents: { storagePath: string; fileName: string; category: string; mimeType: string }[];
}

export interface AiSynthesisOutput {
  menuBar: string;
  dietaryRestrictions: string;
  dayOfLogistics: string;
  contractTerms: string;
  openItems: string;
  summary: string;
  sourcesUsed: string[];
}

const SYSTEM_PROMPT = `You are an expert event planner assistant drafting an onsite event brief for the QC Event Design team.
Your job: extract and synthesize information from the provided documents and emails to draft specific sections of an onsite brief.
Rules:
- Be specific. Use actual numbers, names, dates, and dollar amounts from the documents.
- Flag anything uncertain with "TBD — confirm before event" or "⚠ Verify: [what to verify]".
- Never invent details that are not in the source documents.
- For financial numbers (gratuity rates, fees, etc.), show the source: "(per contract)" or "(per invoice)".
- Flag discrepancies explicitly: "⚠ DISCREPANCY: contract says X but invoice shows Y — confirm before event".
- Keep each section concise and scannable — the team reads this on their phone on event day.
- Use plain text formatting (no markdown headers, no bullet symbols — use simple line breaks and dashes).
Return your response as a valid JSON object with these exact keys:
menuBar, dietaryRestrictions, dayOfLogistics, contractTerms, openItems, summary`;

export async function synthesizeAiSections(input: AiSynthesisInput): Promise<AiSynthesisOutput> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Load documents from storage
  const loadedDocs = await loadDocumentsFromStorage(input.documents);

  // Search Gmail
  const emails = await searchGmailForProgram(input.clientName, input.venueName, input.programName);
  const emailText = emails.length > 0
    ? emails.map(e => `--- EMAIL: ${e.subject} (${e.receivedAt}) ---\n${e.body}`).join('\n\n').slice(0, MAX_EMAIL_CHARS)
    : '(no relevant emails found)';

  const sourcesUsed = [
    ...loadedDocs.map(d => `${d.fileName} (${d.category})`),
    emails.length > 0 ? `${emails.length} Gmail thread(s)` : null,
  ].filter(Boolean) as string[];

  // Build content blocks — documents first, then text context
  const contentBlocks: (DocumentBlockParam | Anthropic.Messages.TextBlockParam)[] = [];

  for (const doc of loadedDocs) {
    if (doc.mimeType === 'application/pdf') {
      contentBlocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: doc.base64 },
        title: `${doc.category}: ${doc.fileName}`,
      } as DocumentBlockParam);
    }
    // Images and other types sent as base64 text summary (not native blocks)
  }

  const userPrompt = `
PROGRAM: ${input.programName}
CLIENT: ${input.clientName ?? 'TBD'}
VENUE: ${input.venueName ?? 'TBD'}
EVENT DATE: ${input.eventDate ?? 'TBD'}
GUESTS: ${input.guestCount}

=== STRUCTURED PROGRAM DATA (already in brief — use for cross-referencing) ===
${input.structuredContext}

=== GMAIL THREADS (relevant emails) ===
${emailText}

Based on all documents and emails above, draft these six sections of the onsite brief as JSON:

1. menuBar — Full menu and bar details: courses, dishes, pricing if applicable, bar package, NA options. Flag any items not yet confirmed.
2. dietaryRestrictions — Known dietary needs (allergies, preferences). Cross-reference against menu items and flag conflicts (e.g., "⚠ Nut allergy noted — verify lobster bisque has no cross-contamination").
3. dayOfLogistics — Day-of timeline (load-in, setup, event start/end, teardown), key contacts on-site, parking/access notes. Include anything time-sensitive.
4. contractTerms — Key terms the onsite lead must know: deposit status, final guest count deadline, menu selection deadline, gratuity/service charge rates, cancellation policy, payment terms, room rental details, corkage, what is/isn't included. Show source document for each term.
5. openItems — Bulleted list of unresolved items, TBDs, discrepancies, or things to confirm before event day. Include who is responsible if known.
6. summary — 2-3 sentence plain-English summary for the onsite lead. What type of event, key watch-outs, and one action item.

Return ONLY valid JSON with keys: menuBar, dietaryRestrictions, dayOfLogistics, contractTerms, openItems, summary.`;

  contentBlocks.push({ type: 'text', text: userPrompt });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: contentBlocks }],
    });

    const text = (response.content.find(c => c.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]) as Partial<AiSynthesisOutput>;
    return {
      menuBar:              parsed.menuBar ?? '(no data extracted — upload a menu PDF)',
      dietaryRestrictions:  parsed.dietaryRestrictions ?? '(no dietary information found)',
      dayOfLogistics:       parsed.dayOfLogistics ?? '(no day-of details found — check emails and documents)',
      contractTerms:        parsed.contractTerms ?? '(no contract uploaded — upload contract PDF to extract terms)',
      openItems:            parsed.openItems ?? '(no open items identified)',
      summary:              parsed.summary ?? '(could not generate summary)',
      sourcesUsed,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI synthesis failed';
    const fallback = `[AI synthesis failed: ${msg}. Upload documents and retry.]`;
    return {
      menuBar: fallback, dietaryRestrictions: fallback,
      dayOfLogistics: fallback, contractTerms: fallback,
      openItems: fallback, summary: fallback,
      sourcesUsed,
    };
  }
}
