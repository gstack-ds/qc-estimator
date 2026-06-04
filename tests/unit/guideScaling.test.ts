import { describe, it, expect } from 'vitest';
import { calculateGuideCount } from '../../src/lib/tours/guideScaling';

// ─── Basic guide count ──────────────────────────────────────────

describe('calculateGuideCount — basic ratio', () => {
  it('1 guest needs 1 guide (always at least 1)', () => {
    const r = calculateGuideCount({ guestCount: 1, guestsPerGuide: 15 });
    expect(r.guideCount).toBe(1);
    expect(r.waveCount).toBe(1);
    expect(r.totalGuideSlots).toBe(1);
  });

  it('exactly guestsPerGuide → 1 guide', () => {
    const r = calculateGuideCount({ guestCount: 15, guestsPerGuide: 15 });
    expect(r.guideCount).toBe(1);
  });

  it('one over the ratio rounds up (ceil)', () => {
    const r = calculateGuideCount({ guestCount: 16, guestsPerGuide: 15 });
    expect(r.guideCount).toBe(2);
  });

  it('60 guests / 15 per guide = 4 guides', () => {
    const r = calculateGuideCount({ guestCount: 60, guestsPerGuide: 15 });
    expect(r.guideCount).toBe(4);
  });

  it('45 guests / 20 per guide = 3 guides (ceil(2.25))', () => {
    const r = calculateGuideCount({ guestCount: 45, guestsPerGuide: 20 });
    expect(r.guideCount).toBe(3);
  });

  it('no waves → waveCount is 1 and totalGuideSlots equals guideCount', () => {
    const r = calculateGuideCount({ guestCount: 60, guestsPerGuide: 15 });
    expect(r.waveCount).toBe(1);
    expect(r.totalGuideSlots).toBe(4);
    expect(r.selfGuided).toBe(false);
    expect(r.cappedByVenue).toBe(false);
  });
});

// ─── Self-guided ────────────────────────────────────────────────

describe('calculateGuideCount — self-guided', () => {
  it('self_guided = true → 0 guides regardless of count', () => {
    const r = calculateGuideCount({ guestCount: 60, guestsPerGuide: 15, selfGuided: true });
    expect(r.guideCount).toBe(0);
    expect(r.totalGuideSlots).toBe(0);
    expect(r.selfGuided).toBe(true);
  });

  it('self_guided overrides venue cap and wave settings', () => {
    const r = calculateGuideCount({
      guestCount: 60,
      guestsPerGuide: 15,
      selfGuided: true,
      venueGuideCap: 3,
      waveSize: 20,
    });
    expect(r.guideCount).toBe(0);
    expect(r.totalGuideSlots).toBe(0);
    expect(r.waveCount).toBe(1);
  });

  it('self_guided = false (explicit) still calculates guides', () => {
    const r = calculateGuideCount({ guestCount: 60, guestsPerGuide: 15, selfGuided: false });
    expect(r.guideCount).toBe(4);
  });
});

// ─── Venue guide cap ────────────────────────────────────────────

describe('calculateGuideCount — venue guide cap', () => {
  it('cap limits guide count when needed > cap', () => {
    const r = calculateGuideCount({ guestCount: 60, guestsPerGuide: 15, venueGuideCap: 2 });
    expect(r.guideCount).toBe(2);
    expect(r.cappedByVenue).toBe(true);
  });

  it('cap does not limit when needed ≤ cap', () => {
    const r = calculateGuideCount({ guestCount: 60, guestsPerGuide: 15, venueGuideCap: 10 });
    expect(r.guideCount).toBe(4);
    expect(r.cappedByVenue).toBe(false);
  });

  it('cap equal to computed count → not considered capped', () => {
    const r = calculateGuideCount({ guestCount: 60, guestsPerGuide: 15, venueGuideCap: 4 });
    expect(r.guideCount).toBe(4);
    expect(r.cappedByVenue).toBe(false);
  });

  it('null cap → cappedByVenue false', () => {
    const r = calculateGuideCount({ guestCount: 60, guestsPerGuide: 15, venueGuideCap: null });
    expect(r.cappedByVenue).toBe(false);
    expect(r.guideCount).toBe(4);
  });

  it('no cap provided → cappedByVenue false', () => {
    const r = calculateGuideCount({ guestCount: 60, guestsPerGuide: 15 });
    expect(r.cappedByVenue).toBe(false);
  });
});

