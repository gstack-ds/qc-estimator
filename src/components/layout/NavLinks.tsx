'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLink {
  href: string;
  label: string;
  badge?: number;
}

export default function NavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <>
      {links.map(({ href, label, badge }) => {
        // Compare against the path only — a query/hash on the href (e.g. /programs?new=1) must
        // not break the active-state match.
        const isActive = pathname.startsWith(href.split(/[?#]/)[0]);
        return (
          <Link
            key={href}
            href={href}
            className={`text-sm tracking-wide transition-colors flex items-center gap-1.5 ${
              isActive
                ? 'text-brand-copper font-medium'
                : 'text-brand-silver hover:text-brand-offwhite'
            }`}
          >
            {label}
            {badge != null && badge > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 text-[10px] font-semibold rounded-full bg-amber-500 text-white leading-none">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );
}
