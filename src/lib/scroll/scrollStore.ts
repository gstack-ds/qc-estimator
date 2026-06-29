// Pure helpers for app-wide scroll restoration. No DOM / React / browser APIs — testable in isolation.
// The ScrollRestoration component owns the DOM/history side; this owns the data shape + decisions.

export interface ContainerScroll {
  top: number;
  left: number;
}

// One saved entry: window scrollY + per-container scrollTop/Left, keyed by the container's
// data-scroll-restore value (e.g. "leads-table", "leads-lane-new_inquiry").
export interface ScrollRecord {
  w: number;
  c: Record<string, ContainerScroll>;
}

const PREFIX = 'qc-scroll:';

// Saved positions are keyed by full URL (pathname + search), so the same list with different
// filters/sorts in the query string restores independently.
export function storageKey(url: string): string {
  return PREFIX + url;
}

export function serializeRecord(r: ScrollRecord): string {
  return JSON.stringify(r);
}

export function parseRecord(raw: string | null): ScrollRecord | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== 'object' || v === null) return null;
    const obj = v as { w?: unknown; c?: unknown };
    const w = typeof obj.w === 'number' ? obj.w : 0;
    const c: Record<string, ContainerScroll> = {};
    if (obj.c && typeof obj.c === 'object') {
      for (const [k, raw2] of Object.entries(obj.c as Record<string, unknown>)) {
        const e = raw2 as { top?: unknown; left?: unknown };
        if (e && typeof e.top === 'number') {
          c[k] = { top: e.top, left: typeof e.left === 'number' ? e.left : 0 };
        }
      }
    }
    return { w, c };
  } catch {
    return null;
  }
}

// Within tolerance px of the target — used to decide when a restore "took" so the retry loop stops.
export function isAtTarget(target: number, actual: number, tolerance = 2): boolean {
  return Math.abs(target - actual) <= tolerance;
}

// Is there anything worth restoring? Avoids redundant work / a top→position flicker when the saved
// position was already the top of the page.
export function hasScroll(r: ScrollRecord): boolean {
  if (r.w > 0) return true;
  return Object.values(r.c).some((c) => c.top > 0 || c.left > 0);
}
