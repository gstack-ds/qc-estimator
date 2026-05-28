'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { EstimateSummary } from '@/types';
import type { DbEstimate, DbProgram, DbEvent } from '@/lib/supabase/queries';
import type { SlideCopyData, InclusionToggles, TravelResult, MenuCourse } from '@/types/slideCopy';
import { saveSlideCopyData, getTravelTime, getAttachmentsForEstimate, extractedMenuToMenuCourses, generateVenueBio } from '@/app/(programs)/programs/[id]/estimates/actions';
import MenuSelectionPanel from './MenuSelectionPanel';
import { spellNumber, oxfordComma, formatCurrency, checkBannedWords } from '@/lib/slideCopy/brandVoice';

// Minimal shape needed from line items — avoids circular import with EstimateBuilder
interface SlideCopyLineItem {
  taxBucket: string;
  taxType: string;
  name: string;
  qty: number;
  isRevenueItem?: boolean;
}

interface Props {
  estimate: DbEstimate;
  program: DbProgram;
  event: DbEvent | null;
  summary: EstimateSummary;
  lineItems: SlideCopyLineItem[];
  initialData: SlideCopyData | null;
  venueName?: string;
  venueSpaceName?: string;
  venueAddress?: string;
  pendingMenuData?: MenuCourse[] | null;
  onPendingMenuConsumed?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function pluralize(name: string, qty: number): string {
  if (qty === 1) return name.toLowerCase();
  return name.toLowerCase().endsWith('s') ? name.toLowerCase() : name.toLowerCase() + 's';
}

function buildTeamSummary(lineItems: SlideCopyLineItem[]): string {
  const staffing = lineItems.filter(
    (li) => li.taxBucket === 'staffing' && li.qty > 0 && !li.isRevenueItem
  );
  if (staffing.length === 0) return '';
  const parts = staffing.map((li) => `${spellNumber(li.qty)} ${pluralize(li.name, li.qty)}`);
  return `Our full-service team includes ${oxfordComma(parts)}.`;
}

function autoDetectInclusions(
  summary: EstimateSummary,
  lineItems: SlideCopyLineItem[]
): InclusionToggles {
  const hasAlcohol = lineItems.some((li) => li.taxBucket === 'fb' && li.taxType === 'alcohol');
  const hasConsumption = lineItems.some((li) => /consumption/i.test(li.name));
  const hasTableSide = lineItems.some((li) => li.taxBucket === 'staffing' && /server|captain/i.test(li.name));
  const hasChairs = lineItems.some((li) => li.taxBucket === 'equipment' && /chair|linen|napkin/i.test(li.name));
  return {
    venueRental: summary.venueSubtotalClient > 0,
    platedDinnerOrFood: summary.fbSubtotalClient > 0,
    beerAndHouseWine: hasAlcohol,
    beveragesOnConsumption: hasConsumption,
    tableSideService: hasTableSide,
    chairsLinensNapkins: hasChairs,
    fullServiceTeam: summary.qcStaffingSubtotalClient > 0,
    serviceChargeGratuityTaxes: summary.serviceChargeClient > 0 || summary.gratuityClient > 0,
    customInclusion: '',
  };
}

const INCLUSION_LABELS: [keyof Omit<InclusionToggles, 'customInclusion'>, string][] = [
  ['venueRental', 'Venue rental'],
  ['platedDinnerOrFood', 'Plated dinner / food'],
  ['beerAndHouseWine', 'Beer and house wine'],
  ['beveragesOnConsumption', 'Beverages on consumption'],
  ['tableSideService', 'Table-side service'],
  ['chairsLinensNapkins', 'Chairs, linens, and napkins'],
  ['fullServiceTeam', 'Full-service team'],
  ['serviceChargeGratuityTaxes', 'Service charge, gratuity, and taxes'],
];

// ─── Main component ───────────────────────────────────────

export default function SlideCopySection({
  estimate, program, event, summary, lineItems, initialData, venueName, venueSpaceName, venueAddress,
  pendingMenuData, onPendingMenuConsumed,
}: Props) {
  const [venueUrl, setVenueUrl] = useState(initialData?.venueUrl ?? '');
  const [sqft, setSqft] = useState(initialData?.sqft?.toString() ?? '');
  const [maxCapacity, setMaxCapacity] = useState(initialData?.maxCapacity ?? '');
  const [inclusions, setInclusions] = useState<InclusionToggles>(
    () => initialData?.inclusions ?? autoDetectInclusions(summary, lineItems)
  );
  const [travelResult, setTravelResult] = useState<TravelResult | null>(initialData?.travelResult ?? null);
  const [travelLoading, setTravelLoading] = useState(false);
  const [travelError, setTravelError] = useState<string | null>(null);
  const [venueBio, setVenueBio] = useState(initialData?.venueBio ?? '');
  const [bioLoading, setBioLoading] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);
  const [menuCourses, setMenuCourses] = useState<MenuCourse[]>(initialData?.menuSelections ?? []);
  const [menuLoading, setMenuLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didMount = useRef(false);

  // Consume pendingMenuData from Option B "Copy to Canva"
  useEffect(() => {
    if (pendingMenuData && pendingMenuData.length > 0) {
      setMenuCourses(pendingMenuData);
      onPendingMenuConsumed?.();
    }
  }, [pendingMenuData]);

  const handleLoadMenuFromPdfs = useCallback(async () => {
    setMenuLoading(true);
    const { error, records } = await getAttachmentsForEstimate(estimate.id);
    setMenuLoading(false);
    if (error || !records) return;
    const allMenuItems = records.flatMap((r) => r.extracted_data?.menuItems ?? []);
    if (allMenuItems.length > 0) {
      setMenuCourses(extractedMenuToMenuCourses(allMenuItems));
    }
  }, [estimate.id]);

  // Debounced auto-save — skip the very first render
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const data: SlideCopyData = {
        venueUrl: venueUrl || undefined,
        sqft: sqft ? Number(sqft) : undefined,
        maxCapacity: maxCapacity || undefined,
        venueBio: venueBio || undefined,
        inclusions,
        menuSelections: menuCourses.length > 0 ? menuCourses : undefined,
        travelResult: travelResult ?? undefined,
      };
      saveSlideCopyData(estimate.id, data);
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [venueUrl, sqft, maxCapacity, inclusions, travelResult, menuCourses, venueBio]);

