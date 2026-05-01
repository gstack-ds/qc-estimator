import { randomUUID } from 'crypto';
import { scanGmail } from './gmail';
import { parseLead } from './parser';
import { suggestOwner } from './router';
import { writeLead, leadAlreadyExists, type WriteLeadResult } from './writer';
import { isProcessed, markProcessed } from './dedup';
import { notifyScanSummary, notifyError } from './notify';
import type { ParsedLead, ScanResult } from './types';

function isValidLeadData(lead: ParsedLead): boolean {
  const fields = [
    lead.client_name,
    lead.program_name,
    lead.start_date,
    lead.guest_count,
    lead.city ?? lead.state,
  ];
  const populated = fields.filter((v) => v != null && v !== '').length;
  return populated >= 3;
}

export async function runScan(afterTimestamp?: number): Promise<ScanResult> {
  const batchId = randomUUID();
  const startedAt = new Date();
  const result: ScanResult = {
    batchId,
    startedAt,
    emailsFound: 0,
    emailsParsed: 0,
    leadsCreated: 0,
    errors: [],
  };

  try {
    const messages = await scanGmail({ afterTimestamp });
    result.emailsFound = messages.length;
    console.log(`[scanner] Batch ${batchId}: found ${messages.length} message(s)`);

    for (const msg of messages) {
      // Skip if already processed (file-based dedup)
      if (isProcessed(msg.messageId)) {
        console.log(`[scanner] Skipping already-processed message ${msg.messageId}`);
        continue;
      }

      // Skip if already in DB (handles cross-machine dedup)
      try {
        if (await leadAlreadyExists(msg.emailLink)) {
          markProcessed(msg.messageId);
          console.log(`[scanner] Skipping message already in DB: ${msg.messageId}`);
          continue;
        }
      } catch (err) {
        result.errors.push(`DB dedup check failed for ${msg.messageId}: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }

      let lead, method, warnings: string[];
      try {
        ({ lead, method, warnings } = await parseLead(msg.emailBody));
        result.emailsParsed++;
        console.log(`[scanner] Parsed ${msg.messageId} via ${method}`);
      } catch (err) {
        const errMsg = `Parse failed for ${msg.messageId}: ${err instanceof Error ? err.message : String(err)}`;
        result.errors.push(errMsg);
        console.error(`[scanner] ${errMsg}`);
        continue;
      }

      if (!isValidLeadData(lead)) {
        console.log(`[scanner] Rejected ${msg.messageId} — not a valid lead format`);
        markProcessed(msg.messageId);
        continue;
      }

      const suggestedOwner = suggestOwner(lead.region, lead.city, lead.state);

      let written: WriteLeadResult;
      try {
        written = await writeLead({
          lead,
          messageId: msg.messageId,
          emailLink: msg.emailLink,
          subject: msg.subject,
          receivedAt: msg.receivedAt,
          suggestedOwner,
          batchId,
          parseMethod: method,
          parseWarnings: warnings,
        });
      } catch (err) {
        const errMsg = `DB write failed for ${msg.messageId}: ${err instanceof Error ? err.message : String(err)}`;
        result.errors.push(errMsg);
        console.error(`[scanner] ${errMsg}`);
        continue;
      }

      if (written === null) {
        result.errors.push(`DB write returned null for ${msg.messageId}`);
      } else if ('skipped' in written) {
        markProcessed(msg.messageId);
        console.log(`[scanner] Skipped ${msg.messageId}: ${written.skipped}`);
      } else {
        result.leadsCreated++;
        markProcessed(msg.messageId);
        console.log(`[scanner] Created lead ${written.id} for ${msg.messageId}`);
      }
    }
  } catch (err) {
    const errMsg = `Gmail scan failed: ${err instanceof Error ? err.message : String(err)}`;
    result.errors.push(errMsg);
    console.error(`[scanner] ${errMsg}`);
    await notifyError('Gmail scan', err);
  }

  console.log(`[scanner] Batch ${batchId} complete: ${result.leadsCreated} leads created, ${result.errors.length} errors`);

  try {
    await notifyScanSummary(result);
  } catch (err) {
    console.error('[scanner] Notification failed:', err);
  }

  return result;
}
