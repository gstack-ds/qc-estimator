import { describe, it, expect, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runChatTurn } from '../../src/lib/chat/runChat';

// Minimal supabase mock: from(table) → thenable builder resolving to configured rows.
function mockDb(rows: Record<string, Record<string, unknown>[]>): SupabaseClient {
  const from = (table: string) => {
    const b: Record<string, unknown> = {
      select: () => b, eq: () => b, ilike: () => b, or: () => b, gte: () => b, lte: () => b,
      in: () => b, not: () => b, order: () => b, limit: () => b, single: () => b,
      then: (onF: (v: unknown) => unknown) => Promise.resolve(onF({ data: rows[table] ?? [], error: null })),
    };
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

// Mock Anthropic whose messages.create returns a queued sequence of responses.
function mockAnthropic(responses: unknown[]): Anthropic {
  let i = 0;
  const create = vi.fn(async () => responses[Math.min(i++, responses.length - 1)]);
  return { messages: { create } } as unknown as Anthropic;
}

const toolUse = (name: string, input: Record<string, unknown> = {}) => ({
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id: `t${Math.random()}`, name, input }],
});
const text = (t: string) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: t }] });

const base = {
  db: mockDb({ programs: [] }),
  system: 'sys',
  messages: [{ role: 'user' as const, content: 'hi' }],
};

describe('runChatTurn', () => {
  it('returns the answer directly when the model uses no tools', async () => {
    const r = await runChatTurn({ ...base, anthropic: mockAnthropic([text('Hello there')]) });
    expect(r.answer).toBe('Hello there');
    expect(r.sources).toEqual([]);
    expect(r.capped).toBe(false);
  });

  it('runs one tool round then answers, collecting the retrieved data as a source', async () => {
    const r = await runChatTurn({
      ...base,
      anthropic: mockAnthropic([toolUse('list_programs'), text('You have 0 programs.')]),
    });
    expect(r.answer).toBe('You have 0 programs.');
    expect(r.capped).toBe(false);
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].tool).toBe('list_programs');
    // The source carries the ACTUAL retrieved clientSafe data (load-bearing for source-display).
    expect(r.sources[0].data).toEqual({ count: 0, programs: [] });
  });

  it('HARD-STOPS at 5 tool rounds and never loops unbounded', async () => {
    // The model always asks for a tool — must terminate, not spin.
    const r = await runChatTurn({
      ...base,
      anthropic: mockAnthropic([toolUse('list_programs')]), // same response every time
    });
    expect(r.capped).toBe(true);
    expect(r.answer).toMatch(/couldn't finish|narrower/i);
    expect(r.sources).toHaveLength(5); // exactly 5 rounds executed, then stop on the 6th request
  });

  it('respects a custom maxRounds', async () => {
    const r = await runChatTurn({ ...base, maxRounds: 2, anthropic: mockAnthropic([toolUse('list_programs')]) });
    expect(r.capped).toBe(true);
    expect(r.sources).toHaveLength(2);
  });

  it('surfaces a tool error as source data without crashing the loop', async () => {
    const r = await runChatTurn({
      ...base,
      anthropic: mockAnthropic([toolUse('nonexistent_tool'), text('done')]),
    });
    expect(r.answer).toBe('done');
    expect(r.sources[0].data).toMatchObject({ error: expect.stringMatching(/Unknown retrieval tool/) });
  });
});
