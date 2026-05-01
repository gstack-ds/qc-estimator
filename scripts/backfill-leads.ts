/**
 * One-time backfill: scans Alex's Gmail for ALL "INITIAL LEAD" emails going
 * back 12 months and writes any that aren't already in Supabase.
 *
 * Usage:
 *   node --loader tsx scripts/backfill-leads.ts
 *
 * Requires the same env vars as the daemon:
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN,
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import 'dotenv/config';
import { google } from 'googleapis';
import { randomUUID } from 'crypto';
import { parseLead } from '../src/lib/scanner/parser';
import { suggestOwner } from '../src/lib/scanner/router';
import { writeLead, leadAlreadyExists } from '../src/lib/scanner/writer';

// ─── Gmail helpers (inlined from gmail.ts — not exported there) ──────────────

function getAuthClient() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'http://localhost:3333/callback',
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return auth;
}

function decodeBase64Url(encoded: string): string {
  return Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function extractPlainText(payload: any): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
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
    if (plain) return plain;
    if (html) return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }
  return '';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const required = [
    'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN',
    'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const batchId = randomUUID();
  const twelveMonthsAgo = Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 1000);
  const query = `subject:"INITIAL LEAD" after:${twelveMonthsAgo}`;

  console.log(`\n[backfill] Starting — batch ${batchId}`);
  console.log(`[backfill] Query: ${query}\n`);

  const gmail = google.gmail({ version: 'v1', auth: getAuthClient() });

  // ── Step 1: collect all matching message IDs (paginated) ─────────────────

  const messageIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 500,
      ...(pageToken ? { pageToken } : {}),
    });
    const page = listRes.data.messages ?? [];
    messageIds.push(...page.map((m) => m.id!).filter(Boolean));
    pageToken = listRes.data.nextPageToken ?? undefined;
    if (pageToken) {
      console.log(`[backfill] Fetched ${messageIds.length} IDs so far, fetching next page…`);
    }
  } while (pageToken);

  console.log(`[backfill] Found ${messageIds.length} total message(s) matching query\n`);

  if (messageIds.length === 0) {
    console.log('[backfill] Nothing to process. Done.');
    return;
  }

  // ── Step 2: process each message ─────────────────────────────────────────

  let skipped = 0;
  let created = 0;
  let failed = 0;

  for (let i = 0; i < messageIds.length; i++) {
    const msgId = messageIds[i];
    const emailLink = `https://mail.google.com/mail/u/0/#inbox/${msgId}`;
    const prefix = `[backfill] [${i + 1}/${messageIds.length}] ${msgId}`;

    // Supabase dedup
    let alreadyExists = false;
    try {
      alreadyExists = await leadAlreadyExists(emailLink);
    } catch (err) {
      console.error(`${prefix} — dedup check failed: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
      continue;
    }

    if (alreadyExists) {
      console.log(`${prefix} — skipped (already in DB)`);
      skipped++;
      continue;
    }

    // Fetch full message
    let emailBody: string;
    let subject: string;
    let receivedAt: Date;
    try {
      const full = await gmail.users.messages.get({ userId: 'me', id: msgId, format: 'full' });
      const headers: Record<string, string> = {};
      for (const h of full.data.payload?.headers ?? []) {
        if (h.name && h.value) headers[h.name.toLowerCase()] = h.value;
      }
      emailBody = extractPlainText(full.data.payload);
      subject = headers['subject'] ?? '';
      receivedAt = full.data.internalDate ? new Date(Number(full.data.internalDate)) : new Date();
    } catch (err) {
      console.error(`${prefix} — fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
      continue;
    }

    // Parse
    let lead: Awaited<ReturnType<typeof parseLead>>['lead'];
    let method: string;
    let warnings: string[];
    try {
      ({ lead, method, warnings } = await parseLead(emailBody));
      if (warnings.length) console.log(`${prefix} — parse warnings: ${warnings.join('; ')}`);
    } catch (err) {
      console.error(`${prefix} — parse failed: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
      continue;
    }

    // Write
    const suggestedOwner = suggestOwner(lead.region, lead.city, lead.state);
    try {
      const written = await writeLead({
        lead,
        messageId: msgId,
        emailLink,
        subject,
        receivedAt,
        suggestedOwner,
        batchId,
        parseMethod: method as 'claude' | 'regex',
        parseWarnings: warnings,
      });
      if (written) {
        console.log(`${prefix} — created lead ${written.id} via ${method} (owner: ${suggestedOwner ?? 'unassigned'})`);
        created++;
      } else {
        console.error(`${prefix} — write returned null`);
        failed++;
      }
    } catch (err) {
      console.error(`${prefix} — write failed: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log(`
[backfill] Done.
  Total found : ${messageIds.length}
  Created     : ${created}
  Skipped     : ${skipped}
  Failed      : ${failed}
  Batch ID    : ${batchId}
`);
}

main().catch((err) => {
  console.error('[backfill] Fatal error:', err.message);
  process.exit(1);
});
