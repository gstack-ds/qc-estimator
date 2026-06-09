import Image from 'next/image';
import Link from 'next/link';
import type { DbEstimate, DbProgram, DbEvent, DbEstimateSection } from '@/lib/supabase/queries';
import type { EstimateSummary } from '@/types';
import type { SlideCopyData, MenuCourse } from '@/types/slideCopy';
import type { VendorPhoto } from '@/lib/vendors/profileTypes';
import { DIETARY_LABELS, type DietaryTag } from '@/lib/vendors/profileTypes';
import { formatCurrency } from '@/lib/slideCopy/brandVoice';
import PrintButton from '@/components/venues/PrintButton';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return formatCurrency(n);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

// ── Small sub-components ──────────────────────────────────────────────────────

function Ornament() {
  return (
    <div className="flex items-center gap-3 my-8 print:my-5">
      <div className="flex-1 border-t border-brand-cream" />
      <span className="text-brand-copper text-xs tracking-widest">✦ ✦ ✦</span>
      <div className="flex-1 border-t border-brand-cream" />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.25em] text-brand-copper font-medium mb-4 print:mb-2">
      {children}
    </p>
  );
}

function DietaryBadge({ tag }: { tag: DietaryTag }) {
  return (
    <span title={DIETARY_LABELS[tag]} className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded border border-brand-cream text-brand-brown bg-brand-offwhite leading-none align-middle mx-0.5">
      {tag}
    </span>
  );
}

// ── Hero section ──────────────────────────────────────────────────────────────

