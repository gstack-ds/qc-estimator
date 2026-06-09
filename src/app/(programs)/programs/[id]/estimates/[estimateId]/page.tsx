import { notFound } from 'next/navigation';
import {
  getProgram,
  getEstimatesForProgram,
  getEstimate,
  getEstimateSections,
  getEvent,
  getLineItemsForEstimate,
  getMarkups,
  getTiers,
  getTransportVehicleRates,
  getTransportScheduleRows,
  getVenuePickerVendors,
  getAllVenueSpaces,
  getLocations,
  getTravelItems,
  getBudgetPlanEntryForEstimate,
  getVenueWithSpaces,
  getVendorPhotos,
} from '@/lib/supabase/queries';
import { ensureDefaultSections } from '@/app/(programs)/programs/[id]/estimates/actions';
import EstimateBuilder from '@/components/estimates/EstimateBuilder';
import type { SlideCopyData } from '@/types/slideCopy';
import AvEstimateBuilder from '@/components/estimates/AvEstimateBuilder';
import DecorEstimateBuilder from '@/components/estimates/DecorEstimateBuilder';
import TransportationEstimateBuilder from '@/components/estimates/TransportationEstimateBuilder';
import TourEstimateBuilder from '@/components/estimates/TourEstimateBuilder';
import ProposalPreview from '@/components/estimates/ProposalPreview';
import { calculateVenueEstimate } from '@/lib/engine/pricing';
import type { LineItem, TaxType, TaxBucket } from '@/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string; estimateId: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function EstimatePage({ params, searchParams }: Props) {
  const { id: programId, estimateId } = await params;
  const { view } = await searchParams;

  const [program, allEstimates, estimate, markups, tiers, venues, allLocations, travelItems, budgetPlanEntry] = await Promise.all([
    getProgram(programId),
    getEstimatesForProgram(programId),
    getEstimate(estimateId),
    getMarkups(),
    getTiers(),
    getVenuePickerVendors(),
    getLocations(),
    getTravelItems(programId),
    getBudgetPlanEntryForEstimate(estimateId),
  ]);

  if (!program || !estimate) notFound();

  const event = estimate.event_id ? await getEvent(estimate.event_id) : null;
  const eventName = event?.name ?? null;
  const effectiveProgram = event?.guest_count
    ? { ...program, guest_count: event.guest_count }
    : program;

  // Compute program-level travel total from travel items
  const programTravelTotal = travelItems.reduce((s, it) => s + it.qty * it.unit_price, 0);

  if (estimate.type === 'transportation') {
    const [vehicleRates, scheduleRows] = await Promise.all([
      getTransportVehicleRates(estimateId),
      getTransportScheduleRows(estimateId),
    ]);
    return (
      <div className="h-[calc(100vh-49px)] flex flex-col">
        <TransportationEstimateBuilder
          program={effectiveProgram}
          location={program.location}
          allEstimates={allEstimates}
          estimate={estimate}
          vehicleRates={vehicleRates}
          scheduleRows={scheduleRows}
          tiers={tiers}
          eventName={eventName}
          programTravelTotal={programTravelTotal}
          includeTravelInProductionFee={program.include_travel_in_production_fee ?? false}
        />
      </div>
    );
  }

  const [lineItems, venueSpaces, rawSections] = await Promise.all([
    getLineItemsForEstimate(estimateId),
    estimate.type === 'venue' ? getAllVenueSpaces() : Promise.resolve([]),
    getEstimateSections(estimateId),
  ]);

  let dbSections = rawSections;
  if (dbSections.length === 0 && estimate.type !== 'transportation') {
    const { sections } = await ensureDefaultSections(estimateId, estimate.type as import('@/types').EstimateType);
    dbSections = sections.map((s) => ({ ...s, tax_bucket: s.tax_bucket as 'fb' | 'equipment' | 'venue' | 'staffing' }));
  }

  if (estimate.type === 'venue' && view === 'proposal') {
    const venueId = estimate.venue_id;
    const [venue, photos] = await Promise.all([
      venueId ? getVenueWithSpaces(venueId) : Promise.resolve(null),
      venueId ? getVendorPhotos(venueId) : Promise.resolve([]),
    ]);

    const bucketMap = new Map<string, TaxBucket>(
      dbSections.map((s) => [s.id, s.tax_bucket]),
    );

    const loc = program.location;
    const programConfig = {
      guestCount: effectiveProgram.guest_count,
      location: loc
        ? { id: loc.id, name: loc.name, foodTaxRate: loc.food_tax_rate, alcoholTaxRate: loc.alcohol_tax_rate, generalTaxRate: loc.general_tax_rate }
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

    const engineItems: LineItem[] = lineItems.map((item) => {
      const markup = markups.find((m) => m.id === item.category_id);
      const isCustom = item.custom_client_unit_price !== null;
      const defaultMarkupPct = isCustom ? 0 : (markup?.markup_pct ?? 0.5);
      return {
        id: item.id,
        section: item.section,
        taxBucket: bucketMap.get(item.section_id ?? '') ?? 'equipment' as TaxBucket,
        name: item.name,
        qty: item.qty,
        unitPrice: item.unit_price,
        categoryMarkupPct: isCustom ? 0 : (item.markup_override ?? defaultMarkupPct),
        taxType: item.tax_type as TaxType,
        isRevenueItem: item.is_revenue_item,
        clientCostOverride: isCustom ? item.qty * item.custom_client_unit_price! : undefined,
      };
    });

    const sc = estimate.service_charge_override ?? programConfig.serviceChargeDefault;
    const gr = estimate.gratuity_override ?? programConfig.gratuityDefault;
    const af = estimate.admin_fee_override ?? programConfig.adminFeeDefault;
    const discount = estimate.discount_type && estimate.discount_value > 0
      ? { type: estimate.discount_type, value: estimate.discount_value }
      : null;

    const summary = calculateVenueEstimate(
      { name: estimate.name, fbMinimum: estimate.fb_minimum, isVenueTaxable: estimate.is_venue_taxable, serviceCharge: sc, gratuity: gr, adminFee: af, lineItems: engineItems, discount },
      programConfig,
    );

    const heroPhoto = photos.find((p) => p.tag === 'space') ?? photos[0] ?? null;
    const galleryPhotos = photos.filter((p) => p !== heroPhoto);

    const spaceId = estimate.venue_space_id;
    const space = venue?.spaces?.find((s) => s.id === spaceId) ?? null;

    return (
      <div className="max-w-4xl mx-auto px-6 py-10 print:px-0 print:py-0" data-brochure-page>
        <ProposalPreview
          estimate={estimate}
          program={effectiveProgram}
          event={event}
          venueName={venue?.name ?? estimate.name}
          venueSpaceName={space?.name ?? undefined}
          venueCity={venue?.city ?? undefined}
          venueState={venue?.state ?? undefined}
          heroPhoto={heroPhoto}
          galleryPhotos={galleryPhotos}
          summary={summary}
          slideCopyData={estimate.slide_copy_data as SlideCopyData | null}
          sections={dbSections}
        />
      </div>
    );
  }

  if (estimate.type === 'venue') {
    return (
      <div className="h-[calc(100vh-49px)] flex flex-col">
        <EstimateBuilder
          program={effectiveProgram}
          location={program.location}
          allEstimates={allEstimates}
          estimate={estimate}
          dbLineItems={lineItems}
          dbSections={dbSections}
          markups={markups}
          tiers={tiers}
          eventName={eventName}
          event={event}
          initialSlideCopyData={estimate.slide_copy_data as SlideCopyData | null}
          venues={venues}
          venueSpaces={venueSpaces}
          allLocations={allLocations}
          programTravelTotal={programTravelTotal}
          includeTravelInProductionFee={program.include_travel_in_production_fee ?? false}
          budgetPlanEntry={budgetPlanEntry}
        />
      </div>
    );
  }

  if (estimate.type === 'tour') {
    return (
      <div className="h-[calc(100vh-49px)] flex flex-col">
        <TourEstimateBuilder
          program={effectiveProgram}
          location={program.location}
          allEstimates={allEstimates}
          estimate={estimate}
          dbLineItems={lineItems}
          dbSections={dbSections}
          markups={markups}
          tiers={tiers}
          eventName={eventName}
          programTravelTotal={programTravelTotal}
          includeTravelInProductionFee={program.include_travel_in_production_fee ?? false}
        />
      </div>
    );
  }

  const Builder = estimate.type === 'av'
    ? AvEstimateBuilder
    : DecorEstimateBuilder;

  return (
    <div className="h-[calc(100vh-49px)] flex flex-col">
      <Builder
        program={effectiveProgram}
        location={program.location}
        allEstimates={allEstimates}
        estimate={estimate}
        dbLineItems={lineItems}
        dbSections={dbSections}
        markups={markups}
        tiers={tiers}
        eventName={eventName}
        programTravelTotal={programTravelTotal}
        includeTravelInProductionFee={program.include_travel_in_production_fee ?? false}
      />
    </div>
  );
}
