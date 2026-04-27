import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getProgram,
  getLocations,
  getEstimatesForProgram,
  getEventsForProgram,
  getMarkups,
  getTiers,
  getLineItemsForEstimates,
  getTransportAggregatesForProgram,
  type DbEstimate,
  type DbLineItem,
  type DbMarkup,
  type DbLocation,
  type DbTier,
  type TransportAggregate,
} from '@/lib/supabase/queries';
import ProgramForm from '@/components/estimates/ProgramForm';
import EventsView, { type EventRow } from '@/components/estimates/EventsView';
import { type EstimateCard } from '@/components/estimates/ComparisonView';
import DeleteProgramButton from '@/components/estimates/DeleteProgramButton';
import { calculateVenueEstimate, calculateMarginAnalysis } from '@/lib/engine/pricing';
import { calcTransportSummary } from '@/lib/engine/transportation';
import type { LineItem, TaxType, ProgramConfig, TeamHoursTier, EstimateSummary } from '@/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

// ─── Engine conversion helpers ───────────────────────────

function buildProgramConfig(program: {
  guest_count: number;
  cc_processing_fee: number;
  client_commission: number;
  gdp_commission_enabled: boolean;
  gdp_commission_rate: number;
  service_charge_default: number;
  gratuity_default: number;
  admin_fee_default: number;
  third_party_commissions: { name: string; rate: number }[];
}, location: DbLocation | null): ProgramConfig {
  return {
    guestCount: program.guest_count,
    location: location
      ? {
          id: location.id,
          name: location.name,
          foodTaxRate: location.food_tax_rate,
          alcoholTaxRate: location.alcohol_tax_rate,
          generalTaxRate: location.general_tax_rate,
        }
      : { id: '', name: '', foodTaxRate: 0, alcoholTaxRate: 0, generalTaxRate: 0 },
    ccProcessingFee: program.cc_processing_fee,
    clientCommission: program.client_commission,
    gdpCommissionEnabled: program.gdp_commission_enabled,
    gdpCommissionRate: program.gdp_commission_rate,
    serviceChargeDefault: program.service_charge_default,
    gratuityDefault: program.gratuity_default,
    adminFeeDefault: program.admin_fee_default,
    thirdPartyCommissions: program.third_party_commissions ?? [],
  };
}

function buildLineItems(items: DbLineItem[], markups: DbMarkup[]): LineItem[] {
  return items.map((item) => {
    const markup = markups.find((m) => m.id === item.category_id);
    const isCustom = item.custom_client_unit_price !== null;
    return {
      id: item.id,
      section: item.section,
      name: item.name,
      qty: item.qty,
      unitPrice: item.unit_price,
      categoryMarkupPct: isCustom ? 0 : (markup?.markup_pct ?? 0.5),
      taxType: item.tax_type as TaxType,
      clientCostOverride: isCustom
        ? item.qty * item.custom_client_unit_price!
        : undefined,
    };
  });
}

function buildEstimateCard(
  estimate: DbEstimate,
  items: DbLineItem[],
  markups: DbMarkup[],
  config: ProgramConfig,
  tiers: TeamHoursTier[],
  transportAggregate?: TransportAggregate,
): EstimateCard {
  if (estimate.type === 'transportation') {
    const agg = transportAggregate ?? { estimate_id: estimate.id, total_our: 0, total_client: 0 };
    const transportCommission = estimate.transport_commission ?? 0;
    const transportSummary = calcTransportSummary(
      [{ subtotalOur: agg.total_our, subtotalClient: agg.total_client }],
      config.location.generalTaxRate,
      config.ccProcessingFee,
      transportCommission,
    );
    const fakeSummary: EstimateSummary = {
      fbSubtotalOur: 0, fbSubtotalClient: 0, fbFoodSubtotalClient: 0, fbAlcoholSubtotalClient: 0,
      foodTax: 0, alcoholTax: 0,
      equipmentSubtotalOur: agg.total_our, equipmentSubtotalClient: agg.total_client, equipmentTax: 0,
      qcStaffingSubtotalOur: 0, qcStaffingSubtotalClient: 0,
      venueSubtotalOur: 0, venueSubtotalClient: 0, venueTax: 0,
      serviceChargeOur: 0, serviceChargeClient: 0, gratuityOur: 0, gratuityClient: 0,
      adminFeeOur: 0, adminFeeClient: 0,
      subtotalOur: agg.total_our, subtotalClient: agg.total_client,
      productionFee: transportSummary.productionFee,
      totalOur: agg.total_our, totalClient: transportSummary.totalClient,
      pricePerPerson: 0, fbMinimumMet: true, fbShortfall: 0,
    };
    const transportConfig: ProgramConfig = { ...config, clientCommission: transportCommission, gdpCommissionEnabled: false, thirdPartyCommissions: [] };
    const margin = calculateMarginAnalysis(fakeSummary, transportConfig, tiers);
    return {
      id: estimate.id,
      name: estimate.name,
      type: estimate.type,
      total: transportSummary.totalClient,
      pricePerPerson: config.guestCount > 0 ? Math.ceil(transportSummary.totalClient / config.guestCount) : 0,
      lineItemCount: 0,
      includeInBudget: estimate.include_in_budget,
      qcMarginPct: margin.qcMarginPct,
    };
  }

  const lineItems = buildLineItems(items, markups);
  const sc = estimate.service_charge_override ?? config.serviceChargeDefault;
  const gr = estimate.gratuity_override ?? config.gratuityDefault;
  const af = estimate.admin_fee_override ?? config.adminFeeDefault;

  const summary = calculateVenueEstimate(
    {
      name: estimate.name,
      fbMinimum: estimate.fb_minimum,
      isVenueTaxable: estimate.is_venue_taxable,
      serviceCharge: sc,
      gratuity: gr,
      adminFee: af,
      lineItems,
    },
    config
  );

  const margin = calculateMarginAnalysis(summary, config, tiers);

  return {
    id: estimate.id,
    name: estimate.name,
    type: estimate.type,
    total: summary.totalClient,
    pricePerPerson: summary.pricePerPerson,
    lineItemCount: items.length,
    includeInBudget: estimate.include_in_budget,
    qcMarginPct: margin.qcMarginPct,
  };
}

