import { describe, it, expect } from 'vitest';
import {
  TOOL_USERS,
  isToolUser,
  filterToolUsers,
  memberInitials,
  type TeamMemberLike,
} from '../../src/lib/team/toolUsers';

// Mirrors the team_members seed (migration 019) — 9 members, 5 of which are tool users.
const ALL_MEMBERS: TeamMemberLike[] = [
  { id: 1, first_name: 'Alex', last_name: 'Stack', is_active: true },
  { id: 2, first_name: 'Lindsey', last_name: 'Correa', is_active: true },
  { id: 3, first_name: 'Lydia', last_name: 'Defore', is_active: true },
  { id: 4, first_name: 'Danielle', last_name: 'Rose', is_active: true },
  { id: 5, first_name: 'Abbie', last_name: 'Blair', is_active: true },
  { id: 6, first_name: 'Khloe', last_name: 'Parker', is_active: true },
  { id: 7, first_name: 'Jakie', last_name: 'Quill', is_active: true },
  { id: 8, first_name: 'Sonja', last_name: 'Pasko', is_active: true },
  { id: 9, first_name: 'Kelly', last_name: 'Saunders', is_active: true },
];

describe('TOOL_USERS', () => {
  it('is exactly the 5 estimator users', () => {
    expect(TOOL_USERS).toHaveLength(5);
    expect(TOOL_USERS.map((u) => u.firstName).sort()).toEqual(
      ['Abbie', 'Alex', 'Danielle', 'Khloe', 'Lindsey'],
    );
  });
});

describe('isToolUser', () => {
  it('returns true for the 5 tool users', () => {
    expect(isToolUser({ id: 1, first_name: 'Alex', last_name: 'Stack' })).toBe(true);
    expect(isToolUser({ id: 4, first_name: 'Danielle', last_name: 'Rose' })).toBe(true);
    expect(isToolUser({ id: 5, first_name: 'Abbie', last_name: 'Blair' })).toBe(true);
    expect(isToolUser({ id: 6, first_name: 'Khloe', last_name: 'Parker' })).toBe(true);
    expect(isToolUser({ id: 2, first_name: 'Lindsey', last_name: 'Correa' })).toBe(true);
  });

  it('returns false for non-tool team members', () => {
    expect(isToolUser({ id: 3, first_name: 'Lydia', last_name: 'Defore' })).toBe(false);
    expect(isToolUser({ id: 8, first_name: 'Sonja', last_name: 'Pasko' })).toBe(false);
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    expect(isToolUser({ id: 99, first_name: ' alex ', last_name: ' STACK ' })).toBe(true);
  });

  it('requires both first and last name to match (no first-name-only match)', () => {
    // A different "Alex" should NOT count as the tool user Alex Stack.
    expect(isToolUser({ id: 99, first_name: 'Alex', last_name: 'Johnson' })).toBe(false);
  });
});

describe('filterToolUsers', () => {
  it('returns exactly the 5 tool users in canonical order', () => {
    const result = filterToolUsers(ALL_MEMBERS);
    expect(result.map((m) => m.id)).toEqual([5, 4, 6, 2, 1]); // Abbie, Danielle, Khloe, Lindsey, Alex
  });

  it('excludes inactive members even if they are tool users', () => {
    const withInactive = ALL_MEMBERS.map((m) =>
      m.id === 6 ? { ...m, is_active: false } : m,
    );
    const result = filterToolUsers(withInactive);
    expect(result.find((m) => m.id === 6)).toBeUndefined();
    expect(result).toHaveLength(4);
  });

  it('returns empty array when no tool users present', () => {
    expect(filterToolUsers([{ id: 3, first_name: 'Lydia', last_name: 'Defore' }])).toEqual([]);
  });
});

describe('memberInitials', () => {
  it('builds two-letter uppercase initials from first + last name', () => {
    expect(memberInitials({ id: 6, first_name: 'Khloe', last_name: 'Parker' })).toBe('KP');
    expect(memberInitials({ id: 4, first_name: 'Danielle', last_name: 'Rose' })).toBe('DR');
    expect(memberInitials({ id: 1, first_name: 'Alex', last_name: 'Stack' })).toBe('AS');
    expect(memberInitials({ id: 5, first_name: 'Abbie', last_name: 'Blair' })).toBe('AB');
    expect(memberInitials({ id: 2, first_name: 'Lindsey', last_name: 'Correa' })).toBe('LC');
  });

  it('falls back to "?" when names are blank', () => {
    expect(memberInitials({ id: 0, first_name: '', last_name: '' })).toBe('?');
  });
});
