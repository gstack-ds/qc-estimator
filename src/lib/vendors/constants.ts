// Vendor directory constants — server-free, safe to import in client components.

export type VendorType = 'venue' | 'restaurant' | 'tour' | 'transportation' | 'entertainment' | 'decor';

export const VENDOR_TYPES: { value: VendorType; label: string }[] = [
  { value: 'venue',          label: 'Venue' },
  { value: 'restaurant',     label: 'Restaurant' },
  { value: 'tour',           label: 'Tour' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'entertainment',  label: 'Entertainment' },
  { value: 'decor',          label: 'Decor Vendor' },
];

// Types shown in the estimate venue picker
export const ESTIMATE_PICKER_TYPES: VendorType[] = ['venue', 'restaurant'];

// Types that have meaningful spaces/rooms (for UI hints)
export const SPACE_SUPPORTING_TYPES: VendorType[] = ['venue', 'restaurant'];

export type SpacePrivacyTag = 'private' | 'semi_private' | 'main_dining';

export const PRIVACY_TAG_OPTIONS: { value: SpacePrivacyTag; label: string }[] = [
  { value: 'private',      label: 'Private' },
  { value: 'semi_private', label: 'Semi-Private' },
  { value: 'main_dining',  label: 'Main Dining' },
];
