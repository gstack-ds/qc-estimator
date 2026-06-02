import { describe, it, expect } from 'vitest';
import { validateVenueInput } from '@/lib/venues/validate';

const NO_EXISTING: { id: string; name: string; address: string | null }[] = [];

const EXISTING = [
  { id: 'uuid-1', name: '5Church', address: '127 N Tryon St, Charlotte NC 28202' },
  { id: 'uuid-2', name: 'The Ballantyne', address: '10000 Ballantyne Commons Pkwy, Charlotte NC 28277' },
];

// ─── Address required ─────────────────────────────────────

describe('validateVenueInput — address required', () => {
  it('rejects when address is undefined', () => {
    const result = validateVenueInput({ name: 'Panera' }, NO_EXISTING);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_address');
  });

  it('rejects when address is null', () => {
    const result = validateVenueInput({ name: 'Panera', address: null }, NO_EXISTING);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_address');
  });

  it('rejects when address is empty string', () => {
    const result = validateVenueInput({ name: 'Panera', address: '' }, NO_EXISTING);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_address');
  });

  it('rejects when address is whitespace-only', () => {
    const result = validateVenueInput({ name: 'Panera', address: '   ' }, NO_EXISTING);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_address');
  });

  it('accepts when address is provided', () => {
    const result = validateVenueInput({ name: 'Panera', address: '100 Any St' }, NO_EXISTING);
    expect(result.ok).toBe(true);
  });
});

// ─── Duplicate address — hard block ──────────────────────

describe('validateVenueInput — duplicate address', () => {
  it('hard-blocks exact address match (same case)', () => {
    const result = validateVenueInput(
      { name: 'New Name', address: '127 N Tryon St, Charlotte NC 28202' },
      EXISTING,
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === 'duplicate_address') {
      expect(result.existingId).toBe('uuid-1');
      expect(result.existingName).toBe('5Church');
    } else {
      expect(result.ok ? 'ok' : result.reason).toBe('duplicate_address');
    }
  });

  it('hard-blocks address that differs only by punctuation and case', () => {
    // "127 N Tryon St, Charlotte NC 28202" normalized = "127 n tryon st charlotte nc 28202"
    const result = validateVenueInput(
      { name: 'New Name', address: '127 N. Tryon St Charlotte, NC 28202' },
      EXISTING,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('duplicate_address');
  });

  it('allows a different address even with a similar name', () => {
    const result = validateVenueInput(
      { name: '5Church', address: '500 Different Ave' },
      EXISTING,
    );
    // Same name → should warn (similar_name), not hard-block on address
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('similar_name');
  });
});

// ─── Fuzzy name match — soft warning ─────────────────────

describe('validateVenueInput — fuzzy name match', () => {
  it('warns when normalized name matches "panera" vs "Panera"', () => {
    const existing = [{ id: 'uuid-3', name: 'Panera', address: '100 Old St' }];
    const result = validateVenueInput({ name: 'panera', address: '200 New St' }, existing);
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === 'similar_name') {
      expect(result.existingName).toBe('Panera');
    } else {
      expect(result.ok ? 'ok' : result.reason).toBe('similar_name');
    }
  });

  it('warns when "5 Church" matches "5Church"', () => {
    const result = validateVenueInput(
      { name: '5 Church', address: '500 Different Ave' },
      EXISTING,
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === 'similar_name') {
      expect(result.existingName).toBe('5Church');
    } else {
      expect(result.ok ? 'ok' : result.reason).toBe('similar_name');
    }
  });

  it('skips name check when skipNameCheck=true', () => {
    const result = validateVenueInput(
      { name: '5 Church', address: '500 Different Ave' },
      EXISTING,
      true,
    );
    expect(result.ok).toBe(true);
  });

  it('passes when name and address are both unique', () => {
    const result = validateVenueInput(
      { name: 'Brand New Venue', address: '999 Unique Street' },
      EXISTING,
    );
    expect(result.ok).toBe(true);
  });
});

// ─── Address-check priority ───────────────────────────────

describe('validateVenueInput — address check takes priority over name check', () => {
  it('returns duplicate_address even if name is unique', () => {
    const result = validateVenueInput(
      { name: 'Totally Unique Name', address: '10000 Ballantyne Commons Pkwy, Charlotte NC 28277' },
      EXISTING,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('duplicate_address');
  });
});
