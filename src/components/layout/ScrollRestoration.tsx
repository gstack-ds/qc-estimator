'use client';

// App-wide scroll restoration. Mounted once in the (programs) layout.
//
// Why this exists (see CLAUDE.md): list/detail pages are force-dynamic, so on BACK navigation the
// server component refetches and repaints late — native scroll restoration fires before the content
// (and its height) exists, so it lands at the top. And the leads table/board scroll inside nested
// overflow containers, which native restoration never touches at all.
//
// Mechanism: continuously save the window scroll + every [data-scroll-restore] container's scroll
// into sessionStorage keyed by URL; on back/forward (popstate), re-apply the saved positions in a
// requestAnimationFrame retry loop until they "take" (beating the dynamic late-paint) or it times out.
// Fresh forward navigations are left at the top, as normal.

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  storageKey, serializeRecord, parseRecord, isAtTarget, hasScroll, type ScrollRecord,
} from '@/lib/scroll/scrollStore';

const SAVE_THROTTLE_MS = 150;
const MAX_RESTORE_FRAMES = 60; // ~1s at 60fps — long enough for a force-dynamic refetch to paint

// Full URL (path + search) from the browser — avoids useSearchParams (which would force a Suspense
// boundary / dynamic deopt). usePathname is only the effect trigger for route changes.
function currentUrl(): string {
  return window.location.pathname + window.location.search;
}

export default function ScrollRestoration() {
  const pathname = usePathname();
  const urlRef = useRef('');
  const isPopRef = useRef(false);

  // Track the current URL synchronously during render (not in an effect): after a client navigation
  // window.location is already the new URL, so a scroll-to-top fired during the transition saves
  // under the NEW page's key — never clobbering the page we just left.
  if (typeof window !== 'undefined') urlRef.current = currentUrl();

  // Take over scroll restoration from the browser, and flag back/forward navigations.
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    const onPop = () => { isPopRef.current = true; };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Continuously save the CURRENT url's positions (window + marked containers), throttled.
  // Capture phase so scrolls inside nested overflow containers are caught (scroll doesn't bubble).
  useEffect(() => {
    let rafId = 0;
    let lastSave = 0;

    const save = () => {
      const containers: ScrollRecord['c'] = {};
      document.querySelectorAll<HTMLElement>('[data-scroll-restore]').forEach((el) => {
        const key = el.getAttribute('data-scroll-restore');
        if (key) containers[key] = { top: el.scrollTop, left: el.scrollLeft };
      });
      const rec: ScrollRecord = { w: window.scrollY, c: containers };
      try { sessionStorage.setItem(storageKey(urlRef.current), serializeRecord(rec)); } catch { /* quota/private mode */ }
    };

    const onScroll = () => {
      const now = Date.now();
      if (now - lastSave >= SAVE_THROTTLE_MS) { lastSave = now; save(); }
      else { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(() => { lastSave = Date.now(); save(); }); }
    };

    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('pagehide', save);
    return () => {
      save(); // flush on unmount
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('pagehide', save);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Restore on back/forward arrival, retrying until the positions take (or timeout).
  useEffect(() => {
    if (!isPopRef.current) return; // only restore for back/forward — not fresh pushes (those go to top)
    isPopRef.current = false;

    const rec = parseRecord(sessionStorage.getItem(storageKey(currentUrl())));
    if (!rec || !hasScroll(rec)) return;

    let frame = 0;
    let rafId = 0;
    const apply = () => {
      let ready = true;

      for (const [key, pos] of Object.entries(rec.c)) {
        const el = document.querySelector<HTMLElement>(`[data-scroll-restore="${CSS.escape(key)}"]`);
        if (!el) { ready = false; continue; }            // container not painted yet — keep retrying
        el.scrollTop = pos.top;
        el.scrollLeft = pos.left;
        // content not tall/wide enough yet (e.g. the horizontally-scrolled leads board strip)
        if (!isAtTarget(pos.top, el.scrollTop) || !isAtTarget(pos.left, el.scrollLeft)) ready = false;
      }

      window.scrollTo(0, rec.w);
      if (!isAtTarget(rec.w, window.scrollY)) ready = false;

      frame += 1;
      if (!ready && frame < MAX_RESTORE_FRAMES) rafId = requestAnimationFrame(apply);
    };
    rafId = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(rafId);
  }, [pathname]);

  return null;
}