// ─── Page ─────────────────────────────────────────────────

export default async function ProgramPage({ params }: Props) {
  const { id } = await params;

  const [program, locations, estimates, dbEvents, markups, dbTiers] = await Promise.all([
    getProgram(id),
    getLocations(),
    getEstimatesForProgram(id),
    getEventsForProgram(id),
    getMarkups(),
    getTiers(),
  ]);

  const tiers: TeamHoursTier[] = dbTiers.map((t) => ({
    revenueThreshold: t.revenue_threshold,
    baseHours: t.base_hours,
    tierName: t.tier_name ?? '',
  }));

  if (!program) notFound();

  const estimateIds = estimates.map((e) => e.id);
  const [allLineItems, transportAggregates] = await Promise.all([
    getLineItemsForEstimates(estimateIds),
    getTransportAggregatesForProgram(id),
  ]);
  const programConfig = buildProgramConfig(program, program.location);

  // Build a card for each estimate
  const cardMap = new Map<string, EstimateCard>();
  for (const est of estimates) {
    const items = allLineItems.filter((li) => li.estimate_id === est.id);
    const transportAgg = transportAggregates.find((a) => a.estimate_id === est.id);
    cardMap.set(est.id, buildEstimateCard(est, items, markups, programConfig, tiers, transportAgg));
  }

  // Group estimates by event_id
  const eventCardMap = new Map<string, EstimateCard[]>();
  const unassignedCards: EstimateCard[] = [];
  for (const est of estimates) {
    const card = cardMap.get(est.id)!;
    if (est.event_id) {
      if (!eventCardMap.has(est.event_id)) eventCardMap.set(est.event_id, []);
      eventCardMap.get(est.event_id)!.push(card);
    } else {
      unassignedCards.push(card);
    }
  }

  // Build EventRow[] in sort order
  const eventRows: EventRow[] = dbEvents.map((ev) => ({
    id: ev.id,
    name: ev.name,
    event_date: ev.event_date,
    start_time: ev.start_time,
    end_time: ev.end_time,
    guest_count: ev.guest_count,
    event_type: ev.event_type,
    description: ev.description,
    sort_order: ev.sort_order,
    cards: eventCardMap.get(ev.id) ?? [],
  }));

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/programs" className="text-sm text-brand-silver hover:text-brand-brown transition-colors">
            ← Programs
          </Link>
          <h1 className="font-serif text-2xl font-medium text-brand-charcoal mt-1">{program.name}</h1>
        </div>
        <DeleteProgramButton programId={id} />
      </div>

      {/* Program form — constrained width */}
      <div className="max-w-3xl">
        <ProgramForm program={program} locations={locations} mode="edit" />
      </div>

      {/* Events + Estimates section */}
      <div>
        <h2 className="font-serif text-lg font-medium text-brand-charcoal mb-4">Events</h2>
        <EventsView
          programId={id}
          events={eventRows}
          unassignedCards={unassignedCards}
          programGuestCount={program.guest_count}
        />
      </div>
    </div>
  );
}
