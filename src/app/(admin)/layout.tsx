import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import NavLinks from '@/components/layout/NavLinks';
import { getProfile } from '@/lib/supabase/queries';

const NAV_LINKS = [
  { href: '/programs', label: 'Programs' },
  { href: '/admin', label: 'Reference Data' },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await getProfile(user.id);
  if (profile?.role !== 'admin') redirect('/programs');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/programs" className="font-semibold text-gray-900 text-sm hover:text-blue-600">
            QC Estimator
          </Link>
          <nav className="flex items-center gap-4">
            <NavLinks links={NAV_LINKS} />
          </nav>
        </div>
        <span className="text-xs text-gray-400">{user.email}</span>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
