'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLink {
  href: string;
  label: string;
}

export default function NavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <>
      {links.map(({ href, label }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`text-sm tracking-wide transition-colors ${
              isActive
                ? 'text-brand-copper font-medium'
                : 'text-brand-silver hover:text-brand-offwhite'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
