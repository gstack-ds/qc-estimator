import { getAllCalloutsWithContext, getTeamMembers } from '@/lib/supabase/queries';
import CalloutsView from '@/components/callouts/CalloutsView';

export const dynamic = 'force-dynamic';

export default async function CalloutsPage() {
  const [callouts, teamMembers] = await Promise.all([
    getAllCalloutsWithContext(),
    getTeamMembers(),
  ]);

  return (
    <div className="px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-medium text-brand-charcoal">Callouts</h1>
        <p className="text-sm text-brand-charcoal/60 mt-1">
          Shared issue log across all programs. Raise it, discuss it, resolve it. Internal only — never on a proposal.
        </p>
      </div>
      <CalloutsView callouts={callouts} teamMembers={teamMembers} />
    </div>
  );
}
