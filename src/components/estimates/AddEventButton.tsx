'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createEvent } from '@/app/(programs)/programs/actions';

const EVENT_TYPE_OPTIONS = [
  { value: 'general_session',    label: 'General Session' },
  { value: 'formal_dinner',      label: 'Formal Dinner' },
  { value: 'cocktail_reception', label: 'Cocktail Reception' },
  { value: 'breakfast',          label: 'Breakfast' },
  { value: 'lunch',              label: 'Lunch' },
  { value: 'dine_around',        label: 'Dine Around' },
  { value: 'experiential',       label: 'Experiential' },
  { value: 'excursion',          label: 'Excursion' },
  { value: 'logistics',          label: 'Logistics' },
  { value: 'custom',             label: 'Custom' },
] as const;

interface Props {
  programId: string;
  defaultGuestCount: number;
  nextSortOrder: number;
}

export default function AddEventButton({ programId, defaultGuestCount, nextSortOrder }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [guestCount, setGuestCount] = useState(defaultGuestCount);
  const [eventType, setEventType] = useState<string>('general_session');
  const [description, setDescription] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const result = await createEvent(programId, {
      name: name.trim(),
      event_date: eventDate || null,
      start_time: startTime || null,
      end_time: endTime || null,
      guest_count: guestCount,
      event_type: eventType,
      description: description.trim() || null,
      sort_order: nextSortOrder,
    });
    if (!result.error) {
      setOpen(false);
      setName('');
      setEventDate('');
      setStartTime('');
      setEndTime('');
      setGuestCount(defaultGuestCount);
      setEventType('general_session');
      setDescription('');
      startTransition(() => router.refresh());
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-brand-brown border border-brand-brown px-4 py-2 rounded hover:bg-brand-brown hover:text-white transition-colors"
      >
        + Add Event
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-brand-copper/40 rounded-lg p-5 space-y-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-brand-charcoal text-sm">New Event</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-brand-silver hover:text-brand-charcoal text-lg leading-none"
          aria-label="Cancel"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Name */}
        <div className="col-span-2">
          <label className="block text-xs text-brand-charcoal/70 mb-1">Event Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Welcome Dinner"
            required
            className="w-full border border-brand-cream rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-brown"
          />
        </div>

        {/* Event Type */}
        <div>
          <label className="block text-xs text-brand-charcoal/70 mb-1">Event Type</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="w-full border border-brand-cream rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-brown bg-white"
          >
            {EVENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Guest Count */}
        <div>
          <label className="block text-xs text-brand-charcoal/70 mb-1">Guest Count</label>
          <input
            type="number"
            min={0}
            value={guestCount}
            onChange={(e) => setGuestCount(parseInt(e.target.value) || 0)}
            className="w-full border border-brand-cream rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-brown"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs text-brand-charcoal/70 mb-1">Date</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full border border-brand-cream rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-brown"
          />
        </div>

        {/* Times */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs text-brand-charcoal/70 mb-1">Start</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full border border-brand-cream rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-brown"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-brand-charcoal/70 mb-1">End</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full border border-brand-cream rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-brown"
            />
          </div>
        </div>

        {/* Description */}
        <div className="col-span-2">
          <label className="block text-xs text-brand-charcoal/70 mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border border-brand-cream rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-brown resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-brand-silver hover:text-brand-charcoal"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="bg-brand-brown text-white text-sm font-medium px-4 py-2 rounded hover:bg-brand-charcoal disabled:opacity-50 transition-colors"
        >
          {loading ? 'Creating…' : 'Create Event'}
        </button>
      </div>
    </form>
  );
}
