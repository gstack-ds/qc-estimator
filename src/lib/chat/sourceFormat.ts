// Field classification + formatting for the chatbot's source-display. PURE + server-free so it's
// unit-testable and reusable in the client renderer. Correctness matters: the source-display is
// the TRUTH the user verifies against, so a rate must never be shown as a dollar amount (or vice
// versa). Percent is checked BEFORE currency; ambiguous sub-$1 values fall back to a plain number
// (never wrong, just unformatted) rather than risk mislabeling a rate as currency.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
// Commission/fee rates are stored as decimals (0.035 = 3.5%).
function fmtPercent(n: number): string {
  const pct = n * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/\.?0+$/, '')}%`;
}
// From YYYY-MM-DD string PARTS (never new Date('YYYY-MM-DD') — UTC-parse shifts a day in ET).
function fmtDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const mi = Number(m[2]) - 1;
  return mi >= 0 && mi < 12 ? `${MONTHS[mi]} ${Number(m[3])}, ${m[1]}` : s;
}

// Keys that are stored as decimal RATES (0.035 = 3.5%) but don't end in _rate/_pct.
const RATE_KEYS = new Set(['cc_processing_fee', 'service_charge_default', 'gratuity_default', 'admin_fee_default']);

export function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bId\b/g, 'ID')
    .replace(/\bFb\b/g, 'F&B')
    .replace(/\bCc\b/g, 'CC')
    .replace(/\bQc\b/g, 'QC')
    .replace(/\bGdp\b/g, 'GDP')
    .replace(/\bPp\b/g, 'PP');
}

// Structural / noise keys not worth showing to a human verifying a price.
export function isHiddenKey(key: string): boolean {
  return key === 'id' || key.endsWith('_id') || key === 'created_at' || key === 'updated_at' || key === 'type';
}

export type FieldKind = 'currency' | 'percent' | 'date' | 'bool' | 'number' | 'text';

export function classifyField(key: string, value: unknown): FieldKind {
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') {
    // Percent FIRST — a rate must never be shown as currency.
    if (/_(rate|pct)$/.test(key) || /commission/.test(key) || RATE_KEYS.has(key)) return 'percent';
    const currencyish =
      /_(client|cost|total|tax)$/.test(key) ||
      /(subtotal|price|fee|minimum|shortfall|amount|room_fee|latest_total|budget_amount)/.test(key);
    // A currency-named field that's a sub-$1 fraction is suspicious (likely a stray rate) — render
    // it as a plain number rather than risk "$0.04" for a 3.5% rate. Real $0 amounts still format.
    if (currencyish && !(value > 0 && value < 1)) return 'currency';
    return 'number';
  }
  if (typeof value === 'string') {
    if ((/date/.test(key) || /_at$/.test(key)) && /^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    return 'text';
  }
  return 'text';
}

export function formatField(key: string, value: unknown): string {
  switch (classifyField(key, value)) {
    case 'currency':
      return fmtCurrency(value as number);
    case 'percent':
      return fmtPercent(value as number);
    case 'date':
      return fmtDate(value as string);
    case 'bool':
      return value ? 'Yes' : 'No';
    case 'number':
      return String(value);
    default:
      return value === null || value === undefined || value === '' ? '—' : String(value);
  }
}

export function isEmptyValue(v: unknown): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

// Pure core of the renderer: every non-hidden SCALAR leaf as a { label, value } row (currency/
// percent/date formatted), recursing through nested objects and arrays. This is what the component
// displays; testing it proves the real numbers become correct readable rows (and that data the
// prose omitted still surfaces — every leaf is collected), without needing a DOM renderer.
export function collectReadableRows(value: unknown): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const walk = (v: unknown, key: string) => {
    if (isEmptyValue(v)) return;
    if (Array.isArray(v)) {
      for (const item of v) walk(item, key);
      return;
    }
    if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        if (isHiddenKey(k) || isEmptyValue(val)) continue;
        walk(val, k);
      }
      return;
    }
    rows.push({ label: humanizeKey(key), value: formatField(key, v) });
  };
  walk(value, '');
  return rows;
}

// A short header label + entity name for a source card, by tool.
export function sourceHeader(tool: string, data: unknown): string {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const name = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : undefined);
  switch (tool) {
    case 'get_estimate':
      return `Estimate — ${name('estimate_name') ?? 'details'}`;
    case 'get_program':
      return `Program — ${name('name') ?? 'details'}`;
    case 'get_venue':
      return `Venue — ${name('name') ?? 'details'}`;
    case 'list_programs':
      return `Programs (${typeof d.count === 'number' ? d.count : '?'})`;
    case 'list_estimates':
      return `Estimates (${typeof d.count === 'number' ? d.count : '?'})`;
    case 'search_venues':
      return `Venues (${typeof d.count === 'number' ? d.count : '?'})`;
    case 'get_pipeline':
      return `Pipeline (${typeof d.total_leads === 'number' ? d.total_leads : '?'} leads)`;
    default:
      return humanizeKey(tool);
  }
}
