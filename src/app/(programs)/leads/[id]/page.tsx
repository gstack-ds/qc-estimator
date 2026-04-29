import { notFound } from 'next/navigation';
import { getLead, getProgramForLead, getTeamMembers } from '@/lib/supabase/queries';
import LeadDetail from '@/components/leads/LeadDetail';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: Props) {
  const { id } = await params;
  const [lead, linkedProgram, teamMembers] = await Promise.all([getLead(id), getProgramForLead(id), getTeamMembers()]);
  if (!lead) notFound();
  return <LeadDetail lead={lead} linkedProgram={linkedProgram} teamMembers={teamMembers} />;
}
