'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ExtractedVendorProfile } from '@/lib/vendors/extractedVendorTypes';
import type { VendorMenu, BarOption } from '@/lib/vendors/profileTypes';
import { parseMenus, parseBarOptions, parseInclusions } from '@/lib/vendors/profileTypes';
import { createVenue } from '@/app/(programs)/venues/actions';
import { applyVendorExtraction } from '@/app/(programs)/venues/actions';
import type { ApplyVendorSection } from '@/app/(programs)/venues/actions';
import type { DbVenue } from '@/lib/supabase/queries';

interface Props {
  profile: ExtractedVendorProfile;
  vendors: DbVenue[];
  onBack: () => void;
}

type Mode = 'create' | 'update';
type ApplySection = ApplyVendorSection;

function FieldRow({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-brand-silver w-28 shrink-0">{label}</span>
      <span className="text-brand-charcoal break-all">{value}</span>
    </div>
  );
}

function SectionCheckbox({
  id, checked, onChange, label, count,
}: { id: ApplySection; checked: boolean; onChange: (id: ApplySection, v: boolean) => void; label: string; count?: number }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(id, e.target.checked)}
        className="accent-brand-brown"
      />
      <span className="text-sm font-medium text-brand-charcoal">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-brand-silver">({count})</span>
      )}
    </label>
  );
}

