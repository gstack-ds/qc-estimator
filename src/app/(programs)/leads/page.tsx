import { getLeads, getLeadCounts } from '@/lib/supabase/queries';
import LeadsList from '@/components/leads/LeadsList';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const [leads, counts] = await Promise.all([getLeads(), getLeadCounts()]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-medium text-brand-charcoal">Leads</h1>
        <p className="text-sm text-brand-charcoal/60 mt-1">GDP leads and manual entries. Click a row to view details.</p>
      </div>
      <LeadsList leads={leads} counts={counts} />
    </div>
  );
}
