import { getLocations } from '@/lib/supabase/queries';
import ProgramForm from '@/components/estimates/ProgramForm';

export default async function NewProgramPage() {
  const locations = await getLocations();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">New Program</h1>
        <p className="text-sm text-gray-500 mt-1">Fill in the event details. You can edit these any time.</p>
      </div>
      <ProgramForm locations={locations} mode="create" />
    </div>
  );
}
