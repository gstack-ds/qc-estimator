import { notFound } from 'next/navigation';
import { getLead, getProgramsForLead, getTeamMembers } from '@/lib/supabase/queries';
import LeadDetail from '@/components/leads/LeadDetail';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: Props) {
  const { id } = await params;
  const [lead, linkedPrograms, teamMembers] = await Promise.all([
    getLead(id),
    getProgramsForLead(id),
    getTeamMembers(),
  ]);
  if (!lead) notFound();
  return <LeadDetail lead={lead} linkedPrograms={linkedPrograms} teamMembers={teamMembers} />;
}
