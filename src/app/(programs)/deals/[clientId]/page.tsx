import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getDealByClientId,
  getEventsForProgram,
  getEstimatesForProgram,
  getStaffingForProgram,
  getBudgetPlanEntries,
  getProgramDocuments,
  getTravelItems,
  getTeamMembers,
  type DbEvent,
  type DbEstimate,
  type DbStaffingRole,
  type DbBudgetPlanEntry,
  type DbTravelItem,
  type DbTeamMember,
} from '@/lib/supabase/queries';
import type { DbProgramDocument } from '@/lib/programs/documentTypes';
import { StatusProgression } from '@/components/deals/StatusProgression';
import { DealNav } from '@/components/deals/DealNav';
import { DealSection, FieldGrid, type Field } from '@/components/deals/DealSection';
import {
  EventsSummary,
  StaffingSummary,
  BudgetSummary,
  DocumentsSummary,
  TravelSummary,
} from '@/components/deals/ProgramSummaries';
import { buildDealSections } from '@/lib/deal/sections';
import { fmtDate, fmtPercent, fmtBool, orDash } from '@/lib/deal/format';

// READ-ONLY unified deal page (Phase 2B). Assembles a deal by client_id (shared client + its
// lead + its program) into ONE scrollable sectioned page. No editing (2C), no redirects from
// old routes (2E) — reach via direct link. Program-side sections are read-only summaries that
// link out to the existing editable workspaces.

interface Props {
  params: Promise<{ clientId: string }>;
}

const pick = <T,>(...vals: (T | null | undefined)[]): T | null => {
  for (const v of vals) if (v !== null && v !== undefined && v !== ('' as unknown as T)) return v;
  return null;
};

