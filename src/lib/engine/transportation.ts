// QC Estimator — Transportation Pricing Engine
// Pure TypeScript. No React, no Next.js, no Supabase imports.

export const TRANSPORT_MARKUP = 0.75; // 75% per CLAUDE.md

export function calcClientRate(hourlyRate: number): number {
  return Math.round(hourlyRate * (1 + TRANSPORT_MARKUP) / 10) * 10;
}

export function calcHoursFromTimes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60;
  return (endMins - startMins) / 60;
}

export function calcBilledHours(
  serviceType: 'hourly' | 'transfer',
  startTime: string,
  endTime: string,
  hourMinimum: number | null,
): number {
  if (serviceType === 'transfer') return 1;
  const raw = calcHoursFromTimes(startTime, endTime);
  return Math.max(raw, hourMinimum ?? 0);
}

export function calcRowOurCost(hourlyRate: number, hours: number, qty: number): number {
  return hourlyRate * hours * qty;
}

export function calcRowClientCost(clientRate: number, hours: number, qty: number): number {
  return clientRate * hours * qty;
}

export interface TransportSummaryInput {
  subtotalOur: number;
  subtotalClient: number;
}

export interface TransportSummary {
  subtotalOur: number;
  subtotalClient: number;
  markupRevenue: number;
  tax: number;
  productionFee: number;
  totalClient: number;
  qcRevenue: number;
  qcMarginPct: number;
}

export function calcTransportSummary(
  rows: TransportSummaryInput[],
  taxRate: number,
  ccFee: number,
  transportCommission: number,
): TransportSummary {
  const subtotalOur = rows.reduce((s, r) => s + r.subtotalOur, 0);
  const subtotalClient = rows.reduce((s, r) => s + r.subtotalClient, 0);
  const markupRevenue = subtotalClient - subtotalOur;
  const tax = subtotalClient * taxRate;
  const productionFee = subtotalClient * ccFee + markupRevenue * transportCommission;
  const totalClient = subtotalClient + tax + productionFee;
  const qcRevenue = markupRevenue - productionFee;
  const qcMarginPct = totalClient > 0 ? qcRevenue / totalClient : 0;
  return { subtotalOur, subtotalClient, markupRevenue, tax, productionFee, totalClient, qcRevenue, qcMarginPct };
}
