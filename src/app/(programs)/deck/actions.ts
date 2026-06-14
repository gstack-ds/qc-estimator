'use server';

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { buildDeckContract } from '@/lib/contracts/deckContract';
import type { RawEstimate, RawSection, RawLineItem, RawProgram, RawLocation, RawCategoryMarkup } from '@/lib/contracts/deckContract';
import { NarrativeOutputSchema, defaultNarrative } from '@/lib/deck/types';
import type { NarrativeInput, NarrativeOutput, DeckRenderRequest } from '@/lib/deck/types';
import type { TeamHoursTier } from '@/types';

// ─── Narrative generation ─────────────────────────────────────────────────────

async function callNarrative(input: NarrativeInput): Promise<NarrativeOutput> {
  const client = new Anthropic();
  const prompt = `You are writing copy for a corporate event proposal. Generate engaging, professional descriptions.

Event context:
- Program: ${input.programName}${input.clientName ? ` for ${input.clientName}` : ''}
- Estimate: ${input.estimateName} (${input.estimateType})
- Venue: ${input.venueName ?? 'TBD'}${input.venueCity ? ` in ${input.venueCity}` : ''}
- Guest count: ${input.guestCount}
- Event type: ${input.eventType ?? 'corporate event'}
- Sections: ${input.sectionNames.filter((s) => s !== 'Uncategorized').join(', ')}

Return ONLY valid JSON — no markdown fences, no commentary — with exactly these string fields:
{
  "headline": "one-line event title",
  "intro": "2-3 sentence program overview for the proposal cover",
  "venueSummary": "1-2 sentences about the venue or setting",
  "experienceSummary": "1-2 sentences on overall guest experience highlights",
  "sectionDescriptions": { "<section name>": "1 sentence about this section" },
  "closingNote": "one sentence closing remark"
}

Rules:
- No dollar amounts, prices, or percentages
- Oxford comma always
- Active voice, plain English
- Avoid: decor, set up, tear down, immersive, unforgettable, curated`;

  const response = await client.messages.create(
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    },
    { signal: AbortSignal.timeout(25000) }
  );

  const raw =
    (response.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined)
      ?.text ?? '';
  // Strip code fences if the model included them despite instructions
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return NarrativeOutputSchema.parse(JSON.parse(stripped));
}

async function generateNarrative(input: NarrativeInput): Promise<NarrativeOutput> {
  try {
    return await callNarrative(input);
  } catch {
    // Retry once on any failure
    try {
      return await callNarrative(input);
    } catch {
      // Degrade to default copy — never fail the whole PDF over narrative
      return defaultNarrative(input);
    }
  }
}

// ─── DB fetch helpers ─────────────────────────────────────────────────────────

