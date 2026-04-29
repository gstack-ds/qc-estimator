'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { DbProgram, DbEstimate, DbLocation, DbTier, DbTransportVehicleRate, DbTransportScheduleRow, TravelRefData, DbTrip } from '@/lib/supabase/queries';
import { calculateMarginAnalysis, getMarginHealth, getNetHealth, lookupTeamHours } from '@/lib/engine/pricing';
import type { ProgramConfig, TeamHoursTier, EstimateSummary, MarginAnalysis } from '@/types';
import {
  calcClientRate,
  calcBilledHours,
  calcRowOurCost,
  calcRowClientCost,
  calcTransportSummary,
} from '@/lib/engine/transportation';
import {
  updateEstimate,
  upsertTransportVehicleRate,
  deleteTransportVehicleRate,
  upsertTransportScheduleRow,
  deleteTransportScheduleRow,
  updateTransportCommission,
} from '@/app/(programs)/programs/[id]/estimates/actions';
import type { ExtractedData, ExtractedTransportVehicleRate, ExtractedTransportScheduleRow } from '@/app/(programs)/programs/[id]/estimates/actions';
import EstimateNav from './EstimateNav';
import AttachmentsPanel from './AttachmentsPanel';
import MarginPanel from './MarginPanel';
import TravelPanel from './TravelPanel';

// ─── Local Types ──────────────────────────────────────────

interface LocalVehicleRate {
  id: string | null;
  vehicleType: string;
  hourlyRate: number;
  hourMinimum: number | null;
  sortOrder: number;
}

interface LocalScheduleRow {
  id: string | null;
  serviceDate: string;
  vehicleRateId: string | null;
  serviceType: 'hourly' | 'transfer';
  spotTime: string;
  startTime: string;
  endTime: string;
  qty: number;
  notes: string;
  sortOrder: number;
}

// ─── Props ────────────────────────────────────────────────

