import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { ParsedLead } from './types';

// ─── Zod validation schema ────────────────────────────────

const dateSchema = z.string().nullable().optional().transform((v) => {
  if (!v) return null;
  // Accept YYYY-MM-DD directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // Try to parse natural language dates
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
});

const commissionSchema = z.union([z.string(), z.number()]).nullable().optional().transform((v) => {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace('%', ''));
  if (isNaN(n)) return null;
  // Treat values > 1 as percentages and convert to decimal
  return n > 1 ? n / 100 : n;
});

export const ParsedLeadSchema = z.object({
  client_name: z.string().nullable().optional(),
  end_company: z.string().nullable().optional(),
  contact_name: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
  contact_role: z.string().nullable().optional(),
  third_party_company: z.string().nullable().optional(),
  third_party_contact: z.string().nullable().optional(),
  third_party_comm_notes: z.string().nullable().optional(),
  program_name: z.string().nullable().optional(),
  program_type: z.string().nullable().optional(),
  program_description: z.string().nullable().optional(),
  start_date: dateSchema,
  end_date: dateSchema,
  rain_date: dateSchema,
  num_nights: z.union([z.string(), z.number()]).nullable().optional().transform((v) => {
    if (v == null) return null;
    const n = parseInt(String(v));
    return isNaN(n) ? null : n;
  }),
  guest_count: z.union([z.string(), z.number()]).nullable().optional().transform((v) => {
    if (v == null) return null;
    const n = parseInt(String(v).replace(/[^0-9]/g, ''));
    return isNaN(n) ? null : n;
  }),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  hotel: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  lead_source: z.string().nullable().optional(),
  source_advisor: z.string().nullable().optional(),
  source_coordinator: z.string().nullable().optional(),
  source_commission: commissionSchema,
  third_party_commission: commissionSchema,
  commission_notes: z.string().nullable().optional(),
  billing_notes: z.string().nullable().optional(),
  returning_client: z.union([z.boolean(), z.string()]).nullable().optional().transform((v) => {
    if (v == null) return null;
    if (typeof v === 'boolean') return v;
    return /^(yes|true|y|1)$/i.test(String(v));
  }),
  special_instructions: z.string().nullable().optional(),
}).passthrough();

// ─── Claude parser ────────────────────────────────────────

const EXTRACTION_PROMPT = `You are extracting structured data from a GDP INITIAL LEAD email for a corporate event planning company.

Return ONLY valid JSON with these exact field names (all optional, use null if not found):
{
  "client_name": "end client / company hosting the event",
  "end_company": "the paying client company",
  "contact_name": "primary contact person",
  "contact_email": "contact email address",
  "contact_role": "contact's title or role",
  "third_party_company": "3rd party company / intermediary",
  "third_party_contact": "3rd party contact person",
  "third_party_comm_notes": "notes about 3rd party commission",
  "program_name": "name or description of the event program",
  "program_type": "type of event (e.g. Corporate Dinner, Conference, Gala)",
  "program_description": "additional program details",
  "start_date": "YYYY-MM-DD format, first event date",
  "end_date": "YYYY-MM-DD format, last event date",
  "rain_date": "YYYY-MM-DD format if mentioned",
  "num_nights": integer number of nights,
  "guest_count": integer number of guests/attendees,
  "city": "event city",
  "state": "event state (2-letter abbrev if US)",
  "hotel": "hotel name",
  "venue": "venue name (if different from hotel)",
  "region": "market or region name",
  "lead_source": "where the lead came from (e.g. GDP)",
  "source_advisor": "advisor name",
  "source_coordinator": "coordinator name",
  "source_commission": decimal (e.g. 0.10 for 10%),
  "third_party_commission": decimal (e.g. 0.065 for 6.5%),
  "commission_notes": "any commission-related notes",
  "billing_notes": "billing or payment notes",
  "returning_client": boolean,
  "special_instructions": "any special notes or instructions"
}

No markdown, no explanation. Raw JSON only.

Email body:
`;

