/**
 * One-time cleanup: removes duplicate leads that share the same client_name + start_date.
 * Keeps the oldest record per group (min created_at) and deletes the rest.
 *
 * Usage:
 *   node --loader tsx scripts/dedup-leads.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Fetch all leads with the fields needed for grouping
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, client_name, start_date, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch leads:', error.message);
    process.exit(1);
  }

  if (!leads || leads.length === 0) {
    console.log('No leads found. Done.');
    return;
  }

  console.log(`\n[dedup] Loaded ${leads.length} leads\n`);

  // Group by client_name + start_date
  const groups = new Map<string, typeof leads>();
  for (const lead of leads) {
    if (!lead.client_name || !lead.start_date) continue;
    const key = `${lead.client_name.trim().toLowerCase()}|${lead.start_date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(lead);
  }

  const duplicateGroups = [...groups.values()].filter((g) => g.length > 1);

  if (duplicateGroups.length === 0) {
    console.log('[dedup] No duplicates found. Done.');
    return;
  }

  console.log(`[dedup] Found ${duplicateGroups.length} group(s) with duplicates:\n`);

  const toDelete: string[] = [];

  for (const group of duplicateGroups) {
    // Already ordered by created_at asc — first is the oldest
    const [keep, ...dupes] = group;
    console.log(`  Keep : ${keep.id} — ${keep.client_name} / ${keep.start_date} (created ${keep.created_at})`);
    for (const dupe of dupes) {
      console.log(`  Delete: ${dupe.id} — ${dupe.client_name} / ${dupe.start_date} (created ${dupe.created_at})`);
      toDelete.push(dupe.id);
    }
    console.log();
  }

  console.log(`[dedup] Deleting ${toDelete.length} duplicate lead(s)…`);

  const { error: deleteError } = await supabase
    .from('leads')
    .delete()
    .in('id', toDelete);

  if (deleteError) {
    console.error('[dedup] Delete failed:', deleteError.message);
    process.exit(1);
  }

  console.log(`[dedup] Done. Removed ${toDelete.length} duplicate(s).`);
}

main().catch((err) => {
  console.error('[dedup] Fatal error:', err.message);
  process.exit(1);
});
