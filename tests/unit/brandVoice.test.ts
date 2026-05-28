import { describe, it, expect } from 'vitest';
import {
  spellNumber,
  oxfordComma,
  removeDashes,
  formatCurrency,
  checkBannedWords,
  checkSparingWords,
} from '../../src/lib/slideCopy/brandVoice';

describe('spellNumber', () => {
  it('spells zero through nine', () => {
    expect(spellNumber(0)).toBe('zero');
    expect(spellNumber(1)).toBe('one');
    expect(spellNumber(5)).toBe('five');
    expect(spellNumber(9)).toBe('nine');
  });

  it('returns numerals for 10 and above', () => {
    expect(spellNumber(10)).toBe('10');
    expect(spellNumber(12)).toBe('12');
    expect(spellNumber(100)).toBe('100');
  });
});

describe('oxfordComma', () => {
  it('returns empty string for empty array', () => {
    expect(oxfordComma([])).toBe('');
  });

  it('returns single item unchanged', () => {
    expect(oxfordComma(['a'])).toBe('a');
  });

  it('joins two items with and (no comma)', () => {
    expect(oxfordComma(['a', 'b'])).toBe('a and b');
  });

  it('joins three items with Oxford comma', () => {
    expect(oxfordComma(['a', 'b', 'c'])).toBe('a, b, and c');
  });

  it('joins four items with Oxford comma', () => {
    expect(oxfordComma(['a', 'b', 'c', 'd'])).toBe('a, b, c, and d');
  });
});

describe('removeDashes', () => {
  it('replaces em dash with comma-space', () => {
    expect(removeDashes('foo — bar')).toBe('foo, bar');
  });

  it('replaces en dash with comma-space', () => {
    expect(removeDashes('foo – bar')).toBe('foo, bar');
  });

  it('handles no surrounding spaces on dash', () => {
    expect(removeDashes('foo—bar')).toBe('foo, bar');
  });

  it('leaves text without dashes unchanged', () => {
    expect(removeDashes('hello world')).toBe('hello world');
  });
});

describe('formatCurrency', () => {
  it('formats thousands with comma', () => {
    expect(formatCurrency(65758)).toBe('$65,758');
    expect(formatCurrency(1000)).toBe('$1,000');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('rounds to nearest dollar', () => {
    expect(formatCurrency(65758.75)).toBe('$65,759');
    expect(formatCurrency(65758.25)).toBe('$65,758');
  });
});

describe('checkBannedWords', () => {
  it('flags banned words found in text', () => {
    expect(checkBannedWords('office party tonight')).toContain('party');
  });

  it('flags decor', () => {
    expect(checkBannedWords('floral decor arrangement')).toContain('decor');
  });

  it('returns empty array when no banned words', () => {
    expect(checkBannedWords('elegant dinner event')).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    expect(checkBannedWords('PARTY time')).toContain('party');
  });
});

describe('checkSparingWords', () => {
  it('flags sparing words found in text', () => {
    expect(checkSparingWords('an elevated experience')).toContain('elevated');
    expect(checkSparingWords('curated selection of wines')).toContain('curated');
  });

  it('returns empty array when none present', () => {
    expect(checkSparingWords('a great dinner for guests')).toHaveLength(0);
  });
});
