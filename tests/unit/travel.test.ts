import { describe, it, expect } from 'vitest';
import {
  calcTravelCost,
  calcHotelCost,
  calcPerDiemCost,
  calcVehicleCost,
  calculateTrip,
  calculateTotalTravel,
  LAST_MINUTE_BUFFER_PER_PERSON,
} from '../../src/lib/engine/travel';
import type { TravelRefs, TripInput } from '../../src/lib/engine/travel';

// ─── Fixtures ─────────────────────────────────────────────

const REFS: TravelRefs = {
  driveRoutes: [
    { id: 'dr-1', route_name: 'DC to Richmond VA', cost: 205 },
    { id: 'dr-2', route_name: 'Charlotte to Raleigh NC', cost: 230 },
  ],
  trainRoutes: [
    { id: 'tr-1', route_name: 'DC to NYC', low_cost: 80, high_cost: 200 },
    { id: 'tr-2', route_name: 'Philadelphia to NYC', low_cost: 40, high_cost: 120 },
  ],
  flightTypes: [
    { id: 'ft-1', type_name: 'Short Haul', low_cost: 350, high_cost: 550 },
    { id: 'ft-2', type_name: 'Medium Haul', low_cost: 450, high_cost: 750 },
  ],
  hotelRates: [
    { id: 'hr-1', market: 'NYC', low_rate: 450, high_rate: 650 },
    { id: 'hr-2', market: 'DC', low_rate: 350, high_rate: 550 },
  ],
  perDiemRates: [
    { id: 'pd-1', market_type: 'Standard', full_day: 68, half_day: 34 },
    { id: 'pd-2', market_type: 'NYC', full_day: 92, half_day: 46 },
  ],
  vehicleRates: [
    {
      id: 'vr-1', market: 'NYC',
      sedan_hourly: 125, sedan_airport: 175,
      suv_hourly: 150, suv_airport: 200,
      sprinter_hourly: 200, sprinter_airport: 275,
    },
    {
      id: 'vr-2', market: 'DC',
      sedan_hourly: 110, sedan_airport: 150,
      suv_hourly: 135, suv_airport: 175,
      sprinter_hourly: 185, sprinter_airport: 250,
    },
  ],
};

const BASE_TRIP: TripInput = {
  travel_type: 'None',
  drive_route_id: null,
  train_route_id: null,
  flight_type_id: null,
  last_minute_buffer: false,
  staff_count: 2,
  nights: 1,
  hotel_rate_id: null,
  hotel_budget: 'Low',
  per_diem_rate_id: null,
  vehicle_rate_id: null,
  vehicle_type: 'None',
  vehicle_service: 'Airport Transfer',
  vehicle_hours: 0,
  custom_vehicle_cost: 0,
};

// ─── Travel cost ─────────────────────────────────────────

describe('calcTravelCost', () => {
  it('returns drive route cost (flat, not per-staff)', () => {
    const trip: TripInput = { ...BASE_TRIP, travel_type: 'Drive', drive_route_id: 'dr-1' };
    expect(calcTravelCost(trip, REFS)).toBe(205);
  });

  it('returns 0 for drive with no route selected', () => {
    const trip: TripInput = { ...BASE_TRIP, travel_type: 'Drive', drive_route_id: null };
    expect(calcTravelCost(trip, REFS)).toBe(0);
  });

  it('multiplies train low_cost by staff count', () => {
    const trip: TripInput = { ...BASE_TRIP, travel_type: 'Train', train_route_id: 'tr-1', staff_count: 3 };
    expect(calcTravelCost(trip, REFS)).toBe(80 * 3); // 240
  });

  it('multiplies flight low_cost by staff, no buffer', () => {
    const trip: TripInput = { ...BASE_TRIP, travel_type: 'Flight', flight_type_id: 'ft-1', staff_count: 2, last_minute_buffer: false };
    expect(calcTravelCost(trip, REFS)).toBe(350 * 2); // 700
  });

  it('adds last minute buffer per person for flights', () => {
    const trip: TripInput = { ...BASE_TRIP, travel_type: 'Flight', flight_type_id: 'ft-1', staff_count: 2, last_minute_buffer: true };
    expect(calcTravelCost(trip, REFS)).toBe(350 * 2 + LAST_MINUTE_BUFFER_PER_PERSON * 2); // 700 + 300 = 1000
  });

  it('returns 0 for None travel type', () => {
    expect(calcTravelCost(BASE_TRIP, REFS)).toBe(0);
  });
});

// ─── Hotel cost ───────────────────────────────────────────

describe('calcHotelCost', () => {
  it('calculates low rate × nights × staff', () => {
    const trip: TripInput = { ...BASE_TRIP, hotel_rate_id: 'hr-1', hotel_budget: 'Low', nights: 2, staff_count: 2 };
    expect(calcHotelCost(trip, REFS)).toBe(450 * 2 * 2); // 1800
  });

  it('uses high rate when budget = High', () => {
    const trip: TripInput = { ...BASE_TRIP, hotel_rate_id: 'hr-1', hotel_budget: 'High', nights: 1, staff_count: 1 };
    expect(calcHotelCost(trip, REFS)).toBe(650);
  });

  it('returns 0 when no hotel rate selected', () => {
    const trip: TripInput = { ...BASE_TRIP, hotel_rate_id: null, nights: 2 };
    expect(calcHotelCost(trip, REFS)).toBe(0);
  });

  it('returns 0 when nights = 0', () => {
    const trip: TripInput = { ...BASE_TRIP, hotel_rate_id: 'hr-1', nights: 0 };
    expect(calcHotelCost(trip, REFS)).toBe(0);
  });
});

