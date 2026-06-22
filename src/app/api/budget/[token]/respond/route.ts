// THE write path for client capture (Phase 3). Public, no-login, but tightly constrained:
// - resolve + validate the token server-side (exists, not revoked, not expired) → else reject, write nothing
// - Zod-parse the body (shape + bounds; unknown keys stripped)
// - validate the payload AGAINST the locked snapshot + compute the total server-side
// - soft per-token rate limit
// - write to ONE table (budget_share_responses), scoped to the one share_id from the token
// The code path is fixed: it cannot be coerced into writing elsewhere or trusting a client total.

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { hashShareToken } from '@/lib/budget/shareToken';
import { RespondPayloadSchema, validateResponse } from '@/lib/budget/budgetResponse';
import type { BudgetShareContract } from '@/lib/budget/budgetShareContract';

export const dynamic = 'force-dynamic';

const RATE_WINDOW_SECONDS = 10;
const RATE_MAX_IN_WINDOW = 3;

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = admin();

  // 1. Resolve + validate the token. Invalid/revoked/expired → reject, write nothing.
  const tokenHash = hashShareToken(token);
  const { data: share } = await db
    .from('budget_shares')
    .select('id, snapshot, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  const valid = !!share && share.revoked_at == null && new Date(share.expires_at).getTime() > Date.now();
  if (!valid) {
    return NextResponse.json({ error: 'This link is no longer available.' }, { status: 410 });
  }

  // 2. Parse the body shape (Zod strips unknown keys; bounds enforced).
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const parsed = RespondPayloadSchema.safeParse(body);
  if (!parsed.success) {
    // Never echo internal data — a generic message only.
    return NextResponse.json({ error: 'Invalid submission.' }, { status: 400 });
  }

  // 3. Soft per-token rate limit (best-effort; bounds abuse without identity).
  const since = new Date(Date.now() - RATE_WINDOW_SECONDS * 1000).toISOString();
  const { count } = await db
    .from('budget_share_responses')
    .select('id', { count: 'exact', head: true })
    .eq('share_id', share!.id)
    .gte('submitted_at', since);
  if ((count ?? 0) >= RATE_MAX_IN_WINDOW) {
    return NextResponse.json({ error: 'Too many submissions — please wait a moment.' }, { status: 429 });
  }

  // 4. Validate against the LOCKED snapshot + compute the total server-side.
  const contract = share!.snapshot as BudgetShareContract;
  const result = validateResponse(contract, parsed.data);

  // 5. Write to the one table, scoped to the one share_id from the validated token.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;
  const { error } = await db.from('budget_share_responses').insert({
    share_id: share!.id,
    selections: {
      lineSelections: result.lineSelections,
      categoryTargets: result.categoryTargets,
      computedByEvent: result.computedByEvent,
    },
    computed_total: result.computedTotal,
    client_notes: result.notes || null,
    status: 'submitted',
    ip,
    user_agent: userAgent,
  });
  if (error) {
    return NextResponse.json({ error: 'Could not save your response.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
