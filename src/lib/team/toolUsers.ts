// Server-free helpers for the 5 QC Estimator "tool users" — the team members who
// actually build estimates and get assigned to them. No React, no Supabase imports,
// so it is safe to use from client components and to unit-test in isolation.
//
// These 5 already exist in the team_members table (migration 019). This module does
// not create them — it only identifies them within a full team_members list and
// formats their initials for the assigned-to badge.

export interface TeamMemberLike {
  id: number;
  first_name: string;
  last_name: string;
  is_active?: boolean;
}

// The 5 people who use the estimator and can be assigned to an estimate.
// Matched by full name (case-insensitive) so the set is stable across environments
// regardless of team_members serial IDs.
export const TOOL_USERS: { firstName: string; lastName: string }[] = [
  { firstName: 'Abbie', lastName: 'Blair' },
  { firstName: 'Danielle', lastName: 'Rose' },
  { firstName: 'Khloe', lastName: 'Parker' },
  { firstName: 'Lindsey', lastName: 'Correa' },
  { firstName: 'Alex', lastName: 'Stack' },
];

const TOOL_USER_KEYS = new Set(
  TOOL_USERS.map((u) => `${u.firstName} ${u.lastName}`.trim().toLowerCase()),
);

function fullNameKey(member: TeamMemberLike): string {
  const first = (member.first_name ?? '').trim();
  const last = (member.last_name ?? '').trim();
  return `${first} ${last}`.trim().toLowerCase();
}

// Is this team member one of the 5 estimator tool users?
export function isToolUser(member: TeamMemberLike): boolean {
  return TOOL_USER_KEYS.has(fullNameKey(member));
}

// Filter a full team_members list down to the 5 tool users, in the canonical
// TOOL_USERS order. Inactive members are excluded.
export function filterToolUsers<T extends TeamMemberLike>(members: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const m of members) {
    if (m.is_active === false) continue;
    if (isToolUser(m)) byKey.set(fullNameKey(m), m);
  }
  const ordered: T[] = [];
  for (const u of TOOL_USERS) {
    const m = byKey.get(`${u.firstName} ${u.lastName}`.trim().toLowerCase());
    if (m) ordered.push(m);
  }
  return ordered;
}

// Two-letter initials for the badge: first letter of first + first letter of last.
// e.g. "Khloe Parker" → "KP", "Danielle Rose" → "DR", "Alex Stack" → "AS".
export function memberInitials(member: TeamMemberLike): string {
  const f = (member.first_name ?? '').trim();
  const l = (member.last_name ?? '').trim();
  const fi = f ? f[0] : '';
  const li = l ? l[0] : '';
  const initials = `${fi}${li}`.toUpperCase();
  return initials || '?';
}
