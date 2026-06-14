// Mock Supabase client factory for MCP server tests.
// Builds a chainable query object that resolves to pre-set data.

import { vi } from 'vitest';

export type SupabaseResult = { data: unknown; error: null | { message: string; code?: string } };
type CountResult = { count: number | null; data: null; error: null };

function buildChain(result: SupabaseResult, countResult: CountResult) {
  // Track whether select was called with head:true
  let isHead = false;

  const chain: Record<string, unknown> = {};
  const chainMethods = ['eq', 'neq', 'in', 'ilike', 'or', 'gte', 'lte', 'not', 'order', 'limit', 'filter'];
  for (const m of chainMethods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }

  // select must always return chain (even for head queries), so further .eq() calls work
  chain.select = vi.fn().mockImplementation(
    (_fields: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.head) isHead = true;
      return chain;
    }
  );

  // Terminal: single row
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);

  // Make chain thenable — returns count payload when head:true, otherwise row payload
  chain.then = vi.fn().mockImplementation(
    (resolve: (val: unknown) => void, _reject?: unknown) => {
      const r = isHead ? countResult : result;
      resolve(r);
      return Promise.resolve(r);
    }
  );
  chain.catch = vi.fn().mockReturnValue(chain);

  return chain;
}

/**
 * Creates a mock Supabase client. Each `from(table)` call returns a chainable
 * query that resolves to the pre-configured `result`. Tables not listed resolve
 * to `{ data: [], error: null }`.
 *
 * Pass `{ count: N }` in the result to support `select('*', { count: 'exact', head: true })`.
 */
export function createMockDb(
  tableData: Record<string, SupabaseResult | (() => SupabaseResult)>
) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      const cfg = tableData[table];
      const result: SupabaseResult = typeof cfg === 'function'
        ? cfg()
        : cfg ?? { data: [], error: null };
      // countResult: pull count field from result if present, default 0
      const countResult: CountResult = {
        count: typeof result.data === 'number' ? result.data : null,
        data: null,
        error: null,
      };
      return buildChain(result, countResult);
    }),
  };
}

/** Shorthand for a successful result with rows */
export function ok(data: unknown): SupabaseResult {
  return { data, error: null };
}

/** Shorthand for a not-found PGRST116 error */
export function notFound(): SupabaseResult {
  return { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
}

/** Shorthand for a generic query error */
export function dbError(message: string): SupabaseResult {
  return { data: null, error: { message } };
}
