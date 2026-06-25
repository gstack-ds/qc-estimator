/**
 * One-shot lead scan for Windows Task Scheduler.
 *
 * Unlike run-scanner.ts (a long-running node-cron daemon), this runs a single
 * scan and exits. Task Scheduler owns the timing (4x daily + at boot), so there
 * is no persistent process that can silently die between scans — the failure
 * mode that caused the June 2026 13-day outage.
 *
 * Lookback is wider than the live 24h default so a missed run or short outage
 * self-heals on the next scheduled run. Dedup (DB emailLink + processed-ids.json)
 * makes the overlap free — no duplicate leads.
 *
 *   Build: npm run build:scan-once   (esbuild -> scripts/run-scan-once.js)
 *   Run:   node scripts/run-scan-once.js   (via scripts/run-scan-once.bat)
 */
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
import { runScan } from '../src/lib/scanner/index';

const LOOKBACK_DAYS = 7;

async function main() {
  const afterTs = Math.floor((Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000) / 1000);
  console.log(`[scan-once] Starting one-shot scan at ${new Date().toISOString()} (lookback ${LOOKBACK_DAYS}d)`);
  const result = await runScan(afterTs);
  console.log(
    `[scan-once] Complete: ${result.emailsFound} found, ${result.leadsCreated} created, ${result.errors.length} per-lead error(s)`,
  );
  // Exit 0 even with per-lead errors — the scan itself completed. A truly fatal
  // failure (Gmail/network down) rejects and is caught below as exit 1.
  process.exit(0);
}

main().catch((err) => {
  console.error('[scan-once] Fatal error:', err);
  process.exit(1);
});
