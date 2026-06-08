'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  parseMenus, parseBarOptions, parseInclusions,
  DIETARY_TAGS, DIETARY_LABELS,
  type VendorMenu, type VendorMenuCourse, type VendorMenuItem,
  type BarOption, type BarCategory,
  type VendorInclusion,
} from '@/lib/vendors/profileTypes';
import { saveVendorProfile } from '@/app/(programs)/venues/profileActions';

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return crypto.randomUUID(); }

function fmt(n: number | null | undefined) {
  if (n == null) return '';
  return String(n);
}

function parseNum(s: string): number | null {
  const v = parseFloat(s);
  return isNaN(v) ? null : v;
}

// ── SaveStatus banner ─────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function SaveBanner({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  const cls = {
    saving: 'text-brand-silver',
    saved:  'text-green-600',
    error:  'text-red-600',
  }[status];
  const label = { saving: 'Saving…', saved: 'Saved', error: 'Save failed' }[status];
  return <span className={`text-xs ${cls}`}>{label}</span>;
}

// ── Collapsible Section wrapper ───────────────────────────────────────────────

function Section({
  title, count, children, defaultOpen = true,
}: { title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-brand-silver/30 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-brand-offwhite hover:bg-brand-cream/40 transition-colors text-left"
      >
        <span className="text-sm font-medium text-brand-charcoal">
          {title}
          {count !== undefined && count > 0 && (
            <span className="ml-2 text-xs text-brand-silver">({count})</span>
          )}
        </span>
        <svg
          className={`h-4 w-4 text-brand-silver transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

// ── Dietary tag toggles ───────────────────────────────────────────────────────

function DietaryTagRow({
  selected, onChange,
}: { selected: string[]; onChange: (tags: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {DIETARY_TAGS.map(tag => {
        const on = selected.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            title={DIETARY_LABELS[tag]}
            onClick={() => onChange(on ? selected.filter(t => t !== tag) : [...selected, tag])}
            className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
              on
                ? 'bg-brand-charcoal text-white border-brand-charcoal'
                : 'border-brand-silver/40 text-brand-slate hover:border-brand-charcoal'
            }`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

// ── Menus Editor ──────────────────────────────────────────────────────────────

function MenusEditor({
  menus, onChange,
}: { menus: VendorMenu[]; onChange: (m: VendorMenu[]) => void }) {
  function updateMenu(menuId: string, updater: (m: VendorMenu) => VendorMenu) {
    onChange(menus.map(m => m.id === menuId ? updater(m) : m));
  }
  function updateCourse(menuId: string, cId: string, updater: (c: VendorMenuCourse) => VendorMenuCourse) {
    updateMenu(menuId, m => ({ ...m, courses: m.courses.map(c => c.id === cId ? updater(c) : c) }));
  }
  function updateItem(menuId: string, cId: string, iId: string, updater: (i: VendorMenuItem) => VendorMenuItem) {
    updateCourse(menuId, cId, c => ({ ...c, items: c.items.map(i => i.id === iId ? updater(i) : i) }));
  }

  const addMenu = () => onChange([...menus, { id: uid(), name: '', courses: [] }]);
  const delMenu = (id: string) => onChange(menus.filter(m => m.id !== id));
  const addCourse = (menuId: string) => updateMenu(menuId, m => ({ ...m, courses: [...m.courses, { id: uid(), name: '', items: [] }] }));
  const delCourse = (menuId: string, cId: string) => updateMenu(menuId, m => ({ ...m, courses: m.courses.filter(c => c.id !== cId) }));
  const addItem = (menuId: string, cId: string) => updateCourse(menuId, cId, c => ({ ...c, items: [...c.items, { id: uid(), name: '', dietary_tags: [] }] }));
  const delItem = (menuId: string, cId: string, iId: string) => updateCourse(menuId, cId, c => ({ ...c, items: c.items.filter(i => i.id !== iId) }));

  const inp = 'w-full border border-brand-silver/40 rounded px-2 py-1 text-sm bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-brown';

  return (
    <div className="space-y-4">
      {menus.map(menu => (
        <div key={menu.id} className="border border-brand-silver/20 rounded-lg p-4 space-y-3">
          {/* Menu header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
            <input className={inp} placeholder="Menu name (e.g. 4-Course Dinner)" value={menu.name}
              onChange={e => updateMenu(menu.id, m => ({ ...m, name: e.target.value }))} />
            <input className="border border-brand-silver/40 rounded px-2 py-1 text-sm bg-white w-28 text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-brown"
              placeholder="$/person" type="number" min="0" step="0.01"
              value={fmt(menu.price_per_person)}
              onChange={e => updateMenu(menu.id, m => ({ ...m, price_per_person: parseNum(e.target.value) }))} />
            <button type="button" onClick={() => delMenu(menu.id)}
              className="text-brand-silver hover:text-red-500 text-xs transition-colors">✕</button>
          </div>
          <input className={inp} placeholder="Description (optional)"
            value={menu.description ?? ''}
            onChange={e => updateMenu(menu.id, m => ({ ...m, description: e.target.value }))} />

          {/* Courses */}
          {menu.courses.map(course => (
            <div key={course.id} className="ml-4 border-l-2 border-brand-cream pl-4 space-y-2">
              <div className="flex gap-2 items-center">
                <input className={inp} placeholder="Course name (e.g. Entrée)" value={course.name}
                  onChange={e => updateCourse(menu.id, course.id, c => ({ ...c, name: e.target.value }))} />
                <input className="border border-brand-silver/40 rounded px-2 py-1 text-sm bg-white w-32 text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-brown"
                  placeholder="Choose rule"
                  value={course.selection_rule ?? ''}
                  onChange={e => updateCourse(menu.id, course.id, c => ({ ...c, selection_rule: e.target.value }))} />
                <button type="button" onClick={() => delCourse(menu.id, course.id)}
                  className="text-brand-silver hover:text-red-500 text-xs transition-colors flex-shrink-0">✕</button>
              </div>

              {/* Items */}
              {course.items.map(item => (
                <div key={item.id} className="ml-4 space-y-1">
                  <div className="flex gap-2 items-center">
                    <input className={inp} placeholder="Item name" value={item.name}
                      onChange={e => updateItem(menu.id, course.id, item.id, i => ({ ...i, name: e.target.value }))} />
                    <input className="border border-brand-silver/40 rounded px-2 py-1 text-sm bg-white w-24 text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-brown"
                      placeholder="Price" type="number" min="0" step="0.01"
                      value={fmt(item.price)}
                      onChange={e => updateItem(menu.id, course.id, item.id, i => ({ ...i, price: parseNum(e.target.value) }))} />
                    <button type="button" onClick={() => delItem(menu.id, course.id, item.id)}
                      className="text-brand-silver hover:text-red-500 text-xs transition-colors flex-shrink-0">✕</button>
                  </div>
                  <input className={inp} placeholder="Description (optional)" value={item.description ?? ''}
                    onChange={e => updateItem(menu.id, course.id, item.id, i => ({ ...i, description: e.target.value }))} />
                  <DietaryTagRow
                    selected={item.dietary_tags ?? []}
                    onChange={tags => updateItem(menu.id, course.id, item.id, i => ({ ...i, dietary_tags: tags as typeof DIETARY_TAGS[number][] }))}
                  />
                </div>
              ))}
              <button type="button" onClick={() => addItem(menu.id, course.id)}
                className="text-xs text-brand-brown hover:text-brand-charcoal transition-colors ml-4">
                + Add item
              </button>
            </div>
          ))}
          <button type="button" onClick={() => addCourse(menu.id)}
            className="text-xs text-brand-brown hover:text-brand-charcoal transition-colors">
            + Add course
          </button>
        </div>
      ))}
      <button type="button" onClick={addMenu}
        className="text-sm text-brand-brown hover:text-brand-charcoal transition-colors font-medium">
        + Add menu
      </button>
    </div>
  );
}

// ── Bar Options Editor ────────────────────────────────────────────────────────

function BarEditor({ options, onChange }: { options: BarOption[]; onChange: (o: BarOption[]) => void }) {
  function updateOption(id: string, updater: (o: BarOption) => BarOption) {
    onChange(options.map(o => o.id === id ? updater(o) : o));
  }
  function updateCat(optId: string, catId: string, updater: (c: BarCategory) => BarCategory) {
    updateOption(optId, o => ({ ...o, categories: o.categories.map(c => c.id === catId ? updater(c) : c) }));
  }

  const addOption = () => onChange([...options, { id: uid(), name: '', categories: [] }]);
  const delOption = (id: string) => onChange(options.filter(o => o.id !== id));
  const addCat = (optId: string) => updateOption(optId, o => ({ ...o, categories: [...o.categories, { id: uid(), name: '', brands: [] }] }));
  const delCat = (optId: string, catId: string) => updateOption(optId, o => ({ ...o, categories: o.categories.filter(c => c.id !== catId) }));

  const inp = 'w-full border border-brand-silver/40 rounded px-2 py-1 text-sm bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-brown';

  return (
    <div className="space-y-4">
      {options.map(opt => (
        <div key={opt.id} className="border border-brand-silver/20 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
            <input className={inp} placeholder="Package name (e.g. Premium Open Bar)" value={opt.name}
              onChange={e => updateOption(opt.id, o => ({ ...o, name: e.target.value }))} />
            <input className="border border-brand-silver/40 rounded px-2 py-1 text-sm bg-white w-28 text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-brown"
              placeholder="$/person" type="number" min="0" step="0.01"
              value={fmt(opt.price_per_person)}
              onChange={e => updateOption(opt.id, o => ({ ...o, price_per_person: parseNum(e.target.value) }))} />
            <button type="button" onClick={() => delOption(opt.id)}
              className="text-brand-silver hover:text-red-500 text-xs transition-colors">✕</button>
          </div>
          <input className={inp} placeholder="Description (optional)" value={opt.description ?? ''}
            onChange={e => updateOption(opt.id, o => ({ ...o, description: e.target.value }))} />

          {/* Categories */}
          {opt.categories.map(cat => (
            <div key={cat.id} className="ml-4 border-l-2 border-brand-cream pl-4 space-y-1">
              <div className="flex gap-2 items-center">
                <input className="border border-brand-silver/40 rounded px-2 py-1 text-sm bg-white w-32 text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-brown"
                  placeholder="Spirit (e.g. Vodka)"
                  value={cat.name}
                  onChange={e => updateCat(opt.id, cat.id, c => ({ ...c, name: e.target.value }))} />
                <input className={inp}
                  placeholder="Brands, comma-separated (e.g. Tito's, Sobieski)"
                  value={cat.brands.join(', ')}
                  onChange={e => updateCat(opt.id, cat.id, c => ({ ...c, brands: e.target.value.split(',').map(b => b.trim()).filter(Boolean) }))} />
                <button type="button" onClick={() => delCat(opt.id, cat.id)}
                  className="text-brand-silver hover:text-red-500 text-xs transition-colors flex-shrink-0">✕</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => addCat(opt.id)}
            className="text-xs text-brand-brown hover:text-brand-charcoal transition-colors">
            + Add spirit category
          </button>

          <textarea className={`${inp} h-16 resize-none`} placeholder="Notes (e.g. upgrade options, service hours)"
            value={opt.notes ?? ''}
            onChange={e => updateOption(opt.id, o => ({ ...o, notes: e.target.value }))} />
        </div>
      ))}
      <button type="button" onClick={addOption}
        className="text-sm text-brand-brown hover:text-brand-charcoal transition-colors font-medium">
        + Add bar package
      </button>
    </div>
  );
}

// ── Inclusions Editor ─────────────────────────────────────────────────────────

function InclusionsEditor({ inclusions, onChange }: { inclusions: VendorInclusion[]; onChange: (i: VendorInclusion[]) => void }) {
  const addInclusion = () => onChange([...inclusions, { id: uid(), text: '' }]);
  const del = (id: string) => onChange(inclusions.filter(i => i.id !== id));
  const update = (id: string, text: string) => onChange(inclusions.map(i => i.id === id ? { ...i, text } : i));

  return (
    <div className="space-y-2">
      {inclusions.map(inc => (
        <div key={inc.id} className="flex gap-2 items-center">
          <span className="text-brand-silver text-sm">•</span>
          <input
            className="flex-1 border border-brand-silver/40 rounded px-2 py-1 text-sm bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-brown"
            placeholder="e.g. Tables, chairs, and linens included"
            value={inc.text}
            onChange={e => update(inc.id, e.target.value)}
          />
          <button type="button" onClick={() => del(inc.id)}
            className="text-brand-silver hover:text-red-500 text-xs transition-colors">✕</button>
        </div>
      ))}
      <button type="button" onClick={addInclusion}
        className="text-sm text-brand-brown hover:text-brand-charcoal transition-colors font-medium">
        + Add inclusion
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  vendorId: string;
  initialMenus: unknown;
  initialBarOptions: unknown;
  initialInclusions: unknown;
  initialProfileNotes: string | null;
}

export default function VendorProfileSection({
  vendorId, initialMenus, initialBarOptions, initialInclusions, initialProfileNotes,
}: Props) {
  const [menus, setMenus] = useState<VendorMenu[]>(() => parseMenus(initialMenus));
  const [barOptions, setBarOptions] = useState<BarOption[]>(() => parseBarOptions(initialBarOptions));
  const [inclusions, setInclusions] = useState<VendorInclusion[]>(() => parseInclusions(initialInclusions));
  const [notes, setNotes] = useState(initialProfileNotes ?? '');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ menus, barOptions, inclusions, notes });
  latestRef.current = { menus, barOptions, inclusions, notes };

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      const { menus: m, barOptions: b, inclusions: inc, notes: n } = latestRef.current;
      const result = await saveVendorProfile(vendorId, {
        menus: m, bar_options: b, inclusions: inc, profile_notes: n,
      });
      if (result.error) {
        setSaveStatus('error');
      } else {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    }, 1500);
  }, [vendorId]);

  function handleMenusChange(m: VendorMenu[]) { setMenus(m); scheduleSave(); }
  function handleBarChange(b: BarOption[]) { setBarOptions(b); scheduleSave(); }
  function handleInclusionsChange(i: VendorInclusion[]) { setInclusions(i); scheduleSave(); }
  function handleNotesChange(n: string) { setNotes(n); scheduleSave(); }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-serif text-brand-charcoal">Profile Content</h2>
        <SaveBanner status={saveStatus} />
      </div>
      <p className="text-xs text-brand-silver">
        Reference content for proposals and brochures. Does not affect pricing calculations.
      </p>

      <Section title="Menu Packages" count={menus.length}>
        <MenusEditor menus={menus} onChange={handleMenusChange} />
      </Section>

      <Section title="Bar Options" count={barOptions.length}>
        <BarEditor options={barOptions} onChange={handleBarChange} />
      </Section>

      <Section title="What's Included" count={inclusions.length}>
        <InclusionsEditor inclusions={inclusions} onChange={handleInclusionsChange} />
      </Section>

      <Section title="Profile Notes" defaultOpen={false}>
        <textarea
          className="w-full border border-brand-silver/40 rounded px-3 py-2 text-sm bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-brown resize-none h-24"
          placeholder="Freeform notes (parking, AV notes, policies, etc.)"
          value={notes}
          onChange={e => handleNotesChange(e.target.value)}
        />
      </Section>
    </div>
  );
}
