import { describe, it, expect } from 'vitest';
import { stateAbbrevFromLocation } from '../../src/lib/utils/locationLabel';

describe('stateAbbrevFromLocation', () => {
  it('extracts the state from "City, ST" format', () => {
    expect(stateAbbrevFromLocation('Middleburg, VA')).toBe('VA');
    expect(stateAbbrevFromLocation('Charlotte, NC')).toBe('NC');
    expect(stateAbbrevFromLocation('Washington, DC')).toBe('DC');
    expect(stateAbbrevFromLocation('New York City, NY')).toBe('NY');
  });

  it('extracts the state from "City (ST)" parenthetical format', () => {
    expect(stateAbbrevFromLocation('Lake Wylie (SC)')).toBe('SC');
    expect(stateAbbrevFromLocation('Fort Mill (SC)')).toBe('SC');
  });

  it('extracts the state from "City ST" (space, no comma)', () => {
    expect(stateAbbrevFromLocation('Middleburg VA')).toBe('VA');
  });

  it('returns empty string when there is no state — no dangling comma source', () => {
    expect(stateAbbrevFromLocation('Atlanta')).toBe('');
    expect(stateAbbrevFromLocation('')).toBe('');
    expect(stateAbbrevFromLocation(null)).toBe('');
    expect(stateAbbrevFromLocation(undefined)).toBe('');
  });

  it('does not mistake a non-state trailing token for a state', () => {
    // "Wylie" ends in no state code; a 2-letter city tail not in the set is ignored.
    expect(stateAbbrevFromLocation('Somewhere Xy')).toBe('');
    expect(stateAbbrevFromLocation('Lake Wylie')).toBe('');
  });

  it('normalizes lowercase state input to uppercase', () => {
    expect(stateAbbrevFromLocation('Middleburg, va')).toBe('VA');
    expect(stateAbbrevFromLocation('Lake Wylie (sc)')).toBe('SC');
  });
});
