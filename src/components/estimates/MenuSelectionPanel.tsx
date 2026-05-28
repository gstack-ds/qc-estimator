'use client';
import type { MenuCourse, MenuOption } from '@/types/slideCopy';

interface Props {
  courses: MenuCourse[];
  onChange: (courses: MenuCourse[]) => void;
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span className="inline-block text-[9px] px-1 py-0 rounded border border-brand-copper/30 text-brand-copper/70 font-mono leading-4">
      {tag}
    </span>
  );
}

function CourseBlock({ course, index, onChange }: { course: MenuCourse; index: number; onChange: (c: MenuCourse) => void }) {
  const selectedCount = course.options.filter((o) => o.selected).length;
  const atMax = course.maxSelections !== undefined && selectedCount >= course.maxSelections;

  const handleToggle = (optIdx: number) => {
    if (course.options[optIdx].locked) return;
    const updated = course.options.map((o, i) => {
      if (i !== optIdx) return o;
      if (!o.selected && atMax) return o; // cap reached
      return { ...o, selected: !o.selected };
    });
    onChange({ ...course, options: updated });
  };

  const handleRadio = (optIdx: number) => {
    if (course.options[optIdx].locked) return;
    const updated = course.options.map((o, i) => ({ ...o, selected: i === optIdx }));
    onChange({ ...course, options: updated });
  };

  const isSingle = course.maxSelections === 1;

  return (
    <div className="border border-brand-copper/15 rounded bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-brand-offwhite border-b border-brand-copper/10">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-brand-charcoal">{course.name}</span>
          {course.scenario === 'needs_selection' && course.selectionRule && (
            <span className="text-[10px] text-brand-brown/70 italic">{course.selectionRule}</span>
          )}
          {course.scenario === 'final' && (
            <span className="text-[9px] text-green-700 bg-green-50 border border-green-200 px-1 rounded">Final</span>
          )}
        </div>
        {course.scenario === 'needs_selection' && course.maxSelections !== undefined && (
          <span className={`text-[10px] font-medium ${atMax ? 'text-brand-copper' : 'text-brand-charcoal/50'}`}>
            {selectedCount} of {course.maxSelections} selected
          </span>
        )}
      </div>
      <div className="divide-y divide-brand-copper/5">
        {course.options.map((opt, oi) => (
          <div
            key={oi}
            className={`flex items-start gap-2.5 px-3 py-1.5 ${
              opt.selected ? 'bg-brand-cream/40' : ''
            } ${opt.locked ? 'opacity-70' : 'cursor-pointer hover:bg-brand-cream/30'}`}
            onClick={() => {
              if (!opt.locked) {
                isSingle ? handleRadio(oi) : handleToggle(oi);
              }
            }}
          >
            {course.scenario === 'needs_selection' && (
              <div className="mt-0.5 flex-shrink-0">
                {isSingle ? (
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                    opt.selected ? 'border-brand-copper bg-brand-copper' : 'border-brand-copper/30'
                  }`}>
                    {opt.selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                ) : (
                  <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center ${
                    opt.selected ? 'border-brand-copper bg-brand-copper' : 'border-brand-copper/30'
                  } ${!opt.selected && atMax ? 'opacity-30' : ''}`}>
                    {opt.selected && <span className="text-white text-[9px] leading-none">✓</span>}
                  </div>
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-brand-charcoal">{opt.name}</span>
                {opt.tags?.map((t) => <TagPill key={t} tag={t} />)}
              </div>
              {opt.description && (
                <p className="text-[11px] text-brand-charcoal/50 mt-0.5 leading-relaxed">{opt.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MenuSelectionPanel({ courses, onChange }: Props) {
  if (courses.length === 0) return null;

  const handleCourseChange = (idx: number, updated: MenuCourse) => {
    const next = [...courses];
    next[idx] = updated;
    onChange(next);
  };

  const needsSelection = courses.filter((c) => c.scenario === 'needs_selection');
  const pending = needsSelection.filter((c) =>
    c.maxSelections !== undefined ? c.options.filter((o) => o.selected).length < c.maxSelections : false
  );

  return (
    <div className="space-y-2">
      {pending.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
          {pending.length} course{pending.length > 1 ? 's' : ''} still need{pending.length === 1 ? 's' : ''} selection.
        </div>
      )}
      {courses.map((course, i) => (
        <CourseBlock
          key={i}
          course={course}
          index={i}
          onChange={(c) => handleCourseChange(i, c)}
        />
      ))}
    </div>
  );
}
