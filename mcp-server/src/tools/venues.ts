// MCP registration shim — zod schemas only; handlers live in src/lib/retrieval/venues.
import { z } from 'zod/v3';

export const searchVenuesSchema = {
  query: z.string().optional()
    .describe('Text to match against venue name or city (case-insensitive)'),
  vendor_type: z.enum(['venue', 'restaurant', 'tour', 'transportation', 'entertainment', 'decor']).optional()
    .describe('Filter by vendor type'),
  market: z.string().optional()
    .describe('Filter by market name'),
  limit: z.number().int().min(1).max(50).default(20).optional()
    .describe('Max records to return (default 20, max 50)'),
};

export const getVenueSchema = {
  id: z.string().describe('Venue/vendor UUID'),
};

export { handleSearchVenues, handleGetVenue } from '../../../src/lib/retrieval/venues';
