export type FbBreakEvenReason = 'no_minimum' | 'already_met' | 'no_pp_items';

export interface FbBreakEvenItem {
  qty: number;
  unitPrice: number;
  isRevenueItem?: boolean;
}

export interface FbBreakEvenResult {
  breakEvenGuestCount: number | null;
  reason?: FbBreakEvenReason;
  currentlyMet: boolean;
}

/**
 * Calculates the minimum guest count at which the F&B vendor cost meets the F&B minimum.
 *
 * Per-person items are detected by heuristic: qty === guestCount (guestCount > 0).
 * All other items are treated as flat costs.
 *
 * Returns null breakEvenGuestCount when:
 * - No minimum is set (reason: 'no_minimum')
 * - Flat items alone already meet the minimum (reason: 'already_met')
 * - No per-person items contribute cost (reason: 'no_pp_items')
 */
export function calculateFbBreakEven(
  fbMinimum: number,
  guestCount: number,
  fbItems: FbBreakEvenItem[],
): FbBreakEvenResult {
  if (fbMinimum <= 0) {
    return { breakEvenGuestCount: null, reason: 'no_minimum', currentlyMet: true };
  }

  const relevant = fbItems.filter((i) => !i.isRevenueItem);

  // Per-person items: qty equals guestCount (only meaningful when guestCount > 0)
  const ppItems = guestCount > 0 ? relevant.filter((i) => i.qty === guestCount) : [];
  const flatItems = relevant.filter((i) => !(guestCount > 0 && i.qty === guestCount));

  const flatCost = flatItems.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const ppCostPerGuest = ppItems.reduce((s, i) => s + i.unitPrice, 0);
  const currentTotal = flatCost + ppCostPerGuest * (guestCount > 0 ? guestCount : 0);
  const currentlyMet = currentTotal >= fbMinimum;

  if (flatCost >= fbMinimum) {
    return { breakEvenGuestCount: null, reason: 'already_met', currentlyMet: true };
  }

  if (ppCostPerGuest <= 0) {
    return { breakEvenGuestCount: null, reason: 'no_pp_items', currentlyMet };
  }

  const breakEvenGuestCount = Math.ceil((fbMinimum - flatCost) / ppCostPerGuest);
  return { breakEvenGuestCount, currentlyMet };
}