export default async function DealPage({ params }: Props) {
  const { clientId } = await params;
  const { client, lead, program } = await getDealByClientId(clientId);

  // No record at all → 404.
  if (!client && !lead && !program) notFound();

  // Program-side read-only data (only when a program exists). teamMembers always fetched for
  // owner / assignee name resolution.
  let events: DbEvent[] = [];
  let estimates: DbEstimate[] = [];
  let staffing: DbStaffingRole[] = [];
  let budgetEntries: DbBudgetPlanEntry[] = [];
  let documents: DbProgramDocument[] = [];
  let travel: DbTravelItem[] = [];
  let teamMembers: DbTeamMember[] = [];

  if (program) {
    [events, estimates, staffing, budgetEntries, documents, travel, teamMembers] = await Promise.all([
      getEventsForProgram(program.id),
      getEstimatesForProgram(program.id),
      getStaffingForProgram(program.id),
      getBudgetPlanEntries(program.id),
      getProgramDocuments(program.id),
      getTravelItems(program.id),
      getTeamMembers(),
    ]);
  } else {
    teamMembers = await getTeamMembers();
  }

  const teamMap: Record<number, string> = Object.fromEntries(
    teamMembers.map((m) => [m.id, `${m.first_name} ${m.last_name}`.trim()]),
  );

  const dealName =
    pick(program?.name, lead?.program_name, lead?.client_name, client?.client_name) ?? 'Untitled Deal';
  const company = pick(client?.company_name, lead?.end_company, program?.company_name);
  const ownerName = lead?.assigned_to != null ? teamMap[lead.assigned_to] : null;
  const supportName = lead?.team_support != null ? teamMap[lead.team_support] : null;

  const navSections = buildDealSections({
    hasLead: !!lead,
    hasProgram: !!program,
    events: events.map((e) => ({ id: e.id, name: e.name })),
  });

  // ── Field groups ───────────────────────────────────────────────────────────
  const clientFields: Field[] = [
    { label: 'Client Name', value: orDash(pick(client?.client_name, lead?.client_name, program?.client_name)) },
    { label: 'Company', value: orDash(company) },
    { label: 'End Client', value: orDash(pick(client?.end_client, lead?.end_client)) },
    { label: 'Contact Name', value: orDash(pick(client?.contact_name, lead?.contact_name)) },
    { label: 'Client Contact', value: orDash(pick(client?.client_contact_name, lead?.client_contact_name)) },
    { label: 'Contact Email', value: orDash(pick(client?.contact_email, lead?.contact_email)) },
    { label: 'Contact Role', value: orDash(pick(client?.contact_role, lead?.contact_role)) },
    { label: 'Returning Client', value: fmtBool(pick(client?.returning_client, lead?.returning_client)) },
  ];

  const commissionFields: Field[] = [
    { label: 'Client Commission', value: fmtPercent(pick(client?.client_commission, lead?.source_commission)) },
    { label: 'GDP Commission Rate', value: fmtPercent(pick(client?.gdp_commission_rate, lead?.third_party_commission)) },
    { label: 'GDP Commission', value: fmtPercent(pick(client?.gdp_commission, lead?.gdp_commission)) },
    { label: 'Extra Commission', value: fmtPercent(pick(client?.extra_commission, lead?.extra_commission)) },
    { label: 'Third Party', value: orDash(pick(client?.third_party, lead?.third_party)) },
    { label: 'Third-Party Company', value: orDash(pick(client?.third_party_company, lead?.third_party_company)) },
    { label: 'Third-Party Contact', value: orDash(pick(client?.third_party_contact, lead?.third_party_contact)) },
    { label: 'Commission Notes', value: orDash(pick(client?.commission_notes, lead?.commission_notes)) },
    { label: 'Billing Notes', value: orDash(pick(client?.billing_notes, lead?.billing_notes)) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      {/* ── Sticky header + status + breadcrumb ── */}
      <header className="sticky top-0 z-20 -mx-4 mb-2 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
        <DealNav dealName={dealName} sections={navSections} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-brand-charcoal">{dealName}</h1>
            <p className="text-xs text-gray-500">
              {orDash(company)}
              {ownerName ? ` · Owner: ${ownerName}` : ''}
              {supportName ? ` · Support: ${supportName}` : ''}
            </p>
          </div>
          <div className="shrink-0">
            {lead ? (
              <StatusProgression status={lead.status} />
            ) : program ? (
              <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium capitalize text-gray-500">
                Program: {program.status.replace(/_/g, ' ')}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {/* 1 — Client & Deal Info */}
        <DealSection id="client" title="Client & Deal Info">
          <FieldGrid fields={clientFields} />
        </DealSection>

        {/* 2 — Intake & Source (lead) */}
        {lead && (
          <DealSection id="intake" title="Intake & Source">
            <FieldGrid
              fields={[
                { label: 'Lead Source Type', value: orDash(lead.lead_source_type) },
                { label: 'Lead Source', value: orDash(lead.lead_source) },
                { label: 'Source Advisor', value: orDash(lead.source_advisor) },
                { label: 'Source Coordinator', value: orDash(lead.source_coordinator) },
                { label: 'Sales Coordinator', value: orDash(lead.sales_coordinator) },
                { label: 'GDP Advisor', value: orDash(lead.gdp_advisor) },
                { label: 'GDP Coordinator', value: orDash(lead.gdp_coordinator) },
                { label: 'Last Follow-Up', value: fmtDate(lead.date_last_followup) },
              ]}
            />
            {lead.special_instructions && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-brand-charcoal">{lead.special_instructions}</p>
            )}
          </DealSection>
        )}

        {/* 3 — Dates & Logistics (lead) */}
        {lead && (
          <DealSection id="dates" title="Dates & Logistics">
            <FieldGrid
              fields={[
                { label: 'Start Date', value: fmtDate(lead.start_date) },
                { label: 'End Date', value: fmtDate(lead.end_date) },
                { label: 'Rain Date', value: fmtDate(lead.rain_date) },
                { label: 'Current Due Date', value: fmtDate(lead.current_due_date) },
                { label: 'Nights', value: orDash(lead.num_nights) },
                { label: 'Program Type', value: orDash(lead.program_type) },
                { label: 'Guest Count', value: orDash(lead.guest_count) },
                { label: 'Hotel', value: orDash(lead.hotel) },
                { label: 'Venue', value: orDash(lead.venue) },
                { label: 'City', value: orDash(lead.city) },
                { label: 'State', value: orDash(lead.state) },
                { label: 'Region', value: orDash(lead.region) },
              ]}
            />
          </DealSection>
        )}

        {/* 4 — Commission (shared client) */}
        <DealSection id="commission" title="Commission & Partners">
          <FieldGrid fields={commissionFields} />
        </DealSection>

        {/* 5 — Program Setup (program) */}
        <DealSection
          id="program"
          title={program ? 'Program Setup' : 'Program'}
          action={
            program ? (
              <Link href={`/programs/${program.id}`} className="text-xs font-medium text-brand-copper hover:underline">
                Open program workspace →
              </Link>
            ) : undefined
          }
        >
          {program ? (
            <FieldGrid
              fields={[
                { label: 'Program Name', value: orDash(program.name) },
                { label: 'Event Date', value: fmtDate(program.event_date) },
                { label: 'Guest Count', value: orDash(program.guest_count) },
                { label: 'Service Style', value: orDash(program.service_style) },
                { label: 'Alcohol Type', value: orDash(program.alcohol_type) },
                { label: 'Start Time', value: orDash(program.event_start_time) },
                { label: 'End Time', value: orDash(program.event_end_time) },
                { label: 'Location', value: orDash(program.location?.name) },
                { label: 'Client Hotel', value: orDash(program.client_hotel) },
                { label: 'Program Type', value: orDash(program.program_type) },
                { label: 'CC Processing', value: fmtPercent(program.cc_processing_fee) },
                { label: 'Client Commission', value: fmtPercent(program.client_commission) },
                { label: 'GDP Commission', value: program.gdp_commission_enabled ? fmtPercent(program.gdp_commission_rate) : 'Off' },
                { label: 'Service Charge', value: fmtPercent(program.service_charge_default) },
                { label: 'Gratuity', value: fmtPercent(program.gratuity_default) },
                { label: 'Admin Fee', value: fmtPercent(program.admin_fee_default) },
              ]}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">
              Not booked yet — no program workspace.
              {lead && (
                <>
                  {' '}
                  <Link href={`/leads/${lead.id}`} className="font-medium text-brand-copper hover:underline">
                    Open lead to create a program →
                  </Link>
                </>
              )}
            </div>
          )}
        </DealSection>

        {/* 6–10 — Program workspace summaries (read-only, link out) */}
        {program && (
          <>
            <DealSection id="events" title="Events & Estimates">
              <EventsSummary programId={program.id} events={events} estimates={estimates} />
            </DealSection>

            <DealSection id="staffing" title="Staffing">
              <StaffingSummary staffing={staffing} teamMap={teamMap} />
            </DealSection>

            <DealSection id="budget" title="Budget Plan">
              <BudgetSummary programId={program.id} entries={budgetEntries} />
            </DealSection>

            <DealSection id="documents" title="Documents">
              <DocumentsSummary documents={documents} />
            </DealSection>

            <DealSection id="travel" title="Travel">
              <TravelSummary travel={travel} />
            </DealSection>
          </>
        )}
      </div>
    </div>
  );
}