async function fetchSlide(estimateId: string) {
  const supabase = await createClient();

  const { data: estimate, error: estErr } = await supabase
    .from('estimates')
    .select(
      'id, program_id, event_id, type, name, fb_minimum, is_venue_taxable, service_charge_override, gratuity_override, admin_fee_override, discount_type, discount_value, tax_exempt, food_tax_override, alcohol_tax_override, general_tax_override, included_in_proposal, include_in_budget, venue_id, venue_space_id'
    )
    .eq('id', estimateId)
    .single();
  if (estErr || !estimate) throw new Error(`Estimate not found: ${estErr?.message ?? 'no data'}`);

  const [sectionsResult, lineItemsResult, programResult, categoryMarkupsResult, tiersResult, travelItemsResult] =
    await Promise.all([
      supabase
        .from('estimate_sections')
        .select('id, name, tax_bucket, markup_pct, sort_order')
        .eq('estimate_id', estimateId)
        .order('sort_order'),
      supabase
        .from('estimate_line_items')
        .select(
          'id, estimate_id, section, section_id, name, label, qty, unit_price, category_id, markup_override, custom_client_unit_price, tax_type, is_revenue_item, notes, thumbnail_url, thumbnail_icon, package_options, selected_package_id, sort_order'
        )
        .eq('estimate_id', estimateId)
        .order('sort_order'),
      supabase
        .from('programs')
        .select(
          'id, name, client_name, guest_count, cc_processing_fee, client_commission, gdp_commission_enabled, gdp_commission_rate, service_charge_default, gratuity_default, admin_fee_default, third_party_commissions, include_travel_in_production_fee, location_id'
        )
        .eq('id', estimate.program_id)
        .single(),
      supabase.from('category_markups').select('id, markup_pct'),
      supabase
        .from('team_hours_tiers')
        .select('revenue_threshold, base_hours, tier_name')
        .order('revenue_threshold'),
      supabase.from('program_travel_items').select('qty, unit_price').eq('program_id', estimate.program_id),
    ]);

  if (sectionsResult.error) throw new Error(`sections: ${sectionsResult.error.message}`);
  if (lineItemsResult.error) throw new Error(`line_items: ${lineItemsResult.error.message}`);
  if (programResult.error) throw new Error(`program: ${programResult.error.message}`);
  if (categoryMarkupsResult.error) throw new Error(`markups: ${categoryMarkupsResult.error.message}`);
  if (tiersResult.error) throw new Error(`tiers: ${tiersResult.error.message}`);
  if (travelItemsResult.error) throw new Error(`travel: ${travelItemsResult.error.message}`);

  const prog = programResult.data;

  let location: RawLocation = { id: '', name: '', food_tax_rate: 0, alcohol_tax_rate: 0, general_tax_rate: 0 };
  if (prog.location_id) {
    const { data: loc, error: locErr } = await supabase
      .from('locations')
      .select('id, name, food_tax_rate, alcohol_tax_rate, general_tax_rate')
      .eq('id', prog.location_id)
      .single();
    if (locErr) throw new Error(`location: ${locErr.message}`);
    if (loc) location = loc;
  }

  let venueName: string | null = null;
  let venueCity: string | null = null;
  if (estimate.venue_id) {
    const { data: venue } = await supabase
      .from('venues')
      .select('name, city')
      .eq('id', estimate.venue_id)
      .single();
    venueName = venue?.name ?? null;
    venueCity = venue?.city ?? null;
  }

  let eventType: string | null = null;
  if (estimate.event_id) {
    const { data: ev } = await supabase
      .from('events')
      .select('event_type')
      .eq('id', estimate.event_id)
      .single();
    eventType = ev?.event_type ?? null;
  }

  const travelTotal = (travelItemsResult.data ?? []).reduce(
    (s: number, it: { qty: number; unit_price: number }) => s + it.qty * it.unit_price,
    0
  );

  const rawEstimate: RawEstimate = {
    id: estimate.id,
    program_id: estimate.program_id,
    event_id: estimate.event_id,
    type: estimate.type,
    name: estimate.name,
    fb_minimum: estimate.fb_minimum ?? 0,
    is_venue_taxable: estimate.is_venue_taxable ?? false,
    service_charge_override: estimate.service_charge_override,
    gratuity_override: estimate.gratuity_override,
    admin_fee_override: estimate.admin_fee_override,
    discount_type: estimate.discount_type,
    discount_value: estimate.discount_value ?? 0,
    tax_exempt: estimate.tax_exempt ?? false,
    food_tax_override: estimate.food_tax_override,
    alcohol_tax_override: estimate.alcohol_tax_override,
    general_tax_override: estimate.general_tax_override,
    included_in_proposal: estimate.included_in_proposal ?? false,
    include_in_budget: estimate.include_in_budget ?? false,
    venue_id: estimate.venue_id,
    venue_space_id: estimate.venue_space_id,
  };

  const rawProgram: RawProgram = {
    id: prog.id,
    guest_count: prog.guest_count,
    cc_processing_fee: prog.cc_processing_fee,
    client_commission: prog.client_commission,
    gdp_commission_enabled: prog.gdp_commission_enabled,
    gdp_commission_rate: prog.gdp_commission_rate,
    service_charge_default: prog.service_charge_default,
    gratuity_default: prog.gratuity_default,
    admin_fee_default: prog.admin_fee_default,
    third_party_commissions: prog.third_party_commissions ?? null,
    include_travel_in_production_fee: prog.include_travel_in_production_fee ?? false,
  };

  const tiers: TeamHoursTier[] = (tiersResult.data ?? []).map((t) => ({
    revenueThreshold: t.revenue_threshold,
    baseHours: t.base_hours,
    tierName: t.tier_name ?? '',
  }));

  const rawSections: RawSection[] = (sectionsResult.data ?? []) as RawSection[];
  const rawLineItems: RawLineItem[] = (lineItemsResult.data ?? []) as RawLineItem[];
  const rawMarkups: RawCategoryMarkup[] = (categoryMarkupsResult.data ?? []) as RawCategoryMarkup[];

  const contract = buildDeckContract(
    rawEstimate,
    rawSections,
    rawLineItems,
    rawProgram,
    location,
    tiers,
    rawMarkups,
    travelTotal
  );

  const narrativeInput: NarrativeInput = {
    estimateType: estimate.type,
    estimateName: estimate.name,
    programName: prog.name,
    clientName: prog.client_name ?? null,
    venueName,
    venueCity,
    eventType,
    guestCount: prog.guest_count,
    sectionNames: contract.sections.map((s) => s.name),
  };

  return { contract, narrativeInput };
}

async function callRenderer(request: DeckRenderRequest): Promise<{ pdf: string } | { error: string }> {
  const rendererUrl = process.env.RENDERER_URL;
  const rendererSecret = process.env.RENDERER_SECRET;
  if (!rendererUrl || !rendererSecret) {
    return { error: 'Deck renderer is not configured. Set RENDERER_URL and RENDERER_SECRET environment variables.' };
  }

  const res = await fetch(`${rendererUrl}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Renderer-Secret': rendererSecret,
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { error: `Renderer error ${res.status}: ${text}` };
  }

  const data = (await res.json()) as { pdf: string };
  return { pdf: data.pdf };
}

// ─── Public server actions ────────────────────────────────────────────────────

export async function generateDeckForEstimate(
  estimateId: string
): Promise<{ pdf: string } | { error: string }> {
  try {
    const { contract, narrativeInput } = await fetchSlide(estimateId);
    const narrative = await generateNarrative(narrativeInput);
    return callRenderer({ slides: [{ contract, narrative }] });
  } catch (e) {
    return { error: String(e) };
  }
}

export async function generateDeckForProgram(
  programId: string
): Promise<{ pdf: string } | { error: string }> {
  try {
    const supabase = await createClient();
    const { data: estimates, error: estErr } = await supabase
      .from('estimates')
      .select('id')
      .eq('program_id', programId)
      .eq('included_in_proposal', true)
      .order('sort_order');
    if (estErr) throw new Error(estErr.message);
    if (!estimates || estimates.length === 0) {
      return { error: 'No estimates are included in the proposal for this program.' };
    }

    const slides = await Promise.all(
      estimates.map(async (e) => {
        const { contract, narrativeInput } = await fetchSlide(e.id);
        const narrative = await generateNarrative(narrativeInput);
        return { contract, narrative };
      })
    );

    return callRenderer({ slides });
  } catch (e) {
    return { error: String(e) };
  }
}
