import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runScan } from '@/lib/scanner';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runScan();
    return NextResponse.json({
      leadsCreated: result.leadsCreated,
      emailsFound: result.emailsFound,
      errors: result.errors,
      batchId: result.batchId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scan failed';
    console.error('[api/scanner/run]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
