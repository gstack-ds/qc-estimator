// The ONLY public, no-login path family in the app: budget share links at /b/<token>.
// Pure + server-free so the auth middleware and its tests both import the exact same predicate.
// Kept deliberately narrow (requires a token segment after /b/) so no authed route is opened.
export function isPublicSharePath(pathname: string): boolean {
  return pathname.startsWith('/b/');
}
