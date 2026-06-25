import { describe, it, expect } from 'vitest';
import { hoursSince, isStale, type Heartbeat } from '../../src/lib/scanner/heartbeat';

const NOW = new Date('2026-06-25T18:00:00.000Z');

function hbAt(iso: string): Heartbeat {
  return { lastSuccessfulScan: iso, batchId: 'test-batch' };
}

describe('hoursSince', () => {
  it('computes elapsed hours from an ISO timestamp', () => {
    expect(hoursSince('2026-06-25T12:00:00.000Z', NOW)).toBeCloseTo(6, 5);
  });

  it('returns ~0 for the current instant', () => {
    expect(hoursSince(NOW.toISOString(), NOW)).toBeCloseTo(0, 5);
  });

  it('returns Infinity for an unparseable timestamp', () => {
    expect(hoursSince('not-a-date', NOW)).toBe(Infinity);
  });
});

describe('isStale', () => {
  it('treats a null heartbeat as stale (never recorded = alert)', () => {
    expect(isStale(null, 18, NOW)).toBe(true);
  });

  it('is not stale when the last scan is within the threshold', () => {
    // 11:00 ET window -> 7h ago, under 18h
    expect(isStale(hbAt('2026-06-25T11:00:00.000Z'), 18, NOW)).toBe(false);
  });

  it('is not stale across the normal 15h overnight gap (16:00 -> 07:00)', () => {
    const morning = new Date('2026-06-25T11:00:00.000Z'); // 07:00 ET
    expect(isStale(hbAt('2026-06-24T20:00:00.000Z'), 18, morning)).toBe(false); // prev 16:00 ET = 15h
  });

  it('is stale at exactly the threshold (>=)', () => {
    expect(isStale(hbAt('2026-06-25T00:00:00.000Z'), 18, NOW)).toBe(true); // exactly 18h
  });

  it('is stale when older than the threshold', () => {
    expect(isStale(hbAt('2026-06-24T18:00:00.000Z'), 18, NOW)).toBe(true); // 24h
  });
});
