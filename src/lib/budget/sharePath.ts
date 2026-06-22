// The public, no-login budget-share surfaces — the ONLY paths that bypass the auth gate:
//   /b/<token>                      → the public view page (Phase 2)
//   /api/budget/<token>/respond     → the client-capture write endpoint (Phase 3)
// Pure + server-free so the auth middleware and its tests import the exact same predicates.
// Kept deliberately narrow (a token segment always follows) so no authed route is opened.
// The respond endpoint does its own token validation server-side.

export function isPublicSharePath(pathname: string): boolean {
  return pathname.startsWith('/b/');
}

// Match ONLY the respond endpoint — never the whole /api/budget namespace — so a future route
// under /api/budget can't silently inherit the public bypass.
const RESPOND_RE = /^\/api\/budget\/[^/]+\/respond\/?$/;
export function isPublicShareApi(pathname: string): boolean {
  return RESPOND_RE.test(pathname);
}

export function isPublicBudgetSurface(pathname: string): boolean {
  return isPublicSharePath(pathname) || isPublicShareApi(pathname);
}
