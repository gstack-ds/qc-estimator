import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProgram, getProgramBrief, getTeamMembers } from '@/lib/supabase/queries';
import OnsiteBriefView from '@/components/programs/OnsiteBriefView';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BriefPage({ params }: Props) {
  const { id } = await params;
  const [program, brief, teamMembers] = await Promise.all([
    getProgram(id),
    getProgramBrief(id),
    getTeamMembers(),
  ]);

  if (!program) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm">
        <Link href="/programs" className="text-brand-silver hover:text-brand-brown transition-colors">Programs</Link>
        <span className="text-brand-silver/40 mx-0.5">›</span>
        <Link href={`/programs/${id}`} className="text-brand-silver hover:text-brand-brown transition-colors">{program.name}</Link>
        <span className="text-brand-silver/40 mx-0.5">›</span>
        <span className="font-medium text-brand-charcoal">Onsite Brief</span>
      </div>

      {brief ? (
        <OnsiteBriefView
          programId={id}
          programName={program.name}
          brief={brief}
          teamMembers={teamMembers}
        />
      ) : (
        <div className="bg-white border border-brand-cream rounded-xl p-8 text-center space-y-3">
          <p className="text-brand-charcoal font-medium">No brief generated yet</p>
          <p className="text-sm text-brand-silver">Return to the program page and click "Generate Onsite Brief".</p>
          <Link href={`/programs/${id}`} className="text-brand-brown text-sm hover:text-brand-charcoal transition-colors underline-offset-2 hover:underline">
            ← Back to program
          </Link>
        </div>
      )}
    </div>
  );
}
