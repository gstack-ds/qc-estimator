// MCP registration shim. The query handlers now live in the shared retrieval layer
// (src/lib/retrieval) so the in-app chatbot and this server import one source. This file keeps
// only the MCP-specific zod schemas + re-exports the handlers.
import { z } from 'zod/v3';

export const listProgramsSchema = {
  status: z.enum(['active', 'completed', 'did_not_book']).optional()
    .describe('Filter by program lifecycle status'),
  client: z.string().optional()
    .describe('Partial match on client_name (case-insensitive)'),
  start_after: z.string().optional()
    .describe('ISO date — only programs whose event_date is >= this value'),
  start_before: z.string().optional()
    .describe('ISO date — only programs whose event_date is <= this value'),
  limit: z.number().int().min(1).max(100).default(50).optional()
    .describe('Max records to return (default 50, max 100)'),
};

export const getProgramSchema = {
  id: z.string().describe('Program UUID'),
};

export { handleListPrograms, handleGetProgram } from '../../../src/lib/retrieval/programs';
