// QC Estimator MCP Server
// Provides read-only access to programs, estimates, venues, and pipeline data.
// Transport: stdio (local). Structure supports HTTP/SSE by swapping the transport.
//
// Setup: copy mcp-server/.env.example to mcp-server/.env and fill in credentials.
// Run:   npx tsx mcp-server/src/index.ts
//        OR add to Claude Desktop config (see CLAUDE.md).

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v3';
import { getDb } from './db';
import type { RetrievalDb } from '../../src/lib/retrieval';
import {
  listProgramsSchema,
  getProgramSchema,
  handleListPrograms,
  handleGetProgram,
} from './tools/programs';
import {
  listEstimatesSchema,
  getEstimateSchema,
  handleListEstimates,
  handleGetEstimate,
} from './tools/estimates';
import {
  searchVenuesSchema,
  getVenueSchema,
  handleSearchVenues,
  handleGetVenue,
} from './tools/venues';
import {
  getPipelineSchema,
  handleGetPipeline,
} from './tools/pipeline';

const server = new McpServer({
  name: 'qc-estimator',
  version: '1.0.0',
});

// Wrap a handler to catch errors and return them as tool errors.
// Handlers live in the shared retrieval layer (src/lib/retrieval) and are typed against the
// app's @supabase/supabase-js. This server has a separately-installed copy whose SupabaseClient
// is nominally distinct, so we bridge getDb()'s client to RetrievalDb with one documented cast.
function wrap<T>(
  handler: (db: RetrievalDb, args: T) => Promise<unknown>
) {
  return async (args: T) => {
    try {
      const db = getDb() as unknown as RetrievalDb;
      const result = await handler(db, args);
      if (result === null) {
        return {
          content: [{ type: 'text' as const, text: 'Not found.' }],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  };
}

// ─── Tool registrations ───────────────────────────────────────────────────────

server.tool(
  'list_programs',
  'List QC Estimator programs. Filter by lifecycle status (active/completed/did_not_book), partial client name, or event date range. Returns id, name, client, event_date, status, and latest_total.',
  listProgramsSchema,
  wrap(handleListPrograms)
);

server.tool(
  'get_program',
  'Get full details for a single program including its events, estimates, staffing, and linked lead. Use this after list_programs to drill into a specific program.',
  getProgramSchema,
  wrap(handleGetProgram)
);

server.tool(
  'list_estimates',
  'List estimates for a program or across all programs. Filter by program_id, estimate_type (venue/av/decor/transportation/tour), or included_in_proposal flag.',
  listEstimatesSchema,
  wrap(handleListEstimates)
);

server.tool(
  'get_estimate',
  'Get full deck contract for an estimate including all line items, engine-computed totals (subtotals, production fee, taxes, discount), and margin analysis (QC revenue, margin%, health rating). Transportation estimates return a schedule summary instead.',
  getEstimateSchema,
  wrap(handleGetEstimate)
);

server.tool(
  'search_venues',
  'Search the vendor directory for venues and restaurants. Filter by name/city text, vendor_type, or market. Returns contact info, fee defaults, and service styles.',
  searchVenuesSchema,
  wrap(handleSearchVenues)
);

server.tool(
  'get_venue',
  'Get full profile for a single venue/vendor including all room spaces (capacity, FB minimum, room fee, privacy tag), contact info, and usage count.',
  getVenueSchema,
  wrap(handleGetVenue)
);

server.tool(
  'get_pipeline',
  'Get the leads pipeline as Kanban lanes. Specify status_group: "open" (default, active pipeline), "closed" (completed/did_not_book/unresponsive), or "all". Returns lanes with lead cards including client, dates, guest count, owner, and linked program if converted.',
  getPipelineSchema,
  wrap(handleGetPipeline)
);

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server runs until the process exits. MCP stdio transport is synchronous.
}

main().catch((err) => {
  process.stderr.write(`MCP server error: ${(err as Error).message}\n`);
  process.exit(1);
});
