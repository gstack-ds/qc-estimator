// Server-free helpers for seeding an estimate name from the selected venue/space.
// No React/Supabase — testable in isolation.

// Default placeholder names assigned at creation (see programs/actions.ts createEstimate).
// We only auto-seed the name when it's still one of these — never clobber a name the user typed.
const DEFAULT_NAME_RE = /^New (?:Venue |AV |Decor |Transportation |Tour )?Estimate$/;

export function isDefaultEstimateName(name: string | null | undefined): boolean {
  const t = (name ?? '').trim();
  return t === '' || DEFAULT_NAME_RE.test(t);
}

// "Venue — Space" when a space is chosen, otherwise just the venue name.
export function seedEstimateName(venueName: string, spaceName?: string | null): string {
  const v = (venueName ?? '').trim();
  const s = (spaceName ?? '').trim();
  return s ? `${v} — ${s}` : v;
}
