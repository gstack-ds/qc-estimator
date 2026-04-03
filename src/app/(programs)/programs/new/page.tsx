import { getLocations } from '@/lib/supabase/queries';
import ProgramForm from '@/components/estimates/ProgramForm';

export default async function NewProgramPage() {
  const locations = await getLocations();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-medium text-brand-charcoal">New Program</h1>
        <p className="text-sm text-brand-silver mt-1">Fill in the event details. You can edit these any time.</p>
      </div>
      <ProgramForm locations={locations} mode="create" />
    </div>
  );
}
