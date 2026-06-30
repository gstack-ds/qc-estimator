// MCP registration shim — zod schemas only; handlers live in src/lib/retrieval/estimates.
import { z } from 'zod/v3';

export const listEstimatesSchema = {
  program_id: z.string().optional()
    .describe('Filter by program UUID'),
  estimate_type: z.enum(['venue', 'av', 'decor', 'transportation', 'tour']).optional()
    .describe('Filter by estimate type'),
  included_in_proposal: z.boolean().optional()
    .describe('Filter by included_in_proposal flag'),
};

export const getEstimateSchema = {
  id: z.string().describe('Estimate UUID'),
};

export { handleListEstimates, handleGetEstimate } from '../../../src/lib/retrieval/estimates';