interface Props {
  program: DbProgram;
  location: DbLocation | null;
  allEstimates: DbEstimate[];
  estimate: DbEstimate;
  vehicleRates: DbTransportVehicleRate[];
  scheduleRows: DbTransportScheduleRow[];
  travelRefs: TravelRefData;
  initialTrips: DbTrip[];
  tiers: DbTier[];
  eventName?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────

function fmt(v: number) {
  return v === 0 ? '—' : '$' + Math.round(v).toLocaleString('en-US');
}

function fmtExact(v: number) {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toProgramConfig(program: DbProgram, location: DbLocation | null): ProgramConfig {
  return {
    guestCount: program.guest_count,
    location: location
      ? { id: location.id, name: location.name, foodTaxRate: location.food_tax_rate, alcoholTaxRate: location.alcohol_tax_rate, generalTaxRate: location.general_tax_rate }
      : { id: '', name: '', foodTaxRate: 0, alcoholTaxRate: 0, generalTaxRate: 0 },
    ccProcessingFee: program.cc_processing_fee,
    clientCommission: program.client_commission,
    gdpCommissionEnabled: false,
    gdpCommissionRate: 0,
    serviceChargeDefault: program.service_charge_default,
    gratuityDefault: program.gratuity_default,
    adminFeeDefault: program.admin_fee_default,
    thirdPartyCommissions: [],
  };
}

function dbVehicleRateToLocal(r: DbTransportVehicleRate): LocalVehicleRate {
  return { id: r.id, vehicleType: r.vehicle_type, hourlyRate: r.hourly_rate, hourMinimum: r.hour_minimum, sortOrder: r.sort_order };
}

function dbScheduleRowToLocal(r: DbTransportScheduleRow): LocalScheduleRow {
  return {
    id: r.id,
    serviceDate: r.service_date ?? '',
    vehicleRateId: r.vehicle_rate_id,
    serviceType: r.service_type as 'hourly' | 'transfer',
    spotTime: r.spot_time ?? '',
    startTime: r.start_time ?? '',
    endTime: r.end_time ?? '',
    qty: r.qty,
    notes: r.notes ?? '',
    sortOrder: r.sort_order,
  };
}

// ─── Component ────────────────────────────────────────────

export default function TransportationEstimateBuilder({
  program, location, allEstimates, estimate, vehicleRates: initRates, scheduleRows: initRows, travelRefs, initialTrips, tiers, eventName,
}: Props) {
  const [estimateName, setEstimateName] = useState(estimate.name);
  const [commission, setCommission] = useState(estimate.transport_commission ?? 0);
  const [travelTotal, setTravelTotal] = useState(0);

  const [vehicleRates, setVehicleRates] = useState<LocalVehicleRate[]>(
    initRates.map(dbVehicleRateToLocal)
  );
  const [scheduleRows, setScheduleRows] = useState<LocalScheduleRow[]>(
    initRows.map(dbScheduleRowToLocal)
  );

  const vehicleRatesRef = useRef(vehicleRates);
  const scheduleRowsRef = useRef(scheduleRows);
  useEffect(() => { vehicleRatesRef.current = vehicleRates; }, [vehicleRates]);
  useEffect(() => { scheduleRowsRef.current = scheduleRows; }, [scheduleRows]);

  const programConfig = useMemo(() => toProgramConfig(program, location), [program, location]);
  const teamHoursTiers: TeamHoursTier[] = tiers.map((t) => ({ revenueThreshold: t.revenue_threshold, baseHours: t.base_hours, tierName: t.tier_name ?? '' }));

  const generalTaxRate = location?.general_tax_rate ?? 0;

  // Compute rows with derived costs
  const computedRows = useMemo(() => {
    return scheduleRows.map((row) => {
      const rate = vehicleRates.find((r) => r.id === row.vehicleRateId);
      const clientRate = rate ? calcClientRate(rate.hourlyRate) : 0;
      const hours = calcBilledHours(row.serviceType, row.startTime, row.endTime, rate?.hourMinimum ?? null);
      const ourCost = rate ? calcRowOurCost(rate.hourlyRate, hours, row.qty) : 0;
      const clientCost = rate ? calcRowClientCost(clientRate, hours, row.qty) : 0;
      return { ...row, hours, ourCost, clientCost, clientRate };
    });
  }, [scheduleRows, vehicleRates]);

  const summary = useMemo(() => {
    return calcTransportSummary(
      computedRows.map((r) => ({ subtotalOur: r.ourCost, subtotalClient: r.clientCost })),
      generalTaxRate,
      programConfig.ccProcessingFee,
      commission,
    );
  }, [computedRows, generalTaxRate, programConfig.ccProcessingFee, commission]);

  const margin = useMemo<MarginAnalysis>(() => {
    const fakeSummary: EstimateSummary = {
      fbSubtotalOur: 0, fbSubtotalClient: 0, fbFoodSubtotalClient: 0, fbAlcoholSubtotalClient: 0,
      foodTax: 0, alcoholTax: 0,
      equipmentSubtotalOur: summary.subtotalOur, equipmentSubtotalClient: summary.subtotalClient, equipmentTax: 0,
      qcStaffingSubtotalOur: 0, qcStaffingSubtotalClient: 0,
      venueSubtotalOur: 0, venueSubtotalClient: 0, venueTax: 0,
      serviceChargeOur: 0, serviceChargeClient: 0,
      gratuityOur: 0, gratuityClient: 0,
      adminFeeOur: 0, adminFeeClient: 0,
      subtotalOur: summary.subtotalOur, subtotalClient: summary.subtotalClient,
      productionFee: summary.productionFee,
      totalOur: summary.subtotalOur, totalClient: summary.totalClient,
      pricePerPerson: 0, fbMinimumMet: true, fbShortfall: 0,
    };
    const transportConfig: ProgramConfig = { ...programConfig, clientCommission: commission, gdpCommissionEnabled: false, thirdPartyCommissions: [] };
    return calculateMarginAnalysis(fakeSummary, transportConfig, teamHoursTiers, travelTotal);
  }, [summary, programConfig, commission, teamHoursTiers, travelTotal]);

  // ─── Save helpers ────────────────────────────────────────

  const saveNameDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleNameChange(val: string) {
    setEstimateName(val);
    if (saveNameDebounce.current) clearTimeout(saveNameDebounce.current);
    saveNameDebounce.current = setTimeout(() => {
      updateEstimate(estimate.id, program.id, { name: val || 'New Transportation Estimate' });
    }, 600);
  }

  const commissionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleCommissionChange(val: string) {
    const n = isNaN(parseFloat(val)) ? 0 : parseFloat(val) / 100;
    setCommission(n);
    if (commissionDebounce.current) clearTimeout(commissionDebounce.current);
    commissionDebounce.current = setTimeout(() => {
      updateTransportCommission(estimate.id, n);
    }, 600);
  }

  // ─── Vehicle Rate card ────────────────────────────────────

  function addVehicleRate() {
    const sortOrder = vehicleRatesRef.current.length;
    const local: LocalVehicleRate = { id: null, vehicleType: '', hourlyRate: 0, hourMinimum: null, sortOrder };
    setVehicleRates((prev) => [...prev, local]);
    // Save to DB
    upsertTransportVehicleRate({ estimate_id: estimate.id, vehicle_type: '', hourly_rate: 0, hour_minimum: null, sort_order: sortOrder })
      .then(({ id }) => {
        if (id) setVehicleRates((prev) => prev.map((r, i) => i === prev.length - 1 && r.id === null ? { ...r, id } : r));
      });
  }

  const saveVehicleRate = useCallback((idx: number, patch: Partial<LocalVehicleRate>) => {
    setVehicleRates((prev) => {
      const next = prev.map((r, i) => i === idx ? { ...r, ...patch } : r);
      const rate = next[idx];
      if (rate.id) {
        upsertTransportVehicleRate({
          id: rate.id,
          estimate_id: estimate.id,
          vehicle_type: rate.vehicleType,
          hourly_rate: rate.hourlyRate,
          hour_minimum: rate.hourMinimum,
          sort_order: rate.sortOrder,
        });
      }
      return next;
    });
  }, [estimate.id]);

  async function removeVehicleRate(idx: number) {
    const rate = vehicleRatesRef.current[idx];
    setVehicleRates((prev) => prev.filter((_, i) => i !== idx));
    if (rate.id) await deleteTransportVehicleRate(rate.id);
  }

  // ─── Schedule rows ────────────────────────────────────────

  function addScheduleRow() {
    const sortOrder = scheduleRowsRef.current.length;
    const local: LocalScheduleRow = { id: null, serviceDate: '', vehicleRateId: vehicleRatesRef.current[0]?.id ?? null, serviceType: 'hourly', spotTime: '', startTime: '', endTime: '', qty: 1, notes: '', sortOrder };
    setScheduleRows((prev) => [...prev, local]);
    upsertTransportScheduleRow({
      estimate_id: estimate.id,
      service_date: null,
      vehicle_rate_id: local.vehicleRateId,
      service_type: local.serviceType,
      spot_time: null,
      start_time: null,
      end_time: null,
      qty: 1,
      our_cost: 0,
      client_cost: 0,
      notes: null,
      sort_order: sortOrder,
    }).then(({ id }) => {
      if (id) setScheduleRows((prev) => prev.map((r, i) => i === prev.length - 1 && r.id === null ? { ...r, id } : r));
    });
  }

  const saveScheduleRow = useCallback((idx: number, patch: Partial<LocalScheduleRow>) => {
    setScheduleRows((prev) => {
      const next = prev.map((r, i) => i === idx ? { ...r, ...patch } : r);
      const row = next[idx];
      if (row.id) {
        const rate = vehicleRatesRef.current.find((r) => r.id === row.vehicleRateId);
        const clientRate = rate ? calcClientRate(rate.hourlyRate) : 0;
        const hours = calcBilledHours(row.serviceType, row.startTime, row.endTime, rate?.hourMinimum ?? null);
        const ourCost = rate ? calcRowOurCost(rate.hourlyRate, hours, row.qty) : 0;
        const clientCost = rate ? calcRowClientCost(clientRate, hours, row.qty) : 0;
        upsertTransportScheduleRow({
          id: row.id,
          estimate_id: estimate.id,
          service_date: row.serviceDate || null,
          vehicle_rate_id: row.vehicleRateId,
          service_type: row.serviceType,
          spot_time: row.spotTime || null,
          start_time: row.startTime || null,
          end_time: row.endTime || null,
          qty: row.qty,
          our_cost: ourCost,
          client_cost: clientCost,
          notes: row.notes || null,
          sort_order: row.sortOrder,
        });
      }
      return next;
    });
  }, [estimate.id]);

  async function removeScheduleRow(idx: number) {
    const row = scheduleRowsRef.current[idx];
    setScheduleRows((prev) => prev.filter((_, i) => i !== idx));
    if (row.id) await deleteTransportScheduleRow(row.id);
  }

  // ─── PDF extraction populate ──────────────────────────────

  const handlePopulateFromExtraction = useCallback((data: ExtractedData) => {
    const extractedRates: ExtractedTransportVehicleRate[] = data.vehicleRates ?? [];
    const extractedRows: ExtractedTransportScheduleRow[] = data.scheduleRows ?? [];

    // Add vehicle rates
    let newRatesPromise = Promise.resolve<LocalVehicleRate[]>([]);
    if (extractedRates.length > 0) {
      const baseOrder = vehicleRatesRef.current.length;
      newRatesPromise = Promise.all(
        extractedRates.map(async (er, i) => {
          const sortOrder = baseOrder + i;
          const { id } = await upsertTransportVehicleRate({
            estimate_id: estimate.id,
            vehicle_type: er.vehicleType ?? '',
            hourly_rate: er.hourlyRate ?? 0,
            hour_minimum: er.hourMinimum ?? null,
            sort_order: sortOrder,
          });
          return { id: id ?? null, vehicleType: er.vehicleType ?? '', hourlyRate: er.hourlyRate ?? 0, hourMinimum: er.hourMinimum ?? null, sortOrder } as LocalVehicleRate;
        })
      ).then((newRates) => {
        setVehicleRates((prev) => [...prev, ...newRates]);
        return newRates;
      });
    }

    // Add schedule rows after rates are saved (need IDs)
    if (extractedRows.length > 0) {
      newRatesPromise.then((addedRates) => {
        const allRates = [...vehicleRatesRef.current, ...addedRates];
        const baseOrder = scheduleRowsRef.current.length;
        Promise.all(
          extractedRows.map(async (er, i) => {
            const sortOrder = baseOrder + i;
            const matchedRate = allRates.find((r) => r.vehicleType?.toLowerCase() === (er.vehicleType ?? '').toLowerCase());
            const serviceType = (er.serviceType === 'transfer' ? 'transfer' : 'hourly') as 'hourly' | 'transfer';
            const rate = matchedRate;
            const clientRate = rate ? calcClientRate(rate.hourlyRate) : 0;
            const hours = calcBilledHours(serviceType, er.startTime ?? '', er.endTime ?? '', rate?.hourMinimum ?? null);
            const ourCost = rate ? calcRowOurCost(rate.hourlyRate, hours, er.qty ?? 1) : 0;
            const clientCost = rate ? calcRowClientCost(clientRate, hours, er.qty ?? 1) : 0;
            const { id } = await upsertTransportScheduleRow({
              estimate_id: estimate.id,
              service_date: er.serviceDate || null,
              vehicle_rate_id: matchedRate?.id ?? null,
              service_type: serviceType,
              spot_time: null,
              start_time: er.startTime || null,
              end_time: er.endTime || null,
              qty: er.qty ?? 1,
              our_cost: ourCost,
              client_cost: clientCost,
              notes: er.notes || null,
              sort_order: sortOrder,
            });
            return {
              id: id ?? null, serviceDate: er.serviceDate ?? '', vehicleRateId: matchedRate?.id ?? null,
              serviceType, spotTime: '', startTime: er.startTime ?? '', endTime: er.endTime ?? '',
              qty: er.qty ?? 1, notes: er.notes ?? '', sortOrder,
            } as LocalScheduleRow;
          })
        ).then((newRows) => {
          setScheduleRows((prev) => [...prev, ...newRows]);
        });
      });
    }
  }, [estimate.id]);

  // ─── UI helpers ───────────────────────────────────────────

  const inputCls = 'w-full border border-brand-cream rounded px-2 py-1.5 text-sm bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper focus:border-brand-brown';
  const labelCls = 'block text-[10px] font-medium text-brand-charcoal/50 uppercase tracking-wide mb-1';
  const thCls = 'px-2 py-1.5 text-left text-[10px] font-medium text-brand-charcoal/50 uppercase tracking-wide whitespace-nowrap';
  const tdCls = 'px-2 py-1';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-brand-offwhite border-b border-brand-cream px-6 py-2">
        <EstimateNav
          programId={program.id}
          programName={program.name}
          eventName={eventName}
          estimateId={estimate.id}
          estimateName={estimateName}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-6 p-6 min-h-full">
          {/* ─── Main column ─────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Estimate name */}
            <div>
              <label className={labelCls}>Estimate Name</label>
              <input
                type="text"
                value={estimateName}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full border border-brand-cream rounded px-3 py-2 text-sm text-brand-charcoal bg-white focus:outline-none focus:ring-2 focus:ring-brand-copper"
                placeholder="New Transportation Estimate"
              />
            </div>

            {/* Attachments */}
            <AttachmentsPanel
              estimateId={estimate.id}
              estimateType="transportation"
              onPopulateLineItems={handlePopulateFromExtraction}
            />

            {/* ─── Vehicle Rate Card ─────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-serif text-sm font-medium text-brand-charcoal">Vehicle Rate Card</h3>
                <button onClick={addVehicleRate} className="text-xs text-brand-brown hover:text-brand-charcoal font-medium transition-colors">+ Add vehicle</button>
              </div>
              <div className="rounded-lg border border-brand-cream overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-brand-offwhite border-b border-brand-cream">
                    <tr>
                      <th className={thCls}>Vehicle Type</th>
                      <th className={thCls + ' text-right'}>Hourly Rate (Our Cost)</th>
                      <th className={thCls + ' text-right'}>Hour Minimum</th>
                      <th className={thCls + ' text-right'}>Client Rate</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-cream/60">
                    {vehicleRates.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-4 text-xs text-brand-silver text-center">No vehicles added yet.</td></tr>
                    )}
                    {vehicleRates.map((rate, idx) => (
                      <tr key={rate.id ?? idx} className="hover:bg-brand-offwhite transition-colors">
                        <td className={tdCls}>
                          <input
                            type="text"
                            value={rate.vehicleType}
                            onChange={(e) => saveVehicleRate(idx, { vehicleType: e.target.value })}
                            placeholder="e.g., Suburban (6 pax)"
                            className={inputCls}
                          />
                        </td>
                        <td className={tdCls}>
                          <div className="relative">
                            <span className="absolute left-2 top-1.5 text-brand-silver text-sm">$</span>
                            <input
                              type="number" min="0" step="5"
                              value={rate.hourlyRate || ''}
                              onChange={(e) => saveVehicleRate(idx, { hourlyRate: parseFloat(e.target.value) || 0 })}
                              className={inputCls + ' pl-5 text-right'}
                              placeholder="0"
                            />
                          </div>
                        </td>
                        <td className={tdCls}>
                          <input
                            type="number" min="0" step="0.5"
                            value={rate.hourMinimum ?? ''}
                            onChange={(e) => saveVehicleRate(idx, { hourMinimum: e.target.value === '' ? null : parseFloat(e.target.value) || 0 })}
                            className={inputCls + ' text-right'}
                            placeholder="—"
                          />
                        </td>
                        <td className={tdCls + ' text-right font-medium text-brand-charcoal tabular-nums'}>
                          {rate.hourlyRate > 0 ? fmtExact(calcClientRate(rate.hourlyRate)) : '—'}
                        </td>
                        <td className="px-1 py-1 text-center">
                          <button onClick={() => removeVehicleRate(idx)} className="text-brand-silver/40 hover:text-red-500 transition-colors text-base leading-none" title="Remove">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ─── Daily Schedule ─────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-serif text-sm font-medium text-brand-charcoal">Daily Schedule</h3>
                <button onClick={addScheduleRow} className="text-xs text-brand-brown hover:text-brand-charcoal font-medium transition-colors">+ Add run</button>
              </div>
              <div className="rounded-lg border border-brand-cream overflow-x-auto">
                <table className="text-sm" style={{ minWidth: '1010px', width: '100%' }}>
                  <thead className="bg-brand-offwhite border-b border-brand-cream">
                    <tr>
                      <th className={thCls}>Date</th>
                      <th className={thCls}>Spot Time</th>
                      <th className={thCls}>Vehicle</th>
                      <th className={thCls}>Type</th>
                      <th className={thCls}>Start</th>
                      <th className={thCls}>End</th>
                      <th className={thCls + ' text-right'}>Hrs</th>
                      <th className={thCls + ' text-right'}>Qty</th>
                      <th className={thCls + ' text-right'}>Our Cost</th>
                      <th className={thCls + ' text-right'}>Client Cost</th>
                      <th className={thCls}>Notes</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-cream/60">
                    {scheduleRows.length === 0 && (
                      <tr><td colSpan={12} className="px-3 py-4 text-xs text-brand-silver text-center">No runs added yet. Add a vehicle to the rate card first.</td></tr>
                    )}
                    {computedRows.map((row, idx) => (
                      <tr key={row.id ?? idx} className="hover:bg-brand-offwhite transition-colors">
                        <td className={tdCls} style={{ minWidth: '130px' }}>
                          <input
                            type="date"
                            value={row.serviceDate}
                            onChange={(e) => saveScheduleRow(idx, { serviceDate: e.target.value })}
                            className={inputCls}
                          />
                        </td>
                        <td className={tdCls} style={{ minWidth: '100px' }}>
                          <input
                            type="time"
                            value={row.spotTime}
                            onChange={(e) => saveScheduleRow(idx, { spotTime: e.target.value })}
                            className={inputCls}
                          />
                        </td>
                        <td className={tdCls} style={{ minWidth: '160px' }}>
                          <select
                            value={row.vehicleRateId ?? ''}
                            onChange={(e) => saveScheduleRow(idx, { vehicleRateId: e.target.value || null })}
                            className={inputCls}
                          >
                            <option value="">— Select —</option>
                            {vehicleRates.map((r) => r.id && (
                              <option key={r.id} value={r.id}>{r.vehicleType || '(unnamed)'}</option>
                            ))}
                          </select>
                        </td>
                        <td className={tdCls} style={{ minWidth: '110px' }}>
                          <select
                            value={row.serviceType}
                            onChange={(e) => saveScheduleRow(idx, { serviceType: e.target.value as 'hourly' | 'transfer' })}
                            className={inputCls}
                          >
                            <option value="hourly">Hourly</option>
                            <option value="transfer">Transfer</option>
                          </select>
                        </td>
                        <td className={tdCls} style={{ minWidth: '100px' }}>
                          <input
                            type="time"
                            value={row.startTime}
                            onChange={(e) => saveScheduleRow(idx, { startTime: e.target.value })}
                            className={inputCls}
                            disabled={row.serviceType === 'transfer'}
                          />
                        </td>
                        <td className={tdCls} style={{ minWidth: '100px' }}>
                          <input
                            type="time"
                            value={row.endTime}
                            onChange={(e) => saveScheduleRow(idx, { endTime: e.target.value })}
                            className={inputCls}
                            disabled={row.serviceType === 'transfer'}
                          />
                        </td>
                        <td className={tdCls + ' text-right tabular-nums text-brand-charcoal/70 whitespace-nowrap'}>
                          {row.serviceType === 'transfer' ? '1' : row.hours > 0 ? row.hours.toFixed(1) : '—'}
                        </td>
                        <td className={tdCls} style={{ minWidth: '70px' }}>
                          <input
                            type="number" min="1"
                            value={row.qty}
                            onChange={(e) => saveScheduleRow(idx, { qty: parseInt(e.target.value) || 1 })}
                            className={inputCls + ' text-right'}
                          />
                        </td>
                        <td className={tdCls + ' text-right tabular-nums text-brand-charcoal/70 whitespace-nowrap'}>
                          {row.ourCost > 0 ? fmt(row.ourCost) : '—'}
                        </td>
                        <td className={tdCls + ' text-right tabular-nums font-medium text-brand-charcoal whitespace-nowrap'}>
                          {row.clientCost > 0 ? fmt(row.clientCost) : '—'}
                        </td>
                        <td className={tdCls} style={{ minWidth: '140px' }}>
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(e) => saveScheduleRow(idx, { notes: e.target.value })}
                            className={inputCls}
                            placeholder="Notes"
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <button onClick={() => removeScheduleRow(idx)} className="text-brand-silver/40 hover:text-red-500 transition-colors text-base leading-none" title="Remove">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {scheduleRows.length > 0 && (
                    <tfoot className="border-t border-brand-copper/20 bg-brand-offwhite">
                      <tr>
                        <td colSpan={8} className="px-2 py-2 text-xs font-semibold text-brand-charcoal/60 uppercase tracking-wide">Total</td>
                        <td className="px-2 py-2 text-right text-sm font-semibold text-brand-charcoal tabular-nums">{fmt(summary.subtotalOur)}</td>
                        <td className="px-2 py-2 text-right text-sm font-semibold text-brand-charcoal tabular-nums">{fmt(summary.subtotalClient)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Travel Panel */}
            <TravelPanel
              estimateId={estimate.id}
              initialTrips={initialTrips}
              refs={travelRefs}
              onTotalChange={setTravelTotal}
            />
          </div>

          {/* ─── Sidebar ─────────────────────────────── */}
          <div className="w-72 flex-shrink-0 space-y-4">
            {/* Commission */}
            <div className="bg-white border border-brand-cream rounded-lg p-4">
              <h3 className="font-serif text-sm font-medium text-brand-charcoal mb-3">Commission</h3>
              <div>
                <label className={labelCls}>Client Commission %</label>
                <div className="relative">
                  <input
                    type="number" min="0" step="0.5"
                    value={(commission * 100).toFixed(1).replace(/\.0$/, '')}
                    onChange={(e) => handleCommissionChange(e.target.value)}
                    className={inputCls + ' pr-6'}
                  />
                  <span className="absolute right-2 top-1.5 text-brand-silver text-sm">%</span>
                </div>
                <p className="text-[10px] text-brand-silver mt-1">Not linked to program commission</p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white border border-brand-cream rounded-lg p-4 space-y-2 text-sm">
              <h3 className="font-serif text-sm font-medium text-brand-charcoal mb-3">Summary</h3>
              <div className="space-y-1">
                <div className="flex justify-between text-brand-charcoal/70">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{fmt(summary.subtotalClient)}</span>
                </div>
                <div className="flex justify-between text-brand-charcoal/70">
                  <span>Tax ({((generalTaxRate) * 100).toFixed(3)}%)</span>
                  <span className="tabular-nums">{fmt(summary.tax)}</span>
                </div>
                <div className="flex justify-between font-semibold text-brand-charcoal border-t border-brand-cream pt-2 mt-1">
                  <span>Total</span>
                  <span className="tabular-nums">{fmt(summary.totalClient)}</span>
                </div>
              </div>
            </div>

            {/* Margin */}
            <MarginPanel margin={margin} />
          </div>
        </div>
      </div>
    </div>
  );
}
