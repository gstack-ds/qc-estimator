import 'dotenv/config';
import cron from 'node-cron';
import { runScan } from '../src/lib/scanner/index';

console.log('[scanner] Starting QC Lead Scanner daemon...');

// Fire immediately on startup for a quick sanity check
runScan().catch((err) => console.error('[scanner] Initial scan error:', err));

// 7:00, 11:00, 14:00, 16:00 Eastern Time
// Cron runs in server local time — ensure TZ=America/New_York in PM2 env
cron.schedule('0 7,11,14,16 * * *', async () => {
  console.log(`[scanner] Cron fired at ${new Date().toISOString()}`);
  try {
    await runScan();
  } catch (err) {
    console.error('[scanner] Cron scan error:', err);
  }
});

console.log('[scanner] Daemon running. Scheduled at 7:00, 11:00, 14:00, 16:00 ET.');
