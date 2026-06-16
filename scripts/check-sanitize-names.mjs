import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// load mcp-server/.env (has SUPABASE_URL + SERVICE_ROLE_KEY)
const envText = readFileSync(resolve(__dirname, '..', 'mcp-server', '.env'), 'utf8');
const env = {};
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

// exact copy of the NEW regex from renderer.ts
function sanitizeEstimateName(name) {
  return name
    .replace(/\s*\(\s*upcharg\w*\s+at\s+[\d.]+%\s*\)/gi, '')
    .replace(/\s*-\s*[A-Z]{2,}\b.*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const supabase = createClient(url, key);

const { data, error } = await supabase.from('estimates').select('name');
if (error) {
  console.error('Query error:', error.message);
  process.exit(1);
}

const distinct = [...new Set(data.map((r) => r.name).filter((n) => n != null))].sort();

const modified = [];
for (const name of distinct) {
  const after = sanitizeEstimateName(name);
  if (after !== name) modified.push({ name, after });
}

console.log(`Total estimate rows: ${data.length}`);
console.log(`Distinct names: ${distinct.length}`);
console.log(`Names MODIFIED by sanitizer: ${modified.length}`);
console.log('');
console.log('='.repeat(100));
console.log('ORIGINAL'.padEnd(60) + '|  BECOMES');
console.log('='.repeat(100));
for (const { name, after } of modified) {
  console.log(name.padEnd(58).slice(0, 58) + '  |  ' + after);
}
console.log('='.repeat(100));
