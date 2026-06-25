/**
 * Scanner watchdog — the safety net for SILENT scanner failure.
 *
 * Runs as a SEPARATE Windows Task Scheduler task (independent of the scanner)
 * so it fires even when the scanner is completely dead. Reads the heartbeat
 * the scanner writes on each successful scan; if no successful scan has
 * completed within THRESHOLD_HOURS, it emails an alert via notify.ts.
 *
 * The scanner runs 4x/day (7/11/14/16 ET); the longest normal gap is 15h
 * (16:00 -> 07:00), so an 18h threshold never false-alarms overnight while
 * still catching a real outage within ~a day.
 *
 *   --test   send a clearly-labelled test alert and exit (verifies delivery)
 *
 * Build: npm run build:watchdog   ->   scripts/run-watchdog.js
 * Run:   via scripts/run-watchdog.bat (sets cwd so the heartbeat file resolves)
 */
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
import { readHeartbeat, hoursSince, isStale } from '../src/lib/scanner/heartbeat';
import { notifyHeartbeatStale, notifyWatchdogTest } from '../src/lib/scanner/notify';

const THRESHOLD_HOURS = 18;
const BOOT_GRACE_SECONDS = 30 * 60;

async function main() {
  if (process.argv.includes('--test')) {
    console.log('[watchdog] --test: sending a test alert to verify delivery…');
    const sent = await notifyWatchdogTest();
    process.exit(sent ? 0 : 1);
  }

  // Just booted? The scanner's boot-triggered scan will refresh the heartbeat
  // shortly — don't false-alarm after an intentional power-off.
  const uptimeS = os.uptime();
  if (uptimeS < BOOT_GRACE_SECONDS) {
    console.log(
      `[watchdog] System booted ${Math.round(uptimeS / 60)}m ago (< ${BOOT_GRACE_SECONDS / 60}m grace) — skipping; boot scan should refresh the heartbeat.`,
    );
    process.exit(0);
  }

  const hb = readHeartbeat();
  if (!isStale(hb, THRESHOLD_HOURS)) {
    const h = hb ? hoursSince(hb.lastSuccessfulScan).toFixed(1) : '?';
    console.log(`[watchdog] OK — last successful scan ${h}h ago (threshold ${THRESHOLD_HOURS}h).`);
    process.exit(0);
  }

  const hours = hb ? hoursSince(hb.lastSuccessfulScan) : Infinity;
  const lastIso = hb?.lastSuccessfulScan ?? null;
  console.error(
    `[watchdog] STALE — last successful scan ${lastIso ?? 'never recorded'} (${hours === Infinity ? 'never' : hours.toFixed(1) + 'h'} ago, threshold ${THRESHOLD_HOURS}h). Alerting.`,
  );
  await notifyHeartbeatStale(lastIso, hours, THRESHOLD_HOURS);
  // Exit non-zero so the task's LastTaskResult also records the problem.
  process.exit(1);
}

main().catch((err) => {
  console.error('[watchdog] Fatal error:', err);
  process.exit(1);
});
