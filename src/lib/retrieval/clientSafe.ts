// clientSafe strip — removes QC-INTERNAL margin / vendor-cost / commission data from retrieval
// results before they reach the in-app chatbot. The MCP server (Gary's local read-only tool)
// gets the FULL result; the chatbot gets the stripped result (applied in ./index callTool when
// opts.clientSafe is true).
//
// Why strip even though the team sees margins in-app: the chatbot makes margin/commission
// AGGREGATABLE ("rank clients by profit", "which vendor has the best markup") — a sharper,
// more sensitive access pattern than opening one estimate's margin panel. Reversible: any field
// can be added back by removing it from the denylists below.

// get_estimate (venue/av/decor/tour → deck_contract)
const ESTIMATE_SUMMARY_INTERNAL = [
  'fb_subtotal_our', 'equipment_subtotal_our', 'qc_staffing_subtotal_our',
  'venue_subtotal_our', 'subtotal_our', 'total_our',
];
const LINE_ITEM_INTERNAL = ['our_cost', 'markup_pct'];
const SECTION_INTERNAL = ['markup_pct'];

// get_estimate (transportation → transport_summary)
const TRANSPORT_SUMMARY_INTERNAL = ['subtotal_our', 'markup_revenue', 'qc_revenue', 'qc_margin_pct'];
const TRANSPORT_META_INTERNAL = ['transport_commission'];
const SCHEDULE_ROW_INTERNAL = ['our_cost'];

// get_program
const PROGRAM_FEE_INTERNAL = [
  'client_commission', 'gdp_commission_enabled', 'gdp_commission_rate', 'third_party_commissions',
];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function omit(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (!keys.includes(k)) out[k] = v;
  return out;
}

function omitIn(obj: Record<string, unknown>, field: string, keys: string[]): Record<string, unknown> {
  const inner = obj[field];
  if (!isObject(inner)) return obj;
  return { ...obj, [field]: omit(inner, keys) };
}

function mapArray(
  obj: Record<string, unknown>,
  field: string,
  fn: (item: Record<string, unknown>) => Record<string, unknown>,
): Record<string, unknown> {
  const arr = obj[field];
  if (!Array.isArray(arr)) return obj;
  return { ...obj, [field]: arr.map((it) => (isObject(it) ? fn(it) : it)) };
}

// Strip a get_estimate result (handles both the deck_contract and transport_summary shapes).
export function stripEstimateForClient(result: unknown): unknown {
  if (!isObject(result)) return result;

  if (result.type === 'transport_summary') {
    let r = omitIn(result, 'summary', TRANSPORT_SUMMARY_INTERNAL);
    r = omitIn(r, 'metadata', TRANSPORT_META_INTERNAL);
    r = mapArray(r, 'schedule_rows', (row) => omit(row, SCHEDULE_ROW_INTERNAL));
    return r;
  }

  if (result.type === 'deck_contract') {
    // Drop the entire margin block + the vendor-cost summary fields, and per-item/section cost+markup.
    let r = omit(result, ['margin']);
    r = omitIn(r, 'summary', ESTIMATE_SUMMARY_INTERNAL);
    r = mapArray(r, 'sections', (section) => {
      const s = omit(section, SECTION_INTERNAL);
      return mapArray(s, 'line_items', (li) => omit(li, LINE_ITEM_INTERNAL));
    });
    return r;
  }

  return result;
}

// Strip a get_program result — removes the QC commission fields from `fees`.
export function stripProgramForClient(result: unknown): unknown {
  if (!isObject(result)) return result;
  return omitIn(result, 'fees', PROGRAM_FEE_INTERNAL);
}