function Hero({
  heroPhoto, venueName, spaceName, city, state,
}: {
  heroPhoto: VendorPhoto | null;
  venueName: string;
  spaceName?: string | null;
  city?: string | null;
  state?: string | null;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl print:rounded-none print:break-after-avoid">
      {heroPhoto ? (
        <div className="relative aspect-[21/9] print:aspect-[16/9]">
          <Image
            src={heroPhoto.file_url}
            alt={heroPhoto.caption ?? venueName}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        </div>
      ) : (
        <div className="aspect-[21/9] print:aspect-[16/9] bg-brand-cream" />
      )}
      <div className={`${heroPhoto ? 'absolute bottom-0 inset-x-0' : ''} px-8 py-6 print:py-4`}>
        <p className="text-[10px] uppercase tracking-[0.3em] text-brand-copper mb-2 print:text-[9px]">
          QC Event Design
        </p>
        <h1 className={`font-serif font-light leading-tight tracking-wide print:text-4xl ${heroPhoto ? 'text-white text-5xl md:text-6xl' : 'text-brand-charcoal text-4xl md:text-5xl'}`}>
          {venueName}
        </h1>
        {(spaceName || city) && (
          <p className={`mt-1 text-sm ${heroPhoto ? 'text-white/80' : 'text-brand-silver'}`}>
            {[spaceName, city, state].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Photo strip ───────────────────────────────────────────────────────────────

function PhotoStrip({ photos }: { photos: VendorPhoto[] }) {
  if (photos.length === 0) return null;
  const display = photos.slice(0, 4);
  return (
    <div className={`grid gap-2 print:gap-1 ${display.length === 1 ? 'grid-cols-1' : display.length === 2 ? 'grid-cols-2' : display.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
      {display.map((p) => (
        <div key={p.id} className="relative aspect-[4/3] overflow-hidden rounded-lg print:rounded-none bg-brand-cream">
          <Image
            src={p.file_url}
            alt={p.caption ?? ''}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        </div>
      ))}
    </div>
  );
}

// ── Pricing section ───────────────────────────────────────────────────────────

function PricingSection({
  summary, guestCount, inclusions, eventDate, startTime,
}: {
  summary: EstimateSummary;
  guestCount: number;
  inclusions: string[];
  eventDate?: string | null;
  startTime?: string | null;
}) {
  return (
    <div className="print:break-inside-avoid">
      <SectionLabel>The Offer</SectionLabel>

      {(eventDate || startTime) && (
        <p className="text-xs text-brand-silver mb-3 tracking-wide">
          {[formatDate(eventDate ?? null), formatTime(startTime ?? null)].filter(Boolean).join('  ·  ')}
        </p>
      )}

      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <span className="font-serif text-3xl print:text-2xl text-brand-charcoal font-light">
          {fmt$(summary.totalClient)}
        </span>
        {guestCount > 0 && (
          <span className="text-brand-silver text-sm">based on {guestCount} guests</span>
        )}
      </div>
      {summary.pricePerPerson > 0 && (
        <p className="text-sm text-brand-brown mb-4">{fmt$(summary.pricePerPerson)} per person</p>
      )}

      {inclusions.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-brand-charcoal/50 mb-2">Including</p>
          <ul className="space-y-1.5">
            {inclusions.map((inc, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-brand-charcoal/85">
                <span className="text-brand-copper mt-0.5 flex-shrink-0">✦</span>
                <span>{inc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Itinerary ─────────────────────────────────────────────────────────────────

function ItinerarySection({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="print:break-inside-avoid">
      <SectionLabel>Route &amp; Itinerary</SectionLabel>
      <div className="space-y-1">
        {text.split('\n').filter(Boolean).map((line, i) => (
          <p key={i} className="text-sm text-brand-charcoal/85 leading-relaxed">
            {line.startsWith('•') ? line : `· ${line}`}
          </p>
        ))}
      </div>
    </div>
  );
}

// ── Menu ──────────────────────────────────────────────────────────────────────

const BAR_COURSE_RE = /^(vodka|whiskey|whisky|bourbon|gin|rum|tequila|scotch|beer|wine|champagne|prosecco|spirits|cocktail|liquor|full\s+bar|premium\s+bar|open\s+bar|hosted\s+bar|bar\b)/i;

function MenuSection({ menuCourses, barNotes }: { menuCourses: MenuCourse[]; barNotes?: string }) {
  if (!menuCourses.length && !barNotes) return null;

  const foodCourses = menuCourses.filter(c => !BAR_COURSE_RE.test(c.name));
  const barCourses = menuCourses.filter(c => BAR_COURSE_RE.test(c.name));

  return (
    <div className="print:break-inside-avoid-page">
      <SectionLabel>Menu &amp; Bar</SectionLabel>

      {foodCourses.length > 0 && (
        <div className="space-y-5 print:space-y-3 mb-6">
          {foodCourses.map((course, i) => {
            const optionsToShow = course.scenario === 'needs_selection'
              ? course.options
              : course.options.filter(o => o.selected);
            const header = course.selectionRule
              ? `${course.name.toUpperCase()} (${course.selectionRule.toUpperCase()})`
              : course.name.toUpperCase();
            return (
              <div key={i} className="print:break-inside-avoid">
                <p className="text-[11px] font-semibold tracking-[0.15em] text-brand-brown mb-1.5">{header}</p>
                <ul className="space-y-1">
                  {optionsToShow.map((opt, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm text-brand-charcoal/85">
                      <span className="text-brand-copper/60 mt-0.5 flex-shrink-0">·</span>
                      <span className="flex-1">
                        {opt.name}
                        {opt.description && <span className="text-brand-silver text-xs ml-1">— {opt.description}</span>}
                      </span>
                      {opt.tags?.length > 0 && (
                        <span className="flex-shrink-0">
                          {opt.tags.map(t => <DietaryBadge key={t} tag={t as DietaryTag} />)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {(barCourses.length > 0 || barNotes) && (
        <div className="print:break-inside-avoid">
          {barCourses.length > 0 && (
            <div className="space-y-3 mb-4 print:space-y-2">
              {barCourses.map((course, i) => {
                const brands = course.options.map(o => o.name).filter(Boolean).join(', ');
                return (
                  <p key={i} className="text-sm text-brand-charcoal/85">
                    <span className="font-medium tracking-wide">{course.name.toUpperCase()}</span>
                    {brands && <span className="text-brand-silver"> / {brands}</span>}
                  </p>
                );
              })}
            </div>
          )}
          {barNotes && (
            <div className="text-sm text-brand-charcoal/80 whitespace-pre-wrap leading-relaxed">
              {barNotes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Cost Summary ──────────────────────────────────────────────────────────────

function CostSummary({
  summary, sections,
}: {
  summary: EstimateSummary;
  sections: DbEstimateSection[];
}) {
  const venueLabel = sections.find(s => s.tax_bucket === 'venue')?.name ?? 'Venue Rental';
  const fbLabel = sections.find(s => s.tax_bucket === 'fb')?.name ?? 'Food & Beverage';
  const staffingLabel = sections.find(s => s.tax_bucket === 'staffing')?.name ?? 'Bar Staffing';
  const equipLabel = sections.find(s => s.tax_bucket === 'equipment')?.name ?? 'AV / Equipment';

  const totalTaxes = summary.foodTax + summary.alcoholTax + summary.equipmentTax + summary.venueTax + summary.productionFeeTax;

  const rows: [string, number][] = ([
    [venueLabel, summary.venueSubtotalClient],
    [fbLabel, summary.fbSubtotalClient],
    [staffingLabel, summary.qcStaffingSubtotalClient],
    [equipLabel, summary.equipmentSubtotalClient],
    ['Service Charge', summary.serviceChargeClient],
    ['Gratuity', summary.gratuityClient],
    ['Admin Fee', summary.adminFeeClient],
    ['Tax', totalTaxes],
  ] as [string, number][]).filter(([, v]) => v > 0);

  return (
    <div className="print:break-inside-avoid">
      <SectionLabel>Investment</SectionLabel>
      <div className="border border-brand-cream rounded-lg overflow-hidden print:border-none">
        {rows.map(([label, val], i) => (
          <div
            key={label}
            className={`flex items-center justify-between px-4 py-2.5 text-sm print:px-0 print:py-1.5 ${i % 2 === 0 ? 'bg-brand-offwhite print:bg-transparent' : 'bg-white print:bg-transparent'}`}
          >
            <span className="uppercase tracking-[0.12em] text-[11px] font-medium text-brand-charcoal/70">{label}</span>
            <span className="font-medium text-brand-charcoal tabular-nums">{fmt$(val)}</span>
          </div>
        ))}
        <div className="border-t border-brand-cream mt-1 print:border-brand-charcoal/20">
          <div className="flex items-center justify-between px-4 py-3 print:px-0 print:py-2">
            <span className="uppercase tracking-[0.15em] text-[11px] font-bold text-brand-charcoal">Total Estimate</span>
            <span className="font-bold text-brand-charcoal text-base tabular-nums">{fmt$(summary.totalClient)}</span>
          </div>
          {summary.pricePerPerson > 0 && (
            <div className="flex items-center justify-between px-4 pb-3 print:px-0 print:pb-2">
              <span className="uppercase tracking-[0.15em] text-[11px] font-medium text-brand-brown">Price Per Person</span>
              <span className="font-medium text-brand-brown tabular-nums">{fmt$(summary.pricePerPerson)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  estimate: DbEstimate;
  program: DbProgram;
  event: DbEvent | null;
  venueName?: string;
  venueSpaceName?: string;
  venueCity?: string | null;
  venueState?: string | null;
  heroPhoto: VendorPhoto | null;
  galleryPhotos: VendorPhoto[];
  summary: EstimateSummary;
  slideCopyData: SlideCopyData | null;
  sections: DbEstimateSection[];
}

const INCLUSION_LABEL_MAP: Record<string, string> = {
  venueRental: 'Venue rental',
  platedDinnerOrFood: 'Plated dinner / food',
  beerAndHouseWine: 'Beer & house wine',
  beveragesOnConsumption: 'Beverages on consumption',
  tableSideService: 'Table-side service',
  chairsLinensNapkins: 'Chairs, linens & napkins',
  fullServiceTeam: 'Full-service team',
  serviceChargeGratuityTaxes: 'Service charge, gratuity & taxes',
};

export default function ProposalPreview({
  estimate, program, event, venueName, venueSpaceName, venueCity, venueState,
  heroPhoto, galleryPhotos, summary, slideCopyData, sections,
}: Props) {
  const sc = slideCopyData;
  const eventDate = event?.event_date ?? program.event_date;
  const startTime = event?.start_time ?? program.event_start_time;
  const programUrl = `/programs/${program.id}/estimates/${estimate.id}`;

  const inclusions: string[] = sc?.inclusions
    ? [
        ...Object.entries(INCLUSION_LABEL_MAP)
          .filter(([key]) => (sc.inclusions as unknown as Record<string, boolean>)[key])
          .map(([, label]) => label),
        ...(sc.inclusions.customInclusion ? [sc.inclusions.customInclusion] : []),
      ]
    : [];

  const menuCourses: MenuCourse[] = sc?.menuSelections ?? [];

  return (
    <div className="brochure-root bg-white">
      {/* Toolbar — hidden when printing */}
      <div className="brochure-toolbar flex items-center justify-between mb-6 print:hidden">
        <Link
          href={programUrl}
          className="text-sm text-brand-silver hover:text-brand-brown transition-colors flex items-center gap-1"
        >
          ← Back to Builder
        </Link>
        <PrintButton />
      </div>

      {/* Hero */}
      <Hero
        heroPhoto={heroPhoto}
        venueName={venueName ?? estimate.name}
        spaceName={venueSpaceName}
        city={venueCity}
        state={venueState}
      />

      {/* Bio */}
      {sc?.venueBio && (
        <p className="mt-6 text-sm text-brand-charcoal/75 leading-relaxed print:mt-4">{sc.venueBio}</p>
      )}

      <Ornament />

      {/* Pricing */}
      <PricingSection
        summary={summary}
        guestCount={program.guest_count}
        inclusions={inclusions}
        eventDate={eventDate}
        startTime={startTime}
      />

      {/* Photo strip (non-hero photos) */}
      {galleryPhotos.length > 0 && (
        <>
          <div className="my-8 print:my-5">
            <PhotoStrip photos={galleryPhotos} />
          </div>
        </>
      )}

      {/* Itinerary */}
      {sc?.itinerary && (
        <>
          <Ornament />
          <ItinerarySection text={sc.itinerary} />
        </>
      )}

      {/* Menu + Bar */}
      {(menuCourses.length > 0 || sc?.barNotes) && (
        <>
          <Ornament />
          <MenuSection menuCourses={menuCourses} barNotes={sc?.barNotes} />
        </>
      )}

      {/* Cost summary */}
      <Ornament />
      <CostSummary summary={summary} sections={sections} />

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-brand-cream text-center print:mt-8">
        <p className="text-[10px] uppercase tracking-[0.25em] text-brand-copper">QC Event Design</p>
        {sc?.maxCapacity && (
          <p className="text-xs text-brand-silver mt-1">{sc.maxCapacity}</p>
        )}
      </div>
    </div>
  );
}
