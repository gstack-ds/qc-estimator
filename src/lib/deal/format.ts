// Read-only display formatters for the deal page. Server-free, no deps. Dates are formatted
// from the YYYY-MM-DD string PARTS (never new Date('YYYY-MM-DD'), which UTC-shifts a day in ET).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function orDash(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const s = String(v).trim();
  return s === '' ? '—' : s;
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const [, y, mo, d] = m;
  const mi = Number(mo) - 1;
  if (mi < 0 || mi > 11) return s;
  return `${MONTHS[mi]} ${Number(d)}, ${y}`;
}

// Commission rates are stored as decimals (0.05 = 5%).
export function fmtPercent(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const pct = n * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/\.?0+$/, '')}%`;
}

export function fmtCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtBool(b: boolean | null | undefined): string {
  if (b === null || b === undefined) return '—';
  return b ? 'Yes' : 'No';
}
