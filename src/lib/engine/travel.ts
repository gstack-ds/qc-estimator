// QC Estimator — Travel Calculation Engine
// Pure TypeScript. No React, no Next.js, no Supabase imports.

export const LAST_MINUTE_BUFFER_PER_PERSON = 150;

export interface TravelRefs {
  driveRoutes: Array<{ id: string; route_name: string; cost: number }>;
  trainRoutes: Array<{ id: string; route_name: string; low_cost: number; high_cost: number }>;
  flightTypes: Array<{ id: string; type_name: string; low_cost: number; high_cost: number }>;
  hotelRates: Array<{ id: string; market: string; low_rate: number; high_rate: number }>;
  perDiemRates: Array<{ id: string; market_type: string; full_day: number; half_day: number }>;
  vehicleRates: Array<{
    id: string; market: string;
    sedan_hourly: number; sedan_airport: number;
    suv_hourly: number; suv_airport: number;
    sprinter_hourly: number; sprinter_airport: number;
  }>;
}

export interface TripInput {
  travel_type: 'Drive' | 'Train' | 'Flight' | 'None';
  drive_route_id: string | null;
  train_route_id: string | null;
  flight_type_id: string | null;
  last_minute_buffer: boolean;
  staff_count: number;
  nights: number;
  hotel_rate_id: string | null;
  hotel_budget: 'Low' | 'High';
  per_diem_rate_id: string | null;
  vehicle_rate_id: string | null;
  vehicle_type: 'Sedan' | 'SUV' | 'Sprinter' | 'None';
  vehicle_service: 'Airport Transfer' | 'Hourly';
  vehicle_hours: number;
  custom_vehicle_cost: number;
}

export interface TripCosts {
  travelCost: number;
  hotelCost: number;
  perDiemCost: number;
  vehicleCost: number;
  tripTotal: number;
}

// ─── Individual cost calculations ────────────────────────

export function calcTravelCost(trip: TripInput, refs: TravelRefs): number {
  const staff = Math.max(0, trip.staff_count);

  if (trip.travel_type === 'Drive') {
    const route = refs.driveRoutes.find((r) => r.id === trip.drive_route_id);
    return route?.cost ?? 0;
  }

  if (trip.travel_type === 'Train') {
    const route = refs.trainRoutes.find((r) => r.id === trip.train_route_id);
    if (!route) return 0;
    return route.low_cost * staff;
  }

  if (trip.travel_type === 'Flight') {
    const ft = refs.flightTypes.find((f) => f.id === trip.flight_type_id);
    if (!ft) return 0;
    const buffer = trip.last_minute_buffer ? LAST_MINUTE_BUFFER_PER_PERSON * staff : 0;
    return ft.low_cost * staff + buffer;
  }

  return 0;
}

export function calcHotelCost(trip: TripInput, refs: TravelRefs): number {
  if (!trip.hotel_rate_id || trip.nights <= 0) return 0;
  const rate = refs.hotelRates.find((h) => h.id === trip.hotel_rate_id);
  if (!rate) return 0;
  const nightly = trip.hotel_budget === 'High' ? rate.high_rate : rate.low_rate;
  return nightly * trip.nights * Math.max(0, trip.staff_count);
}

export function calcPerDiemCost(trip: TripInput, refs: TravelRefs): number {
  if (!trip.per_diem_rate_id || trip.nights <= 0) return 0;
  const rate = refs.perDiemRates.find((p) => p.id === trip.per_diem_rate_id);
  if (!rate) return 0;
  const staff = Math.max(0, trip.staff_count);
  // arrival day (half) + full days + departure day (half)
  // nights=1: 2 half days; nights=N: 2 half + (N-1) full
  const cost = 2 * rate.half_day + Math.max(0, trip.nights - 1) * rate.full_day;
  return cost * staff;
}

export function calcVehicleCost(trip: TripInput, refs: TravelRefs): number {
  if (trip.vehicle_type === 'None') return 0;

  // Custom override takes precedence
  if (trip.custom_vehicle_cost > 0) return trip.custom_vehicle_cost;

  if (!trip.vehicle_rate_id) return 0;
  const rate = refs.vehicleRates.find((v) => v.id === trip.vehicle_rate_id);
  if (!rate) return 0;

  const type = trip.vehicle_type.toLowerCase() as 'sedan' | 'suv' | 'sprinter';
  if (trip.vehicle_service === 'Airport Transfer') {
    return rate[`${type}_airport`];
  }
  // Hourly
  return rate[`${type}_hourly`] * Math.max(0, trip.vehicle_hours);
}

// ─── Full trip calculation ────────────────────────────────

export function calculateTrip(trip: TripInput, refs: TravelRefs): TripCosts {
  const travelCost = calcTravelCost(trip, refs);
  const hotelCost = calcHotelCost(trip, refs);
  const perDiemCost = calcPerDiemCost(trip, refs);
  const vehicleCost = calcVehicleCost(trip, refs);
  return {
    travelCost,
    hotelCost,
    perDiemCost,
    vehicleCost,
    tripTotal: travelCost + hotelCost + perDiemCost + vehicleCost,
  };
}

export function calculateTotalTravel(trips: TripInput[], refs: TravelRefs): number {
  return trips.reduce((sum, trip) => sum + calculateTrip(trip, refs).tripTotal, 0);
}
