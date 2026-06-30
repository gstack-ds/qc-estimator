// MCP registration shim — zod schema only; handler lives in src/lib/retrieval/pipeline.
import { z } from 'zod/v3';

export const getPipelineSchema = {
  status_group: z.enum(['open', 'closed', 'all']).default('open').optional()
    .describe('Which status group to return — open (default), closed, or all'),
};

export { handleGetPipeline } from '../../../src/lib/retrieval/pipeline';