// ─── Wave logic ─────────────────────────────────────────────────

describe('calculateGuideCount — waves', () => {
  it('60 guests / waveSize 20 → 3 waves with 2 guides each', () => {
    // ceil(20/15) = 2 guides per wave; 3 waves → 6 total slots
    const r = calculateGuideCount({ guestCount: 60, guestsPerGuide: 15, waveSize: 20 });
    expect(r.waveCount).toBe(3);
    expect(r.guideCount).toBe(2);
    expect(r.totalGuideSlots).toBe(6);
  });

  it('waveSize ≥ guestCount → 1 wave, guides for actual guest count', () => {
    const r = calculateGuideCount({ guestCount: 15, guestsPerGuide: 15, waveSize: 20 });
    expect(r.waveCount).toBe(1);
    expect(r.guideCount).toBe(1);
    expect(r.totalGuideSlots).toBe(1);
  });

  it('partial last wave uses full wave size for guide calculation (conservative)', () => {
    // 50 guests, waveSize=20 → 3 waves (20+20+10), guides based on full wave of 20
    // ceil(20/15) = 2 guides, 3 waves → 6 total slots
    const r = calculateGuideCount({ guestCount: 50, guestsPerGuide: 15, waveSize: 20 });
    expect(r.waveCount).toBe(3);
    expect(r.guideCount).toBe(2);
    expect(r.totalGuideSlots).toBe(6);
  });

  it('totalGuideSlots = guideCount × waveCount', () => {
    const r = calculateGuideCount({ guestCount: 60, guestsPerGuide: 10, waveSize: 30 });
    expect(r.waveCount).toBe(2);
    expect(r.guideCount).toBe(3); // ceil(30/10)
    expect(r.totalGuideSlots).toBe(r.guideCount * r.waveCount);
  });

  it('null waveSize → no wave splitting', () => {
    const r = calculateGuideCount({ guestCount: 60, guestsPerGuide: 15, waveSize: null });
    expect(r.waveCount).toBe(1);
    expect(r.guideCount).toBe(4);
  });
});

// ─── Waves + cap combination ────────────────────────────────────

describe('calculateGuideCount — waves + venue cap', () => {
  it('cap applies per-wave guide count', () => {
    // 60 guests, waveSize=20, guestsPerGuide=5 → 4 guides/wave, cap=3 → 3 guides/wave
    const r = calculateGuideCount({
      guestCount: 60,
      guestsPerGuide: 5,
      waveSize: 20,
      venueGuideCap: 3,
    });
    expect(r.waveCount).toBe(3);
    expect(r.guideCount).toBe(3);
    expect(r.totalGuideSlots).toBe(9);
    expect(r.cappedByVenue).toBe(true);
  });

  it('cap not limiting when large enough (with waves)', () => {
    const r = calculateGuideCount({
      guestCount: 60,
      guestsPerGuide: 5,
      waveSize: 20,
      venueGuideCap: 10,
    });
    expect(r.guideCount).toBe(4); // ceil(20/5)
    expect(r.cappedByVenue).toBe(false);
  });
});

// ─── Edge cases ─────────────────────────────────────────────────

describe('calculateGuideCount — edge cases', () => {
  it('0 guests → 0 guides', () => {
    const r = calculateGuideCount({ guestCount: 0, guestsPerGuide: 15 });
    expect(r.guideCount).toBe(0);
    expect(r.totalGuideSlots).toBe(0);
    expect(r.waveCount).toBe(1);
  });

  it('very large group scales correctly', () => {
    // 200 guests, 15/guide → ceil(200/15) = 14 guides
    const r = calculateGuideCount({ guestCount: 200, guestsPerGuide: 15 });
    expect(r.guideCount).toBe(14);
  });

  it('guestsPerGuide = 1 → one guide per guest', () => {
    const r = calculateGuideCount({ guestCount: 5, guestsPerGuide: 1 });
    expect(r.guideCount).toBe(5);
  });

  it('always returns non-negative totalGuideSlots', () => {
    for (const gc of [0, 1, 5, 60, 200]) {
      const r = calculateGuideCount({ guestCount: gc, guestsPerGuide: 15 });
      expect(r.totalGuideSlots).toBeGreaterThanOrEqual(0);
    }
  });
});