export async function parseWithClaude(emailBody: string): Promise<ParsedLead> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: EXTRACTION_PROMPT + emailBody }],
  });

  const text = (response.content.find((c) => c.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const raw = JSON.parse(jsonMatch?.[0] ?? text);
  return ParsedLeadSchema.parse(raw) as ParsedLead;
}

// ─── Regex parser (fallback) ──────────────────────────────

function extractField(body: string, ...labels: string[]): string | null {
  for (const label of labels) {
    // Match "Label: value" — value runs to the next line that starts with a capital word + colon
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${escaped}\\s*:[ \\t]*([^\\r\\n]+)`, 'i');
    const m = body.match(re);
    if (m) {
      const val = m[1].trim();
      if (val && val !== '—' && val !== '-' && val.toLowerCase() !== 'n/a') return val;
    }
  }
  return null;
}

function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseCommission(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace('%', '').trim());
  if (isNaN(n)) return null;
  return n > 1 ? n / 100 : n;
}

function parseInteger(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw.replace(/[^0-9]/g, ''));
  return isNaN(n) ? null : n;
}

export function parseWithRegex(emailBody: string): ParsedLead {
  const b = emailBody;

  const startRaw = extractField(b, 'Start Date', 'Arrival Date', 'Event Date', 'Dates', 'Program Dates');
  const endRaw = extractField(b, 'End Date', 'Departure Date');

  // City + state: try "City, ST" pattern or separate fields
  let city: string | null = extractField(b, 'City', 'Destination City', 'Event City');
  let state: string | null = extractField(b, 'State', 'Destination State');
  if (!city) {
    const dest = extractField(b, 'Destination', 'Location', 'City/State', 'City, State');
    if (dest) {
      const parts = dest.split(',').map((s) => s.trim());
      city = parts[0] || null;
      state = parts[1] || null;
    }
  }

  return ParsedLeadSchema.parse({
    client_name: extractField(b, 'Client', 'Client Name', 'Client Company', 'Company', 'End Client'),
    end_company: extractField(b, 'End Company', 'End Client Company', 'Corporate Client'),
    contact_name: extractField(b, 'Contact', 'Contact Name', 'Primary Contact', 'Planner Name'),
    contact_email: extractField(b, 'Email', 'Contact Email', 'E-mail'),
    contact_role: extractField(b, 'Role', 'Title', 'Contact Role', 'Contact Title'),
    third_party_company: extractField(b, 'Third Party', 'Third-Party Company', '3rd Party', 'Intermediary'),
    third_party_contact: extractField(b, 'Third Party Contact', '3rd Party Contact'),
    third_party_comm_notes: extractField(b, 'Third Party Commission Notes', '3rd Party Notes'),
    program_name: extractField(b, 'Program Name', 'Program', 'Event Name', 'Event', 'Group Name'),
    program_type: extractField(b, 'Program Type', 'Event Type', 'Type of Event', 'Function'),
    program_description: extractField(b, 'Program Description', 'Description', 'Details'),
    start_date: parseDate(startRaw),
    end_date: parseDate(endRaw),
    rain_date: parseDate(extractField(b, 'Rain Date', 'Alternate Date', 'Rain/Alternate')),
    num_nights: parseInteger(extractField(b, 'Nights', 'Number of Nights', '# Nights', 'Room Nights')),
    guest_count: parseInteger(extractField(b, 'Guest Count', 'Guests', 'Group Size', 'Pax', 'Attendees', 'Number of Guests', '# of Guests')),
    city,
    state,
    hotel: extractField(b, 'Hotel', 'Hotel Property', 'Property'),
    venue: extractField(b, 'Venue', 'Event Venue', 'Venue Name'),
    region: extractField(b, 'Region', 'Market', 'Destination', 'City', 'Market/Region'),
    lead_source: extractField(b, 'Lead Source', 'Source', 'Lead Type') ?? 'GDP',
    source_advisor: extractField(b, 'Advisor', 'Source Advisor', 'GDP Advisor'),
    source_coordinator: extractField(b, 'Coordinator', 'Source Coordinator', 'GDP Coordinator'),
    source_commission: parseCommission(extractField(b, 'Commission', 'Source Commission', 'Commission %', 'Agency Commission')),
    third_party_commission: parseCommission(extractField(b, 'Third Party Commission', '3rd Party Commission', 'Override Commission')),
    commission_notes: extractField(b, 'Commission Notes', 'Commission Details'),
    billing_notes: extractField(b, 'Billing Notes', 'Billing', 'Billing Instructions'),
    returning_client: extractField(b, 'Returning Client', 'Repeat Client'),
    special_instructions: extractField(b, 'Special Instructions', 'Special Requests', 'Notes', 'Additional Notes', 'Comments'),
  }) as ParsedLead;
}

// ─── Main export ──────────────────────────────────────────

export async function parseLead(
  emailBody: string,
): Promise<{ lead: ParsedLead; method: 'claude' | 'regex'; warnings: string[] }> {
  const warnings: string[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const lead = await parseWithClaude(emailBody);
      return { lead, method: 'claude', warnings };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[parser] Claude failed, falling back to regex: ${msg}`);
      warnings.push(`Claude fallback: ${msg}`);
    }
  } else {
    warnings.push('ANTHROPIC_API_KEY not set, using regex parser');
  }

  const lead = parseWithRegex(emailBody);
  return { lead, method: 'regex', warnings };
}
