import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import NavLinks from '@/components/layout/NavLinks';
import { getProfile } from '@/lib/supabase/queries';

export default async function ProgramsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await getProfile(user.id);
  const isAdmin = profile?.role === 'admin';

  const navLinks = [
    { href: '/programs', label: 'Programs' },
    ...(isAdmin ? [{ href: '/admin', label: 'Reference Data' }] : []),
  ];

  return (
    <div className="min-h-screen bg-brand-offwhite">
      <header className="bg-brand-charcoal border-b border-black/20 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/programs" className="flex items-center gap-3 group">
            <Image
              src="/images/qc-monogram.png"
              alt="Quill Creative"
              width={32}
              height={32}
              className="object-contain opacity-90 group-hover:opacity-100 transition-opacity"
            />
            <div className="leading-none">
              <div className="text-brand-offwhite font-serif text-sm font-medium tracking-[0.12em] uppercase">
                Quill Creative
              </div>
              <div className="text-brand-silver text-[9px] tracking-[0.18em] uppercase mt-0.5">
                Event Design
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-6">
            <NavLinks links={navLinks} />
          </nav>
        </div>
        <span className="text-xs text-brand-silver">{user.email}</span>
      </header>
      <main>{children}</main>
    </div>
  );
}
