// Daily usage cap for the in-app chatbot. Hard cap holds the ~$50/mo ceiling
// (5 users × 6 q/day × ~$0.05 × 30 ≈ $45). The counter is the ONLY persisted chatbot state.
import type { SupabaseClient } from '@supabase/supabase-js';

// Tunable config constants.
export const CHAT_DAILY_CAP = 6;
export const CHAT_WARNING_AT = 5; // when the resulting count reaches this, exactly 1 question remains

// Today's date in the TEAM'S timezone (ET), built from Intl parts — NEVER new Date('YYYY-MM-DD')
// (UTC-parse shifts a day in ET). A UTC-based "date" would roll the daily cap over at ~7–8pm ET,
// mid-workday — wrong. This rolls at ET midnight. `en-CA` yields YYYY-MM-DD parts.
export function etDateString(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Pure mirror of the SQL increment_chat_usage (migration 058). The SQL is the source of truth;
// this exists for unit coverage + documentation of the intended semantics. `current` = the count
// stored for today BEFORE this request (null if there's no row yet). An at-cap request is rejected
// WITHOUT incrementing — so a rejected-pre-billed request never consumes a slot.
export function applyIncrement(
  current: number | null,
  cap: number = CHAT_DAILY_CAP,
): { allowed: boolean; count: number } {
  if (current === null) return { allowed: true, count: 1 };
  if (current >= cap) return { allowed: false, count: current };
  return { allowed: true, count: current + 1 };
}

// Questions remaining AFTER a just-counted request (drives the warning UX). `count` is post-increment.
export function remainingAfter(count: number, cap: number = CHAT_DAILY_CAP): number {
  return Math.max(0, cap - count);
}

// Calls the atomic DB function via a SERVICE-ROLE client. The route auth-gates with the session
// first, then passes the server-verified user id here. Throws on DB error (the route fails closed
// to protect the ceiling).
export async function checkAndIncrementUsage(
  adminDb: SupabaseClient,
  userId: string,
  date: string,
  cap: number = CHAT_DAILY_CAP,
): Promise<{ allowed: boolean; count: number }> {
  const { data, error } = await adminDb.rpc('increment_chat_usage', {
    p_user: userId,
    p_date: date,
    p_cap: cap,
  });
  if (error) throw new Error(`chat usage counter: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return { allowed: !!row?.allowed, count: Number(row?.current_count ?? 0) };
}
