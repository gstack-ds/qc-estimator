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
  getTravelItems,
  getProgramDocuments,
  type DbEstimate,
  type DbLineItem,
  type DbMarkup,
  type DbLocation,
  type DbTier,
  type TransportAggregate,
} from '@/lib/supabase/queries';
import TravelSection from '@/components/programs/TravelSection';
import DocumentsSection from '@/components/programs/DocumentsSection';
import ProgramForm from '@/components/estimates/ProgramForm';
import EventsView, { type EventRow } from '@/components/estimates/EventsView';
import { type EstimateCard } from '@/components/estimates/ComparisonView';
import DeleteProgramButton from '@/components/estimates/DeleteProgramButton';
import ProgramPnLPanel, { type PnLRow } from '@/components/estimates/ProgramPnLPanel';
import ProgramStatusDropdown from '@/components/programs/ProgramStatusDropdown';
import type { ProgramStatus } from '@/lib/programs/constants';
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

const FB_SECTIONS = new Set(['F&B']);
const VENUE_SECTIONS = new Set(['Venue Fees']);
const STAFFING_SECTIONS = new Set(['Non-Taxable Staffing', 'Florals - Non-Taxable', 'Rentals - Non-Taxable']);

function sectionToTaxBucket(section: string): import('@/types').TaxBucket {
  if (FB_SECTIONS.has(section)) return 'fb';
  if (VENUE_SECTIONS.has(section)) return 'venue';
  if (STAFFING_SECTIONS.has(section)) return 'staffing';
  return 'equipment';
}

function buildLineItems(items: DbLineItem[], markups: DbMarkup[]): LineItem[] {
  return items.map((item) => {
    const markup = markups.find((m) => m.id === item.category_id);
    const isCustom = item.custom_client_unit_price !== null;
    const defaultMarkupPct = isCustom ? 0 : (markup?.markup_pct ?? 0.5);
    return {
      id: item.id,
      section: item.section,
      taxBucket: sectionToTaxBucket(item.section),
      name: item.name,
      qty: item.qty,
      unitPrice: item.unit_price,
      categoryMarkupPct: isCustom ? 0 : (item.markup_override ?? defaultMarkupPct),
      taxType: item.tax_type as TaxType,
      clientCostOverride: isCustom
        ? item.qty * item.custom_client_unit_price!
        : undefined,
    };
  });
}

function buildEstimateData(
  estimate: DbEstimate,
  items: DbLineItem[],
  markups: DbMarkup[],
  config: ProgramConfig,
  tiers: TeamHoursTier[],
  transportAggregate?: TransportAggregate,
): { card: EstimateCard; pnlRow: PnLRow } {
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
      productionFeeTax: 0, lineItemsSubtotalClient: agg.total_client, preTaxTotal: agg.total_client + transportSummary.productionFee,
      totalOur: agg.total_our, totalClient: transportSummary.totalClient,
      pricePerPerson: 0, fbMinimumMet: true, fbShortfall: 0,
      vendorTaxesTotal: 0, revenueItemsClientTotal: 0, discountAmount: 0, travelInProductionFee: 0,
    };
    const transportConfig: ProgramConfig = { ...config, clientCommission: transportCommission, gdpCommissionEnabled: false, thirdPartyCommissions: [] };
    const margin = calculateMarginAnalysis(fakeSummary, transportConfig, tiers);
    const billing = transportSummary.totalClient;
    const card: EstimateCard = {
      id: estimate.id, name: estimate.name, type: estimate.type,
      total: billing,
      pricePerPerson: config.guestCount > 0 ? Math.ceil(billing / config.guestCount) : 0,
      lineItemCount: 0, includeInBudget: estimate.include_in_budget,
      qcMarginPct: margin.qcMarginPct,
    };
    const pnlRow: PnLRow = {
      id: estimate.id, name: estimate.name, type: estimate.type as PnLRow['type'],
      billing, vendorCosts: margin.vendorCostsBase, taxes: margin.totalTaxes,
      commissions: margin.ccProcessingAmount + margin.gdpCommissionAmount + margin.thirdPartyCommissionsTotal,
      qcMargin: margin.qcRevenue, marginPct: margin.qcMarginPct,
    };
    return { card, pnlRow };
  }

  const lineItems = buildLineItems(items, markups);
  const sc = estimate.service_charge_override ?? config.serviceChargeDefault;
  const gr = estimate.gratuity_override ?? config.gratuityDefault;
  const af = estimate.admin_fee_override ?? config.adminFeeDefault;

  const discount = estimate.discount_type && estimate.discount_value > 0
    ? { type: estimate.discount_type, value: estimate.discount_value }
    : null;
  const summary = calculateVenueEstimate(
    { name: estimate.name, fbMinimum: estimate.fb_minimum, isVenueTaxable: estimate.is_venue_taxable, serviceCharge: sc, gratuity: gr, adminFee: af, lineItems, discount },
    config,
  );
  const margin = calculateMarginAnalysis(summary, config, tiers);

  const card: EstimateCard = {
    id: estimate.id, name: estimate.name, type: estimate.type,
    total: summary.totalClient, pricePerPerson: summary.pricePerPerson,
    lineItemCount: items.length, includeInBudget: estimate.include_in_budget,
    qcMarginPct: margin.qcMarginPct,
  };
  const pnlRow: PnLRow = {
    id: estimate.id, name: estimate.name, type: estimate.type as PnLRow['type'],
    billing: summary.totalClient, vendorCosts: margin.vendorCostsBase, taxes: margin.totalTaxes,
    commissions: margin.ccProcessingAmount + margin.gdpCommissionAmount + margin.thirdPartyCommissionsTotal,
    qcMargin: margin.qcRevenue, marginPct: margin.qcMarginPct,
  };
  return { card, pnlRow };
}

