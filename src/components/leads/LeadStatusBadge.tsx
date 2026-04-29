import type { LeadStatus } from '@/lib/supabase/queries';

const CONFIG: Record<LeadStatus, { label: string; classes: string }> = {
  new_lead:       { label: 'New Lead',       classes: 'bg-blue-50 text-blue-700 border-blue-100' },
  proposal:       { label: 'Proposal',       classes: 'bg-amber-50 text-amber-700 border-amber-100' },
  under_contract: { label: 'Under Contract', classes: 'bg-green-50 text-green-700 border-green-100' },
  archived:       { label: 'Archived',       classes: 'bg-brand-offwhite text-brand-silver border-brand-cream' },
};

export default function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const { label, classes } = CONFIG[status] ?? CONFIG.new_lead;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${classes}`}>
      {label}
    </span>
  );
}
