import { describe, it, expect } from 'vitest';
import { normalizeAddress, normalizeName } from '@/lib/venues/normalize';

describe('normalizeAddress', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeAddress('123 Main St.')).toBe('123 main st');
  });

  it('collapses extra whitespace', () => {
    expect(normalizeAddress('  123  Main   St  ')).toBe('123 main st');
  });

  it('strips commas', () => {
    expect(normalizeAddress('123 Main St, Charlotte, NC 28202')).toBe('123 main st charlotte nc 28202');
  });

  it('strips trailing period and normalizes case', () => {
    expect(normalizeAddress('123 Main St.')).toBe(normalizeAddress('123 main st'));
  });

  it('treats addresses with same tokens as equal regardless of punctuation', () => {
    // Address-level normalization: "Charlotte, NC 28202" vs "charlotte nc 28202"
    expect(normalizeAddress('Charlotte, NC 28202')).toBe(normalizeAddress('charlotte nc 28202'));
  });
});

describe('normalizeName', () => {
  it('strips spaces and punctuation', () => {
    expect(normalizeName('5Church')).toBe('5church');
    expect(normalizeName('5 Church')).toBe('5church');
  });

  it('detects "5Church" vs "5 Church" as same', () => {
    expect(normalizeName('5Church')).toBe(normalizeName('5 Church'));
  });

  it('detects "The Ballantyne" vs "Ballantyne" as different', () => {
    expect(normalizeName('The Ballantyne')).not.toBe(normalizeName('Ballantyne'));
  });

  it('strips hyphens and apostrophes', () => {
    expect(normalizeName("O'Hare Hall")).toBe('oharehall');
    expect(normalizeName('SkyView Bar-Grill')).toBe('skyviewbargrill');
  });
});

describe('duplicate detection logic', () => {
  // Simulates what createVenue does: normalize incoming data and compare to existing
  function wouldBlockCreation(
    incoming: { name: string; address: string },
    existing: { name: string; address: string }[],
  ): { blocked: boolean; reason: 'exact_address' | 'similar_name' | null; existingName?: string } {
    const normAddr = normalizeAddress(incoming.address);
    const normName = normalizeName(incoming.name);

    const addressMatch = existing.find((v) => normalizeAddress(v.address) === normAddr);
    if (addressMatch) return { blocked: true, reason: 'exact_address', existingName: addressMatch.name };

    const nameMatch = existing.find((v) => normalizeName(v.name) === normName);
    if (nameMatch) return { blocked: false, reason: 'similar_name', existingName: nameMatch.name };

    return { blocked: false, reason: null };
  }

  it('hard-blocks when address normalizes to the same string', () => {
    const result = wouldBlockCreation(
      { name: 'Venue A', address: '123 Main Street' },
      [{ name: 'Venue B', address: '123 main street' }],
    );
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('exact_address');
  });

  it('warns (not blocks) when name normalizes to same but addresses differ', () => {
    const result = wouldBlockCreation(
      { name: '5 Church', address: '300 N Tryon St' },
      [{ name: '5Church', address: '301 N Tryon St' }],
    );
    expect(result.blocked).toBe(false);
    expect(result.reason).toBe('similar_name');
    expect(result.existingName).toBe('5Church');
  });

  it('allows creation when both name and address differ', () => {
    const result = wouldBlockCreation(
      { name: 'New Venue', address: '999 Different Ave' },
      [{ name: 'Other Venue', address: '123 Main St' }],
    );
    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
  });
});