// ─── Page ─────────────────────────────────────────────────

export default async function ProgramPage({ params }: Props) {
  const { id } = await params;

  const [program, locations, estimates, dbEvents, markups, dbTiers, travelItems, programDocs] = await Promise.all([
    getProgram(id),
    getLocations(),
    getEstimatesForProgram(id),
    getEventsForProgram(id),
    getMarkups(),
    getTiers(),
    getTravelItems(id),
    getProgramDocuments(id),
  ]);

  const tiers: TeamHoursTier[] = dbTiers.map((t) => ({
    revenueThreshold: t.revenue_threshold,
    baseHours: t.base_hours,
    tierName: t.tier_name ?? '',
  }));

  if (!program) notFound();

  const estimateIds = estimates.map((e) => e.id);
  const [allLineItems, transportAggregates, estimateAttachmentCount] = await Promise.all([
    getLineItemsForEstimates(estimateIds),
    getTransportAggregatesForProgram(id),
    // Roll-up count of estimate-level attachments for display in Documents section
    (async () => {
      if (estimateIds.length === 0) return 0;
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();
      const { count } = await supabase
        .from('estimate_attachments')
        .select('*', { count: 'exact', head: true })
        .in('estimate_id', estimateIds);
      return count ?? 0;
    })(),
  ]);
  const programConfig = buildProgramConfig(program, program.location);

  // Build a card and P&L row for each estimate
  const cardMap = new Map<string, EstimateCard>();
  const pnlRows: PnLRow[] = [];
  for (const est of estimates) {
    const items = allLineItems.filter((li) => li.estimate_id === est.id);
    const transportAgg = transportAggregates.find((a) => a.estimate_id === est.id);
    const { card, pnlRow } = buildEstimateData(est, items, markups, programConfig, tiers, transportAgg);
    cardMap.set(est.id, card);
    if (est.include_in_budget) pnlRows.push(pnlRow);
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/programs" className="text-sm text-brand-silver hover:text-brand-brown transition-colors">
            ← Programs
          </Link>
          <h1 className="font-serif text-2xl font-medium text-brand-charcoal mt-1">{program.name}</h1>
          <div className="mt-2">
            <ProgramStatusDropdown programId={id} status={(program.status ?? 'active') as ProgramStatus} />
          </div>
        </div>
        <DeleteProgramButton programId={id} />
      </div>

      {/* Program form — constrained width */}
      <div className="max-w-3xl">
        <ProgramForm program={program} locations={locations} mode="edit" />
      </div>

      {/* Travel & Transportation */}
      <div className="max-w-3xl">
        <div className="bg-white border border-brand-cream rounded-lg p-5">
          <TravelSection
            programId={id}
            initialItems={travelItems}
            initialIncludeInFee={program.include_travel_in_production_fee ?? false}
          />
        </div>
      </div>

      {/* Documents */}
      <div className="max-w-3xl">
        <div className="bg-white border border-brand-cream rounded-lg p-5">
          <DocumentsSection
            programId={id}
            initialDocs={programDocs}
            estimateAttachmentCount={estimateAttachmentCount}
          />
        </div>
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

      {/* Program P&L */}
      <ProgramPnLPanel rows={pnlRows} />
    </div>
  );
}
