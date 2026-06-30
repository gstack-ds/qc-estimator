// Shared read-only retrieval layer — single source of the 7 queries for BOTH the MCP server
// and the in-app chatbot. The MCP server imports the raw handlers (full data). The chatbot
// goes through callTool({ clientSafe: true }), which applies the clientSafe strip — so the
// chatbot structurally cannot reach internal margin/cost/commission data.
import type { SupabaseClient } from '@supabase/supabase-js';
import { handleListPrograms, handleGetProgram } from './programs';
import { handleListEstimates, handleGetEstimate } from './estimates';
import { handleSearchVenues, handleGetVenue } from './venues';
import { handleGetPipeline } from './pipeline';
import { stripEstimateForClient, stripProgramForClient } from './clientSafe';
import type {
  ListProgramsArgs, GetByIdArgs, ListEstimatesArgs, SearchVenuesArgs, GetPipelineArgs,
} from './types';

// Re-export raw handlers (the MCP server's tool shims import these).
export { handleListPrograms, handleGetProgram } from './programs';
export { handleListEstimates, handleGetEstimate } from './estimates';
export { handleSearchVenues, handleGetVenue } from './venues';
export { handleGetPipeline } from './pipeline';
export { stripEstimateForClient, stripProgramForClient } from './clientSafe';

// Anthropic tool definitions (JSON Schema) — built from the same surface the MCP zod schemas describe.
// The supabase client type the handlers expect (the app's installed copy). The MCP server
// has a separately-installed @supabase/supabase-js whose SupabaseClient is nominally distinct
// (protected members), so its registration bridges to this type with a single documented cast.
export type RetrievalDb = SupabaseClient;

export interface RetrievalTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export const RETRIEVAL_TOOLS: RetrievalTool[] = [
  {
    name: 'list_programs',
    description:
      'List QC Estimator programs. Filter by lifecycle status (active/completed/did_not_book), partial client name, or event date range. Returns id, name, client, event_date, status, and latest_total.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'completed', 'did_not_book'], description: 'Filter by program lifecycle status' },
        client: { type: 'string', description: 'Partial match on client name (case-insensitive)' },
        start_after: { type: 'string', description: 'ISO date — only programs with event_date >= this' },
        start_before: { type: 'string', description: 'ISO date — only programs with event_date <= this' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Max records (default 50)' },
      },
    },
  },
  {
    name: 'get_program',
    description:
      'Get full details for a single program including its events, estimates summary, staffing, and linked lead. Use after list_programs to drill into a specific program.',
    input_schema: { type: 'object', properties: { id: { type: 'string', description: 'Program UUID' } }, required: ['id'] },
  },
  {
    name: 'list_estimates',
    description:
      'List estimates for a program or across all programs. Filter by program_id, estimate_type (venue/av/decor/transportation/tour), or included_in_proposal.',
    input_schema: {
      type: 'object',
      properties: {
        program_id: { type: 'string', description: 'Filter by program UUID' },
        estimate_type: { type: 'string', enum: ['venue', 'av', 'decor', 'transportation', 'tour'], description: 'Filter by estimate type' },
        included_in_proposal: { type: 'boolean', description: 'Filter by included_in_proposal flag' },
      },
    },
  },
  {
    name: 'get_estimate',
    description:
      'Get full details for an estimate including all line items, computed totals (subtotals, production fee, taxes, discount), client cost, and price per person. Transportation estimates return a schedule summary. Use this for any pricing question — the numbers are computed by the pricing engine; quote them exactly.',
    input_schema: { type: 'object', properties: { id: { type: 'string', description: 'Estimate UUID' } }, required: ['id'] },
  },
  {
    name: 'search_venues',
    description:
      'Search the vendor directory for venues and restaurants. Filter by name/city text, vendor_type, or market. Returns contact info, fee defaults, and service styles.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to match against venue name or city' },
        vendor_type: { type: 'string', enum: ['venue', 'restaurant', 'tour', 'transportation', 'entertainment', 'decor'], description: 'Filter by vendor type' },
        market: { type: 'string', description: 'Filter by market name' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Max records (default 20)' },
      },
    },
  },
  {
    name: 'get_venue',
    description:
      'Get full profile for a single venue/vendor including all room spaces (capacity, FB minimum, room fee, privacy tag), contact info, and usage count.',
    input_schema: { type: 'object', properties: { id: { type: 'string', description: 'Venue/vendor UUID' } }, required: ['id'] },
  },
  {
    name: 'get_pipeline',
    description:
      'Get the leads pipeline as Kanban lanes. status_group: "open" (default), "closed", or "all". Returns lanes with lead cards including client, dates, guest count, owner, and linked program.',
    input_schema: {
      type: 'object',
      properties: { status_group: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Which status group (default open)' } },
    },
  },
];

// The ONE entry point the chatbot uses. Dispatches by tool name and applies the clientSafe strip
// when requested. Anthropic tool inputs arrive as untyped JSON; we narrow per tool.
export async function callTool(
  db: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
  opts: { clientSafe: boolean },
): Promise<unknown> {
  switch (name) {
    case 'list_programs':
      return handleListPrograms(db, args as ListProgramsArgs);
    case 'get_program': {
      const r = await handleGetProgram(db, args as unknown as GetByIdArgs);
      return opts.clientSafe ? stripProgramForClient(r) : r;
    }
    case 'list_estimates':
      return handleListEstimates(db, args as ListEstimatesArgs);
    case 'get_estimate': {
      const r = await handleGetEstimate(db, args as unknown as GetByIdArgs);
      return opts.clientSafe ? stripEstimateForClient(r) : r;
    }
    case 'search_venues':
      return handleSearchVenues(db, args as SearchVenuesArgs);
    case 'get_venue':
      return handleGetVenue(db, args as unknown as GetByIdArgs);
    case 'get_pipeline':
      return handleGetPipeline(db, args as GetPipelineArgs);
    default:
      throw new Error(`Unknown retrieval tool: ${name}`);
  }
}
