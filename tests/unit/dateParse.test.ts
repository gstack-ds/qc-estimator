import { describe, it, expect } from 'vitest';
import { parseFlexibleDate, formatDateDisplay } from '../../src/lib/leads/dateParse';

// Fixed reference year so "bare M/D" tests are deterministic.
const CY = 2026;
const p = (s: string) => parseFlexibleDate(s, CY);

describe('parseFlexibleDate — accepted formats', () => {
  it('M/D/YYYY', () => expect(p('5/11/2027')).toBe('2027-05-11'));
  it('MM/DD/YYYY (zero-padded)', () => expect(p('05/11/2027')).toBe('2027-05-11'));
  it('M/D/YY -> 20YY', () => expect(p('5/11/27')).toBe('2027-05-11'));
  it('M-D-YYYY (dashes)', () => expect(p('5-11-2027')).toBe('2027-05-11'));
  it('M-D-YY (dashes, 2-digit)', () => expect(p('5-11-27')).toBe('2027-05-11'));
  it('YYYY-MM-DD (ISO)', () => expect(p('2027-05-11')).toBe('2027-05-11'));
  it('YYYY/MM/DD', () => expect(p('2027/05/11')).toBe('2027-05-11'));
  it('"May 11 2027"', () => expect(p('May 11 2027')).toBe('2027-05-11'));
  it('"May 11, 2027" (comma)', () => expect(p('May 11, 2027')).toBe('2027-05-11'));
  it('"11 May 2027" (day first)', () => expect(p('11 May 2027')).toBe('2027-05-11'));
  it('full month name "September 3, 2027"', () => expect(p('September 3, 2027')).toBe('2027-09-03'));
  it('abbrev "Sept 3 2027"', () => expect(p('Sept 3 2027')).toBe('2027-09-03'));
  it('case-insensitive "may 11 2027"', () => expect(p('may 11 2027')).toBe('2027-05-11'));
  it('trims surrounding whitespace', () => expect(p('  5/11/2027  ')).toBe('2027-05-11'));
  it('paste from an RFP "5/11/2027"', () => expect(p('5/11/2027')).toBe('2027-05-11'));
});

describe('parseFlexibleDate — bare M/D uses CURRENT year', () => {
  it('"5/11" -> current year', () => expect(p('5/11')).toBe('2026-05-11'));
  it('"5-11" -> current year', () => expect(p('5-11')).toBe('2026-05-11'));
  it('"May 11" (no year) -> current year', () => expect(p('May 11')).toBe('2026-05-11'));
  it('"11 May" (no year) -> current year', () => expect(p('11 May')).toBe('2026-05-11'));
  it('honors a different reference year', () => expect(parseFlexibleDate('5/11', 2030)).toBe('2030-05-11'));
});

describe('parseFlexibleDate — US month/day for ambiguous numeric', () => {
  it('"5/11" = May 11, not Nov 5', () => expect(p('5/11')).toBe('2026-05-11'));
  it('"3/4/2027" = March 4', () => expect(p('3/4/2027')).toBe('2027-03-04'));
  it('"11/5/2027" = November 5', () => expect(p('11/5/2027')).toBe('2027-11-05'));
});

describe('parseFlexibleDate — NO day-shift (string math, never new Date)', () => {
  // If the value were built via new Date('YYYY-MM-DD') (UTC midnight), Eastern
  // rendering would roll these back a day / a year. Exact-string equality proves
  // the parser never does that.
  it('ISO round-trips exactly', () => expect(p('2027-05-11')).toBe('2027-05-11'));
  it('year boundary 12/31 stays in-year', () => expect(p('12/31/2027')).toBe('2027-12-31'));
  it('year boundary 1/1 stays in-year', () => expect(p('1/1/2027')).toBe('2027-01-01'));
  it('formatDateDisplay does not shift', () => expect(formatDateDisplay('2027-01-01')).toBe('Jan 1, 2027'));
});

describe('parseFlexibleDate — leap year validation', () => {
  it('Feb 29 valid in a leap year (2028)', () => expect(p('2/29/2028')).toBe('2028-02-29'));
  it('Feb 29 invalid in a non-leap year (2027)', () => expect(p('2/29/2027')).toBeNull());
});

describe('parseFlexibleDate — rejects garbage (returns null, caller keeps raw text)', () => {
  it('empty string', () => expect(p('')).toBeNull());
  it('whitespace only', () => expect(p('   ')).toBeNull());
  it('null', () => expect(parseFlexibleDate(null, CY)).toBeNull());
  it('nonsense text', () => expect(p('not a date')).toBeNull());
  it('month > 12', () => expect(p('13/45/2027')).toBeNull());
  it('day out of range', () => expect(p('5/32/2027')).toBeNull());
  it('Feb 30 never valid', () => expect(p('2/30/2027')).toBeNull());
  it('3-digit year', () => expect(p('5/11/127')).toBeNull());
  it('unknown month name', () => expect(p('Maybe 11 2027')).toBeNull());
});

describe('formatDateDisplay', () => {
  it('formats ISO to "Mon D, YYYY"', () => expect(formatDateDisplay('2027-05-11')).toBe('May 11, 2027'));
  it('handles a full timestamp by slicing', () => expect(formatDateDisplay('2027-05-11T00:00:00')).toBe('May 11, 2027'));
  it('empty/null -> empty string', () => {
    expect(formatDateDisplay(null)).toBe('');
    expect(formatDateDisplay('')).toBe('');
  });
});
