import { describe, it, expect } from 'vitest';
import { CHAT_SYSTEM_PROMPT } from '../../src/lib/chat/systemPrompt';

// Guards the load-bearing guardrail clauses against accidental deletion. This is not a behavioral
// test (that's the adversarial ship-gate) — it just asserts each mandated instruction is present.
describe('CHAT_SYSTEM_PROMPT — guardrail clauses present', () => {
  it('grounds answers only in retrieved data', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/only from|solely from the data/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/verbatim/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/read-only/i);
  });

  it('explicitly forbids sum / infer / scale / fill (helpful arithmetic named concretely)', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/SUM or total/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/INFER from similar/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/SCALE or interpolate/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/FILL a missing or null/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/per-person price by a headcount/i);
  });

  it('makes "I don\'t have that" the correct default, not a failure', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/I don't have that/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/not a failure|RIGHT behavior/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/do not guess|don't guess|Do not guess/i);
  });

  it('is static (prompt-cacheable — no interpolation)', () => {
    expect(CHAT_SYSTEM_PROMPT).not.toContain('${');
    expect(CHAT_SYSTEM_PROMPT.length).toBeGreaterThan(500);
  });
});
