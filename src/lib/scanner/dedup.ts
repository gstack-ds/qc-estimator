import fs from 'fs';
import path from 'path';

const DEDUP_FILE = path.resolve(process.cwd(), 'data', 'processed-ids.json');
const MAX_IDS = 500;

function load(): string[] {
  try {
    const raw = fs.readFileSync(DEDUP_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(ids: string[]): void {
  try {
    const dir = path.dirname(DEDUP_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DEDUP_FILE, JSON.stringify(ids, null, 2), 'utf8');
  } catch (err) {
    console.error('[dedup] Failed to save processed IDs:', err);
  }
}

export function isProcessed(messageId: string): boolean {
  return load().includes(messageId);
}

export function markProcessed(messageId: string): void {
  const ids = load();
  if (ids.includes(messageId)) return;
  ids.push(messageId);
  // Rolling window: keep only the last MAX_IDS
  const trimmed = ids.length > MAX_IDS ? ids.slice(ids.length - MAX_IDS) : ids;
  save(trimmed);
}

export function markProcessedBatch(messageIds: string[]): void {
  const ids = load();
  for (const id of messageIds) {
    if (!ids.includes(id)) ids.push(id);
  }
  const trimmed = ids.length > MAX_IDS ? ids.slice(ids.length - MAX_IDS) : ids;
  save(trimmed);
}
