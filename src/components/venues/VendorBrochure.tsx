import Image from 'next/image';
import type { DbVenueWithSpaces } from '@/lib/supabase/queries';
import type {
  VendorMenu, BarOption, VendorInclusion, VendorPhoto, DietaryTag,
} from '@/lib/vendors/profileTypes';
import { DIETARY_LABELS } from '@/lib/vendors/profileTypes';

function fmtBarPrice(opt: BarOption): string | null {
  if (opt.price_per_person == null) return null;
  if (opt.base_hours != null && opt.additional_hour_price_per_person != null) {
    const baseHrLabel = opt.base_hours === 1 ? '1 hour' : `${opt.base_hours} hours`;
    return `$${opt.price_per_person}/pp first ${baseHrLabel}, +$${opt.additional_hour_price_per_person}/pp each additional hour`;
  }
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(opt.price_per_person);
  return `${formatted} per person`;
}
import PrintButton from './PrintButton';

// ── Helpers ───────────────────────────────────────────────────────────────────

const VENDOR_TYPE_LABELS: Record<string, string> = {
  venue:           'Venue',
  restaurant:      'Restaurant',
  tour:            'Tour',
  transportation:  'Transportation',
  entertainment:   'Entertainment',
  decor:           'Décor',
};

const PRIVACY_LABELS: Record<string, string> = {
  private:    'Private',
  semi:       'Semi-Private',
  public:     'Open / Public',
  restaurant: 'Restaurant Buy-Out',
};

const PRIVACY_COLORS: Record<string, string> = {
  private:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  semi:       'bg-amber-50 text-amber-700 border-amber-200',
  public:     'bg-sky-50 text-sky-700 border-sky-200',
  restaurant: 'bg-orange-50 text-orange-700 border-orange-200',
};

