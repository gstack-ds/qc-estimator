import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteClientIfOrphaned } from '../../src/lib/clients/sync';

// Minimal supabase mock: enough of the chain for deleteClientIfOrphaned —
//   from(t).select('id',{count,head}).eq('client_id', id)  → { count, error }
//   from('clients').delete().eq('id', id)                  → records the delete
function makeMock(opts: {
  leadCount: number | null;
  programCount: number | null;
  leadError?: boolean;
  programError?: boolean;
}) {
  let clientsDeleteCalled = false;
  const supabase = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              if (table === 'leads')
                return Promise.resolve({ count: opts.leadCount, error: opts.leadError ? { message: 'boom' } : null });
              if (table === 'programs')
                return Promise.resolve({ count: opts.programCount, error: opts.programError ? { message: 'boom' } : null });
              return Promise.resolve({ count: 0, error: null });
            },
          };
        },
        delete() {
          return {
            eq() {
              if (table === 'clients') clientsDeleteCalled = true;
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { supabase: supabase as unknown as SupabaseClient, wasDeleted: () => clientsDeleteCalled };
}

describe('deleteClientIfOrphaned', () => {
  it('deletes the client when NOTHING references it (lead-only deal deleted)', async () => {
    const m = makeMock({ leadCount: 0, programCount: 0 });
    await deleteClientIfOrphaned(m.supabase, 'client-1');
    expect(m.wasDeleted()).toBe(true);
  });

  it('KEEPS the client when a lead still references it (program deleted, lead survives)', async () => {
    const m = makeMock({ leadCount: 1, programCount: 0 });
    await deleteClientIfOrphaned(m.supabase, 'client-1');
    expect(m.wasDeleted()).toBe(false);
  });

  it('KEEPS the client when a program still references it (lead deleted, program survives)', async () => {
    const m = makeMock({ leadCount: 0, programCount: 1 });
    await deleteClientIfOrphaned(m.supabase, 'client-1');
    expect(m.wasDeleted()).toBe(false);
  });

  it('does nothing when clientId is null/undefined', async () => {
    const m = makeMock({ leadCount: 0, programCount: 0 });
    await deleteClientIfOrphaned(m.supabase, null);
    expect(m.wasDeleted()).toBe(false);
    await deleteClientIfOrphaned(m.supabase, undefined);
    expect(m.wasDeleted()).toBe(false);
  });

  it('fail-safe: KEEPS the client if a reference count cannot be confirmed (query error)', async () => {
    const m = makeMock({ leadCount: null, programCount: null, leadError: true });
    await deleteClientIfOrphaned(m.supabase, 'client-1');
    expect(m.wasDeleted()).toBe(false);
  });

  it('fail-safe: KEEPS the client on a null count even with NO error (never coerce null→0)', async () => {
    const m = makeMock({ leadCount: null, programCount: null, leadError: false, programError: false });
    await deleteClientIfOrphaned(m.supabase, 'client-1');
    expect(m.wasDeleted()).toBe(false);
  });
});