// ─── Per diem cost ────────────────────────────────────────

describe('calcPerDiemCost', () => {
  it('1 night = 2 half days × staff (Standard)', () => {
    const trip: TripInput = { ...BASE_TRIP, per_diem_rate_id: 'pd-1', nights: 1, staff_count: 2 };
    // 2 × $34 × 2 staff = $136
    expect(calcPerDiemCost(trip, REFS)).toBe(2 * 34 * 2);
  });

  it('2 nights = 2 half days + 1 full day × staff', () => {
    const trip: TripInput = { ...BASE_TRIP, per_diem_rate_id: 'pd-1', nights: 2, staff_count: 1 };
    // 2×34 + 1×68 = 68 + 68 = 136
    expect(calcPerDiemCost(trip, REFS)).toBe(2 * 34 + 68);
  });

  it('3 nights = 2 half + 2 full × staff', () => {
    const trip: TripInput = { ...BASE_TRIP, per_diem_rate_id: 'pd-1', nights: 3, staff_count: 2 };
    // (2×34 + 2×68) × 2 = (68 + 136) × 2 = 408
    expect(calcPerDiemCost(trip, REFS)).toBe((2 * 34 + 2 * 68) * 2);
  });

  it('uses NYC rates', () => {
    const trip: TripInput = { ...BASE_TRIP, per_diem_rate_id: 'pd-2', nights: 1, staff_count: 1 };
    expect(calcPerDiemCost(trip, REFS)).toBe(2 * 46);
  });

  it('returns 0 when nights = 0', () => {
    const trip: TripInput = { ...BASE_TRIP, per_diem_rate_id: 'pd-1', nights: 0 };
    expect(calcPerDiemCost(trip, REFS)).toBe(0);
  });

  it('returns 0 when no rate selected', () => {
    const trip: TripInput = { ...BASE_TRIP, per_diem_rate_id: null, nights: 2 };
    expect(calcPerDiemCost(trip, REFS)).toBe(0);
  });
});

// ─── Vehicle cost ─────────────────────────────────────────

describe('calcVehicleCost', () => {
  it('returns sedan airport rate', () => {
    const trip: TripInput = { ...BASE_TRIP, vehicle_rate_id: 'vr-1', vehicle_type: 'Sedan', vehicle_service: 'Airport Transfer' };
    expect(calcVehicleCost(trip, REFS)).toBe(175);
  });

  it('returns suv hourly × hours', () => {
    const trip: TripInput = { ...BASE_TRIP, vehicle_rate_id: 'vr-1', vehicle_type: 'SUV', vehicle_service: 'Hourly', vehicle_hours: 4 };
    expect(calcVehicleCost(trip, REFS)).toBe(150 * 4); // 600
  });

  it('uses custom override when > 0', () => {
    const trip: TripInput = { ...BASE_TRIP, vehicle_rate_id: 'vr-1', vehicle_type: 'Sedan', vehicle_service: 'Airport Transfer', custom_vehicle_cost: 500 };
    expect(calcVehicleCost(trip, REFS)).toBe(500);
  });

  it('returns 0 when vehicle type is None', () => {
    const trip: TripInput = { ...BASE_TRIP, vehicle_type: 'None', vehicle_rate_id: 'vr-1' };
    expect(calcVehicleCost(trip, REFS)).toBe(0);
  });

  it('returns sprinter airport for DC', () => {
    const trip: TripInput = { ...BASE_TRIP, vehicle_rate_id: 'vr-2', vehicle_type: 'Sprinter', vehicle_service: 'Airport Transfer' };
    expect(calcVehicleCost(trip, REFS)).toBe(250);
  });
});

// ─── Full trip + total ────────────────────────────────────

describe('calculateTrip', () => {
  it('sums all costs into tripTotal', () => {
    const trip: TripInput = {
      ...BASE_TRIP,
      travel_type: 'Drive', drive_route_id: 'dr-1',         // $205
      hotel_rate_id: 'hr-2', hotel_budget: 'Low', nights: 1, // $350
      per_diem_rate_id: 'pd-1',                              // 2×34 = $68
      vehicle_type: 'Sedan', vehicle_rate_id: 'vr-2',
      vehicle_service: 'Airport Transfer',                   // $150
      staff_count: 1,
    };
    const result = calculateTrip(trip, REFS);
    expect(result.travelCost).toBe(205);
    expect(result.hotelCost).toBe(350);
    expect(result.perDiemCost).toBe(68);
    expect(result.vehicleCost).toBe(150);
    expect(result.tripTotal).toBe(205 + 350 + 68 + 150); // 773
  });
});

describe('calculateTotalTravel', () => {
  it('sums multiple trips', () => {
    const trip1: TripInput = { ...BASE_TRIP, travel_type: 'Drive', drive_route_id: 'dr-1' };
    const trip2: TripInput = { ...BASE_TRIP, travel_type: 'Drive', drive_route_id: 'dr-2' };
    expect(calculateTotalTravel([trip1, trip2], REFS)).toBe(205 + 230);
  });

  it('returns 0 for empty array', () => {
    expect(calculateTotalTravel([], REFS)).toBe(0);
  });
});
