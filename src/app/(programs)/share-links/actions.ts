'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Central share-link controls (Feature B). Authenticated-only (the (programs) layout gates auth;
// budget_shares RLS allows authenticated FOR ALL). These act by share id across programs — safe
// because only the trusted team reaches this surface. Revoking only sets revoked_at; the public
// route rejects revoked links immediately.

export async function revokeShareLink(shareId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('budget_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', shareId)
    .is('revoked_at', null);
  if (error) return { error: error.message };
  revalidatePath('/share-links');
  return {};
}

export async function revokeAllActiveShareLinks(): Promise<{ error?: string; revoked: number }> {
  const supabase = await createClient();
  // Revoke every currently-active link (not revoked, not expired) in one statement.
  const { data, error } = await supabase
    .from('budget_shares')
    .update({ revoked_at: new Date().toISOString() })
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('id');
  if (error) return { error: error.message, revoked: 0 };
  revalidatePath('/share-links');
  return { revoked: data?.length ?? 0 };
}
