import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _db: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (_db) return _db;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Copy mcp-server/.env.example to mcp-server/.env.'
    );
  }

  _db = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _db;
}
