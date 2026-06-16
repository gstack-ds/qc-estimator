// Audit tool: shows the before/after of sanitizeEstimateName() across every distinct
// estimate name in the live DB. Use it to confirm zero false positives (real client
// names survive) and that all internal-note junk is still stripped, before shipping a
// change to the sanitizer. Imports the REAL function so the audit tests shipped code.
//
// Run: npx tsx scripts/check-sanitize-names.ts

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { sanitizeEstimateName } from '../src/lib/deck/renderer';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  // load mcp-server/.env (has SUPABASE_URL + SERVICE_ROLE_KEY)
  const envText = readFileSync(resolve(__dirname, '..', 'mcp-server', '.env'), 'utf8');
  const env: Record<string, string> = {};
  for (const line of envText.split('\n')) {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in mcp-server/.env');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data, error } = await supabase.from('estimates').select('name');
  if (error) {
    console.error('Query error:', error.message);
    process.exit(1);
  }

  const distinct = [...new Set((data ?? []).map((r) => r.name).filter((n): n is string => n != null))].sort();

  // Separate meaningful strips (text removed) from whitespace-only cleanups.
  const meaningful: { name: string; after: string }[] = [];
  const whitespaceOnly: { name: string; after: string }[] = [];
  for (const name of distinct) {
    const after = sanitizeEstimateName(name);
    if (after === name) continue;
    // If the change is only collapsing/trimming whitespace, it's cosmetic.
    if (after === name.replace(/\s{2,}/g, ' ').trim()) whitespaceOnly.push({ name, after });
    else meaningful.push({ name, after });
  }

  console.log(`Total estimate rows: ${(data ?? []).length}`);
  console.log(`Distinct names: ${distinct.length}`);
  console.log(`MEANINGFUL strips (text removed): ${meaningful.length}`);
  console.log(`Whitespace-only cleanups: ${whitespaceOnly.length}`);
  console.log('');
  console.log('='.repeat(100));
  console.log('MEANINGFUL STRIPS — confirm each is internal junk, not a real name');
  console.log('='.repeat(100));
  console.log('ORIGINAL'.padEnd(58) + '  |  BECOMES');
  console.log('-'.repeat(100));
  for (const { name, after } of meaningful) {
    console.log(name.padEnd(58).slice(0, 58) + '  |  ' + after);
  }
  console.log('='.repeat(100));
}

main();
