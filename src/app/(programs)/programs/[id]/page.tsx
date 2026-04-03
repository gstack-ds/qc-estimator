import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import {
  getProgram,
  getLocations,
  getEstimatesForProgram,
  getMarkups,
  getTiers,
  getLineItemsForEstimates,
  type DbEstimate,
  type DbLineItem,
  type DbMarkup,
  type DbLocation,
  type DbTier,
} from '@/lib/supabase/queries';
import ProgramForm from '@/components/estimates/ProgramForm';
import ComparisonView, { type EstimateCard } from '@/components/estimates/ComparisonView';
import DeleteProgramButton from '@/components/estimates/DeleteProgramButton';
import { createEstimate } from '@/app/(programs)/programs/actions';
import { calculateVenueEstimate, calculateMarginAnalysis } from '@/lib/engine/pricing';
import type { FeeOption, LineItem, TaxType, ProgramConfig, TeamHoursTier } from '@/types';

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
  service_charge_default: string;
  gratuity_default: string;
  admin_fee_default: string;
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
    serviceChargeDefault: program.service_charge_default as FeeOption,
    gratuityDefault: program.gratuity_default as FeeOption,
    adminFeeDefault: program.admin_fee_default as FeeOption,
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
  tiers: TeamHoursTier[]
): EstimateCard {
  const lineItems = buildLineItems(items, markups);
  const sc = (estimate.service_charge_override ?? config.serviceChargeDefault) as FeeOption;
  const gr = (estimate.gratuity_override ?? config.gratuityDefault) as FeeOption;
  const af = (estimate.admin_fee_override ?? config.adminFeeDefault) as FeeOption;

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

  const [program, locations, estimates, markups, dbTiers] = await Promise.all([
    getProgram(id),
    getLocations(),
    getEstimatesForProgram(id),
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
  const allLineItems = await getLineItemsForEstimates(estimateIds);
  const programConfig = buildProgramConfig(program, program.location);

  const cards: EstimateCard[] = estimates.map((est) => {
    const items = allLineItems.filter((li) => li.estimate_id === est.id);
    return buildEstimateCard(est, items, markups, programConfig, tiers);
  });

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

      {/* Comparison section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-medium text-brand-charcoal">Venue Estimates</h2>
          <form
            action={async () => {
              'use server';
              const result = await createEstimate(id);
              if (result.id) redirect(`/programs/${id}/estimates/${result.id}`);
            }}
          >
            <button
              type="submit"
              className="bg-brand-brown text-white text-sm font-medium rounded px-4 py-2 hover:bg-brand-charcoal transition-colors"
            >
              Add Estimate
            </button>
          </form>
        </div>

        <ComparisonView programId={id} cards={cards} />
      </div>
    </div>
  );
}
