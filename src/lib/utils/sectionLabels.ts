import type { TaxBucket } from '@/types';

export interface SectionRef {
  taxBucket: TaxBucket;
  name: string;
}

export interface SectionTotal {
  id: string;
  name: string;
  taxBucket: TaxBucket;
  total: number;
  sortOrder: number;
}

export function labelForBucket(
  sections: SectionRef[],
  bucket: TaxBucket,
  fallback: string,
): string {
  const matching = sections.filter((s) => s.taxBucket === bucket);
  if (matching.length === 0) return fallback;
  return matching.map((s) => s.name).join(' / ');
}