  const handleCalculateTravel = useCallback(async () => {
    const hotel = program.client_hotel;
    const venue = venueAddress;
    const date = event?.event_date ?? program.event_date;
    const time = event?.start_time ?? program.event_start_time;
    if (!hotel || !venue || !date || !time) {
      setTravelError('Client hotel, venue address, event date, and start time are all required for drive time calculation.');
      return;
    }
    setTravelLoading(true);
    setTravelError(null);
    const { error, result } = await getTravelTime(hotel, venue, date, time, hotel);
    setTravelLoading(false);
    if (error) { setTravelError(error); return; }
    setTravelResult(result);
  }, [program.client_hotel, venueAddress, event, program.event_date, program.event_start_time]);

  const toggleInclusion = useCallback((key: keyof Omit<InclusionToggles, 'customInclusion'>) => {
    setInclusions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleGenerateBio = useCallback(async () => {
    setBioLoading(true);
    setBioError(null);
    const city = venueAddress?.split(',')[1]?.trim();
    const { error, bio, sqftHint, capacityHint } = await generateVenueBio({
      venueName: venueName ?? 'the venue',
      venueUrl: venueUrl || undefined,
      city,
      eventType: event?.event_type ?? undefined,
    });
    setBioLoading(false);
    if (error) { setBioError(error); return; }
    if (bio) setVenueBio(bio);
    if (sqftHint && !sqft) setSqft(sqftHint);
    if (capacityHint && !maxCapacity) setMaxCapacity(capacityHint + ' seated');
  }, [venueName, venueUrl, venueAddress, sqft, maxCapacity, event?.event_type]);

  // ─── Build text blocks ──────────────────────────────────

  const eventDate = event?.event_date ?? program.event_date;
  const startTime = event?.start_time ?? program.event_start_time;
  const eventName = event?.name ?? program.name;

  const slide1Header = [
    venueName ?? '',
    venueSpaceName ?? '',
    program.name,
  ].filter(Boolean).join('\n');

  const totalTaxes = summary.foodTax + summary.alcoholTax + summary.equipmentTax + summary.venueTax;
  const summaryRows = ([
    ['Venue Rental', summary.venueSubtotalClient],
    ['Food and Beverage', summary.fbSubtotalClient],
    ['Bar Staffing', summary.qcStaffingSubtotalClient],
    ['Catering Equipment and Staffing', summary.equipmentSubtotalClient],
    ['Service Charge', summary.serviceChargeClient],
    ['Gratuity', summary.gratuityClient],
    ['Production Fee', summary.productionFee],
    ['Tax', totalTaxes],
  ] as [string, number][]).filter(([, v]) => v > 0);

  const COL = 36;
  const slide1Summary = [
    ...summaryRows.map(([label, val]) => `${label.padEnd(COL)}${formatCurrency(val)}`),
    '─'.repeat(COL + 10),
    `TOTAL ESTIMATE${' '.repeat(COL - 14)}${formatCurrency(summary.totalClient)}`,
    `PRICE PER PERSON${' '.repeat(COL - 16)}${formatCurrency(summary.pricePerPerson)}`,
  ].join('\n');

  const slide2Header = [
    eventName,
    [formatDate(eventDate), formatTime(startTime)].filter(Boolean).join('  |  '),
  ].filter(Boolean).join('\n');

  const activeInclusions = [
    ...INCLUSION_LABELS.filter(([key]) => inclusions[key]).map(([, label]) => label),
    inclusions.customInclusion || null,
  ].filter(Boolean) as string[];

  const slide2Inclusions = activeInclusions.length > 0
    ? 'WHAT\'S INCLUDED:\n' + activeInclusions.map((l) => `• ${l}`).join('\n')
    : '';

  const teamSummary = buildTeamSummary(lineItems);
  const driveLine = travelResult?.driveLine ?? '';

  const menuCopyText = menuCourses.length > 0
    ? menuCourses.map((c) => {
        const selected = c.options.filter((o) => o.selected);
        const lines = selected.map((o) => {
          const tagStr = o.tags?.length ? ` [${o.tags.join(', ')}]` : '';
          return `• ${o.name}${tagStr}`;
        });
        return `${c.name}:\n${lines.join('\n') || '(no selections yet)'}`;
      }).join('\n\n')
    : '';

  const allSections = [
    { marker: '--- SLIDE 1 HEADER ---', text: slide1Header },
    { marker: '--- SLIDE 1 DESCRIPTION ---', text: venueBio },
    { marker: '--- SLIDE 1 SUMMARY ---', text: slide1Summary },
    { marker: '--- SLIDE 2 HEADER ---', text: slide2Header },
    { marker: '--- SLIDE 2 INCLUSIONS ---', text: slide2Inclusions },
    { marker: '--- SLIDE 2 DRIVE TIME ---', text: driveLine },
    { marker: '--- SLIDE 2 MENU ---', text: menuCopyText },
    { marker: '--- SLIDE 2 SERVICE TEAM ---', text: teamSummary },
  ];

  const allCopyText = allSections
    .map(({ marker, text }) => `${marker}\n${text}`)
    .join('\n\n');

  // Brand voice warnings across all copy text
  const bannedFound = checkBannedWords(allCopyText);

  return (
    <div className="border border-brand-copper/30 rounded-lg bg-brand-cream mt-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-copper/20">
        <div>
          <h3 className="font-serif text-sm font-medium text-brand-charcoal tracking-wide">Slide Copy</h3>
          <p className="text-[10px] text-brand-brown/70 tracking-wide uppercase mt-0.5">
            SPIN Philadelphia template · Copy-paste into Canva
          </p>
        </div>
        <CopyButton text={allCopyText} label="Copy All" />
      </div>

      <div className="p-4 space-y-5">
        {/* Brand voice warning */}
        {bannedFound.length > 0 && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Flagged words: {bannedFound.join(', ')} — review before copying.
          </div>
        )}

        {/* Section A — Venue inputs */}
        <div>
          <p className="text-[11px] font-semibold text-brand-brown uppercase tracking-wider mb-2">Venue Details</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-brand-charcoal/60 block mb-0.5">Venue Website (optional)</label>
              <input
                type="url"
                value={venueUrl}
                onChange={(e) => setVenueUrl(e.target.value)}
                placeholder="https://..."
                className="w-full text-xs border border-brand-copper/30 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-brand-copper"
              />
            </div>
            <div>
              <label className="text-[11px] text-brand-charcoal/60 block mb-0.5">Square Footage (optional)</label>
              <input
                type="number"
                value={sqft}
                onChange={(e) => setSqft(e.target.value)}
                placeholder="e.g. 4500"
                className="w-full text-xs border border-brand-copper/30 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-brand-copper"
              />
            </div>
            <div>
              <label className="text-[11px] text-brand-charcoal/60 block mb-0.5">Max Capacity (optional)</label>
              <input
                type="text"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(e.target.value)}
                placeholder="e.g. 200 seated"
                className="w-full text-xs border border-brand-copper/30 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-brand-copper"
              />
            </div>
          </div>
        </div>

        {/* Section C — Inclusions */}
        <div>
          <p className="text-[11px] font-semibold text-brand-brown uppercase tracking-wider mb-2">Inclusions</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {INCLUSION_LABELS.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs text-brand-charcoal cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={inclusions[key]}
                  onChange={() => toggleInclusion(key)}
                  className="rounded border-brand-copper/40 text-brand-copper focus:ring-brand-copper/30"
                />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-2">
            <input
              type="text"
              value={inclusions.customInclusion}
              onChange={(e) => setInclusions((prev) => ({ ...prev, customInclusion: e.target.value }))}
              placeholder="Custom inclusion (optional)"
              className="w-full text-xs border border-brand-copper/30 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-brand-copper"
            />
          </div>
        </div>

        {/* Copy blocks / preview toggle */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-brand-brown uppercase tracking-wider">
              {previewMode ? 'Formatted Preview' : 'Raw Copy Blocks'}
            </p>
            <button
              type="button"
              onClick={() => setPreviewMode((p) => !p)}
              className="text-xs px-2.5 py-1 rounded border border-brand-copper/40 text-brand-brown hover:bg-brand-copper/10 transition-colors"
            >
              {previewMode ? 'Show Raw Blocks' : 'Show Preview'}
            </button>
          </div>

          {previewMode ? (
            <SlidePreview
              venueName={venueName}
              venueSpaceName={venueSpaceName}
              programName={program.name}
              venueBio={venueBio}
              sqft={sqft}
              maxCapacity={maxCapacity}
              summaryRows={summaryRows}
              totalClient={summary.totalClient}
              pricePerPerson={summary.pricePerPerson}
              eventName={eventName}
              eventDate={eventDate}
              startTime={startTime}
              activeInclusions={activeInclusions}
              driveLine={driveLine}
              walkLine={travelResult?.walkLine ?? null}
              menuCourses={menuCourses}
              teamSummary={teamSummary}
            />
          ) : (
          <div className="space-y-3">
            {/* Slide 1 Header */}
            <CopyBlock marker="SLIDE 1 — Venue Header" text={slide1Header} />

            {/* Slide 1 Summary */}
            <CopyBlock marker="SLIDE 1 — Estimate Summary" text={slide1Summary} monospace />

            {/* Slide 2 Header */}
            <CopyBlock marker="SLIDE 2 — Event Header" text={slide2Header} />

            {/* Slide 2 Inclusions */}
            <CopyBlock marker="SLIDE 2 — Inclusions" text={slide2Inclusions || '(no inclusions selected)'} />

            {/* Slide 2 Service Team */}
            <CopyBlock marker="SLIDE 2 — Service Team" text={teamSummary || '(no staffing line items)'} />

            {/* Slide 1 Description / Venue Bio */}
            <VenueBioBlock
              bio={venueBio}
              loading={bioLoading}
              error={bioError}
              hasUrl={!!venueUrl}
              onGenerate={handleGenerateBio}
              onChange={setVenueBio}
            />

            {/* Drive Time */}
            <DriveTimeBlock
              hotelName={program.client_hotel}
              venueName={venueName}
              venueAddress={venueAddress}
              result={travelResult}
              loading={travelLoading}
              error={travelError}
              onCalculate={handleCalculateTravel}
            />

            {/* Menu Selections */}
            <div className="border border-brand-copper/20 rounded bg-white">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-brand-copper/10 bg-brand-offwhite rounded-t">
                <span className="text-[11px] font-medium text-brand-charcoal/70">SLIDE 2 — Menu Selections</span>
                <div className="flex items-center gap-2">
                  {menuCourses.length > 0 && <CopyButton text={menuCopyText} label="Copy Menu" />}
                  <button
                    type="button"
                    onClick={handleLoadMenuFromPdfs}
                    disabled={menuLoading}
                    className="text-xs px-2 py-1 rounded border border-brand-copper/40 text-brand-brown hover:bg-brand-copper/10 transition-colors disabled:opacity-40"
                  >
                    {menuLoading ? 'Loading…' : menuCourses.length > 0 ? 'Reload from PDFs' : 'Load from PDFs'}
                  </button>
                </div>
              </div>
              <div className="p-3">
                {menuCourses.length === 0 ? (
                  <p className="text-xs text-brand-charcoal/40 italic">
                    Extract menu from a PDF attachment, then click "Load from PDFs" to populate selections here.
                  </p>
                ) : (
                  <MenuSelectionPanel courses={menuCourses} onChange={setMenuCourses} />
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────

function CopyBlock({ marker, text, monospace }: { marker: string; text: string; monospace?: boolean }) {
  return (
    <div className="border border-brand-copper/20 rounded bg-white">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-brand-copper/10 bg-brand-offwhite rounded-t">
        <span className="text-[11px] font-medium text-brand-charcoal/70">{marker}</span>
        <CopyButton text={text} label="Copy Section" />
      </div>
      <pre className={`px-3 py-2 text-xs text-brand-charcoal whitespace-pre-wrap ${monospace ? 'font-mono' : 'font-sans'}`}>
        {text}
      </pre>
    </div>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs px-2 py-1 rounded border border-brand-copper/40 text-brand-brown hover:bg-brand-copper/10 transition-colors"
    >
      {copied ? 'Copied ✓' : label}
    </button>
  );
}

function PhasePlaceholder({ label, phase, detail }: { label: string; phase: string; detail: string }) {
  return (
    <div className="border border-dashed border-brand-copper/20 rounded">
      <div className="flex items-center justify-between px-3 py-1.5 bg-brand-offwhite/50 rounded-t">
        <span className="text-[11px] font-medium text-brand-charcoal/40">{label}</span>
        <span className="text-[10px] text-brand-silver/60 bg-brand-cream px-1.5 py-0.5 rounded">Phase {phase}</span>
      </div>
      <p className="px-3 py-2 text-xs text-brand-charcoal/30 italic">{detail}</p>
    </div>
  );
}

// ─── Slide Preview components ────────────────────────────────

interface SlidePreviewProps {
  venueName?: string;
  venueSpaceName?: string;
  programName: string;
  venueBio: string;
  sqft: string;
  maxCapacity: string;
  summaryRows: [string, number][];
  totalClient: number;
  pricePerPerson: number;
  eventName: string;
  eventDate: string | null;
  startTime: string | null;
  activeInclusions: string[];
  driveLine: string;
  walkLine: string | null;
  menuCourses: MenuCourse[];
  teamSummary: string;
}

function SlidePreview(props: SlidePreviewProps) {
  return (
    <div className="space-y-5">
      <p className="text-[10px] text-brand-silver/70 uppercase tracking-wider text-center">
        SPIN Philadelphia Template — Preview
      </p>
      <div>
        <p className="text-[10px] text-brand-charcoal/40 uppercase tracking-wider mb-1.5">Slide 1 — Hero</p>
        <Slide1Preview {...props} />
      </div>
      <div>
        <p className="text-[10px] text-brand-charcoal/40 uppercase tracking-wider mb-1.5">Slide 2 — Menu / Details</p>
        <Slide2Preview {...props} />
      </div>
      <p className="text-[10px] text-brand-silver/50 text-center">
        ✦ Bright Darling font not available — using Cormorant Garamond. Tell Alex to swap in Canva.
      </p>
    </div>
  );
}

function Slide1Preview({ venueName, venueSpaceName, programName, venueBio, sqft, maxCapacity, summaryRows, totalClient, pricePerPerson }: SlidePreviewProps) {
  return (
    <div
      className="w-full rounded-lg overflow-hidden border border-brand-copper/20 shadow-sm flex"
      style={{ aspectRatio: '16 / 9' }}
    >
      {/* Left panel — charcoal */}
      <div className="w-[42%] bg-brand-charcoal flex flex-col p-[4%] text-white min-h-0 overflow-hidden">
        <div className="flex-shrink-0">
          {venueName && (
            <h2 className="font-serif text-[clamp(1rem,2.5vw,1.75rem)] font-light leading-tight text-white mb-1">
              {venueName}
            </h2>
          )}
          {venueSpaceName && (
            <p className="font-serif text-[clamp(0.6rem,1.2vw,0.85rem)] italic text-brand-copper/80 mb-0.5">
              {venueSpaceName}
            </p>
          )}
          <p className="text-[clamp(0.5rem,1vw,0.7rem)] text-white/40 uppercase tracking-wider">{programName}</p>
        </div>

        {venueBio && (
          <p className="font-display text-[clamp(0.5rem,1vw,0.65rem)] text-white/75 leading-relaxed mt-[3%] flex-1 overflow-hidden">
            {venueBio}
          </p>
        )}

        <div className="flex-shrink-0 mt-[3%] border-t border-white/10 pt-[2%] space-y-0.5">
          {sqft && (
            <p className="text-[clamp(0.45rem,0.85vw,0.6rem)] text-white/50">
              {Number(sqft).toLocaleString()} sq ft
            </p>
          )}
          {maxCapacity && (
            <p className="text-[clamp(0.45rem,0.85vw,0.6rem)] text-white/50">{maxCapacity}</p>
          )}
        </div>
      </div>

      {/* Right panel — cream / estimate table */}
      <div className="flex-1 bg-brand-offwhite flex flex-col justify-center px-[4%] py-[3%] min-h-0 overflow-hidden">
        <div className="space-y-[1.5%]">
          {summaryRows.map(([label, val]) => (
            <div key={label} className="flex justify-between items-baseline">
              <span className="text-[clamp(0.45rem,0.9vw,0.65rem)] text-brand-charcoal/70">{label}</span>
              <span className="font-mono text-[clamp(0.45rem,0.9vw,0.65rem)] text-brand-charcoal">{formatCurrency(val)}</span>
            </div>
          ))}
          <div className="border-t border-brand-copper/30 pt-[1.5%] mt-[1.5%] space-y-[1%]">
            <div className="flex justify-between items-baseline">
              <span className="text-[clamp(0.5rem,1vw,0.7rem)] font-semibold text-brand-charcoal uppercase tracking-wide">
                Total Estimate
              </span>
              <span className="font-mono text-[clamp(0.5rem,1vw,0.7rem)] font-semibold text-brand-charcoal">
                {formatCurrency(totalClient)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[clamp(0.45rem,0.9vw,0.6rem)] text-brand-brown uppercase tracking-wide">
                Price Per Person
              </span>
              <span className="font-mono text-[clamp(0.45rem,0.9vw,0.6rem)] text-brand-brown font-medium">
                {formatCurrency(pricePerPerson)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slide2Preview({ eventName, eventDate, startTime, activeInclusions, driveLine, walkLine, menuCourses, teamSummary }: SlidePreviewProps) {
  return (
    <div
      className="w-full rounded-lg overflow-hidden border border-brand-copper/20 shadow-sm flex flex-col"
      style={{ aspectRatio: '16 / 9' }}
    >
      {/* Header strip */}
      <div className="bg-brand-charcoal px-[4%] py-[2%] flex items-center justify-between flex-shrink-0">
        <h2 className="font-serif text-[clamp(0.7rem,1.8vw,1.2rem)] font-light text-white">
          {eventName || 'Event Name'}
        </h2>
        <p className="text-[clamp(0.4rem,0.9vw,0.6rem)] text-white/50">
          {[formatDate(eventDate), formatTime(startTime)].filter(Boolean).join('  |  ')}
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left — drive time + menu */}
        <div className="flex-1 bg-brand-offwhite px-[3%] py-[2.5%] overflow-hidden space-y-[2.5%]">
          {driveLine && (
            <div>
              <p className="text-[clamp(0.4rem,0.75vw,0.5rem)] font-semibold text-brand-copper uppercase tracking-widest mb-0.5">
                Drive Time
              </p>
              <p className="text-[clamp(0.45rem,0.85vw,0.6rem)] text-brand-charcoal">{driveLine}</p>
              {walkLine && (
                <p className="text-[clamp(0.4rem,0.75vw,0.55rem)] text-brand-charcoal/55">{walkLine}</p>
              )}
            </div>
          )}

          {menuCourses.length > 0 && (
            <div>
              <p className="text-[clamp(0.4rem,0.75vw,0.5rem)] font-semibold text-brand-copper uppercase tracking-widest mb-0.5">
                Menu Selections
              </p>
              {menuCourses.map((c, i) => {
                const selected = c.options.filter((o) => o.selected);
                return (
                  <div key={i} className="mb-[1%]">
                    <p className="text-[clamp(0.4rem,0.75vw,0.55rem)] font-medium text-brand-charcoal">{c.name}</p>
                    {selected.length > 0 ? (
                      selected.map((o, j) => (
                        <p key={j} className="text-[clamp(0.38rem,0.7vw,0.5rem)] text-brand-charcoal/65">
                          • {o.name}{o.tags?.length ? ` [${o.tags.join(', ')}]` : ''}
                        </p>
                      ))
                    ) : (
                      <p className="text-[clamp(0.38rem,0.7vw,0.5rem)] text-brand-charcoal/35 italic">no selection</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {menuCourses.length === 0 && !driveLine && (
            <p className="text-[clamp(0.4rem,0.75vw,0.55rem)] text-brand-charcoal/30 italic">
              Add drive time and menu selections to populate this slide.
            </p>
          )}
        </div>

        {/* Right — inclusions + team */}
        <div className="w-[38%] bg-brand-cream/50 border-l border-brand-copper/15 px-[3%] py-[2.5%] overflow-hidden space-y-[2.5%]">
          {activeInclusions.length > 0 && (
            <div>
              <p className="text-[clamp(0.4rem,0.75vw,0.5rem)] font-semibold text-brand-copper uppercase tracking-widest mb-0.5">
                What&apos;s Included
              </p>
              {activeInclusions.map((inc, i) => (
                <p key={i} className="text-[clamp(0.4rem,0.75vw,0.55rem)] text-brand-charcoal/75">
                  · {inc}
                </p>
              ))}
            </div>
          )}

          {teamSummary && (
            <div>
              <p className="text-[clamp(0.4rem,0.75vw,0.5rem)] font-semibold text-brand-copper uppercase tracking-widest mb-0.5">
                Service Team
              </p>
              <p className="text-[clamp(0.38rem,0.7vw,0.5rem)] text-brand-charcoal/65 leading-relaxed">
                {teamSummary}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface VenueBioBlockProps {
  bio: string;
  loading: boolean;
  error: string | null;
  hasUrl: boolean;
  onGenerate: () => void;
  onChange: (v: string) => void;
}

function VenueBioBlock({ bio, loading, error, hasUrl, onGenerate, onChange }: VenueBioBlockProps) {
  return (
    <div className="border border-brand-copper/20 rounded bg-white">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-brand-copper/10 bg-brand-offwhite rounded-t">
        <span className="text-[11px] font-medium text-brand-charcoal/70">SLIDE 1 — Venue Description</span>
        <div className="flex items-center gap-2">
          {bio && <CopyButton text={bio} label="Copy Section" />}
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="text-xs px-2 py-1 rounded border border-brand-copper/40 text-brand-brown hover:bg-brand-copper/10 transition-colors disabled:opacity-40"
          >
            {loading ? 'Generating…' : bio ? 'Regenerate' : hasUrl ? 'Generate from URL' : 'Generate from Name'}
          </button>
        </div>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {error && <p className="text-xs text-red-600">{error}</p>}
        <textarea
          value={bio}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder="Generate a venue description or type one manually…"
          className="w-full text-xs border border-brand-copper/20 rounded px-2 py-1.5 bg-brand-offwhite/40 focus:outline-none focus:border-brand-copper resize-y"
        />
        {!hasUrl && !bio && (
          <p className="text-[10px] text-brand-silver/60">
            No venue URL — will generate from venue name. Add a URL above for a richer description.
          </p>
        )}
      </div>
    </div>
  );
}

interface DriveTimeBlockProps {
  hotelName: string | null;
  venueName?: string;
  venueAddress?: string;
  result: TravelResult | null;
  loading: boolean;
  error: string | null;
  onCalculate: () => void;
}

function DriveTimeBlock({ hotelName, venueName, venueAddress, result, loading, error, onCalculate }: DriveTimeBlockProps) {
  const canCalculate = !!(hotelName && venueAddress);

  return (
    <div className="border border-brand-copper/20 rounded bg-white">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-brand-copper/10 bg-brand-offwhite rounded-t">
        <span className="text-[11px] font-medium text-brand-charcoal/70">SLIDE 1 — Drive Time</span>
        <div className="flex items-center gap-2">
          {result && <CopyButton text={result.driveLine} label="Copy" />}
          <button
            type="button"
            onClick={onCalculate}
            disabled={!canCalculate || loading}
            className="text-xs px-2 py-1 rounded border border-brand-copper/40 text-brand-brown hover:bg-brand-copper/10 transition-colors disabled:opacity-40"
          >
            {loading ? 'Calculating…' : result ? 'Recalculate' : 'Calculate'}
          </button>
        </div>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {!canCalculate && (
          <p className="text-xs text-brand-charcoal/40 italic">
            {!hotelName ? 'Set Client Hotel on the program to enable.' : 'Link a venue with an address to enable.'}
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        {result && (
          <>
            <div className="text-xs text-brand-charcoal">
              <span className="font-medium">Slide copy:</span> {result.driveLine}
              {result.walkLine && <span className="ml-2 text-brand-charcoal/60">· {result.walkLine}</span>}
            </div>
            {result.isSameProperty && (
              <p className="text-xs text-brand-copper/80">On-site event detected.</p>
            )}
            {result.planningNotes && (
              <div className="text-[11px] text-brand-charcoal/60 bg-brand-offwhite rounded p-2 mt-1">
                <p className="font-semibold text-brand-brown uppercase tracking-wider mb-0.5" style={{ fontSize: '10px' }}>Planning Notes</p>
                {result.planningNotes}
              </div>
            )}
            {canCalculate && (
              <p className="text-[10px] text-brand-silver/50">
                {hotelName} → {venueName ?? venueAddress}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
