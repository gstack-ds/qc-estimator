import { describe, it, expect } from 'vitest';
import {
  suggestFleet,
  requiresGreeter,
  greeterOurCost,
  vehicleCost,
  VEHICLE_FLEET,
  GREETER_RATE,
  GREETER_MIN_HOURS,
} from '../../src/lib/tours/vehicleSizing';

// ─── vehicleCost ────────────────────────────────────────────────

describe('vehicleCost', () => {
  const sedan   = VEHICLE_FLEET.find(v => v.id === 'sedan')!;
  const sprinter = VEHICLE_FLEET.find(v => v.id === 'sprinter')!;
  const miniBus  = VEHICLE_FLEET.find(v => v.id === 'mini_bus')!;

  it('charges actual hours when above minimum', () => {
    // Sedan: $150/hr, 3hr min. At 8hrs → $150 × 8 = $1200
    expect(vehicleCost(sedan, 8)).toBe(1200);
  });

  it('charges minimum hours when below minimum', () => {
    // Sedan: 3hr min. At 1hr → $150 × 3 = $450
    expect(vehicleCost(sedan, 1)).toBe(450);
  });

  it('charges minimum hours at exactly the minimum', () => {
    // Sedan at 3hrs → $150 × 3 = $450
    expect(vehicleCost(sedan, 3)).toBe(450);
  });

  it('Sprinter minimum is 4hrs', () => {
    // Sprinter: $220/hr, 4hr min. At 2hrs → $220 × 4 = $880
    expect(vehicleCost(sprinter, 2)).toBe(880);
  });

  it('Mini Bus minimum is 5hrs', () => {
    // Mini Bus: $375/hr, 5hr min. At 3hrs → $375 × 5 = $1875
    expect(vehicleCost(miniBus, 3)).toBe(1875);
  });
});

// ─── suggestFleet — vehicle selection ───────────────────────────

describe('suggestFleet — small groups (single vehicle)', () => {
  it('1 guest → 1 Sedan', () => {
    const r = suggestFleet(1, 3);
    expect(r.assignments).toHaveLength(1);
    expect(r.assignments[0].vehicle.id).toBe('sedan');
    expect(r.assignments[0].count).toBe(1);
    expect(r.totalOurCost).toBe(450); // $150 × 3
    expect(r.totalCapacity).toBeGreaterThanOrEqual(1);
  });

  it('2 guests → 1 Sedan', () => {
    const r = suggestFleet(2, 3);
    expect(r.assignments[0].vehicle.id).toBe('sedan');
    expect(r.assignments[0].count).toBe(1);
    expect(r.totalOurCost).toBe(450);
  });

  it('3 guests → 1 SUV (Sedan too small, SUV cheapest single vehicle)', () => {
    const r = suggestFleet(3, 3);
    expect(r.assignments[0].vehicle.id).toBe('suv');
    expect(r.assignments[0].count).toBe(1);
    expect(r.totalOurCost).toBe(540); // $180 × 3
  });

  it('4 guests → 1 SUV', () => {
    const r = suggestFleet(4, 3);
    expect(r.assignments[0].vehicle.id).toBe('suv');
    expect(r.totalOurCost).toBe(540);
  });

  it('5 guests → 1 Sprinter (cheapest vehicle covering 5)', () => {
    const r = suggestFleet(5, 4);
    expect(r.assignments[0].vehicle.id).toBe('sprinter');
    expect(r.assignments[0].count).toBe(1);
    expect(r.totalOurCost).toBe(880); // $220 × 4
  });

  it('10 guests → 1 Sprinter', () => {
    const r = suggestFleet(10, 4);
    expect(r.assignments[0].vehicle.id).toBe('sprinter');
    expect(r.totalOurCost).toBe(880);
  });
});

// ─── suggestFleet — medium groups (cost-efficiency trade-offs) ──

describe('suggestFleet — medium groups', () => {
  it('11 guests → 1 Sprinter + 1 Sedan (cheaper than 2 Sprinters or Mini Bus)', () => {
    // 1 Sprinter ($880) + 1 Sedan ($600) = $1480
    // 2 Sprinters: $880 × 2 = $1760
    // Mini Bus: $375 × 5 = $1875
    const r = suggestFleet(11, 4);
    expect(r.totalOurCost).toBe(1480);
    expect(r.totalCapacity).toBeGreaterThanOrEqual(11);
    const vehicleIds = r.assignments.map(a => a.vehicle.id);
    expect(vehicleIds).toContain('sprinter');
    expect(vehicleIds).toContain('sedan');
  });

  it('20 guests → 2 Sprinters (cheaper than Mini Bus at 4hrs)', () => {
    // 2 Sprinters: $880 × 2 = $1760
    // Mini Bus: $375 × 5 = $1875
    const r = suggestFleet(20, 4);
    expect(r.totalOurCost).toBe(1760);
    const sprinterEntry = r.assignments.find(a => a.vehicle.id === 'sprinter')!;
    expect(sprinterEntry.count).toBe(2);
  });

  it('21 guests → 1 Mini Bus (cheapest option once Sprinters need 3 vehicles)', () => {
    // Mini Bus: $1875
    // 3 Sprinters: $880 × 3 = $2640
    // 2 Sprinters + 1 Sedan: $1760 + $600 = $2360
    const r = suggestFleet(21, 4);
    expect(r.assignments[0].vehicle.id).toBe('mini_bus');
    expect(r.assignments[0].count).toBe(1);
    expect(r.totalOurCost).toBe(1875);
  });

  it('40 guests → 1 Mini Bus', () => {
    const r = suggestFleet(40, 4);
    expect(r.assignments[0].vehicle.id).toBe('mini_bus');
    expect(r.totalOurCost).toBe(1875);
    expect(r.totalCapacity).toBeGreaterThanOrEqual(40);
  });
});

