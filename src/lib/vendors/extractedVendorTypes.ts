// Types for structured vendor-profile extraction from the Doc Reader.
// Server-free — safe to import in client components.

import type { VendorMenu, BarOption } from './profileTypes';
import { DIETARY_TAGS } from './profileTypes';

export interface ExtractedVendorSpace {
  name: string;
  capacity_seated?: number | null;
  capacity_standing?: number | null;
  fb_minimum?: number | null;
}

export interface ExtractedVendorProfile {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  market?: string;
  website?: string;
  contact_name?: string;
  contact_title?: string;
  contact_email?: string;
  contact_phone?: string;
  spaces: ExtractedVendorSpace[];
  menus: VendorMenu[];
  bar_options: BarOption[];
  inclusions: string[];
}

// ── Normalizer ───────────────────────────────────────────────────────────────
// Turns a raw Claude JSON blob into a valid ExtractedVendorProfile.
// Defensive: generates missing IDs, coerces types, filters bad values.

let _seq = 0;
function uid(prefix: string): string {
  return `${prefix}-${++_seq}-${Math.random().toString(36).slice(2, 7)}`;
}

function coerceNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return isFinite(n) ? n : null;
}

function coerceStr(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return undefined;
}

export function normalizeExtractedProfile(raw: unknown): ExtractedVendorProfile {
  if (typeof raw !== 'object' || raw === null) return emptyProfile();
  const r = raw as Record<string, unknown>;

  return {
    name:          coerceStr(r.name),
    address:       coerceStr(r.address),
    city:          coerceStr(r.city),
    state:         coerceStr(r.state),
    market:        coerceStr(r.market),
    website:       coerceStr(r.website),
    contact_name:  coerceStr(r.contact_name),
    contact_title: coerceStr(r.contact_title),
    contact_email: coerceStr(r.contact_email),
    contact_phone: coerceStr(r.contact_phone),
    spaces:        normalizeSpaces(r.spaces),
    menus:         normalizeMenus(r.menus),
    bar_options:   normalizeBarOptions(r.bar_options),
    inclusions:    normalizeInclusions(r.inclusions),
  };
}

export function emptyProfile(): ExtractedVendorProfile {
  return { spaces: [], menus: [], bar_options: [], inclusions: [] };
}

function normalizeSpaces(raw: unknown): ExtractedVendorSpace[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).flatMap((s) => {
    if (typeof s !== 'object' || s === null) return [];
    const sr = s as Record<string, unknown>;
    const name = coerceStr(sr.name);
    if (!name) return [];
    return [{
      name,
      capacity_seated:   coerceNum(sr.capacity_seated),
      capacity_standing: coerceNum(sr.capacity_standing),
      fb_minimum:        coerceNum(sr.fb_minimum),
    }];
  });
}

function normalizeMenus(raw: unknown): VendorMenu[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).flatMap((m) => {
    if (typeof m !== 'object' || m === null) return [];
    const mr = m as Record<string, unknown>;
    const name = coerceStr(mr.name);
    if (!name) return [];
    return [{
      id:             (coerceStr(mr.id) ?? uid('menu')),
      name,
      price_per_person: coerceNum(mr.price_per_person),
      description:    coerceStr(mr.description),
      courses:        normalizeCourses(mr.courses),
    }];
  });
}

function normalizeCourses(raw: unknown): VendorMenu['courses'] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).flatMap((c) => {
    if (typeof c !== 'object' || c === null) return [];
    const cr = c as Record<string, unknown>;
    const name = coerceStr(cr.name);
    if (!name) return [];
    return [{
      id:             coerceStr(cr.id) ?? uid('course'),
      name,
      selection_rule: coerceStr(cr.selection_rule),
      items:          normalizeCourseItems(cr.items),
    }];
  });
}

function normalizeCourseItems(raw: unknown): VendorMenu['courses'][number]['items'] {
  if (!Array.isArray(raw)) return [];
  const validDietaryTags = new Set<string>(DIETARY_TAGS);
  return (raw as unknown[]).flatMap((it) => {
    if (typeof it !== 'object' || it === null) return [];
    const itr = it as Record<string, unknown>;
    const name = coerceStr(itr.name);
    if (!name) return [];
    const rawTags = Array.isArray(itr.dietary_tags) ? itr.dietary_tags : [];
    const dietary_tags = (rawTags as unknown[]).filter((t): t is string => typeof t === 'string' && validDietaryTags.has(t)) as typeof DIETARY_TAGS[number][];
    return [{
      id:           coerceStr(itr.id) ?? uid('item'),
      name,
      description:  coerceStr(itr.description),
      dietary_tags: dietary_tags.length > 0 ? dietary_tags : undefined,
      price:        coerceNum(itr.price),
    }];
  });
}

function normalizeBarOptions(raw: unknown): BarOption[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).flatMap((b) => {
    if (typeof b !== 'object' || b === null) return [];
    const br = b as Record<string, unknown>;
    const name = coerceStr(br.name);
    if (!name) return [];
    return [{
      id:             coerceStr(br.id) ?? uid('bar'),
      name,
      price_per_person: coerceNum(br.price_per_person),
      description:    coerceStr(br.description),
      categories:     normalizeBarCategories(br.categories),
      notes:          coerceStr(br.notes),
    }];
  });
}

function normalizeBarCategories(raw: unknown): BarOption['categories'] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).flatMap((c) => {
    if (typeof c !== 'object' || c === null) return [];
    const cr = c as Record<string, unknown>;
    const name = coerceStr(cr.name);
    if (!name) return [];
    const brands = Array.isArray(cr.brands) ? (cr.brands as unknown[]).filter((b): b is string => typeof b === 'string') : [];
    return [{ id: coerceStr(cr.id) ?? uid('cat'), name, brands }];
  });
}

function normalizeInclusions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).flatMap((inc) => {
    if (typeof inc === 'string' && inc.trim()) return [inc.trim()];
    if (typeof inc === 'object' && inc !== null) {
      const text = (inc as Record<string, unknown>).text;
      if (typeof text === 'string' && text.trim()) return [text.trim()];
    }
    return [];
  });
}
