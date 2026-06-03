/**
 * Builds the structured (non-AI) sections of an onsite brief from program data.
 * Pure TypeScript — no API calls, no Supabase imports.
 */

import type { BriefContent } from './types';
import type { DbProgramWithLocation } from '@/lib/supabase/queries';
import type { DbEvent } from '@/lib/supabase/queries';
import type { DbTravelItem } from '@/lib/supabase/queries';
import type { DbEstimate } from '@/lib/supabase/queries';
import type { DbVenue, DbVenueSpace } from '@/lib/supabase/queries';
import type { EstimateSummary, ProgramConfig } from '@/types';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fmtDate(d: string | null) {
  if (!d) return 'TBD';
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${day}, ${y}`;
}

function fmtTime(t: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function fmtMoney(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

export interface StructuredBriefInput {
  program: DbProgramWithLocation;
  events: DbEvent[];
  venueEstimate: DbEstimate | null;
  venue: DbVenue | null;
  venueSpace: DbVenueSpace | null;
  summary: EstimateSummary | null;
  programConfig: ProgramConfig | null;
  travelItems: DbTravelItem[];
  programTravelTotal: number;
}

export function buildStructuredSections(input: StructuredBriefInput): Partial<BriefContent> {
  const { program, events, venueEstimate, venue, venueSpace, summary, programConfig, travelItems, programTravelTotal } = input;

  // Prefer event date from first event, fall back to program
  const primaryEvent = events.find(e => e.event_date) ?? null;
  const eventDate = primaryEvent?.event_date ?? program.event_date;
  const startTime = primaryEvent?.start_time ?? program.event_start_time;
  const endTime = primaryEvent?.end_time ?? program.event_end_time;
  const guestCount = primaryEvent?.guest_count && primaryEvent.guest_count > 0
    ? primaryEvent.guest_count
    : program.guest_count;

  // ── Event Basics ────────────────────────────────────────
  const eventBasicsLines = [
    `Program: ${program.name}`,
    `Client: ${program.client_name ?? 'TBD'}`,
    program.company_name ? `Company: ${program.company_name}` : null,
    `Event Date: ${fmtDate(eventDate)}`,
    startTime ? `Event Time: ${fmtTime(startTime)}${endTime ? ` – ${fmtTime(endTime)}` : ''}` : 'Event Time: TBD',
    `Guest Count: ${guestCount > 0 ? guestCount : 'TBD'}`,
    program.service_style ? `Service Style: ${program.service_style}` : null,
    program.alcohol_type ? `Alcohol: ${program.alcohol_type}` : null,
  ].filter(Boolean).join('\n');

  // ── Venue Contact ────────────────────────────────────────
  const venueParts: string[] = [];
  if (venue) {
    venueParts.push(`Venue: ${venue.name}`);
    if (venue.address) venueParts.push(`Address: ${venue.address}${venue.city ? `, ${venue.city}` : ''}${venue.state ? `, ${venue.state}` : ''}`);
    if (venueSpace) venueParts.push(`Room/Space: ${venueSpace.name}`);
    else if (venueEstimate?.room_space) venueParts.push(`Room/Space: ${venueEstimate.room_space}`);
    if (venue.contact_name) venueParts.push(`Contact: ${venue.contact_name}`);
    if (venue.contact_email) venueParts.push(`Email: ${venue.contact_email}`);
    if (venue.contact_phone) venueParts.push(`Phone: ${venue.contact_phone}`);
    if (venue.website) venueParts.push(`Website: ${venue.website}`);
  } else if (venueEstimate?.room_space) {
    venueParts.push(`Room/Space: ${venueEstimate.room_space}`);
  } else {
    venueParts.push('Venue: TBD — link a venue to the estimate');
  }
  if (program.client_hotel) {
    venueParts.push('', `Hotel: ${program.client_hotel}`);
  }

  // ── Financial Details ────────────────────────────────────
  const finParts: string[] = [];
  if (summary && programConfig) {
    const sc = venueEstimate?.service_charge_override ?? programConfig.serviceChargeDefault;
    const gr = venueEstimate?.gratuity_override ?? programConfig.gratuityDefault;
    const af = venueEstimate?.admin_fee_override ?? programConfig.adminFeeDefault;

    finParts.push('=== CLIENT-FACING FINANCIALS ===');
    if (summary.fbSubtotalClient > 0) finParts.push(`  F&B (food + NA bev): ${fmtMoney(summary.fbFoodSubtotalClient + (summary.fbSubtotalClient - summary.fbAlcoholSubtotalClient - summary.fbFoodSubtotalClient))}`);
    if (summary.fbAlcoholSubtotalClient > 0) finParts.push(`  Bar: ${fmtMoney(summary.fbAlcoholSubtotalClient)}`);
    if (summary.serviceChargeClient > 0) finParts.push(`  Service Charge (${fmtPct(sc)}): ${fmtMoney(summary.serviceChargeClient)}`);
    if (summary.gratuityClient > 0) finParts.push(`  Gratuity (${fmtPct(gr)}): ${fmtMoney(summary.gratuityClient)}`);
    if (summary.adminFeeClient > 0) finParts.push(`  Admin Fee (${fmtPct(af)}): ${fmtMoney(summary.adminFeeClient)}`);
    if (summary.venueSubtotalClient > 0) finParts.push(`  Venue/Room Rental: ${fmtMoney(summary.venueSubtotalClient)}`);
    if (summary.qcStaffingSubtotalClient > 0) finParts.push(`  QC Staffing: ${fmtMoney(summary.qcStaffingSubtotalClient)}`);
    const totalTax = summary.foodTax + summary.alcoholTax + summary.equipmentTax + summary.venueTax;
    if (totalTax > 0) finParts.push(`  Tax: ${fmtMoney(totalTax)}`);
    if (summary.productionFee > 0) finParts.push(`  Production Fee: ${fmtMoney(summary.productionFee)}`);
    finParts.push(`  TOTAL: ${fmtMoney(summary.totalClient)}`);
    if (summary.pricePerPerson > 0) finParts.push(`  Per Person: ${fmtMoney(summary.pricePerPerson)}`);
    if (venueEstimate?.fb_minimum && venueEstimate.fb_minimum > 0) {
      const fbMet = summary.fbSubtotalClient >= venueEstimate.fb_minimum;
      finParts.push(`  F&B Minimum: ${fmtMoney(venueEstimate.fb_minimum)} (${fbMet ? '✓ Met' : '⚠ Not yet met'})`);
    }
    finParts.push('', '=== INTERNAL COST BASIS ===');
    finParts.push(`  Vendor Costs: ${fmtMoney(summary.subtotalOur)}`);
    if (programTravelTotal > 0) finParts.push(`  QC Travel: ${fmtMoney(programTravelTotal)}`);
    finParts.push(`  CC Processing (${fmtPct(programConfig.ccProcessingFee)}): approx ${fmtMoney(summary.subtotalClient * programConfig.ccProcessingFee)}`);
    finParts.push(`  Client Commission (${fmtPct(programConfig.clientCommission)}): approx ${fmtMoney(summary.fbSubtotalClient * programConfig.clientCommission)}`);
    if (programConfig.gdpCommissionEnabled) finParts.push(`  GDP Commission (${fmtPct(programConfig.gdpCommissionRate)}): on`);
  } else {
    finParts.push('Financial data unavailable — generate brief after adding estimates.');
  }

  // ── Transportation ────────────────────────────────────────
  const transParts: string[] = [];
  if (travelItems.length > 0) {
    transParts.push(...travelItems.map(it => `  ${it.description || '(unnamed)'}  ×${it.qty}  ${fmtMoney(it.qty * it.unit_price)}`));
    transParts.push(`  Total: ${fmtMoney(programTravelTotal)}`);
    if (program.include_travel_in_production_fee) {
      transParts.push('  (included in production fee)');
    }
  } else {
    transParts.push('No travel items entered yet — add on the program page.');
  }

  return {
    eventBasics: {
      content: eventBasicsLines,
      isAiDraft: false,
    },
    venueContact: {
      content: venueParts.join('\n'),
      isAiDraft: false,
    },
    financialDetails: {
      content: finParts.join('\n'),
      isAiDraft: false,
    },
    transportation: {
      content: transParts.join('\n'),
      isAiDraft: false,
    },
  };
}
