import { getLocations, getMarkups, getTiers } from '@/lib/supabase/queries';
import LocationsTable from '@/components/admin/LocationsTable';
import MarkupsTable from '@/components/admin/MarkupsTable';
import HoursTable from '@/components/admin/HoursTable';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [locations, markups, tiers] = await Promise.all([
    getLocations(),
    getMarkups(),
    getTiers(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Reference Data</h1>
        <p className="text-sm text-gray-500 mt-1">
          Click any cell to edit. Changes save automatically on blur.
        </p>
      </div>

      <LocationsTable initialData={locations} />
      <MarkupsTable initialData={markups} />
      <HoursTable initialData={tiers} />
    </div>
  );
}
