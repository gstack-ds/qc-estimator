// Pure assembly of the deal page's section/breadcrumb list. Single source of truth for BOTH
// the DealNav crumbs and which <section id="…"> the page renders — so a crumb always targets a
// real section. Server-free + testable: handles all 3 deal shapes (lone lead, pair, standalone
// program) and generates a per-event crumb for each event.

export interface DealNavSection {
  id: string;
  label: string;
}

export function buildDealSections(opts: {
  hasLead: boolean;
  hasProgram: boolean;
  events: { id: string; name: string | null }[];
}): DealNavSection[] {
  const out: DealNavSection[] = [];
  out.push({ id: 'client', label: 'Client' });

  // Lead-stage sections only exist when there's a lead record.
  if (opts.hasLead) {
    out.push({ id: 'intake', label: 'Intake & Source' });
    out.push({ id: 'dates', label: 'Dates & Logistics' });
  }

  // Commission lives on the shared client record → always present.
  out.push({ id: 'commission', label: 'Commission' });

  // Program-stage sections + a jump per event.
  out.push({ id: 'program', label: opts.hasProgram ? 'Program Setup' : 'Program' });
  if (opts.hasProgram) {
    out.push({ id: 'events', label: 'Events & Estimates' });
    for (const e of opts.events) {
      out.push({ id: `event-${e.id}`, label: e.name && e.name.trim() ? e.name : 'Event' });
    }
    out.push({ id: 'staffing', label: 'Staffing' });
    out.push({ id: 'budget', label: 'Budget' });
    out.push({ id: 'documents', label: 'Documents' });
    out.push({ id: 'travel', label: 'Travel' });
  }

  return out;
}
