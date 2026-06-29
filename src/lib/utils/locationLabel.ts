// Display helper for the tax-column jurisdiction label.
// Returns the US state abbreviation for a stored location name, or '' when none is present.
// DISPLAY ONLY — the tax RATE comes from the numeric rate columns (foodTaxRate / alcoholTaxRate /
// generalTaxRate), never from this string. Shared by the proposal PDF (ProposalDocument) and the
// on-screen builder tax column (LineItemRow) so the two always read the same.
//
// Locations are stored in a few shapes:
//   "City, ST"   -> "ST"   (e.g. "Middleburg, VA" -> "VA")
//   "City (ST)"  -> "ST"   (e.g. "Lake Wylie (SC)" -> "SC")
//   "City"       -> ""     (e.g. "Atlanta" -> "")  — caller shows just the rate, no dangling comma
const STATE_ABBREVS = new Set(['NC', 'SC', 'GA', 'VA', 'PA', 'MD', 'NY', 'NJ', 'DC']);

export function stateAbbrevFromLocation(name: string | null | undefined): string {
  if (!name) return '';
  // Parenthetical form: "Lake Wylie (SC)"
  const paren = name.match(/\(\s*([A-Za-z]{2})\s*\)\s*$/);
  if (paren && STATE_ABBREVS.has(paren[1].toUpperCase())) return paren[1].toUpperCase();
  // Trailing form: "Middleburg, VA" (comma) or "Middleburg VA" (space)
  const trail = name.match(/[,\s]\s*([A-Za-z]{2})\s*$/);
  if (trail && STATE_ABBREVS.has(trail[1].toUpperCase())) return trail[1].toUpperCase();
  return '';
}
