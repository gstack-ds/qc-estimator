// Shared read-only retrieval handlers (estimates). Reuses the pricing-engine contract builder
// (buildDeckContract) — never hand-rolls math. The chatbot consumes the clientSafe-stripped
// output (see ./clientSafe + ./index callTool); the MCP server gets the full result.
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildDeckContract, type RawEstimate } from '../contracts/deckContract';
import { calcTransportSummary } from '../engine/transportation';
import type { TeamHoursTier } from '../../types';
import type { ListEstimatesArgs, GetByIdArgs } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchTiers(db: SupabaseClient): Promise<TeamHoursTier[]> {
  const { data, error } = await db
    .from('team_hours_tiers')
    .select('revenue_threshold, base_hours, tier_name')
    .order('revenue_threshold');
  if (error) throw new Error(`get_estimate tiers: ${error.message}`);
  return (data ?? []).map((t: { revenue_threshold: number; base_hours: number; tier_name: string | null }) => ({
    revenueThreshold: t.revenue_threshold,
    baseHours: t.base_hours,
    tierName: t.tier_name ?? '',
  }));
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleListEstimates(
  db: SupabaseClient,
  args: ListEstimatesArgs,
) {
  let query = db
    .from('estimates')
    .select(
      'id, program_id, event_id, type, name, room_space, fb_minimum, is_venue_taxable, include_in_budget, sort_order, included_in_proposal, venue_id, created_at, updated_at'
    )
    .order('sort_order');

  if (args.program_id) query = query.eq('program_id', args.program_id);
  if (args.estimate_type) query = query.eq('type', args.estimate_type);
  if (args.included_in_proposal !== undefined) {
    query = query.eq('included_in_proposal', args.included_in_proposal);
  }

  const { data, error } = await query;
  if (error) throw new Error(`list_estimates: ${error.message}`);

  return {
    count: (data ?? []).length,
    estimates: (data ?? []).map((e) => ({
      id: e.id,
      program_id: e.program_id,
      event_id: e.event_id,
      type: e.type,
      name: e.name,
      room_space: e.room_space,
      fb_minimum: e.fb_minimum,
      is_venue_taxable: e.is_venue_taxable,
      include_in_budget: e.include_in_budget,
      included_in_proposal: e.included_in_proposal,
      venue_id: e.venue_id,
      updated_at: e.updated_at,
    })),
  };
}

export async function handleGetEstimate(
  db: SupabaseClient,
  args: GetByIdArgs,
) {
  // Fetch estimate first to determine type and programId
  const { data: estimate, error: estErr } = await db
    .from('estimates')
    .select(
      'id, program_id, event_id, type, name, room_space, fb_minimum, is_venue_taxable, service_charge_override, gratuity_override, admin_fee_override, include_in_budget, sort_order, included_in_proposal, venue_contact, menu_notes, transport_commission, venue_id, venue_space_id, discount_type, discount_value, eeg_enabled, eeg_rate, tax_exempt, food_tax_override, alcohol_tax_override, general_tax_override, slide_copy_data, tour_details, created_at, updated_at'
    )
    .eq('id', args.id)
    .single();

  if (estErr) {
    if (estErr.code === 'PGRST116') return null;
    throw new Error(`get_estimate: ${estErr.message}`);
  }
  if (!estimate) return null;

  // Transportation uses a different data model — return the schedule summary
  if (estimate.type === 'transportation') {
    return handleGetTransportEstimate(db, estimate);
  }

  // Fetch all data needed for the deck contract in parallel
  const [sectionsResult, lineItemsResult, programResult, categoryMarkupsResult, tiersResult, travelItemsResult] =
    await Promise.all([
      db.from('estimate_sections')
        .select('id, name, tax_bucket, markup_pct, sort_order')
        .eq('estimate_id', args.id)
        .order('sort_order'),
      db.from('estimate_line_items')
        .select('id, estimate_id, section, section_id, name, label, qty, unit_price, category_id, markup_override, custom_client_unit_price, tax_type, is_revenue_item, notes, sort_order, thumbnail_url, thumbnail_icon, package_options, selected_package_id')
        .eq('estimate_id', args.id)
        .order('sort_order'),
      db.from('programs')
        .select('id, guest_count, cc_processing_fee, client_commission, gdp_commission_enabled, gdp_commission_rate, service_charge_default, gratuity_default, admin_fee_default, third_party_commissions, include_travel_in_production_fee, location_id')
        .eq('id', estimate.program_id)
        .single(),
      db.from('category_markups').select('id, markup_pct'),
      fetchTiers(db),
      db.from('program_travel_items')
        .select('qty, unit_price')
        .eq('program_id', estimate.program_id),
    ]);

  if (sectionsResult.error) throw new Error(`get_estimate sections: ${sectionsResult.error.message}`);
  if (lineItemsResult.error) throw new Error(`get_estimate line_items: ${lineItemsResult.error.message}`);
  if (programResult.error) throw new Error(`get_estimate program: ${programResult.error.message}`);
  if (categoryMarkupsResult.error) throw new Error(`get_estimate markups: ${categoryMarkupsResult.error.message}`);
  if (travelItemsResult.error) throw new Error(`get_estimate travel: ${travelItemsResult.error.message}`);
  const program = programResult.data;

  // Fetch location — throws if location_id is set but the row is missing or query fails,
  // because a zero-tax result on a taxable estimate is a confident wrong answer.
  // Zero-tax default when location_id is null is correct (no location selected on program).
  let location = { id: '', name: '', food_tax_rate: 0, alcohol_tax_rate: 0, general_tax_rate: 0 };
  if (program.location_id) {
    const { data: loc, error: locErr } = await db
      .from('locations')
      .select('id, name, food_tax_rate, alcohol_tax_rate, general_tax_rate')
      .eq('id', program.location_id)
      .single();
    if (locErr) throw new Error(`get_estimate location: ${locErr.message}`);
    if (loc) location = loc;
  }

  const travelTotal = (travelItemsResult.data ?? []).reduce(
    (s: number, it: { qty: number; unit_price: number }) => s + it.qty * it.unit_price, 0
  );

  const rawEstimate: RawEstimate = {
    id: estimate.id,
    program_id: estimate.program_id,
    event_id: estimate.event_id,
    type: estimate.type,
    name: estimate.name,
    fb_minimum: estimate.fb_minimum,
    is_venue_taxable: estimate.is_venue_taxable,
    service_charge_override: estimate.service_charge_override,
    gratuity_override: estimate.gratuity_override,
    admin_fee_override: estimate.admin_fee_override,
    discount_type: estimate.discount_type,
    discount_value: estimate.discount_value,
    tax_exempt: estimate.tax_exempt,
    food_tax_override: estimate.food_tax_override,
    alcohol_tax_override: estimate.alcohol_tax_override,
    general_tax_override: estimate.general_tax_override,
    included_in_proposal: estimate.included_in_proposal,
    include_in_budget: estimate.include_in_budget,
    venue_id: estimate.venue_id,
    venue_space_id: estimate.venue_space_id,
  };

  const contract = buildDeckContract(
    rawEstimate,
    sectionsResult.data ?? [],
    lineItemsResult.data ?? [],
    {
      id: program.id,
      guest_count: program.guest_count,
      cc_processing_fee: program.cc_processing_fee,
      client_commission: program.client_commission,
      gdp_commission_enabled: program.gdp_commission_enabled,
      gdp_commission_rate: program.gdp_commission_rate,
      service_charge_default: program.service_charge_default,
      gratuity_default: program.gratuity_default,
      admin_fee_default: program.admin_fee_default,
      third_party_commissions: program.third_party_commissions ?? null,
      include_travel_in_production_fee: program.include_travel_in_production_fee,
    },
    location,
    tiersResult,
    categoryMarkupsResult.data ?? [],
    travelTotal,
  );

  return {
    type: 'deck_contract',
    estimate_id: contract.estimateId,
    estimate_name: contract.estimateName,
    estimate_type: contract.estimateType,
    program_id: contract.programId,
    event_id: contract.eventId,
    venue_id: contract.venueId,
    metadata: {
      fb_minimum: contract.fbMinimum,
      is_venue_taxable: contract.isVenueTaxable,
      service_charge: contract.serviceCharge,
      gratuity: contract.gratuity,
      admin_fee: contract.adminFee,
      discount_type: contract.discountType,
      discount_value: contract.discountValue,
      tax_exempt: contract.taxExempt,
      included_in_proposal: contract.includedInProposal,
      include_in_budget: contract.includeInBudget,
    },
    sections: contract.sections.map((s) => ({
      id: s.id,
      name: s.name,
      tax_bucket: s.taxBucket,
      markup_pct: s.markupPct,
      line_items: s.lineItems.map((li) => ({
        id: li.id,
        name: li.name,
        label: li.label,
        qty: li.qty,
        unit_price: li.unitPrice,
        markup_pct: li.markupPct,
        tax_type: li.taxType,
        our_cost: li.ourCost,
        client_cost: li.clientCost,
        tax_rate: li.taxRate,
        tax_amount: li.taxAmount,
        is_revenue_item: li.isRevenueItem,
        notes: li.notes,
      })),
    })),
    summary: {
      fb_subtotal_our: contract.summary.fbSubtotalOur,
      fb_subtotal_client: contract.summary.fbSubtotalClient,
      food_tax: contract.summary.foodTax,
      alcohol_tax: contract.summary.alcoholTax,
      equipment_subtotal_our: contract.summary.equipmentSubtotalOur,
      equipment_subtotal_client: contract.summary.equipmentSubtotalClient,
      equipment_tax: contract.summary.equipmentTax,
      qc_staffing_subtotal_our: contract.summary.qcStaffingSubtotalOur,
      qc_staffing_subtotal_client: contract.summary.qcStaffingSubtotalClient,
      venue_subtotal_our: contract.summary.venueSubtotalOur,
      venue_subtotal_client: contract.summary.venueSubtotalClient,
      venue_tax: contract.summary.venueTax,
      service_charge_client: contract.summary.serviceChargeClient,
      gratuity_client: contract.summary.gratuityClient,
      admin_fee_client: contract.summary.adminFeeClient,
      subtotal_our: contract.summary.subtotalOur,
      subtotal_client: contract.summary.subtotalClient,
      production_fee: contract.summary.productionFee,
      production_fee_tax: contract.summary.productionFeeTax,
      discount_amount: contract.summary.discountAmount,
      total_our: contract.summary.totalOur,
      total_client: contract.summary.totalClient,
      price_per_person: contract.summary.pricePerPerson,
      fb_minimum_met: contract.summary.fbMinimumMet,
      fb_shortfall: contract.summary.fbShortfall,
    },
    margin: {
      vendor_costs_base: contract.margin.vendorCostsBase,
      total_taxes: contract.margin.totalTaxes,
      cc_processing_amount: contract.margin.ccProcessingAmount,
      client_commission_amount: contract.margin.clientCommissionAmount,
      gdp_commission_amount: contract.margin.gdpCommissionAmount,
      third_party_commissions_total: contract.margin.thirdPartyCommissionsTotal,
      qc_revenue: contract.margin.qcRevenue,
      qc_margin_pct: contract.margin.qcMarginPct,
      margin_health: contract.margin.marginHealth,
      estimated_team_hours: contract.margin.estimatedTeamHours,
      op_ex_estimate: contract.margin.opExEstimate,
      travel_expenses: contract.margin.travelExpenses,
      true_net_profit: contract.margin.trueNetProfit,
      true_net_margin_pct: contract.margin.trueNetMarginPct,
      true_net_health: contract.margin.trueNetHealth,
    },
    computed_at: contract.computedAt,
  };
}

async function handleGetTransportEstimate(db: SupabaseClient, estimate: Record<string, unknown>) {
  const estimateId = estimate.id as string;
  const programId = estimate.program_id as string;

  const [scheduleResult, programResult] = await Promise.all([
    db.from('transport_schedule_rows')
      .select('id, service_date, service_type, vehicle_rate_id, spot_time, start_time, end_time, qty, our_cost, client_cost, notes')
      .eq('estimate_id', estimateId)
      .order('sort_order'),
    db.from('programs')
      .select('client_commission, cc_processing_fee, location_id')
      .eq('id', programId)
      .single(),
  ]);

  if (scheduleResult.error) throw new Error(`transport schedule: ${scheduleResult.error.message}`);
  if (programResult.error) throw new Error(`transport program: ${programResult.error.message}`);
  const prog = programResult.data;

  // Same rule as the main path: zero tax when location_id is null is correct;
  // a failed fetch when location_id is set would produce wrong transport tax → throw.
  let generalTaxRate = 0;
  if (prog.location_id) {
    const { data: loc, error: locErr } = await db
      .from('locations')
      .select('general_tax_rate')
      .eq('id', prog.location_id)
      .single();
    if (locErr) throw new Error(`transport location: ${locErr.message}`);
    if (loc) generalTaxRate = loc.general_tax_rate;
  }

  const rows = (scheduleResult.data ?? []).map((r: { our_cost: number; client_cost: number }) => ({
    subtotalOur: r.our_cost,
    subtotalClient: r.client_cost,
  }));

  const transportCommission = (estimate.transport_commission as number | null) ?? prog.client_commission;
  const transportSummary = calcTransportSummary(rows, generalTaxRate, prog.cc_processing_fee, transportCommission);

  return {
    type: 'transport_summary',
    estimate_id: estimateId,
    estimate_name: estimate.name,
    estimate_type: 'transportation',
    program_id: programId,
    schedule_rows: scheduleResult.data ?? [],
    summary: {
      subtotal_our: transportSummary.subtotalOur,
      subtotal_client: transportSummary.subtotalClient,
      markup_revenue: transportSummary.markupRevenue,
      tax: transportSummary.tax,
      production_fee: transportSummary.productionFee,
      total_client: transportSummary.totalClient,
      qc_revenue: transportSummary.qcRevenue,
      qc_margin_pct: transportSummary.qcMarginPct,
    },
    metadata: {
      transport_commission: transportCommission,
      venue_contact: estimate.venue_contact,
      menu_notes: estimate.menu_notes,
      included_in_proposal: estimate.included_in_proposal,
    },
  };
}
