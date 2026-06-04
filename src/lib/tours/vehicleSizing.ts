// Tour vehicle sizing — pure TypeScript, no framework dependencies.
// Produces a lowest-cost fleet suggestion for a given guest count and duration.

export interface VehicleType {
  id: string;
  name: string;
  capacity: number;   // max passengers
  hourlyRate: number; // vendor cost per hour
  minHours: number;   // minimum billable hours
}

export const VEHICLE_FLEET: VehicleType[] = [
  { id: 'sedan',        name: 'Sedan',        capacity:  2, hourlyRate: 150, minHours: 3 },
  { id: 'suv',          name: 'SUV',          capacity:  4, hourlyRate: 180, minHours: 3 },
  { id: 'sprinter',     name: 'Sprinter',     capacity: 10, hourlyRate: 220, minHours: 4 },
  { id: 'mini_bus',     name: 'Mini Bus',     capacity: 40, hourlyRate: 375, minHours: 5 },
  { id: 'motor_coach',  name: 'Motor Coach',  capacity: 56, hourlyRate: 450, minHours: 5 },
];

export const GREETER_RATE = 135;
export const GREETER_MIN_HOURS = 4;

// Greeter required for groups > 10 or for any airport transfer.
const GREETER_GROUP_THRESHOLD = 10;

export interface VehicleAssignment {
  vehicle: VehicleType;
  count: number;
  ourCost: number; // total cost for this vehicle group at the given duration
}

export interface FleetSuggestion {
  assignments: VehicleAssignment[];
  totalOurCost: number;
  totalCapacity: number;
}

// Cost for one unit of a vehicle type at a given duration.
export function vehicleCost(vehicle: VehicleType, hours: number): number {
  return vehicle.hourlyRate * Math.max(hours, vehicle.minHours);
}

function fleetCost(fleet: { vehicle: VehicleType; count: number }[], hours: number): number {
  return fleet.reduce((sum, a) => sum + vehicleCost(a.vehicle, hours) * a.count, 0);
}

function fleetCapacity(fleet: { vehicle: VehicleType; count: number }[]): number {
  return fleet.reduce((sum, a) => sum + a.vehicle.capacity * a.count, 0);
}

// Generates a set of candidate fleets. The cheapest one wins.
// Candidates:
//   1. Each single vehicle type that covers all guests
//   2. Multiple Motor Coaches for very large groups
//   3. All-Sprinter fleet (when 2+ Sprinters needed)
//   4. Greedy largest-first mixed fleet (minimises vehicle count, remainder
//      always filled by the smallest vehicle that fits)
function generateCandidates(
  guestCount: number,
): { vehicle: VehicleType; count: number }[][] {
  const candidates: { vehicle: VehicleType; count: number }[][] = [];
  const sortedDesc = [...VEHICLE_FLEET].sort((a, b) => b.capacity - a.capacity);
  const sedan = VEHICLE_FLEET.find(v => v.id === 'sedan')!;
  const sprinter = VEHICLE_FLEET.find(v => v.id === 'sprinter')!;
  const motorCoach = VEHICLE_FLEET.find(v => v.id === 'motor_coach')!;

  // 1. Single vehicle options for any type that covers all guests
  for (const v of VEHICLE_FLEET) {
    if (v.capacity >= guestCount) {
      candidates.push([{ vehicle: v, count: 1 }]);
    }
  }

  // 2. Multiple Motor Coaches for groups larger than one Motor Coach
  if (guestCount > motorCoach.capacity) {
    candidates.push([{ vehicle: motorCoach, count: Math.ceil(guestCount / motorCoach.capacity) }]);
  }

  // 3. All-Sprinter fleet (only worth generating when 2+ are needed)
  const sprinterCount = Math.ceil(guestCount / sprinter.capacity);
  if (sprinterCount >= 2) {
    candidates.push([{ vehicle: sprinter, count: sprinterCount }]);
  }

  // 4. Greedy largest-first mixed fleet
  const greedy: { vehicle: VehicleType; count: number }[] = [];
  let remaining = guestCount;

  for (const v of sortedDesc) {
    if (remaining <= 0) break;
    const n = Math.floor(remaining / v.capacity);
    if (n > 0) {
      greedy.push({ vehicle: v, count: n });
      remaining -= n * v.capacity;
    }
  }
  // Any leftover (< smallest vehicle capacity) fills with one extra Sedan
  if (remaining > 0) {
    const existing = greedy.find(a => a.vehicle.id === sedan.id);
    if (existing) {
      existing.count += 1;
    } else {
      greedy.push({ vehicle: sedan, count: 1 });
    }
  }
  if (greedy.length > 0) {
    candidates.push(greedy);
  }

  return candidates;
}

// Returns the lowest-cost fleet for the given guest count and tour duration.
export function suggestFleet(guestCount: number, durationHours: number): FleetSuggestion {
  if (guestCount <= 0) {
    return { assignments: [], totalOurCost: 0, totalCapacity: 0 };
  }

  const candidates = generateCandidates(guestCount);

  let bestCost = Infinity;
  let bestFleet: { vehicle: VehicleType; count: number }[] = [];

  for (const fleet of candidates) {
    const cost = fleetCost(fleet, durationHours);
    if (cost < bestCost) {
      bestCost = cost;
      bestFleet = fleet;
    }
  }

  const assignments: VehicleAssignment[] = bestFleet.map(a => ({
    vehicle: a.vehicle,
    count: a.count,
    ourCost: vehicleCost(a.vehicle, durationHours) * a.count,
  }));

  return {
    assignments,
    totalOurCost: bestCost,
    totalCapacity: fleetCapacity(bestFleet),
  };
}

// A greeter is required for airport transfers or groups larger than the threshold.
export function requiresGreeter(guestCount: number, pickupType?: string | null): boolean {
  return guestCount > GREETER_GROUP_THRESHOLD || pickupType === 'airport';
}

// Cost for one greeter at the given duration (minimum 4hrs).
export function greeterOurCost(durationHours: number): number {
  return GREETER_RATE * Math.max(durationHours, GREETER_MIN_HOURS);
}
