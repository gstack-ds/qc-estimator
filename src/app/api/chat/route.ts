// In-app chatbot API — server-side, AUTH-GATED, read-only. Holds the Anthropic key server-side
// (never client) and runs retrieval via the session client (RLS-authed reads). The tool loop +
// clientSafe strip live in src/lib/chat + src/lib/retrieval.
//
// Stage 2: tool-use loop, auth gate, 5-round hard stop. No daily cap yet (Stage 3), no guardrail
// system prompt yet (Stage 6 — this placeholder is intentionally minimal).
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { runChatTurn, type ChatMessage } from '@/lib/chat/runChat';

export const runtime = 'nodejs';

// Placeholder — Stage 6 replaces this with the full pricing-accuracy guardrail prompt.
const SYSTEM_PROMPT = `You are a read-only assistant for the QC Event Design team. Answer questions about programs, estimates, venues, menus, and the leads pipeline using ONLY the data returned by the tools. If the tools don't return the information, say you don't have it. Never compute, estimate, or guess a price — quote figures exactly as the tools return them.`;

function validateMessages(v: unknown): ChatMessage[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > 50) return null;
  const out: ChatMessage[] = [];
  for (const m of v) {
    if (!m || typeof m !== 'object') return null;
    const role = (m as Record<string, unknown>).role;
    const content = (m as Record<string, unknown>).content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null;
    out.push({ role, content });
  }
  return out;
}

export async function POST(req: Request) {
  // ── Auth gate (server-side; reject unauthenticated direct calls — login-behind-page is not enough) ──
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Assistant is not configured.' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const messages = validateMessages((body as { messages?: unknown })?.messages);
  if (!messages) {
    return Response.json({ error: 'Body must be { messages: {role, content}[] } (1–50 turns).' }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const result = await runChatTurn({ anthropic, db: supabase, system: SYSTEM_PROMPT, messages });
    return Response.json(result);
  } catch (e) {
    console.error('[api/chat] error:', (e as Error).message);
    return Response.json({ error: 'The assistant hit an error. Please try again.' }, { status: 500 });
  }
}
