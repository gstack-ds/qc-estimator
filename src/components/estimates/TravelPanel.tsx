'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { calculateTrip, calculateTotalTravel } from '@/lib/engine/travel';
import type { TripInput, TravelRefs } from '@/lib/engine/travel';
import type { TravelRefData, DbTrip } from '@/lib/supabase/queries';
import { upsertTrip } from '@/app/(programs)/programs/[id]/estimates/actions';

// ─── Types ────────────────────────────────────────────────

type TravelType = 'Drive' | 'Train' | 'Flight' | 'None';
type VehicleType = 'Sedan' | 'SUV' | 'Sprinter' | 'None';
type VehicleService = 'Airport Transfer' | 'Hourly';
type HotelBudget = 'Low' | 'High';

interface LocalTrip {
  label: string;
  travel_type: TravelType;
  drive_route_id: string | null;
  train_route_id: string | null;
  flight_type_id: string | null;
  last_minute_buffer: boolean;
  staff_count: number;
  nights: number;
  hotel_rate_id: string | null;
  hotel_budget: HotelBudget;
  per_diem_rate_id: string | null;
  vehicle_rate_id: string | null;
  vehicle_type: VehicleType;
  vehicle_service: VehicleService;
  vehicle_hours: number;
  custom_vehicle_cost: number;
}

function dbTripToLocal(t: DbTrip): LocalTrip {
  return {
    label: t.label,
    travel_type: t.travel_type as TravelType,
    drive_route_id: t.drive_route_id,
    train_route_id: t.train_route_id,
    flight_type_id: t.flight_type_id,
    last_minute_buffer: t.last_minute_buffer,
    staff_count: t.staff_count,
    nights: t.nights,
    hotel_rate_id: t.hotel_rate_id,
    hotel_budget: t.hotel_budget as HotelBudget,
    per_diem_rate_id: t.per_diem_rate_id,
    vehicle_rate_id: t.vehicle_rate_id,
    vehicle_type: t.vehicle_type as VehicleType,
    vehicle_service: t.vehicle_service as VehicleService,
    vehicle_hours: t.vehicle_hours,
    custom_vehicle_cost: t.custom_vehicle_cost,
  };
}

const EMPTY_TRIP: LocalTrip = {
  label: '',
  travel_type: 'None',
  drive_route_id: null,
  train_route_id: null,
  flight_type_id: null,
  last_minute_buffer: false,
  staff_count: 1,
  nights: 0,
  hotel_rate_id: null,
  hotel_budget: 'Low',
  per_diem_rate_id: null,
  vehicle_rate_id: null,
  vehicle_type: 'None',
  vehicle_service: 'Airport Transfer',
  vehicle_hours: 0,
  custom_vehicle_cost: 0,
};

// ─── Props ────────────────────────────────────────────────

