import type { ExtractedMenuItem } from '@/app/(programs)/programs/[id]/estimates/actions';
import type { MenuCourse, MenuOption } from '@/types/slideCopy';

export function extractedMenuToMenuCourses(items: ExtractedMenuItem[]): MenuCourse[] {
  return items
    .filter((item) => item.category === 'food' || item.category === 'alcohol' || item.category === 'na_beverage')
    .map((item): MenuCourse => {
      if (item.packageOptions) {
        const options: MenuOption[] = item.packageOptions.options.map((pkg) => ({
          name: pkg.name,
          description: pkg.description,
          tags: [],
          selected: false,
          locked: false,
        }));
        return { name: item.packageOptions.label, selectionRule: 'choose 1', maxSelections: 1, scenario: 'needs_selection', options };
      }
      const scenario: 'final' | 'needs_selection' = item.needsSelection ? 'needs_selection' : 'final';
      const options: MenuOption[] = item.options?.map((o) => ({
        name: o.name,
        tags: o.tags ?? [],
        description: o.description,
        selected: false,
        locked: false,
      })) ?? (item.selections ?? []).map((s) => ({
        name: s,
        tags: item.tags ?? [],
        selected: !item.needsSelection,
        locked: !item.needsSelection,
      }));
      return {
        name: item.name,
        selectionRule: item.selectionRule,
        maxSelections: item.maxSelections,
        scenario,
        options,
      };
    });
}
