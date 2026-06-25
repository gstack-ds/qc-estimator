// Flexible date parser for the leads pipeline date fields. Pure + server-free
// (no React/Next/Supabase) so it's unit-testable.
//
// Returns canonical 'YYYY-MM-DD' or null when the input can't be understood.
//
// CRITICAL: the canonical value is assembled from numeric parts as a string —
// it NEVER goes through `new Date('YYYY-MM-DD')`, which parses as UTC midnight
// and renders as the previous day in negative offsets (e.g. Eastern). The
// display formatter likewise splits the string and never touches Date.
//
// Design decisions (confirmed):
//   - bare M/D with no year      -> CURRENT year (not next-occurrence)
//   - 2-digit year               -> 20YY
//   - ambiguous numeric "5/11"   -> US month/day (May 11)

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// 2-digit year -> 20YY; 4-digit passes through; anything else is invalid.
function normalizeYear(raw: number, digits: number): number | null {
  if (digits === 2) return 2000 + raw;
  if (digits === 4) return raw;
  return null;
}

// Build the canonical string, validating real calendar bounds. String math only.
function build(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > daysInMonth(y, m)) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function parseFlexibleDate(
  input: string | null | undefined,
  currentYear: number = new Date().getFullYear(),
): string | null {
  if (input == null) return null;
  const s = input.trim();
  if (s === '') return null;

  // 1. ISO: YYYY-MM-DD (also accept YYYY/MM/DD)
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));

  // 2. Numeric M/D/Y or M-D-Y (US month-first), 2- or 4-digit year
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (m) {
    const year = normalizeYear(Number(m[3]), m[3].length);
    if (year == null) return null;
    return build(year, Number(m[1]), Number(m[2]));
  }

  // 3. Bare numeric M/D or M-D -> current year
  m = s.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (m) return build(currentYear, Number(m[1]), Number(m[2]));

  // 4. Month-name first: "May 11", "May 11 2027", "May 11, 2027", "Sept 3"
  m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:,?\s+(\d{2}|\d{4}))?$/);
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()];
    if (!mon) return null;
    const year = m[3] != null ? normalizeYear(Number(m[3]), m[3].length) : currentYear;
    if (year == null) return null;
    return build(year, mon, Number(m[2]));
  }

  // 5. Day first then month name: "11 May", "11 May 2027"
  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?(?:,?\s+(\d{2}|\d{4}))?$/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (!mon) return null;
    const year = m[3] != null ? normalizeYear(Number(m[3]), m[3].length) : currentYear;
    if (year == null) return null;
    return build(year, mon, Number(m[1]));
  }

  return null;
}

// 'YYYY-MM-DD' -> 'May 11, 2027'. String-split, never Date (no day shift).
export function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, mo, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !mo || !d || mo < 1 || mo > 12) return '';
  return `${MONTH_ABBR[mo - 1]} ${d}, ${y}`;
}