function MenuPreview({ menu }: { menu: VendorMenu }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-brand-silver/20 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 bg-brand-cream/30 text-left"
      >
        <div>
          <span className="text-sm font-medium text-brand-charcoal">{menu.name}</span>
          {menu.price_per_person != null && (
            <span className="ml-2 text-xs text-brand-silver">${menu.price_per_person}/pp</span>
          )}
        </div>
        <span className="text-brand-silver text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 py-2 space-y-1.5">
          {menu.courses.map((c) => (
            <div key={c.id}>
              <div className="text-xs font-semibold text-brand-charcoal/70 uppercase tracking-wide">{c.name}</div>
              {c.items.map((it) => (
                <div key={it.id} className="text-xs text-brand-charcoal pl-2">
                  {it.name}
                  {it.price != null && <span className="text-brand-silver ml-1">${it.price}</span>}
                  {it.dietary_tags?.map((t) => (
                    <span key={t} className="ml-1 text-[10px] text-emerald-700 border border-emerald-200 bg-emerald-50 rounded px-0.5">{t}</span>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BarPreview({ bar }: { bar: BarOption }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-brand-silver/20 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 bg-brand-cream/30 text-left"
      >
        <div>
          <span className="text-sm font-medium text-brand-charcoal">{bar.name}</span>
          {bar.price_per_person != null && (
            <span className="ml-2 text-xs text-brand-silver">${bar.price_per_person}/pp</span>
          )}
        </div>
        <span className="text-brand-silver text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && bar.categories.length > 0 && (
        <div className="px-3 py-2 space-y-1">
          {bar.categories.map((cat) => (
            <div key={cat.id}>
              <span className="text-xs font-medium text-brand-charcoal/70">{cat.name}: </span>
              <span className="text-xs text-brand-silver">{cat.brands.join(', ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────

export default function VendorExtractionReview({ profile, vendors, onBack }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('create');

  // Create mode state
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [dupId, setDupId] = useState<string | null>(null);
  const [dupName, setDupName] = useState<string | null>(null);
  const [dupIsWarning, setDupIsWarning] = useState(false);

  // Update mode state
  const [vendorSearch, setVendorSearch] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [checkedSections, setCheckedSections] = useState<Set<ApplySection>>(
    new Set(['basics', 'spaces', 'menus', 'bar_options', 'inclusions'] as ApplySection[])
  );
  const [updatePending, setUpdatePending] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === selectedVendorId) ?? null,
    [vendors, selectedVendorId]
  );

  const filteredVendors = useMemo(() => {
    if (!vendorSearch.trim()) return vendors.slice(0, 20);
    const q = vendorSearch.toLowerCase();
    return vendors.filter((v) => v.name.toLowerCase().includes(q)).slice(0, 20);
  }, [vendors, vendorSearch]);

  function toggleSection(section: ApplySection, value: boolean) {
    setCheckedSections((prev) => {
      const next = new Set(prev);
      if (value) next.add(section); else next.delete(section);
      return next;
    });
  }

  async function handleCreate(skipNameCheck = false) {
    if (!profile.name) { setCreateError('Vendor name is required — edit it above.'); return; }
    setCreatePending(true);
    setCreateError(null);
    setDupId(null);
    setDupName(null);
    setDupIsWarning(false);

    const result = await createVenue({
      name: profile.name,
      address: profile.address ?? null,
      city: profile.city ?? null,
      state: profile.state ?? null,
      market: profile.market ?? null,
      website: profile.website ?? null,
      contact_name: profile.contact_name ?? null,
      contact_title: profile.contact_title ?? null,
      contact_email: profile.contact_email ?? null,
      contact_phone: profile.contact_phone ?? null,
      skipNameCheck,
    });

    if ('id' in result) {
      // Apply menus, bar_options, inclusions, and spaces to the newly created vendor
      const sectionsToApply: ApplySection[] = [];
      if (profile.menus.length > 0) sectionsToApply.push('menus');
      if (profile.bar_options.length > 0) sectionsToApply.push('bar_options');
      if (profile.inclusions.length > 0) sectionsToApply.push('inclusions');
      if (profile.spaces.length > 0) sectionsToApply.push('spaces');
      if (sectionsToApply.length > 0) {
        await applyVendorExtraction(result.id, profile, sectionsToApply);
      }
      setCreatePending(false);
      router.push(`/venues/${result.id}`);
    } else {
      setCreatePending(false);
      setCreateError(result.error);
      if (result.existingId) { setDupId(result.existingId); setDupName(result.existingName ?? null); }
      if (result.isWarning) setDupIsWarning(true);
    }
  }

  async function handleUpdate() {
    if (!selectedVendorId) return;
    const sections = [...checkedSections];
    if (sections.length === 0) { setUpdateError('Select at least one section to apply.'); return; }
    setUpdatePending(true);
    setUpdateError(null);
    const { error } = await applyVendorExtraction(selectedVendorId, profile, sections);
    setUpdatePending(false);
    if (error) { setUpdateError(error); return; }
    router.push(`/venues/${selectedVendorId}`);
  }

  const currentMenus = selectedVendor ? parseMenus(selectedVendor.menus) : [];
  const currentBars  = selectedVendor ? parseBarOptions(selectedVendor.bar_options) : [];
  const currentInclusions = selectedVendor ? parseInclusions(selectedVendor.inclusions) : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-charcoal">
            Review extracted vendor data
          </h2>
          <p className="text-xs text-brand-silver mt-0.5">
            Verify the fields below before creating or updating a vendor profile.
          </p>
        </div>
        <button onClick={onBack} className="text-xs text-brand-silver hover:text-brand-charcoal border border-brand-silver/20 rounded px-3 py-1.5 hover:bg-brand-cream/40">
          ← Back
        </button>
      </div>

      {/* Extraction summary */}
      <div className="rounded-lg border border-brand-silver/20 p-4 space-y-1.5 bg-brand-cream/20">
        <p className="text-xs font-semibold text-brand-charcoal uppercase tracking-wide mb-2">Extracted fields</p>
        <FieldRow label="Name"         value={profile.name} />
        <FieldRow label="Address"      value={profile.address} />
        <FieldRow label="City"         value={profile.city} />
        <FieldRow label="State"        value={profile.state} />
        <FieldRow label="Market"       value={profile.market} />
        <FieldRow label="Website"      value={profile.website} />
        <FieldRow label="Contact"      value={profile.contact_name} />
        <FieldRow label="Title"        value={profile.contact_title} />
        <FieldRow label="Email"        value={profile.contact_email} />
        <FieldRow label="Phone"        value={profile.contact_phone} />
        {profile.spaces.length > 0 && (
          <div className="text-sm">
            <span className="text-brand-silver w-28 inline-block">Spaces</span>
            <span className="text-brand-charcoal">{profile.spaces.map((s) => s.name).join(', ')}</span>
          </div>
        )}
        {profile.menus.length > 0 && (
          <div className="text-sm">
            <span className="text-brand-silver w-28 inline-block">Menus</span>
            <span className="text-brand-charcoal">{profile.menus.map((m) => m.name).join(', ')}</span>
          </div>
        )}
        {profile.bar_options.length > 0 && (
          <div className="text-sm">
            <span className="text-brand-silver w-28 inline-block">Bar options</span>
            <span className="text-brand-charcoal">{profile.bar_options.map((b) => b.name).join(', ')}</span>
          </div>
        )}
        {profile.inclusions.length > 0 && (
          <div className="text-sm">
            <span className="text-brand-silver w-28 inline-block">Inclusions</span>
            <span className="text-brand-charcoal">{profile.inclusions.slice(0, 3).join('; ')}{profile.inclusions.length > 3 ? ` +${profile.inclusions.length - 3} more` : ''}</span>
          </div>
        )}
        {!profile.name && !profile.city && profile.menus.length === 0 && (
          <p className="text-sm text-amber-700">Very little data was extracted — the document may not be a vendor profile, or may be mostly images.</p>
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 border-b border-brand-silver/20 pb-0">
        {(['create', 'update'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${mode === m ? 'border-brand-brown text-brand-brown' : 'border-transparent text-brand-silver hover:text-brand-charcoal'}`}
          >
            {m === 'create' ? 'Create new vendor' : 'Update existing vendor'}
          </button>
        ))}
      </div>

      {/* ── Create mode ── */}
      {mode === 'create' && (
        <div className="space-y-4">
          <p className="text-xs text-brand-silver">
            Creates a new vendor with the extracted data. Runs standard duplicate checks (name + address).
          </p>

          {/* Extracted menus preview */}
          {profile.menus.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-brand-charcoal uppercase tracking-wide">Menus to import ({profile.menus.length})</p>
              {profile.menus.map((m) => <MenuPreview key={m.id} menu={m} />)}
            </div>
          )}

          {profile.bar_options.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-brand-charcoal uppercase tracking-wide">Bar options to import ({profile.bar_options.length})</p>
              {profile.bar_options.map((b) => <BarPreview key={b.id} bar={b} />)}
            </div>
          )}

          {createError && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 flex flex-wrap items-center gap-2">
              <span>{createError}</span>
              {dupId && (
                <a href={`/venues/${dupId}`} className="underline font-medium hover:text-amber-900">
                  View {dupName ?? 'that vendor'}
                </a>
              )}
              {dupIsWarning && (
                <button onClick={() => handleCreate(true)} className="underline font-medium hover:text-amber-900">
                  Create anyway
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => handleCreate(false)}
            disabled={createPending}
            className="w-full bg-brand-brown text-white py-2 rounded text-sm font-medium hover:bg-brand-brown/90 disabled:opacity-50"
          >
            {createPending ? 'Creating…' : 'Create vendor'}
          </button>
        </div>
      )}

      {/* ── Update mode ── */}
      {mode === 'update' && (
        <div className="space-y-4">
          <p className="text-xs text-brand-silver">
            Pick an existing vendor, choose which extracted sections to apply. Unchecked sections keep current data. Spaces are always added (never replaced).
          </p>

          {/* Vendor search picker */}
          <div>
            <label className="block text-xs text-brand-silver mb-1">Search vendors</label>
            <input
              value={vendorSearch}
              onChange={(e) => { setVendorSearch(e.target.value); setSelectedVendorId(null); }}
              placeholder="Type to search…"
              className="w-full border border-brand-silver/30 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
            />
            {!selectedVendorId && filteredVendors.length > 0 && (
              <div className="border border-brand-silver/20 rounded mt-1 max-h-48 overflow-y-auto">
                {filteredVendors.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => { setSelectedVendorId(v.id); setVendorSearch(v.name); }}
                    className="w-full text-left px-3 py-2 text-sm text-brand-charcoal hover:bg-brand-cream/40 flex items-center justify-between"
                  >
                    <span>{v.name}</span>
                    {v.market && <span className="text-xs text-brand-silver">{v.market}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Diff + section checkboxes — shown once vendor is selected */}
          {selectedVendor && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-brand-charcoal">
                Updating: <span className="text-brand-brown">{selectedVendor.name}</span>
              </p>

              <div className="border border-brand-silver/20 rounded-lg divide-y divide-brand-silver/10 overflow-hidden">
                {/* Basics */}
                <div className="p-3 space-y-2">
                  <SectionCheckbox id="basics" checked={checkedSections.has('basics')} onChange={toggleSection} label="Basics (name, address, contact)" />
                  {checkedSections.has('basics') && (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 pl-6 text-xs">
                      <div>
                        <p className="text-brand-silver font-medium mb-1">Current</p>
                        <p>{selectedVendor.contact_name || '—'}</p>
                        <p>{[selectedVendor.address, selectedVendor.city, selectedVendor.state].filter(Boolean).join(', ') || '—'}</p>
                      </div>
                      <div>
                        <p className="text-brand-brown font-medium mb-1">Extracted</p>
                        <p>{profile.contact_name || '—'}</p>
                        <p>{[profile.address, profile.city, profile.state].filter(Boolean).join(', ') || '—'}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Spaces */}
                {profile.spaces.length > 0 && (
                  <div className="p-3 space-y-2">
                    <SectionCheckbox id="spaces" checked={checkedSections.has('spaces')} onChange={toggleSection} label="Spaces" count={profile.spaces.length} />
                    {checkedSections.has('spaces') && (
                      <div className="pl-6 text-xs text-brand-silver">
                        Will add: {profile.spaces.map((s) => s.name).join(', ')}. Duplicate names are skipped.
                      </div>
                    )}
                  </div>
                )}

                {/* Menus */}
                {profile.menus.length > 0 && (
                  <div className="p-3 space-y-2">
                    <SectionCheckbox id="menus" checked={checkedSections.has('menus')} onChange={toggleSection} label="Menus" count={profile.menus.length} />
                    {checkedSections.has('menus') && (
                      <div className="grid grid-cols-2 gap-x-6 pl-6 text-xs">
                        <div>
                          <p className="text-brand-silver font-medium mb-1">Current ({currentMenus.length})</p>
                          {currentMenus.length === 0 ? <p className="text-brand-silver">None</p> : currentMenus.map((m) => <p key={m.id}>{m.name}</p>)}
                        </div>
                        <div>
                          <p className="text-brand-brown font-medium mb-1">Will add ({profile.menus.length})</p>
                          {profile.menus.map((m) => <p key={m.id}>{m.name}</p>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Bar options */}
                {profile.bar_options.length > 0 && (
                  <div className="p-3 space-y-2">
                    <SectionCheckbox id="bar_options" checked={checkedSections.has('bar_options')} onChange={toggleSection} label="Bar options" count={profile.bar_options.length} />
                    {checkedSections.has('bar_options') && (
                      <div className="grid grid-cols-2 gap-x-6 pl-6 text-xs">
                        <div>
                          <p className="text-brand-silver font-medium mb-1">Current ({currentBars.length})</p>
                          {currentBars.length === 0 ? <p className="text-brand-silver">None</p> : currentBars.map((b) => <p key={b.id}>{b.name}</p>)}
                        </div>
                        <div>
                          <p className="text-brand-brown font-medium mb-1">Will add ({profile.bar_options.length})</p>
                          {profile.bar_options.map((b) => <p key={b.id}>{b.name}</p>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Inclusions */}
                {profile.inclusions.length > 0 && (
                  <div className="p-3 space-y-2">
                    <SectionCheckbox id="inclusions" checked={checkedSections.has('inclusions')} onChange={toggleSection} label="Inclusions" count={profile.inclusions.length} />
                    {checkedSections.has('inclusions') && (
                      <div className="grid grid-cols-2 gap-x-6 pl-6 text-xs">
                        <div>
                          <p className="text-brand-silver font-medium mb-1">Current ({currentInclusions.length})</p>
                          {currentInclusions.length === 0 ? <p className="text-brand-silver">None</p> : currentInclusions.slice(0, 3).map((i) => <p key={i.id}>{i.text}</p>)}
                        </div>
                        <div>
                          <p className="text-brand-brown font-medium mb-1">Will add ({profile.inclusions.length})</p>
                          {profile.inclusions.slice(0, 3).map((inc, i) => <p key={i}>{inc}</p>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {updateError && (
                <p className="text-xs text-red-600">{updateError}</p>
              )}

              <button
                onClick={handleUpdate}
                disabled={updatePending || checkedSections.size === 0}
                className="w-full bg-brand-brown text-white py-2 rounded text-sm font-medium hover:bg-brand-brown/90 disabled:opacity-50"
              >
                {updatePending ? 'Applying…' : `Apply ${checkedSections.size} section${checkedSections.size !== 1 ? 's' : ''} to ${selectedVendor.name}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