// ─── suggestFleet — large groups ────────────────────────────────

describe('suggestFleet — large groups', () => {
  it('41 guests → 1 Motor Coach (cheaper than Mini Bus + extras)', () => {
    // Motor Coach: $450 × 5 = $2250
    // Mini Bus + Sedan: $1875 + $750 = $2625
    const r = suggestFleet(41, 5);
    expect(r.assignments[0].vehicle.id).toBe('motor_coach');
    expect(r.assignments[0].count).toBe(1);
    expect(r.totalOurCost).toBe(2250);
  });

  it('56 guests → 1 Motor Coach', () => {
    const r = suggestFleet(56, 5);
    expect(r.assignments[0].vehicle.id).toBe('motor_coach');
    expect(r.totalOurCost).toBe(2250);
    expect(r.totalCapacity).toBeGreaterThanOrEqual(56);
  });

  it('57 guests → 1 Motor Coach + 1 Sedan (cheaper than 2 Motor Coaches)', () => {
    // MC + Sedan: $2250 + $150 × 5 = $2250 + $750 = $3000
    // 2 Motor Coaches: $2250 × 2 = $4500
    const r = suggestFleet(57, 5);
    expect(r.totalOurCost).toBe(3000);
    expect(r.totalCapacity).toBeGreaterThanOrEqual(57);
    const vehicleIds = r.assignments.map(a => a.vehicle.id);
    expect(vehicleIds).toContain('motor_coach');
  });

  it('112 guests → 2 Motor Coaches', () => {
    // 2 MCs: $2250 × 2 = $4500
    // Greedy: 2 MCs exactly covers 112 → same $4500
    const r = suggestFleet(112, 5);
    const mc = r.assignments.find(a => a.vehicle.id === 'motor_coach')!;
    expect(mc.count).toBe(2);
    expect(r.totalOurCost).toBe(4500);
  });
});

// ─── suggestFleet — duration effects ────────────────────────────

describe('suggestFleet — duration effects', () => {
  it('uses actual hours when above vehicle minimum', () => {
    // Sedan at 8hrs: $150 × 8 = $1200
    const r = suggestFleet(1, 8);
    expect(r.totalOurCost).toBe(1200);
  });

  it('uses minimum hours when below vehicle minimum', () => {
    // Sedan: 3hr min. At 1hr still charges $450
    const r = suggestFleet(1, 1);
    expect(r.totalOurCost).toBe(450);
  });

  it('Sprinter uses 4hr minimum for 2hr tour', () => {
    // 10 guests, 2hrs → Sprinter: $220 × 4 = $880
    const r = suggestFleet(10, 2);
    expect(r.totalOurCost).toBe(880);
  });

  it('Sprinter uses actual hours for 6hr tour', () => {
    // 10 guests, 6hrs → Sprinter: $220 × 6 = $1320
    const r = suggestFleet(10, 6);
    expect(r.totalOurCost).toBe(1320);
  });
});

// ─── suggestFleet — edge cases ──────────────────────────────────

describe('suggestFleet — edge cases', () => {
  it('0 guests → empty fleet with zero cost', () => {
    const r = suggestFleet(0, 4);
    expect(r.assignments).toHaveLength(0);
    expect(r.totalOurCost).toBe(0);
    expect(r.totalCapacity).toBe(0);
  });

  it('fleet always covers at least the requested guest count', () => {
    for (const count of [1, 5, 11, 21, 41, 57, 100]) {
      const r = suggestFleet(count, 4);
      expect(r.totalCapacity).toBeGreaterThanOrEqual(count);
    }
  });

  it('per-assignment ourCost matches total', () => {
    const r = suggestFleet(11, 4);
    const sumOfParts = r.assignments.reduce((s, a) => s + a.ourCost, 0);
    expect(sumOfParts).toBe(r.totalOurCost);
  });
});

// ─── requiresGreeter ────────────────────────────────────────────

describe('requiresGreeter', () => {
  it('not required for ≤10 guests with no airport pickup', () => {
    expect(requiresGreeter(10, null)).toBe(false);
    expect(requiresGreeter(10, 'hotel')).toBe(false);
    expect(requiresGreeter(5, 'meeting_point')).toBe(false);
  });

  it('required for 11+ guests (group threshold)', () => {
    expect(requiresGreeter(11, null)).toBe(true);
    expect(requiresGreeter(20, null)).toBe(true);
    expect(requiresGreeter(11, 'hotel')).toBe(true);
  });

  it('required for airport transfers regardless of group size', () => {
    expect(requiresGreeter(1, 'airport')).toBe(true);
    expect(requiresGreeter(5, 'airport')).toBe(true);
    expect(requiresGreeter(10, 'airport')).toBe(true);
  });

  it('required when both conditions met', () => {
    expect(requiresGreeter(20, 'airport')).toBe(true);
  });

  it('not required for undefined pickupType and small group', () => {
    expect(requiresGreeter(3)).toBe(false);
  });
});

// ─── greeterOurCost ─────────────────────────────────────────────

describe('greeterOurCost', () => {
  it('charges minimum hours when tour is shorter', () => {
    // $135/hr × 4hr min = $540
    expect(greeterOurCost(2)).toBe(540);
    expect(greeterOurCost(1)).toBe(540);
  });

  it('charges at minimum when exactly at minimum hours', () => {
    expect(greeterOurCost(GREETER_MIN_HOURS)).toBe(GREETER_RATE * GREETER_MIN_HOURS);
  });

  it('charges actual hours when above minimum', () => {
    // $135 × 6 = $810
    expect(greeterOurCost(6)).toBe(810);
    // $135 × 8 = $1080
    expect(greeterOurCost(8)).toBe(1080);
  });
});
