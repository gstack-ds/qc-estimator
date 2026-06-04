// Tour guide scaling — pure TypeScript, no framework dependencies.
// Calculates how many guides are needed for a given group size, with support
// for venue guide caps and wave-based tour structures.

export interface GuideScalingInput {
  guestCount: number;
  guestsPerGuide: number;        // guests one guide can handle simultaneously
  selfGuided?: boolean;           // when true, no guides needed
  venueGuideCap?: number | null;  // venue maximum concurrent guides (null = no cap)
  waveSize?: number | null;       // max guests per tour wave (null = all guests at once)
}

export interface GuideScalingResult {
  selfGuided: boolean;
  guideCount: number;      // concurrent guides needed (per wave, or total if no waves)
  waveCount: number;       // how many sequential waves the group is split into
  totalGuideSlots: number; // guideCount × waveCount — use as qty for a line item
  cappedByVenue: boolean;  // true when venueGuideCap reduced the count
}

export function calculateGuideCount(input: GuideScalingInput): GuideScalingResult {
  const {
    guestCount,
    guestsPerGuide,
    selfGuided = false,
    venueGuideCap,
    waveSize,
  } = input;

  // Self-guided or no guests — no guides needed at all.
  if (selfGuided || guestCount <= 0) {
    return {
      selfGuided: !!selfGuided,
      guideCount: 0,
      waveCount: 1,
      totalGuideSlots: 0,
      cappedByVenue: false,
    };
  }

  const hasWaves = waveSize != null && waveSize > 0;

  // Number of waves: each wave holds at most waveSize guests.
  // min(waveSize, guestCount) covers the case where the group is smaller than one wave.
  const waveCount = hasWaves ? Math.ceil(guestCount / waveSize!) : 1;

  // Guides needed for the largest possible wave (conservative for partial last waves).
  const effectiveGroupSize = hasWaves ? Math.min(waveSize!, guestCount) : guestCount;
  const rawGuideCount = Math.ceil(effectiveGroupSize / guestsPerGuide);

  // Apply venue cap if it would reduce the guide count.
  const cappedByVenue = venueGuideCap != null && rawGuideCount > venueGuideCap;
  const guideCount = cappedByVenue ? venueGuideCap! : rawGuideCount;

  return {
    selfGuided: false,
    guideCount,
    waveCount,
    totalGuideSlots: guideCount * waveCount,
    cappedByVenue,
  };
}