function fmt$(n: number | null | undefined) {
  if (n == null) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function formatPhone(p: string | null) {
  if (!p) return null;
  const digits = p.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  return p;
}

// ── Section divider ───────────────────────────────────────────────────────────

function Divider() {
  return (
    <div className="flex items-center gap-4 py-2 print:py-1">
      <div className="flex-1 border-t border-brand-cream" />
      <span className="text-brand-copper text-xs tracking-[0.25em]">✦</span>
      <div className="flex-1 border-t border-brand-cream" />
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHead({ label }: { label: string }) {
  return (
    <h2 className="font-serif text-2xl font-light tracking-wide text-brand-charcoal mb-6 print:mb-4">
      {label}
    </h2>
  );
}

// ── Dietary tag pill ──────────────────────────────────────────────────────────

function DietaryPill({ tag }: { tag: DietaryTag }) {
  return (
    <span
      title={DIETARY_LABELS[tag]}
      className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border border-brand-cream text-brand-brown bg-brand-offwhite leading-none"
    >
      {tag}
    </span>
  );
}

// ── Photo grid ────────────────────────────────────────────────────────────────

function PhotoGrid({ photos }: { photos: VendorPhoto[] }) {
  if (!photos.length) return null;
  const sorted = [...photos].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <section className="print:break-inside-avoid-page">
      <SectionHead label="Photos" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 print:gap-2">
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`relative overflow-hidden rounded-lg bg-brand-cream ${
              i === 0 ? 'col-span-2 aspect-[16/9]' : 'aspect-[4/3]'
            }`}
          >
            <Image
              src={p.file_url}
              alt={p.caption ?? 'Venue photo'}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
            {p.caption && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2">
                <p className="text-white text-xs font-display">{p.caption}</p>
              </div>
            )}
            {p.tag !== 'other' && (
              <div className="absolute top-2 right-2">
                <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-black/40 text-white/90">
                  {p.tag}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Spaces section ────────────────────────────────────────────────────────────

function SpacesSection({ spaces }: { spaces: DbVenueWithSpaces['spaces'] }) {
  if (!spaces.length) return null;
  return (
    <section className="print:break-inside-avoid-page">
      <SectionHead label="Spaces &amp; Rooms" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:gap-3">
        {spaces.map(s => (
          <div
            key={s.id}
            className="border border-brand-cream rounded-xl p-5 bg-brand-offwhite space-y-3 print:p-3 print:break-inside-avoid"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-serif text-lg text-brand-charcoal leading-snug">{s.name}</h3>
              {s.privacy_tag && (
                <span className={`flex-shrink-0 text-[10px] uppercase tracking-widest px-2 py-1 rounded border font-medium ${PRIVACY_COLORS[s.privacy_tag] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {PRIVACY_LABELS[s.privacy_tag] ?? s.privacy_tag}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-brand-charcoal/80">
              {s.capacity_seated != null && (
                <span><span className="text-brand-silver text-xs uppercase tracking-wide">Seated</span><br />{s.capacity_seated.toLocaleString()}</span>
              )}
              {s.capacity_standing != null && (
                <span><span className="text-brand-silver text-xs uppercase tracking-wide">Standing</span><br />{s.capacity_standing.toLocaleString()}</span>
              )}
              {s.fb_minimum != null && (
                <span><span className="text-brand-silver text-xs uppercase tracking-wide">F&amp;B Min</span><br />{fmt$(s.fb_minimum)}</span>
              )}
              {s.room_fee != null && (
                <span><span className="text-brand-silver text-xs uppercase tracking-wide">Room Fee</span><br />{fmt$(s.room_fee)}</span>
              )}
            </div>

            {s.notes && (
              <p className="text-sm text-brand-silver leading-relaxed">{s.notes}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Menus section ─────────────────────────────────────────────────────────────

function MenusSection({ menus }: { menus: VendorMenu[] }) {
  if (!menus.length) return null;
  return (
    <section>
      <SectionHead label="Menus" />
      <div className="space-y-10 print:space-y-6">
        {menus.map(menu => (
          <div key={menu.id} className="print:break-inside-avoid-page">
            {/* Menu header */}
            <div className="flex items-baseline gap-3 flex-wrap mb-1">
              <h3 className="font-serif text-xl text-brand-charcoal">{menu.name}</h3>
              {menu.price_per_person != null && (
                <span className="text-brand-brown text-sm font-medium">{fmt$(menu.price_per_person)} per person</span>
              )}
            </div>
            {menu.description && (
              <p className="text-sm text-brand-silver mb-4 leading-relaxed">{menu.description}</p>
            )}

            {/* Courses */}
            <div className="space-y-5 pl-1 print:space-y-3">
              {menu.courses.map(course => (
                <div key={course.id}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[11px] uppercase tracking-[0.15em] font-medium text-brand-brown">
                      {course.name}
                    </span>
                    {course.selection_rule && (
                      <span className="text-[11px] text-brand-silver italic">{course.selection_rule}</span>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {course.items.map(item => (
                      <li key={item.id} className="flex items-start gap-3 text-sm">
                        <span className="text-brand-copper mt-0.5 flex-shrink-0">·</span>
                        <span className="flex-1 text-brand-charcoal/90">
                          {item.name}
                          {item.description && (
                            <span className="text-brand-silver ml-1 text-xs">— {item.description}</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1 flex-shrink-0">
                          {item.dietary_tags?.map(tag => (
                            <DietaryPill key={tag} tag={tag} />
                          ))}
                          {item.price != null && (
                            <span className="text-xs text-brand-silver ml-1">{fmt$(item.price)}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Bar section ───────────────────────────────────────────────────────────────

function BarSection({ barOptions }: { barOptions: BarOption[] }) {
  if (!barOptions.length) return null;
  return (
    <section>
      <SectionHead label="Bar Options" />
      <div className="space-y-8 print:space-y-5">
        {barOptions.map(opt => (
          <div key={opt.id} className="print:break-inside-avoid">
            <div className="flex items-baseline gap-3 flex-wrap mb-1">
              <h3 className="font-serif text-xl text-brand-charcoal">{opt.name}</h3>
              {fmtBarPrice(opt) && (
                <span className="text-brand-brown text-sm font-medium">{fmtBarPrice(opt)}</span>
              )}
            </div>
            {opt.description && (
              <p className="text-sm text-brand-silver mb-4 leading-relaxed">{opt.description}</p>
            )}

            {opt.categories.length > 0 && (
              <div className="border border-brand-cream rounded-lg overflow-hidden">
                {opt.categories.map((cat, i) => (
                  <div
                    key={cat.id}
                    className={`flex gap-4 px-4 py-2.5 text-sm ${i % 2 === 0 ? 'bg-brand-offwhite' : 'bg-white'}`}
                  >
                    <span className="text-[11px] uppercase tracking-[0.12em] text-brand-brown font-medium w-24 flex-shrink-0 pt-0.5">
                      {cat.name}
                    </span>
                    <span className="text-brand-charcoal/80">
                      {cat.brands.join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {opt.notes && (
              <p className="mt-3 text-sm text-brand-silver italic leading-relaxed">{opt.notes}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Inclusions section ────────────────────────────────────────────────────────

function InclusionsSection({ inclusions }: { inclusions: VendorInclusion[] }) {
  if (!inclusions.length) return null;
  return (
    <section className="print:break-inside-avoid">
      <SectionHead label="What&apos;s Included" />
      <ul className="columns-1 md:columns-2 gap-8 space-y-2 print:columns-2">
        {inclusions.map(inc => (
          <li key={inc.id} className="flex items-start gap-3 break-inside-avoid text-sm text-brand-charcoal/85">
            <span className="text-brand-copper mt-0.5 flex-shrink-0 text-base leading-none">✦</span>
            <span>{inc.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Notes section ─────────────────────────────────────────────────────────────

function NotesSection({ notes }: { notes: string }) {
  if (!notes.trim()) return null;
  return (
    <section className="print:break-inside-avoid">
      <SectionHead label="Notes" />
      <p className="text-sm text-brand-charcoal/80 leading-relaxed whitespace-pre-wrap">{notes}</p>
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  venue: DbVenueWithSpaces;
  menus: VendorMenu[];
  barOptions: BarOption[];
  inclusions: VendorInclusion[];
  photos: VendorPhoto[];
}

export default function VendorBrochure({ venue, menus, barOptions, inclusions, photos }: Props) {
  const typeLabel = VENDOR_TYPE_LABELS[venue.vendor_type] ?? venue.vendor_type;
  const locationParts = [venue.city, venue.state].filter(Boolean).join(', ');
  const hasContent = menus.length > 0 || barOptions.length > 0 || inclusions.length > 0 || venue.profile_notes;

  return (
    <div className="brochure-root bg-white">
      {/* Print action — hidden when actually printing */}
      <div className="brochure-toolbar flex justify-end mb-6 print:hidden">
        <PrintButton />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="mb-10 print:mb-6 pb-8 print:pb-4 border-b border-brand-cream">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <span className="text-[11px] uppercase tracking-[0.2em] text-brand-brown border border-brand-cream px-3 py-1 rounded-full">
            {typeLabel}
          </span>
          {venue.market && (
            <span className="text-xs text-brand-silver tracking-wide">{venue.market}</span>
          )}
        </div>

        <h1 className="font-serif text-5xl md:text-6xl font-light text-brand-charcoal leading-none tracking-wide mb-4 print:text-4xl">
          {venue.name}
        </h1>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-brand-silver">
          {locationParts && <span>{locationParts}</span>}
          {venue.address && <span>{venue.address}{venue.zip ? ` ${venue.zip}` : ''}</span>}
        </div>

        {(venue.contact_name || venue.contact_email || venue.contact_phone || venue.website) && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-brand-silver mt-2">
            {venue.contact_name && (
              <span className="text-brand-charcoal/70">
                {venue.contact_name}
                {venue.contact_title && <span className="text-brand-silver"> · {venue.contact_title}</span>}
              </span>
            )}
            {venue.contact_email && (
              <a href={`mailto:${venue.contact_email}`} className="hover:text-brand-brown transition-colors print:no-underline">
                {venue.contact_email}
              </a>
            )}
            {venue.contact_phone && (
              <a href={`tel:${venue.contact_phone}`} className="hover:text-brand-brown transition-colors print:no-underline">
                {formatPhone(venue.contact_phone)}
              </a>
            )}
            {venue.website && (
              <a
                href={venue.website.startsWith('http') ? venue.website : `https://${venue.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand-brown transition-colors print:no-underline"
              >
                {venue.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        )}
      </header>

      {/* ── Body sections ───────────────────────────────────────────────── */}
      <div className="space-y-10 print:space-y-6">
        {photos.length > 0 && (
          <>
            <PhotoGrid photos={photos} />
            <Divider />
          </>
        )}

        {venue.spaces.length > 0 && (
          <>
            <SpacesSection spaces={venue.spaces} />
            <Divider />
          </>
        )}

        {hasContent && (
          <div className="space-y-10 print:space-y-6">
            {menus.length > 0 && (
              <>
                <MenusSection menus={menus} />
                {(barOptions.length > 0 || inclusions.length > 0 || !!venue.profile_notes) && <Divider />}
              </>
            )}
            {barOptions.length > 0 && (
              <>
                <BarSection barOptions={barOptions} />
                {(inclusions.length > 0 || !!venue.profile_notes) && <Divider />}
              </>
            )}
            {inclusions.length > 0 && (
              <>
                <InclusionsSection inclusions={inclusions} />
                {!!venue.profile_notes && <Divider />}
              </>
            )}
            {!!venue.profile_notes && (
              <NotesSection notes={venue.profile_notes} />
            )}
          </div>
        )}

        {!photos.length && !venue.spaces.length && !hasContent && (
          <div className="py-16 text-center">
            <p className="text-brand-silver text-sm">No profile content yet.</p>
            <p className="text-brand-silver/60 text-xs mt-1">Add menus, photos, and spaces in Edit mode.</p>
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="mt-12 pt-6 border-t border-brand-cream text-center print:mt-8 print:pt-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand-copper">QC Event Design</p>
      </div>
    </div>
  );
}