interface Props {
  estimateId: string;
  initialTrips: DbTrip[];
  refs: TravelRefData;
  onTotalChange: (total: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────

function fmt(val: number) {
  return val === 0 ? '—' : '$' + Math.round(val).toLocaleString('en-US');
}

function toEngineRefs(refs: TravelRefData): TravelRefs {
  return refs;
}

// ─── Single Trip Form ─────────────────────────────────────

interface TripFormProps {
  tripNum: number;
  trip: LocalTrip;
  refs: TravelRefData;
  onChange: (patch: Partial<LocalTrip>) => void;
}

function TripForm({ tripNum, trip, refs, onChange }: TripFormProps) {
  const [open, setOpen] = useState(tripNum === 1); // first trip open by default

  const costs = useMemo(
    () => calculateTrip(trip as TripInput, toEngineRefs(refs)),
    [trip, refs]
  );

  const selectClass = 'w-full border border-brand-cream rounded px-2 py-1.5 text-sm bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper focus:border-brand-brown';
  const inputClass = 'w-full border border-brand-cream rounded px-2 py-1.5 text-sm bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper focus:border-brand-brown';
  const labelClass = 'block text-[10px] font-medium text-brand-charcoal/50 uppercase tracking-wide mb-1';

  return (
    <div className="border border-brand-cream rounded-md overflow-hidden">
      {/* Trip header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-brand-offwhite hover:bg-brand-cream/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`text-brand-silver text-xs transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
          <span className="text-xs font-semibold text-brand-charcoal">
            Trip {tripNum}{trip.label ? ` — ${trip.label}` : ''}
          </span>
        </div>
        {costs.tripTotal > 0 && (
          <span className="text-xs font-medium text-brand-charcoal tabular-nums">{fmt(costs.tripTotal)}</span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-2 space-y-2">
          {/* Label */}
          <div>
            <label className={labelClass}>Trip Label</label>
            <input
              type="text"
              value={trip.label}
              onChange={(e) => onChange({ label: e.target.value })}
              className={inputClass}
              placeholder="e.g., Event Day"
            />
          </div>

          {/* Travel Type */}
          <div>
            <label className={labelClass}>Travel Type</label>
            <select value={trip.travel_type} onChange={(e) => onChange({ travel_type: e.target.value as TravelType, drive_route_id: null, train_route_id: null, flight_type_id: null })} className={selectClass}>
              <option value="None">None</option>
              <option value="Drive">Drive</option>
              <option value="Train">Train</option>
              <option value="Flight">Flight</option>
            </select>
          </div>

          {/* Route / Type selector (conditional) */}
          {trip.travel_type === 'Drive' && (
            <div>
              <label className={labelClass}>Drive Route</label>
              <select value={trip.drive_route_id ?? ''} onChange={(e) => onChange({ drive_route_id: e.target.value || null })} className={selectClass}>
                <option value="">— Select route —</option>
                {refs.driveRoutes.map((r) => (
                  <option key={r.id} value={r.id}>{r.route_name} (${Math.round(r.cost)})</option>
                ))}
              </select>
            </div>
          )}

          {trip.travel_type === 'Train' && (
            <div>
              <label className={labelClass}>Train Route</label>
              <select value={trip.train_route_id ?? ''} onChange={(e) => onChange({ train_route_id: e.target.value || null })} className={selectClass}>
                <option value="">— Select route —</option>
                {refs.trainRoutes.map((r) => (
                  <option key={r.id} value={r.id}>{r.route_name} (from ${Math.round(r.low_cost)}/person)</option>
                ))}
              </select>
            </div>
          )}

          {trip.travel_type === 'Flight' && (
            <>
              <div>
                <label className={labelClass}>Flight Type</label>
                <select value={trip.flight_type_id ?? ''} onChange={(e) => onChange({ flight_type_id: e.target.value || null })} className={selectClass}>
                  <option value="">— Select type —</option>
                  {refs.flightTypes.map((f) => (
                    <option key={f.id} value={f.id}>{f.type_name} (from ${Math.round(f.low_cost)}/person)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trip.last_minute_buffer}
                    onChange={(e) => onChange({ last_minute_buffer: e.target.checked })}
                    className="accent-brand-brown"
                  />
                  <span className="text-xs text-brand-charcoal">Last minute buffer (+$150/person)</span>
                </label>
              </div>
            </>
          )}

          {/* Staff + Nights (row) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Staff #</label>
              <input type="number" min="1" value={trip.staff_count} onChange={(e) => onChange({ staff_count: parseInt(e.target.value) || 1 })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Nights</label>
              <input type="number" min="0" value={trip.nights} onChange={(e) => onChange({ nights: parseInt(e.target.value) || 0 })} className={inputClass} />
            </div>
          </div>

          {/* Per Diem */}
          <div>
            <label className={labelClass}>Per Diem</label>
            <select value={trip.per_diem_rate_id ?? ''} onChange={(e) => onChange({ per_diem_rate_id: e.target.value || null })} className={selectClass}>
              <option value="">None</option>
              {refs.perDiemRates.map((r) => (
                <option key={r.id} value={r.id}>{r.market_type} (${r.full_day}/day)</option>
              ))}
            </select>
          </div>

          {/* Hotel */}
          <div>
            <label className={labelClass}>Hotel Market</label>
            <select value={trip.hotel_rate_id ?? ''} onChange={(e) => onChange({ hotel_rate_id: e.target.value || null })} className={selectClass}>
              <option value="">None</option>
              {refs.hotelRates.map((h) => (
                <option key={h.id} value={h.id}>{h.market} (${Math.round(h.low_rate)}–${Math.round(h.high_rate)}/night)</option>
              ))}
            </select>
          </div>

          {trip.hotel_rate_id && (
            <div>
              <label className={labelClass}>Hotel Budget</label>
              <select value={trip.hotel_budget} onChange={(e) => onChange({ hotel_budget: e.target.value as HotelBudget })} className={selectClass}>
                <option value="Low">Low</option>
                <option value="High">High</option>
              </select>
            </div>
          )}

          {/* Vehicle */}
          <div>
            <label className={labelClass}>Vehicle Type</label>
            <select value={trip.vehicle_type} onChange={(e) => onChange({ vehicle_type: e.target.value as VehicleType })} className={selectClass}>
              <option value="None">None</option>
              <option value="Sedan">Sedan</option>
              <option value="SUV">SUV</option>
              <option value="Sprinter">Sprinter</option>
            </select>
          </div>

          {trip.vehicle_type !== 'None' && (
            <>
              <div>
                <label className={labelClass}>Vehicle Market</label>
                <select value={trip.vehicle_rate_id ?? ''} onChange={(e) => onChange({ vehicle_rate_id: e.target.value || null })} className={selectClass}>
                  <option value="">— Select market —</option>
                  {refs.vehicleRates.map((v) => (
                    <option key={v.id} value={v.id}>{v.market}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Service</label>
                <select value={trip.vehicle_service} onChange={(e) => onChange({ vehicle_service: e.target.value as VehicleService })} className={selectClass}>
                  <option value="Airport Transfer">Airport Transfer</option>
                  <option value="Hourly">Hourly</option>
                </select>
              </div>
              {trip.vehicle_service === 'Hourly' && (
                <div>
                  <label className={labelClass}>Hours</label>
                  <input type="number" min="0" step="0.5" value={trip.vehicle_hours} onChange={(e) => onChange({ vehicle_hours: parseFloat(e.target.value) || 0 })} className={inputClass} />
                </div>
              )}
              <div>
                <label className={labelClass}>Custom Vehicle Cost (overrides lookup)</label>
                <div className="relative">
                  <span className="absolute left-2 top-1.5 text-brand-silver text-sm">$</span>
                  <input type="number" min="0" value={trip.custom_vehicle_cost || ''} onChange={(e) => onChange({ custom_vehicle_cost: parseFloat(e.target.value) || 0 })} className={inputClass + ' pl-5'} placeholder="0" />
                </div>
              </div>
            </>
          )}

          {/* Trip cost breakdown */}
          {costs.tripTotal > 0 && (
            <div className="mt-2 pt-2 border-t border-brand-cream/60 space-y-0.5 text-xs text-brand-charcoal/70">
              {costs.travelCost > 0 && <div className="flex justify-between"><span>Travel</span><span className="tabular-nums">{fmt(costs.travelCost)}</span></div>}
              {costs.hotelCost > 0 && <div className="flex justify-between"><span>Hotel</span><span className="tabular-nums">{fmt(costs.hotelCost)}</span></div>}
              {costs.perDiemCost > 0 && <div className="flex justify-between"><span>Per Diem</span><span className="tabular-nums">{fmt(costs.perDiemCost)}</span></div>}
              {costs.vehicleCost > 0 && <div className="flex justify-between"><span>Vehicle</span><span className="tabular-nums">{fmt(costs.vehicleCost)}</span></div>}
              <div className="flex justify-between font-semibold text-brand-charcoal border-t border-brand-cream/60 pt-1 mt-1">
                <span>Trip Total</span><span className="tabular-nums">{fmt(costs.tripTotal)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main TravelPanel ─────────────────────────────────────

export default function TravelPanel({ estimateId, initialTrips, refs, onTotalChange }: Props) {
  const [trips, setTrips] = useState<LocalTrip[]>(() => {
    const result: LocalTrip[] = [{ ...EMPTY_TRIP }, { ...EMPTY_TRIP }, { ...EMPTY_TRIP }];
    initialTrips.forEach((t) => {
      if (t.trip_number >= 1 && t.trip_number <= 3) {
        result[t.trip_number - 1] = dbTripToLocal(t);
      }
    });
    return result;
  });

  const engineRefs = useMemo(() => toEngineRefs(refs), [refs]);

  const total = useMemo(
    () => calculateTotalTravel(trips as TripInput[], engineRefs),
    [trips, engineRefs]
  );

  // Notify parent whenever total changes
  useEffect(() => { onTotalChange(total); }, [total, onTotalChange]);

  // Debounced save per trip
  const saveTrip = useCallback(async (tripNum: number, trip: LocalTrip) => {
    await upsertTrip({
      estimate_id: estimateId,
      trip_number: tripNum,
      ...trip,
    });
  }, [estimateId]);

  const handleTripChange = useCallback((index: number, patch: Partial<LocalTrip>) => {
    setTrips((prev) => {
      const next = prev.map((t, i) => i === index ? { ...t, ...patch } : t);
      // Save after state updates (use setTimeout to ensure we get the merged state)
      setTimeout(() => saveTrip(index + 1, next[index]), 0);
      return next;
    });
  }, [saveTrip]);

  const [open, setOpen] = useState(true);

  return (
    <div className="bg-brand-cream border border-brand-copper/30 rounded-lg p-4 space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h3 className="font-serif text-sm font-medium text-brand-charcoal tracking-wide">Travel Expenses</h3>
          <p className="text-[10px] text-brand-brown/70 tracking-wide mt-0.5 uppercase">Internal · Not visible in exports</p>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && <span className="text-sm font-medium text-brand-charcoal tabular-nums">{fmt(total)}</span>}
          <span className={`text-brand-silver text-xs transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        </div>
      </button>

      {open && (
        <div className="space-y-2">
          {trips.map((trip, i) => (
            <TripForm
              key={i}
              tripNum={i + 1}
              trip={trip}
              refs={refs}
              onChange={(patch) => handleTripChange(i, patch)}
            />
          ))}

          {total > 0 && (
            <div className="flex justify-between text-sm font-semibold text-brand-charcoal border-t border-brand-copper/20 pt-2 mt-1">
              <span>Total Travel</span>
              <span className="tabular-nums">{fmt(total)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
