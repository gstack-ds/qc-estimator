// Tool-use RAG loop for the in-app chatbot. Extracted from the route so the loop — especially
// the HARD 5-round stop and the sources collection — is unit-testable with a mocked Anthropic
// client and mock DB. Server-only by usage (the route injects the key + clients); no next/headers
// import here, so it stays testable in Vitest.
import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { callTool, RETRIEVAL_TOOLS } from '@/lib/retrieval';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// The LOAD-BEARING field: the actual clientSafe rows/values retrieved for the answer, complete
// enough for the UI (Stage 5) to show the user the real numbers beside the prose. Not a summary.
export interface ChatSource {
  tool: string;
  input: unknown;
  data: unknown;
}

export interface ChatResult {
  answer: string;
  sources: ChatSource[];
  capped: boolean;
}

export const MAX_TOOL_ROUNDS = 5;
const MODEL = 'claude-sonnet-4-6';

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

export async function runChatTurn(opts: {
  anthropic: Anthropic;
  db: SupabaseClient;
  system: string;
  messages: ChatMessage[];
  maxRounds?: number;
}): Promise<ChatResult> {
  const { anthropic, db, system, maxRounds = MAX_TOOL_ROUNDS } = opts;

  // Working message list in Anthropic format. Conversation history arrives as plain text turns
  // (tool_use/tool_result blocks live only inside this loop and are discarded after — ephemeral).
  const messages: Anthropic.MessageParam[] = opts.messages.map((m) => ({ role: m.role, content: m.content }));
  const sources: ChatSource[] = [];

  for (let round = 0; ; round++) {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      // Prompt-cache the stable system prompt + tool defs (rendered before the volatile messages).
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools: RETRIEVAL_TOOLS as unknown as Anthropic.Tool[],
      messages,
    });

    if (resp.stop_reason !== 'tool_use') {
      return { answer: textOf(resp.content), sources, capped: false };
    }

    // HARD stop: the model still wants tools after maxRounds rounds of execution. Never loop
    // unbounded — terminate and return what we have. Cost + hang guard.
    if (round >= maxRounds) {
      return {
        answer:
          "I couldn't finish that within the allowed number of steps. Try asking a narrower question.",
        sources,
        capped: true,
      };
    }

    messages.push({ role: 'assistant', content: resp.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of resp.content) {
      if (block.type !== 'tool_use') continue;
      let data: unknown;
      try {
        // clientSafe:true → the chatbot can never reach internal margin/cost/commission data.
        data = await callTool(db, block.name, block.input as Record<string, unknown>, { clientSafe: true });
      } catch (e) {
        data = { error: (e as Error).message };
      }
      sources.push({ tool: block.name, input: block.input, data });
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(data) });
    }

    messages.push({ role: 'user', content: toolResults });
  }
}
