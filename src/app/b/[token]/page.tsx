// PUBLIC, no-login budget share page. Renders SERVER-SIDE from a stored client-safe snapshot.
// The browser never gets a Supabase client; this route reads the share via the service-role key
// (scoped to a single lookup by token hash) so no public RLS policy is needed. Middleware
// allow-lists /b/ out of the auth gate and sets noindex + no-store.

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { hashShareToken } from '@/lib/budget/shareToken';
import BudgetDocumentView from '@/components/budget/BudgetDocumentView';
import BudgetRespondForm from '@/components/budget/BudgetRespondForm';
import PrintButton from '@/components/budget/PrintButton';
import type { BudgetShareContract } from '@/lib/budget/budgetShareContract';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

interface Props {
  params: Promise<{ token: string }>;
}

function ExpiredView() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-brand-offwhite px-4">
      <div className="max-w-md text-center bg-white border border-brand-cream rounded-xl p-10">
        <div className="text-[10px] uppercase tracking-[0.2em] text-brand-brown mb-3">Quill Creative Event Design</div>
        <h1 className="font-serif text-2xl text-brand-charcoal">This link has expired</h1>
        <p className="text-sm text-brand-silver mt-3">
          This budget link is no longer available. Please reach out to your event planner for an updated link.
        </p>
      </div>
    </main>
  );
}

export default async function PublicBudgetSharePage({ params }: Props) {
  const { token } = await params;

  // Lazy service-role client (server-only) — never constructed at build/import time.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const tokenHash = hashShareToken(token);
  const { data: share } = await admin
    .from('budget_shares')
    .select('id, snapshot, expires_at, revoked_at, view_count')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  const valid = !!share && share.revoked_at == null && new Date(share.expires_at).getTime() > Date.now();
  if (!valid) return <ExpiredView />;

  // View tracking (best-effort).
  await admin
    .from('budget_shares')
    .update({ view_count: (share!.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() })
    .eq('id', share!.id);

  const contract = share!.snapshot as BudgetShareContract;

  return (
    <main className="min-h-screen bg-brand-offwhite py-8 px-4">
      <div className="max-w-3xl mx-auto mb-4 flex justify-end">
        <PrintButton />
      </div>
      <BudgetDocumentView contract={contract} />
      <BudgetRespondForm contract={contract} token={token} />
    </main>
  );
}
