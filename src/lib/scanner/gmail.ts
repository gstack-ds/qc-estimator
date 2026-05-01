import { google } from 'googleapis';
import type { RawEmailMessage } from './types';

function buildOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob',
  );
}

function getAuthClient() {
  const auth = buildOAuth2Client();
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return auth;
}

function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

function extractPlainText(payload: any): string {
  if (!payload) return '';

  // Direct text/plain body
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Multipart: recurse through parts, prefer text/plain over text/html
  if (payload.parts && Array.isArray(payload.parts)) {
    let plain = '';
    let html = '';
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        plain += decodeBase64Url(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html += decodeBase64Url(part.body.data);
      } else if (part.mimeType?.startsWith('multipart/')) {
        plain += extractPlainText(part);
      }
    }
    // Strip basic HTML tags as a last resort if no plain text
    if (plain) return plain;
    if (html) return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  return '';
}

export interface GmailScanOptions {
  afterTimestamp?: number; // Unix timestamp; default = 24h ago
}

export async function scanGmail(options: GmailScanOptions = {}): Promise<RawEmailMessage[]> {
  const auth = getAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const afterTs = options.afterTimestamp ?? Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
  const query = [
    'subject:"INITIAL LEAD"',
    '-subject:"out of office"',
    '-subject:"automatic reply"',
    '-subject:"autoreply"',
    '-subject:"auto-reply"',
    `after:${afterTs}`,
  ].join(' ');

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 100,
  });

  const messages = listRes.data.messages ?? [];
  if (messages.length === 0) return [];

  const results: RawEmailMessage[] = [];

  for (const msg of messages) {
    if (!msg.id) continue;
    try {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      const headers: Record<string, string> = {};
      for (const h of full.data.payload?.headers ?? []) {
        if (h.name && h.value) headers[h.name.toLowerCase()] = h.value;
      }

      const emailBody = extractPlainText(full.data.payload);
      const internalDate = full.data.internalDate
        ? new Date(Number(full.data.internalDate))
        : new Date();

      results.push({
        messageId: msg.id,
        emailBody,
        emailLink: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
        subject: headers['subject'] ?? '',
        receivedAt: internalDate,
      });
    } catch (err) {
      console.error(`[gmail] Failed to fetch message ${msg.id}:`, err);
    }
  }

  return results;
}
