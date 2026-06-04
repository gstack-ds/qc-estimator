import type { LeadStatus } from '@/lib/supabase/queries';

const CONFIG: Record<LeadStatus, { label: string; classes: string }> = {
  tracking_on_hold:          { label: 'Tracking / On Hold',         classes: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  new_lead:                  { label: 'New Lead',                   classes: 'bg-blue-50 text-blue-700 border-blue-100' },
  proposal_in_progress:      { label: 'Proposal in Progress',       classes: 'bg-amber-50 text-amber-700 border-amber-100' },
  pending_client_review:     { label: 'Pending Client Review',      classes: 'bg-orange-50 text-orange-700 border-orange-100' },
  negotiations:              { label: 'Negotiations',               classes: 'bg-rose-50 text-rose-700 border-rose-100' },
  pending_contract_payment:  { label: 'Pending Contract/Payment',   classes: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
  under_contract:            { label: 'Under Contract',             classes: 'bg-green-50 text-green-700 border-green-100' },
  planning:                  { label: 'Planning',                   classes: 'bg-teal-50 text-teal-700 border-teal-100' },
  unresponsive:              { label: 'Unresponsive',               classes: 'bg-red-50 text-red-600 border-red-100' },
  post_event_close_out:      { label: 'Post Event Close Out',       classes: 'bg-purple-50 text-purple-700 border-purple-100' },
  halted:                    { label: 'Halted',                     classes: 'bg-rose-50 text-rose-700 border-rose-100' },
  planning_not_started:      { label: 'Planning Not Started',       classes: 'bg-brand-offwhite text-brand-charcoal/60 border-brand-cream' },
  did_not_book:              { label: 'Did Not Book',               classes: 'bg-brand-offwhite text-brand-silver border-brand-cream' },
  completed:                 { label: 'Completed',                  classes: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
};

export default function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const { label, classes } = CONFIG[status] ?? CONFIG.new_lead;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${classes}`}>
      {label}
    </span>
  );
}
