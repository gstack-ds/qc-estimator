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
  const to = process.env.NOTIFY_EMAIL;
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
  const to = process.env.NOTIFY_EMAIL;
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
