import { describe, it, expect } from 'vitest';
import {
  getTrafficWindow,
  formatMinsRange,
  formatDriveLine,
  shouldShowWalking,
  formatWalkLine,
  isSameProperty,
  buildPlanningNotes,
} from '../../src/lib/slideCopy/travel';

describe('getTrafficWindow', () => {
  it('returns AM rush hour for 7am on a weekday', () => {
    const w = getTrafficWindow(7, 2);
    expect(w.label).toBe('AM rush hour');
    expect(w.minMultiplier).toBe(1.5);
    expect(w.maxMultiplier).toBe(2.5);
  });

  it('returns Off-peak for 11am on a weekday', () => {
    expect(getTrafficWindow(11, 3).label).toBe('Off-peak');
  });

  it('returns PM rush hour for 5pm on a Wednesday', () => {
    const w = getTrafficWindow(17, 3);
    expect(w.label).toBe('PM rush hour');
    expect(w.minMultiplier).toBe(1.8);
  });

  it('returns PM rush hour (heavy) for 5pm on a Thursday', () => {
    const w = getTrafficWindow(17, 4);
    expect(w.label).toBe('PM rush hour (heavy)');
    expect(w.minMultiplier).toBe(2.0);
    expect(w.maxMultiplier).toBe(2.7);
  });

  it('returns PM rush hour (heavy) for 5pm on a Friday', () => {
    expect(getTrafficWindow(17, 5).label).toBe('PM rush hour (heavy)');
  });

  it('returns Light evening traffic for 8pm on a weekday', () => {
    expect(getTrafficWindow(20, 2).label).toBe('Light evening traffic');
  });

  it('returns Weekend traffic on Saturday', () => {
    expect(getTrafficWindow(17, 6).label).toBe('Weekend traffic');
  });

  it('returns Weekend traffic on Sunday', () => {
    expect(getTrafficWindow(8, 0).label).toBe('Weekend traffic');
  });

  it('returns Off-peak after 10pm', () => {
    expect(getTrafficWindow(23, 2).label).toBe('Off-peak');
  });
});

describe('formatMinsRange', () => {
  it('formats a range rounded to nearest 5', () => {
    expect(formatMinsRange(18, 1.8, 2.5)).toBe('30 to 45 min');
  });

  it('shows single value when lo equals hi', () => {
    expect(formatMinsRange(10, 1.0, 1.0)).toBe('10 min');
  });
});

describe('formatDriveLine', () => {
  it('includes miles and traffic label', () => {
    const window = getTrafficWindow(17, 4);
    const line = formatDriveLine(6, 18, window);
    expect(line).toContain('6 miles');
    expect(line).toContain('PM rush hour (heavy)');
  });

  it('omits traffic label for off-peak', () => {
    const window = getTrafficWindow(11, 2);
    const line = formatDriveLine(3, 15, window);
    expect(line).not.toContain('(Off-peak)');
    expect(line).toContain('3 miles');
  });

  it('uses singular mile for 1 mile', () => {
    const window = getTrafficWindow(11, 2);
    const line = formatDriveLine(1, 10, window);
    expect(line).toContain('1 mile');
    expect(line).not.toContain('1 miles');
  });

  it('uses "to" not hyphens in range (brand voice)', () => {
    const window = getTrafficWindow(17, 3);
    const line = formatDriveLine(6, 18, window);
    expect(line).not.toContain('–');
    expect(line).not.toContain('—');
    expect(line).toContain('to');
  });
});

describe('shouldShowWalking', () => {
  it('returns true for short walkable distance', () => {
    expect(shouldShowWalking(0.5, 10)).toBe(true);
  });

  it('returns false when distance too far', () => {
    expect(shouldShowWalking(1.2, 25)).toBe(false);
  });

  it('returns false when walk time too long', () => {
    expect(shouldShowWalking(0.8, 21)).toBe(false);
  });

  it('returns true at exactly 1 mile and 20 min', () => {
    expect(shouldShowWalking(1.0, 20)).toBe(true);
  });

  it('returns false for 9.2 miles (SPIN Philadelphia bad example)', () => {
    expect(shouldShowWalking(9.2, 25)).toBe(false);
  });
});

describe('formatWalkLine', () => {
  it('formats walk time in minutes', () => {
    expect(formatWalkLine(12)).toBe('12 min walk');
  });
});

describe('isSameProperty', () => {
  it('returns true when hotel and venue share significant words', () => {
    expect(
      isSameProperty('JW Marriott Atlanta Buckhead', 'JW Marriott Atlanta Buckhead Grand Ballroom')
    ).toBe(true);
  });

  it('returns false for different properties', () => {
    expect(isSameProperty('JW Marriott Atlanta Buckhead', 'World of Coca-Cola Atlanta')).toBe(false);
  });

  it('returns false for empty hotel name', () => {
    expect(isSameProperty('', 'World of Coca-Cola')).toBe(false);
  });

  it('returns false for empty venue name', () => {
    expect(isSameProperty('JW Marriott', '')).toBe(false);
  });
});

describe('buildPlanningNotes', () => {
  it('includes departure time and hotel name', () => {
    const notes = buildPlanningNotes({
      startTime: '18:00',
      maxDriveMins: 45,
      distanceMiles: 6,
      dayOfWeek: 4,
      hotelName: 'JW Marriott Atlanta Buckhead',
    });
    expect(notes).toContain('6:00 PM');
    expect(notes).toContain('JW Marriott Atlanta Buckhead');
  });

  it('adds Thursday warning', () => {
    const notes = buildPlanningNotes({
      startTime: '18:00',
      maxDriveMins: 45,
      distanceMiles: 6,
      dayOfWeek: 4,
      hotelName: 'Marriott',
    });
    expect(notes).toContain('Thursday');
  });

  it('adds Friday warning', () => {
    const notes = buildPlanningNotes({
      startTime: '18:00',
      maxDriveMins: 45,
      distanceMiles: 6,
      dayOfWeek: 5,
      hotelName: 'Marriott',
    });
    expect(notes).toContain('Friday');
  });

  it('adds motor coach recommendation over 5 miles', () => {
    const notes = buildPlanningNotes({
      startTime: '19:00',
      maxDriveMins: 60,
      distanceMiles: 8,
      dayOfWeek: 2,
      hotelName: 'Hyatt',
    });
    expect(notes).toContain('motor coach');
  });

  it('does not add day warning for Wednesday', () => {
    const notes = buildPlanningNotes({
      startTime: '18:00',
      maxDriveMins: 20,
      distanceMiles: 3,
      dayOfWeek: 2,
      hotelName: 'Marriott',
    });
    expect(notes).not.toContain('Thursday');
    expect(notes).not.toContain('Friday');
  });
});
