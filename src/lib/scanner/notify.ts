import { google } from 'googleapis';
import type { ScanResult } from './types';

function getAuthClient() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob',
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return auth;
}

// Recipient resolution. The .env in production sets NOTIFICATION_RECIPIENTS
// (the PRD's name, comma-separated); the original code only read NOTIFY_EMAIL,
// so notifications silently never sent. Prefer NOTIFICATION_RECIPIENTS, fall
// back to NOTIFY_EMAIL, support a comma list.
function getRecipients(): string | null {
  const raw = process.env.NOTIFICATION_RECIPIENTS ?? process.env.NOTIFY_EMAIL;
  if (!raw) return null;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list.join(', ') : null;
}

function encodeEmail(to: string, subject: string, body: string): string {
  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n');
  return Buffer.from(raw).toString('base64url');
}

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const auth = getAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodeEmail(to, subject, body) },
  });
}

export async function notifyScanSummary(result: ScanResult): Promise<void> {
  const to = getRecipients();
  if (!to) return;

  if (result.leadsCreated === 0 && result.errors.length === 0) return;

  const subject = result.leadsCreated > 0
    ? `[QC Scanner] ${result.leadsCreated} new lead${result.leadsCreated > 1 ? 's' : ''} found`
    : '[QC Scanner] Scan completed — no new leads';

  const lines = [
    `Batch: ${result.batchId}`,
    `Started: ${result.startedAt.toISOString()}`,
    `Emails found: ${result.emailsFound}`,
    `Emails parsed: ${result.emailsParsed}`,
    `Leads created: ${result.leadsCreated}`,
  ];

  if (result.errors.length > 0) {
    lines.push('', 'Errors:', ...result.errors.map((e) => `  • ${e}`));
  }

  await sendEmail(to, subject, lines.join('\n'));
}

export async function notifyError(context: string, err: unknown): Promise<void> {
  const to = getRecipients();
  if (!to) return;

  const msg = err instanceof Error ? err.message : String(err);
  const subject = `[QC Scanner] ERROR: ${context}`;
  const body = `An error occurred during: ${context}\n\n${msg}`;

  try {
    await sendEmail(to, subject, body);
  } catch (sendErr) {
    console.error('[notify] Failed to send error notification:', sendErr);
  }
}

// Sent by the watchdog when no successful scan has completed within the
// threshold — surfaces ANY scanner failure (dead process, auth expiry, parse
// breakage, API change) within hours instead of weeks.
export async function notifyHeartbeatStale(
  lastScanIso: string | null,
  hoursSinceLast: number,
  thresholdHours: number,
): Promise<boolean> {
  const to = getRecipients();
  if (!to) {
    console.error('[notify] No recipients (set NOTIFICATION_RECIPIENTS in .env) — cannot send stale-scanner alert');
    return false;
  }

  const last = lastScanIso
    ? `${lastScanIso} (${hoursSinceLast.toFixed(1)}h ago)`
    : 'never recorded';
  const subject = '[QC Scanner] ⚠ No successful scan — scanner may be down';
  const body = [
    'The QC lead scanner has not completed a successful scan within the expected window.',
    'New lead emails may be going unprocessed right now.',
    '',
    `Last successful scan: ${last}`,
    `Alert threshold: ${thresholdHours}h`,
    '',
    'Likely causes: the "QC Lead Scanner" task stopped, Gmail auth expired,',
    'parsing broke, or Supabase/Anthropic is unreachable.',
    'Check Task Scheduler ("QC Lead Scanner") and logs/scanner-task.log on the PC.',
  ].join('\n');

  try {
    await sendEmail(to, subject, body);
    console.log('[notify] Stale-scanner alert sent to', to);
    return true;
  } catch (sendErr) {
    console.error('[notify] Failed to send stale-scanner alert:', sendErr);
    return false;
  }
}

// Manual delivery check: `run-watchdog --test`. Confirms the alert channel
// actually reaches the inbox without faking a stale heartbeat.
export async function notifyWatchdogTest(): Promise<boolean> {
  const to = getRecipients();
  if (!to) {
    console.error('[notify] No recipients (set NOTIFICATION_RECIPIENTS in .env) — cannot send test alert');
    return false;
  }
  const subject = '[QC Scanner] ✅ Watchdog test alert';
  const body = [
    'This is a TEST alert from the QC scanner watchdog.',
    'If you received this, alerting is wired correctly — a real outage would notify you the same way.',
    'No action needed.',
  ].join('\n');
  try {
    await sendEmail(to, subject, body);
    console.log('[notify] Test alert sent to', to);
    return true;
  } catch (sendErr) {
    console.error('[notify] Failed to send test alert:', sendErr);
    return false;
  }
}
