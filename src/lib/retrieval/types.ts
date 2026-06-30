// Plain arg types for the shared retrieval handlers. Decoupled from zod so the handlers can
// live in the app's src/lib (imported by both the MCP server and the in-app chatbot) without
// pulling in the MCP server's zod/v3. The MCP server keeps its zod schemas in mcp-server/src/tools
// (its registration layer); the chatbot builds Anthropic JSON-Schema tool defs from index.ts.

export interface ListProgramsArgs {
  status?: 'active' | 'completed' | 'did_not_book';
  client?: string;
  start_after?: string;
  start_before?: string;
  limit?: number;
}

export interface GetByIdArgs {
  id: string;
}

export interface ListEstimatesArgs {
  program_id?: string;
  estimate_type?: 'venue' | 'av' | 'decor' | 'transportation' | 'tour';
  included_in_proposal?: boolean;
}

export interface SearchVenuesArgs {
  query?: string;
  vendor_type?: 'venue' | 'restaurant' | 'tour' | 'transportation' | 'entertainment' | 'decor';
  market?: string;
  limit?: number;
}

export interface GetPipelineArgs {
  status_group?: 'open' | 'closed' | 'all';
}
