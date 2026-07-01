import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  etDateString,
  applyIncrement,
  remainingAfter,
  checkAndIncrementUsage,
  CHAT_DAILY_CAP,
  CHAT_WARNING_AT,
} from '../../src/lib/chat/usage';

describe('etDateString — the ET day boundary (not UTC)', () => {
  // ET midnight for 2026-07-01 is 04:00Z (EDT = UTC-4). The cap must reset there, not at UTC midnight.
  it('9pm ET on Jun 30 (01:00Z Jul 1) is still Jun 30 in ET — UTC would wrongly say Jul 1', () => {
    expect(etDateString(new Date('2026-07-01T01:00:00Z'))).toBe('2026-06-30');
  });

  it('11:59pm ET on Jun 30 (03:59Z Jul 1) is still Jun 30', () => {
    expect(etDateString(new Date('2026-07-01T03:59:00Z'))).toBe('2026-06-30');
  });

  it('12:01am ET on Jul 1 (04:01Z) rolls to Jul 1 — the reset boundary', () => {
    expect(etDateString(new Date('2026-07-01T04:01:00Z'))).toBe('2026-07-01');
  });

  it('the date (and therefore the usage key → count reset) changes exactly across ET midnight', () => {
    const before = etDateString(new Date('2026-07-01T03:59:00Z')); // 11:59pm ET Jun 30
    const after = etDateString(new Date('2026-07-01T04:01:00Z')); // 12:01am ET Jul 1
    expect(before).not.toBe(after);
    expect(before).toBe('2026-06-30');
    expect(after).toBe('2026-07-01');
  });

  it('winter (EST = UTC-5): 04:30Z Jan 1 is still Dec 31 in ET', () => {
    expect(etDateString(new Date('2026-01-01T04:30:00Z'))).toBe('2025-12-31');
  });
});

describe('applyIncrement — hard cap of 6, mirror of SQL 058', () => {
  it('first request of the day → count 1, allowed', () => {
    expect(applyIncrement(null)).toEqual({ allowed: true, count: 1 });
  });

  it('warning point: the 5th request lands on count 5 (one left)', () => {
    expect(applyIncrement(4)).toEqual({ allowed: true, count: CHAT_WARNING_AT });
    expect(remainingAfter(CHAT_WARNING_AT)).toBe(1);
  });

  it('the 6th request lands on count 6 (last allowed)', () => {
    expect(applyIncrement(5)).toEqual({ allowed: true, count: CHAT_DAILY_CAP });
    expect(remainingAfter(CHAT_DAILY_CAP)).toBe(0);
  });

  it('BLOCKS at the cap: the 7th request is rejected AND does NOT increment (count stays 6)', () => {
    expect(applyIncrement(6)).toEqual({ allowed: false, count: 6 });
    expect(applyIncrement(6).count).toBe(6); // rejected-pre-billed never consumes a slot
  });

  it('every allowed request below the cap increments by exactly 1', () => {
    for (let c = 0; c < CHAT_DAILY_CAP; c++) {
      expect(applyIncrement(c)).toEqual({ allowed: true, count: c + 1 });
    }
  });
});

describe('checkAndIncrementUsage — maps the RPC result', () => {
  const rpc = (data: unknown, error: unknown = null) =>
    ({ rpc: vi.fn(async () => ({ data, error })) }) as unknown as SupabaseClient;

  it('allowed with the resulting count', async () => {
    const r = await checkAndIncrementUsage(rpc([{ allowed: true, current_count: 3 }]), 'u1', '2026-07-01');
    expect(r).toEqual({ allowed: true, count: 3 });
  });

  it('blocked at cap → allowed:false with the current count', async () => {
    const r = await checkAndIncrementUsage(rpc([{ allowed: false, current_count: 6 }]), 'u1', '2026-07-01');
    expect(r).toEqual({ allowed: false, count: 6 });
  });

  it('throws on DB error (route fails closed)', async () => {
    await expect(checkAndIncrementUsage(rpc(null, { message: 'boom' }), 'u1', '2026-07-01')).rejects.toThrow(/boom/);
  });
});
