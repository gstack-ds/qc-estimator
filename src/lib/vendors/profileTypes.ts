// Vendor profile content types — server-free, safe to import in client components.
// These are display/brochure data; they do NOT feed the pricing engine.

export type PhotoTag = 'space' | 'food' | 'ambiance' | 'other';

export const PHOTO_TAG_OPTIONS: { value: PhotoTag; label: string }[] = [
  { value: 'space',    label: 'Space' },
  { value: 'food',     label: 'Food' },
  { value: 'ambiance', label: 'Ambiance' },
  { value: 'other',    label: 'Other' },
];

export const DIETARY_TAGS = ['V', 'VG', 'GF', 'DF', 'NF'] as const;
export type DietaryTag = (typeof DIETARY_TAGS)[number];

export const DIETARY_LABELS: Record<DietaryTag, string> = {
  V:  'Vegetarian',
  VG: 'Vegan',
  GF: 'Gluten-Free',
  DF: 'Dairy-Free',
  NF: 'Nut-Free',
};

export interface VendorMenuItem {
  id: string;
  name: string;
  description?: string;
  dietary_tags?: DietaryTag[];
  price?: number | null;
}

export interface VendorMenuCourse {
  id: string;
  name: string;
  selection_rule?: string;
  items: VendorMenuItem[];
}

export interface VendorMenu {
  id: string;
  name: string;
  price_per_person?: number | null;
  description?: string;
  courses: VendorMenuCourse[];
}

export interface BarCategory {
  id: string;
  name: string;
  brands: string[];
}

export interface BarOption {
  id: string;
  name: string;
  price_per_person?: number | null;
  description?: string;
  categories: BarCategory[];
  notes?: string;
}

export interface VendorInclusion {
  id: string;
  text: string;
}

export interface VendorPhoto {
  id: string;
  vendor_id: string;
  file_url: string;
  storage_path: string;
  caption: string | null;
  tag: PhotoTag;
  sort_order: number;
  created_at: string;
}

// ── Type guards for JSONB round-trip validation ──────────────────────────────

export function isVendorMenu(v: unknown): v is VendorMenu {
  return (
    typeof v === 'object' && v !== null &&
    typeof (v as VendorMenu).id === 'string' &&
    typeof (v as VendorMenu).name === 'string' &&
    Array.isArray((v as VendorMenu).courses)
  );
}

export function isBarOption(v: unknown): v is BarOption {
  return (
    typeof v === 'object' && v !== null &&
    typeof (v as BarOption).id === 'string' &&
    typeof (v as BarOption).name === 'string' &&
    Array.isArray((v as BarOption).categories)
  );
}

export function isVendorInclusion(v: unknown): v is VendorInclusion {
  return (
    typeof v === 'object' && v !== null &&
    typeof (v as VendorInclusion).id === 'string' &&
    typeof (v as VendorInclusion).text === 'string'
  );
}

// ── Safe parsers for JSONB blobs read from the database ─────────────────────

export function parseMenus(raw: unknown): VendorMenu[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).filter(isVendorMenu);
}

export function parseBarOptions(raw: unknown): BarOption[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).filter(isBarOption);
}

export function parseInclusions(raw: unknown): VendorInclusion[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).filter(isVendorInclusion);
}
