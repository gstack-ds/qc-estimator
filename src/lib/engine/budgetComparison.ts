// Budget comparison engine — pure TypeScript, no React/Next/Supabase imports.

export type ComparisonStatus = 'under' | 'within_range' | 'over';

export interface BudgetTarget {
  pricingBasis: 'per_person' | 'flat';
  valueLow: number;
  valueHigh: number;
  pinnedValue: number | null;
  guestCount: number;
}

export interface EstimateVsBudget {
  estimateId: string;
  total: number;
  pricePerPerson: number;
  budgetLow: number;
  budgetHigh: number;
  budgetPinned: number;
  delta: number;          // total - budgetPinned; positive = over
  status: ComparisonStatus;
}

export interface CombineVsBudget {
  combinedTotal: number;
  budgetLow: number;
  budgetHigh: number;
  budgetPinned: number;
  remaining: number;      // budgetPinned - combinedTotal; negative = over
  pctConsumed: number;    // clamped 0–1 for progress bar
  status: ComparisonStatus;
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

export function statusForValue(value: number, low: number, high: number): ComparisonStatus {
  if (value < low) return 'under';
  if (value > high) return 'over';
  return 'within_range';
}

// Converts a BudgetTarget to flat dollar amounts (low, high, pinned).
export function effectiveBudgetFlat(target: BudgetTarget): { low: number; high: number; pinned: number } {
  const multiplier = target.pricingBasis === 'per_person' ? target.guestCount : 1;
  const low = target.valueLow * multiplier;
  const high = target.valueHigh * multiplier;
  const midpoint = ((target.valueLow + target.valueHigh) / 2) * multiplier;
  const pinned = target.pinnedValue !== null ? target.pinnedValue * multiplier : midpoint;
  return { low, high, pinned };
}

// ─── compare_each ─────────────────────────────────────────────────────────────

export function compareEstimateToBudget(
  estimateId: string,
  total: number,
  guestCount: number,
  target: BudgetTarget,
): EstimateVsBudget {
  const { low, high, pinned } = effectiveBudgetFlat(target);
  const pricePerPerson = guestCount > 0 ? Math.ceil(total / guestCount) : 0;
  return {
    estimateId,
    total,
    pricePerPerson,
    budgetLow: low,
    budgetHigh: high,
    budgetPinned: pinned,
    delta: total - pinned,
    status: statusForValue(total, low, high),
  };
}

// ─── combine ─────────────────────────────────────────────────────────────────

export function combineEstimatesToBudget(
  cards: Array<{ id: string; total: number; includeInBudget: boolean }>,
  target: BudgetTarget,
): CombineVsBudget {
  const combinedTotal = cards
    .filter((c) => c.includeInBudget)
    .reduce((sum, c) => sum + c.total, 0);

  const { low, high, pinned } = effectiveBudgetFlat(target);
  const remaining = pinned - combinedTotal;
  const pctConsumed = pinned > 0 ? Math.min(1, combinedTotal / pinned) : combinedTotal > 0 ? 1 : 0;

  return {
    combinedTotal,
    budgetLow: low,
    budgetHigh: high,
    budgetPinned: pinned,
    remaining,
    pctConsumed,
    status: statusForValue(combinedTotal, low, high),
  };
}
