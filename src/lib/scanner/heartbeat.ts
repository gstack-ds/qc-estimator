import fs from 'fs';
import path from 'path';

// File-based liveness heartbeat, written by the scanner on every successful
// Gmail scan and read by the independent watchdog. Mirrors dedup.ts (same
// data/ dir, cwd-relative) so it needs no DB. The watchdog runs as a separate
// scheduled task so it can detect the scanner being completely dead.
const HEARTBEAT_FILE = path.resolve(process.cwd(), 'data', 'last-scan.json');

export interface Heartbeat {
  lastSuccessfulScan: string; // ISO timestamp
  batchId: string;
}

export function recordHeartbeat(batchId: string, at: Date = new Date()): void {
  try {
    const dir = path.dirname(HEARTBEAT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data: Heartbeat = { lastSuccessfulScan: at.toISOString(), batchId };
    fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[heartbeat] Failed to write heartbeat:', err);
  }
}

export function readHeartbeat(): Heartbeat | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(HEARTBEAT_FILE, 'utf8'));
    if (parsed && typeof parsed.lastSuccessfulScan === 'string') return parsed as Heartbeat;
    return null;
  } catch {
    return null;
  }
}

export function hoursSince(iso: string, now: Date = new Date()): number {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return Infinity;
  return (now.getTime() - then) / (1000 * 60 * 60);
}

// A null/unreadable heartbeat is treated as stale — after the watchdog's
// boot-grace window, "no heartbeat at all" is itself a failure worth alerting.
export function isStale(
  heartbeat: Heartbeat | null,
  thresholdHours: number,
  now: Date = new Date(),
): boolean {
  if (!heartbeat) return true;
  return hoursSince(heartbeat.lastSuccessfulScan, now) >= thresholdHours;
}
