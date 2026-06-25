'use client';

import { useState, useRef, useEffect } from 'react';
import { parseFlexibleDate, formatDateDisplay } from '@/lib/leads/dateParse';

interface Props {
  // Canonical 'YYYY-MM-DD' (or null) owned by the parent.
  value: string | null;
  // Fires with a canonical 'YYYY-MM-DD' or null. Only called on a clean commit;
  // unparseable text is kept on screen (invalid ring) and never saved.
  onChange: (v: string | null) => void;
  // Fires when focus leaves the whole control after a CLEAN commit — lets a
  // click-to-edit cell (the table) drop back to its read view. Not called while
  // the field holds unparseable text (so the bad input stays visible to fix).
  onLeave?: () => void;
  label?: string;
  labelClassName?: string;
  placeholder?: string;
  className?: string;        // classes for the text input (borders/size/etc.)
  wrapperClassName?: string; // sizing/margins for the whole control
  autoFocus?: boolean;
  currentYear?: number;
  ariaLabel?: string;
}

export default function FlexibleDateInput({
  value,
  onChange,
  onLeave,
  label,
  labelClassName = 'block text-[10px] font-medium text-brand-silver/70 uppercase tracking-wide mb-0.5',
  placeholder = 'e.g. 5/11/2027',
  className = '',
  wrapperClassName = 'w-full',
  autoFocus,
  currentYear,
  ariaLabel,
}: Props) {
  const [text, setText] = useState(() => formatDateDisplay(value));
  const [invalid, setInvalid] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  // Set just before an Escape-triggered blur so handleBlur cancels instead of
  // committing (the blur fires synchronously, before the batched state flush).
  const escapingRef = useRef(false);

  // Reflect external value changes — but never while the user is typing, and
  // never when the field is showing unparseable text we promised to preserve.
  useEffect(() => {
    if (!focused && !invalid) setText(formatDateDisplay(value));
  }, [value, focused, invalid]);

  // Returns true on a clean commit (valid date or intentional clear).
  function commit(): boolean {
    const t = text.trim();
    if (t === '') {
      setInvalid(false);
      setText('');
      if (value !== null) onChange(null);
      return true;
    }
    const iso = parseFlexibleDate(t, currentYear);
    if (iso) {
      setInvalid(false);
      setText(formatDateDisplay(iso)); // show the parsed result (incl. assumed year)
      if (iso !== value) onChange(iso);
      return true;
    }
    setInvalid(true); // keep the raw text; do not save
    return false;
  }

  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    // Ignore focus moving between our own children (text input <-> picker button).
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    // Escape cancels: revert (already done in the key handler), don't commit/save.
    if (escapingRef.current) {
      escapingRef.current = false;
      setFocused(false);
      onLeave?.();
      return;
    }
    const ok = commit();
    setFocused(false);
    if (ok) onLeave?.();
  }

  function openPicker() {
    const el = pickerRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.click();
  }

  return (
    <div className={wrapperClassName} onBlur={handleBlur}>
      {label && <label className={labelClassName}>{label}</label>}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={text}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label={ariaLabel ?? label}
          aria-invalid={invalid || undefined}
          onFocus={() => setFocused(true)}
          onChange={(e) => { setText(e.target.value); if (invalid) setInvalid(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur(); }
            else if (e.key === 'Escape') { escapingRef.current = true; setText(formatDateDisplay(value)); setInvalid(false); inputRef.current?.blur(); }
          }}
          className={`${className} pr-7 ${invalid ? 'border-red-400 ring-1 ring-red-300' : ''}`}
        />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()} /* keep focus on the input; never blur/commit when opening the picker */
          onClick={openPicker}
          title="Pick from calendar"
          aria-label="Pick from calendar"
          className="absolute right-1 top-1/2 -translate-y-1/2 text-xs leading-none text-brand-silver hover:text-brand-brown"
        >
          📅
        </button>
        {/* Hidden native picker — opened by the button; never a tab stop. */}
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={value?.slice(0, 10) ?? ''}
          onChange={(e) => {
            const v = e.target.value || null;
            setInvalid(false);
            setText(formatDateDisplay(v));
            if (v !== value) onChange(v);
            // A calendar pick is a clean commit — drop the table cell back to read view.
            onLeave?.();
          }}
          className="sr-only"
        />
      </div>
      {invalid && (
        <span className="block text-[10px] text-red-500 mt-0.5">Unrecognized date — try 5/11/2027</span>
      )}
    </div>
  );
}
