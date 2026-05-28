export interface TrafficWindow {
  label: string;
  minMultiplier: number;
  maxMultiplier: number;
}

export interface PlanningNotesInput {
  startTime: string;       // "HH:MM" or "HH:MM:SS"
  maxDriveMins: number;
  distanceMiles: number;
  dayOfWeek: number;       // 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri, 6=Sat
  hotelName: string;
}

// ─── Traffic ──────────────────────────────────────────────

export function getTrafficWindow(hour: number, dayOfWeek: number): TrafficWindow {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isThurFri = dayOfWeek === 4 || dayOfWeek === 5;

  if (isWeekend) return { label: 'Weekend traffic', minMultiplier: 1.0, maxMultiplier: 1.4 };
  if (hour >= 6 && hour < 9) return { label: 'AM rush hour', minMultiplier: 1.5, maxMultiplier: 2.5 };
  if (hour >= 9 && hour < 16) return { label: 'Off-peak', minMultiplier: 1.0, maxMultiplier: 1.3 };
  if (hour >= 16 && hour < 19) {
    if (isThurFri) return { label: 'PM rush hour (heavy)', minMultiplier: 2.0, maxMultiplier: 2.7 };
    return { label: 'PM rush hour', minMultiplier: 1.8, maxMultiplier: 2.5 };
  }
  if (hour >= 19 && hour < 22) return { label: 'Light evening traffic', minMultiplier: 1.1, maxMultiplier: 1.4 };
  return { label: 'Off-peak', minMultiplier: 1.0, maxMultiplier: 1.3 };
}

// ─── Formatting ────────────────────────────────────────────

function roundToNearest5(n: number): number {
  return Math.round(n / 5) * 5;
}

export function formatMinsRange(baseMins: number, minMult: number, maxMult: number): string {
  const lo = roundToNearest5(baseMins * minMult);
  const hi = roundToNearest5(baseMins * maxMult);
  if (lo === hi) return `${lo} min`;
  return `${lo} to ${hi} min`;
}

export function formatDriveLine(miles: number, baseMins: number, window: TrafficWindow): string {
  const mileStr = miles === 1 ? '1 mile' : `${Math.round(miles * 10) / 10} miles`;
  const timeStr = formatMinsRange(baseMins, window.minMultiplier, window.maxMultiplier);
  if (window.label === 'Off-peak') {
    return `${mileStr}, ${timeStr} drive`;
  }
  return `${mileStr}, ${timeStr} drive (${window.label})`;
}

export function shouldShowWalking(miles: number, walkMins: number): boolean {
  return miles <= 1.0 && walkMins <= 20;
}

export function formatWalkLine(walkMins: number): string {
  return `${walkMins} min walk`;
}

// ─── Same-property detection ───────────────────────────────

export function isSameProperty(hotelName: string, venueNameOrAddress: string): boolean {
  if (!hotelName || !venueNameOrAddress) return false;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const hotelTokens = normalize(hotelName).split(' ').filter((t) => t.length > 4);
  const venueStr = normalize(venueNameOrAddress);
  const matchCount = hotelTokens.filter((t) => venueStr.includes(t)).length;
  return matchCount >= 2;
}

// ─── Planning notes ────────────────────────────────────────

function formatTimeParts(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const hr = hour % 12 || 12;
  return `${hr}:${String(minute).padStart(2, '0')} ${period}`;
}

function subtractMinutes(timeStr: string, mins: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m - mins;
  const safeTotal = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return formatTimeParts(Math.floor(safeTotal / 60), safeTotal % 60);
}

export function buildPlanningNotes(opts: PlanningNotesInput): string {
  const [h, m] = opts.startTime.split(':').map(Number);
  const startFormatted = formatTimeParts(h, m);
  const bufferMins = opts.maxDriveMins + 15;
  const latestDeparture = subtractMinutes(opts.startTime, bufferMins);
  const idealDeparture = subtractMinutes(opts.startTime, bufferMins + 15);

  const lines: string[] = [
    `For a ${startFormatted} guest arrival, motor coach departure from ${opts.hotelName} should be no later than ${latestDeparture}, ideally ${idealDeparture}, to absorb traffic variability.`,
  ];

  if (opts.dayOfWeek === 4) {
    lines.push('Thursday PM traffic is consistently heavy in most major US metros. Recommend coordinated motor coach departure rather than staggered shuttles.');
  } else if (opts.dayOfWeek === 5) {
    lines.push('Friday PM traffic is consistently heavy in most major US metros. Recommend coordinated motor coach departure rather than staggered shuttles.');
  }

  if (opts.distanceMiles > 5) {
    lines.push('Distance exceeds 5 miles. Recommend motor coach over rideshare for group coordination.');
  }

  return lines.join(' ');
}
