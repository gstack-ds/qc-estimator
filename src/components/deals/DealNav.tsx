'use client';

// Breadcrumb-jump nav for the unified deal page (Alex's specific ask). Pure in-page anchor
// scrolling — NO router navigation (except the "Programs" crumb which intentionally leaves the
// page), so it never loses scroll state. An IntersectionObserver highlights the section
// currently in view ("you are here"). Section ids must match the <section id="…"> on the page.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { DealNavSection } from '@/lib/deal/sections';

export function DealNav({ dealName, sections }: { dealName: string; sections: DealNavSection[] }) {
  const [active, setActive] = useState<string>('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // The topmost intersecting section wins. rootMargin biases toward the section whose
        // top has scrolled just under the sticky header.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-25% 0px -65% 0px', threshold: 0 },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <Link href="/programs" className="text-gray-400 hover:text-brand-copper">
        Programs
      </Link>
      <span className="text-gray-300">/</span>
      <button onClick={toTop} className="font-semibold text-brand-charcoal hover:text-brand-copper">
        {dealName}
      </button>
      {sections.length > 0 && <span className="text-gray-300">·</span>}
      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => jump(s.id)}
          className={
            active === s.id
              ? 'font-semibold text-brand-copper'
              : 'text-gray-500 hover:text-brand-copper'
          }
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}
