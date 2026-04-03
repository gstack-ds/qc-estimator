'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function UserMenu({ email }: { email: string }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-brand-silver">{email}</span>
      <button
        onClick={handleSignOut}
        className="text-xs text-brand-silver hover:text-brand-offwhite transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
