import {
  getLocations, getMarkups, getTiers,
  getDriveRoutes, getTrainRoutes, getFlightTypes,
  getHotelRates, getPerDiemRates, getVehicleRates,
} from '@/lib/supabase/queries';
import LocationsTable from '@/components/admin/LocationsTable';
import MarkupsTable from '@/components/admin/MarkupsTable';
import HoursTable from '@/components/admin/HoursTable';
import DriveRoutesTable from '@/components/admin/DriveRoutesTable';
import TrainRoutesTable from '@/components/admin/TrainRoutesTable';
import FlightTypesTable from '@/components/admin/FlightTypesTable';
import HotelRatesTable from '@/components/admin/HotelRatesTable';
import PerDiemRatesTable from '@/components/admin/PerDiemRatesTable';
import VehicleRatesTable from '@/components/admin/VehicleRatesTable';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [
    locations, markups, tiers,
    driveRoutes, trainRoutes, flightTypes,
    hotelRates, perDiemRates, vehicleRates,
  ] = await Promise.all([
    getLocations(), getMarkups(), getTiers(),
    getDriveRoutes(), getTrainRoutes(), getFlightTypes(),
    getHotelRates(), getPerDiemRates(), getVehicleRates(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-2xl font-medium text-brand-charcoal">Reference Data</h1>
        <p className="text-sm text-brand-silver mt-1">
          Click any cell to edit. Changes save automatically on blur.
        </p>
      </div>

      <LocationsTable initialData={locations} />
      <MarkupsTable initialData={markups} />
      <HoursTable initialData={tiers} />

      <div className="pt-4 border-t border-brand-cream">
        <h2 className="font-serif text-lg font-medium text-brand-charcoal mb-1">Travel Reference Data</h2>
        <p className="text-sm text-brand-silver mb-8">Rates used by the travel expense calculator on each estimate.</p>
        <div className="space-y-10">
          <DriveRoutesTable initialData={driveRoutes} />
          <TrainRoutesTable initialData={trainRoutes} />
          <FlightTypesTable initialData={flightTypes} />
          <HotelRatesTable initialData={hotelRates} />
          <PerDiemRatesTable initialData={perDiemRates} />
          <VehicleRatesTable initialData={vehicleRates} />
        </div>
      </div>
    </div>
  );
}
