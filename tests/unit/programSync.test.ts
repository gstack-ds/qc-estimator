import { describe, it, expect } from 'vitest';
import { programStatusToLeadStatus } from '@/lib/programs/constants';
import type { ProgramStatus } from '@/lib/programs/constants';

describe('programStatusToLeadStatus — terminal back-propagation mapping', () => {
  it('completed → completed', () => {
    expect(programStatusToLeadStatus('completed')).toBe('completed');
  });

  it('did_not_book → did_not_book', () => {
    expect(programStatusToLeadStatus('did_not_book')).toBe('did_not_book');
  });

  it('active → null (leave lead pipeline status alone)', () => {
    expect(programStatusToLeadStatus('active')).toBeNull();
  });

  it('covers all three ProgramStatus values', () => {
    const statuses: ProgramStatus[] = ['active', 'completed', 'did_not_book'];
    for (const s of statuses) {
      // should not throw
      expect(() => programStatusToLeadStatus(s)).not.toThrow();
    }
  });

  it('only completed and did_not_book produce a non-null lead status', () => {
    const terminal = (['active', 'completed', 'did_not_book'] as ProgramStatus[])
      .filter(s => programStatusToLeadStatus(s) !== null);
    expect(terminal).toEqual(['completed', 'did_not_book']);
  });

  it('returned values are the exact lead status strings the DB expects', () => {
    expect(programStatusToLeadStatus('completed')).toBe('completed');
    expect(programStatusToLeadStatus('did_not_book')).toBe('did_not_book');
  });
});
