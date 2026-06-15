#!/usr/bin/env node
/**
 * Generates a deck HTML preview from a real Supabase program and saves it
 * to tmp/deck-preview.html for local inspection in Chrome.
 *
 * Usage:
 *   npx tsx scripts/preview-deck-html.ts [programId]
 *
 * If no programId is given, picks the active program with the most
 * included_in_proposal estimates. Uses mcp-server/.env (service role key).
 *
 * Open the saved file in Chrome, then check:
 *   - Logo crisp on cream background, no grey box / halo
 *   - Cormorant Garamond + Jost loaded (not fallback system fonts)
 *   - Every estimate block has the same branded cover + pricing layout
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', 'mcp-server', '.env') });

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import {
  buildDeckContract,
  type RawEstimate,
  type RawSection,
  type RawLineItem,
  type RawProgram,
  type RawLocation,
  type RawCategoryMarkup,
} from '../src/lib/contracts/deckContract';
import { buildDeckHtml, type DeckTheme } from '../src/lib/deck/renderer';
import { defaultNarrative, type NarrativeInput } from '../src/lib/deck/types';

// Structural copy — avoids @/ alias; structurally identical to src/types TeamHoursTier
interface TeamHoursTier {
  revenueThreshold: number;
  baseHours: number;
  tierName: string;
}

// ─── Supabase ──────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in mcp-server/.env');
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// ─── Logo loading ──────────────────────────────────────────────────────────────

function loadLogoDataUri(filename: string): string | undefined {
  try {
    const filePath = path.resolve(__dirname, '..', 'public', 'images', filename);
    const buffer = readFileSync(filePath);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {
    console.warn(`  ⚠ Could not load logo: ${filename}`);
    return undefined;
  }
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function findBestProgramId(requestedId?: string): Promise<string> {
  if (requestedId) return requestedId;

  // Find the active program with the most included_in_proposal estimates
  const { data, error } = await db
    .from('estimates')
    .select('program_id')
    .eq('included_in_proposal', true);

  if (error || !data?.length) {
    throw new Error(`No included_in_proposal estimates found: ${error?.message ?? 'empty'}`);
  }

  // Count by program_id
  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.program_id] = (counts[row.program_id] ?? 0) + 1;
  }

  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  const [programId, count] = sorted[0];
  console.log(`  Selected program ${programId} (${count} included estimate${count === 1 ? '' : 's'})`);
  return programId;
}

async function fetchProgramData(programId: string) {
  const [progResult, markupsResult, tiersResult] = await Promise.all([
    db
      .from('programs')
      .select(
        'id, name, client_name, guest_count, cc_processing_fee, client_commission, gdp_commission_enabled, gdp_commission_rate, service_charge_default, gratuity_default, admin_fee_default, third_party_commissions, include_travel_in_production_fee, location_id'
      )
      .eq('id', programId)
      .single(),
    db.from('category_markups').select('id, markup_pct'),
    db.from('team_hours_tiers').select('revenue_threshold, base_hours, tier_name').order('revenue_threshold'),
  ]);

  if (progResult.error) throw new Error(`program: ${progResult.error.message}`);
  if (markupsResult.error) throw new Error(`markups: ${markupsResult.error.message}`);
  if (tiersResult.error) throw new Error(`tiers: ${tiersResult.error.message}`);

  const prog = progResult.data;

  let location: RawLocation = { id: '', name: '', food_tax_rate: 0, alcohol_tax_rate: 0, general_tax_rate: 0 };
  if (prog.location_id) {
    const { data: loc, error: locErr } = await db
      .from('locations')
      .select('id, name, food_tax_rate, alcohol_tax_rate, general_tax_rate')
      .eq('id', prog.location_id)
      .single();
    if (locErr) console.warn(`  ⚠ Location not found: ${locErr.message}`);
    else if (loc) location = loc;
  }

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

  const rawMarkups: RawCategoryMarkup[] = (markupsResult.data ?? []) as RawCategoryMarkup[];

  return {
    programName: prog.name,
    clientName: prog.client_name ?? null,
    rawProgram,
    location,
    tiers,
    rawMarkups,
  };
}

async function fetchEstimateSlide(
  estimateId: string,
  shared: Awaited<ReturnType<typeof fetchProgramData>>
) {
  const [estResult, sectionsResult, itemsResult, travelResult] = await Promise.all([
    db
      .from('estimates')
      .select(
        'id, program_id, event_id, type, name, fb_minimum, is_venue_taxable, service_charge_override, gratuity_override, admin_fee_override, discount_type, discount_value, tax_exempt, food_tax_override, alcohol_tax_override, general_tax_override, included_in_proposal, include_in_budget, venue_id, venue_space_id'
      )
      .eq('id', estimateId)
      .single(),
    db
      .from('estimate_sections')
      .select('id, name, tax_bucket, markup_pct, sort_order')
      .eq('estimate_id', estimateId)
      .order('sort_order'),
    db
      .from('estimate_line_items')
      .select(
        'id, estimate_id, section, section_id, name, label, qty, unit_price, category_id, markup_override, custom_client_unit_price, tax_type, is_revenue_item, notes, thumbnail_url, thumbnail_icon, package_options, selected_package_id, sort_order'
      )
      .eq('estimate_id', estimateId)
      .order('sort_order'),
    db
      .from('program_travel_items')
      .select('qty, unit_price')
      .eq('program_id', shared.rawProgram.id),
  ]);

  if (estResult.error) throw new Error(`estimate ${estimateId}: ${estResult.error.message}`);
  if (sectionsResult.error) throw new Error(`sections: ${sectionsResult.error.message}`);
  if (itemsResult.error) throw new Error(`items: ${itemsResult.error.message}`);

  const est = estResult.data;

  let venueName: string | null = null;
  let venueCity: string | null = null;
  if (est.venue_id) {
    const { data: venue } = await db
      .from('venues')
      .select('name, city')
      .eq('id', est.venue_id)
      .single();
    venueName = venue?.name ?? null;
    venueCity = venue?.city ?? null;
  }

  let eventType: string | null = null;
  let eventGuestCount: number | null = null;
  if (est.event_id) {
    const { data: ev } = await db
      .from('events')
      .select('event_type, guest_count')
      .eq('id', est.event_id)
      .single();
    eventType = ev?.event_type ?? null;
    eventGuestCount = ev?.guest_count ?? null;
  }

  const effectiveGuestCount = eventGuestCount ?? shared.rawProgram.guest_count;

  const travelTotal = (travelResult.data ?? []).reduce(
    (s: number, it: { qty: number; unit_price: number }) => s + it.qty * it.unit_price,
    0
  );

  const rawEstimate: RawEstimate = {
    id: est.id,
    program_id: est.program_id,
    event_id: est.event_id,
    type: est.type,
    name: est.name,
    fb_minimum: est.fb_minimum ?? 0,
    is_venue_taxable: est.is_venue_taxable ?? false,
    service_charge_override: est.service_charge_override,
    gratuity_override: est.gratuity_override,
    admin_fee_override: est.admin_fee_override,
    discount_type: est.discount_type,
    discount_value: est.discount_value ?? 0,
    tax_exempt: est.tax_exempt ?? false,
    food_tax_override: est.food_tax_override,
    alcohol_tax_override: est.alcohol_tax_override,
    general_tax_override: est.general_tax_override,
    included_in_proposal: est.included_in_proposal ?? false,
    include_in_budget: est.include_in_budget ?? false,
    venue_id: est.venue_id,
    venue_space_id: est.venue_space_id,
  };

  const contract = buildDeckContract(
    rawEstimate,
    (sectionsResult.data ?? []) as RawSection[],
    (itemsResult.data ?? []) as RawLineItem[],
    { ...shared.rawProgram, guest_count: effectiveGuestCount },
    shared.location,
    shared.tiers as TeamHoursTier[],
    shared.rawMarkups,
    travelTotal
  );

  const narrativeInput: NarrativeInput = {
    estimateType: est.type,
    estimateName: est.name,
    programName: shared.programName,
    clientName: shared.clientName,
    venueName,
    venueCity,
    eventType,
    guestCount: effectiveGuestCount,
    sectionNames: contract.sections.map((s) => s.name),
  };

  return { contract, narrative: defaultNarrative(narrativeInput) };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const requestedId = process.argv[2];

  console.log('\n🎨 QC Deck Preview Generator\n');

  const programId = await findBestProgramId(requestedId);
  console.log(`  Fetching shared program data…`);
  const shared = await fetchProgramData(programId);
  console.log(`  Program: "${shared.programName}" (${shared.clientName ?? 'no client'})`);

  const { data: estimateRows, error: estErr } = await db
    .from('estimates')
    .select('id, name')
    .eq('program_id', programId)
    .eq('included_in_proposal', true)
    .order('sort_order');

  if (estErr || !estimateRows?.length) {
    throw new Error(`No included estimates: ${estErr?.message ?? 'empty'}`);
  }

  console.log(`  Building ${estimateRows.length} estimate slide(s)…`);
  const slides = await Promise.all(
    estimateRows.map(async (row) => {
      console.log(`    • ${row.name} (${row.id})`);
      return fetchEstimateSlide(row.id, shared);
    })
  );

  console.log(`  Loading logos from public/images/…`);
  const theme: DeckTheme = {
    logoDataUri: loadLogoDataUri('logo-secondary.png'),
    badgeDataUri: loadLogoDataUri('logo-badge.png'),
  };

  if (theme.logoDataUri) console.log('    ✓ logo-secondary.png');
  if (theme.badgeDataUri) console.log('    ✓ logo-badge.png');

  console.log(`  Generating HTML…`);
  const html = buildDeckHtml(slides, theme);

  const outDir = path.resolve(__dirname, '..', 'tmp');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'deck-preview.html');
  writeFileSync(outPath, html, 'utf8');

  console.log(`\n✅ Saved → ${outPath}`);
  console.log('\nTo open in Chrome:');
  console.log('  ! start tmp\\deck-preview.html\n');
  console.log('Check in Chrome:');
  console.log('  • Logo crisp on off-white cover — no grey halo (mix-blend-mode: multiply)');
  console.log('  • Fonts: Cormorant Garamond headings, Jost body (not system fallback)');
  console.log('  • Every estimate block has branded cover + pricing layout\n');
}

main().catch((err) => {
  console.error('\n❌', err.message ?? err);
  process.exit(1);
});
