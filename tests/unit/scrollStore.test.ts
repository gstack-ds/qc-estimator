import { describe, it, expect } from 'vitest';
import {
  storageKey, serializeRecord, parseRecord, isAtTarget, hasScroll, type ScrollRecord,
} from '../../src/lib/scroll/scrollStore';

describe('storageKey', () => {
  it('namespaces by URL so different routes/filters store independently', () => {
    expect(storageKey('/programs')).toBe('qc-scroll:/programs');
    expect(storageKey('/leads?tab=open')).toBe('qc-scroll:/leads?tab=open');
    expect(storageKey('/programs')).not.toBe(storageKey('/leads'));
  });
});

describe('serialize / parse round trip', () => {
  it('round-trips window + container positions', () => {
    const rec: ScrollRecord = { w: 1200, c: { 'leads-table': { top: 800, left: 0 }, 'leads-lane-new': { top: 240, left: 0 } } };
    expect(parseRecord(serializeRecord(rec))).toEqual(rec);
  });

  it('returns null for null/empty/garbage input', () => {
    expect(parseRecord(null)).toBeNull();
    expect(parseRecord('')).toBeNull();
    expect(parseRecord('not json')).toBeNull();
    expect(parseRecord('123')).toBeNull();   // not an object
    expect(parseRecord('"str"')).toBeNull();
  });

  it('defaults missing window scroll to 0 and tolerates partial containers', () => {
    expect(parseRecord('{}')).toEqual({ w: 0, c: {} });
    // container missing left → defaults to 0; entry missing top → dropped
    const parsed = parseRecord('{"w":50,"c":{"a":{"top":10},"b":{"left":5}}}');
    expect(parsed).toEqual({ w: 50, c: { a: { top: 10, left: 0 } } });
  });
});

describe('isAtTarget', () => {
  it('true within tolerance, false outside', () => {
    expect(isAtTarget(1000, 1000)).toBe(true);
    expect(isAtTarget(1000, 999)).toBe(true);   // within default tol 2
    expect(isAtTarget(1000, 997)).toBe(false);  // 3 px off
    expect(isAtTarget(1000, 990, 20)).toBe(true);
  });
});

describe('hasScroll', () => {
  it('true when window or any container is scrolled', () => {
    expect(hasScroll({ w: 500, c: {} })).toBe(true);
    expect(hasScroll({ w: 0, c: { x: { top: 30, left: 0 } } })).toBe(true);
    expect(hasScroll({ w: 0, c: { x: { top: 0, left: 12 } } })).toBe(true);
  });
  it('false when everything is at the top-left (nothing to restore)', () => {
    expect(hasScroll({ w: 0, c: {} })).toBe(false);
    expect(hasScroll({ w: 0, c: { x: { top: 0, left: 0 } } })).toBe(false);
  });
});
