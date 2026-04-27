'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { DbVenue } from '@/lib/supabase/queries';
import { updateVenue } from '@/app/(programs)/venues/actions';

interface Props {
  venue: DbVenue;
}

const SERVICE_STYLE_OPTIONS = [
  'Plated', 'Buffet', 'Stations', 'Heavy Appetizers', 'Reception', 'Family Style', 'Food Trucks',
];

const ALL_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

export default function VenueForm({ venue }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(venue.name);
  const [address, setAddress] = useState(venue.address ?? '');
  const [city, setCity] = useState(venue.city ?? '');
  const [state, setState] = useState(venue.state ?? '');
  const [zip, setZip] = useState(venue.zip ?? '');
  const [styles, setStyles] = useState<string[]>(venue.service_styles ?? []);
  const [contactName, setContactName] = useState(venue.contact_name ?? '');
  const [contactEmail, setContactEmail] = useState(venue.contact_email ?? '');
  const [contactPhone, setContactPhone] = useState(venue.contact_phone ?? '');
  const [website, setWebsite] = useState(venue.website ?? '');
  const [notes, setNotes] = useState(venue.notes ?? '');

  function toggleStyle(style: string) {
    setStyles((prev) => prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]);
    setSaved(false);
  }

  function handleSave() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await updateVenue(venue.id, {
        name: name.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        state: state || null,
        zip: zip.trim() || null,
        service_styles: styles,
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        website: website.trim() || null,
        notes: notes.trim() || null,
      });
      if (result.error) { setError(result.error); return; }
      setSaved(true);
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-brand-silver uppercase tracking-wide mb-1">Venue Name *</label>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
          className="w-full border border-brand-silver/30 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown font-medium"
        />
      </div>

      {/* Address */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-brand-silver uppercase tracking-wide mb-1">Address</label>
          <input
            value={address}
            onChange={(e) => { setAddress(e.target.value); setSaved(false); }}
            className="w-full border border-brand-silver/30 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
            placeholder="123 Main St"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-silver uppercase tracking-wide mb-1">City</label>
          <input
            value={city}
            onChange={(e) => { setCity(e.target.value); setSaved(false); }}
            className="w-full border border-brand-silver/30 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
            placeholder="Charlotte"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-brand-silver uppercase tracking-wide mb-1">State</label>
            <select
              value={state}
              onChange={(e) => { setState(e.target.value); setSaved(false); }}
              className="w-full border border-brand-silver/30 rounded px-2 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
            >
              <option value="">—</option>
              {ALL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-silver uppercase tracking-wide mb-1">ZIP</label>
            <input
              value={zip}
              onChange={(e) => { setZip(e.target.value); setSaved(false); }}
              className="w-full border border-brand-silver/30 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
              placeholder="28277"
            />
          </div>
        </div>
      </div>

      {/* Service Styles */}
      <div>
        <label className="block text-xs font-medium text-brand-silver uppercase tracking-wide mb-2">Service Styles</label>
        <div className="flex flex-wrap gap-2">
          {SERVICE_STYLE_OPTIONS.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => toggleStyle(style)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                styles.includes(style)
                  ? 'bg-brand-brown text-white border-brand-brown'
                  : 'bg-white text-brand-charcoal border-brand-silver/30 hover:border-brand-brown'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div>
        <label className="block text-xs font-medium text-brand-silver uppercase tracking-wide mb-2">Contact</label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-brand-silver mb-1">Name</label>
            <input
              value={contactName}
              onChange={(e) => { setContactName(e.target.value); setSaved(false); }}
              className="w-full border border-brand-silver/30 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-silver mb-1">Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => { setContactEmail(e.target.value); setSaved(false); }}
              className="w-full border border-brand-silver/30 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-silver mb-1">Phone</label>
            <input
              value={contactPhone}
              onChange={(e) => { setContactPhone(e.target.value); setSaved(false); }}
              className="w-full border border-brand-silver/30 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
            />
          </div>
        </div>
      </div>

      {/* Website + Notes */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-brand-silver uppercase tracking-wide mb-1">Website</label>
          <input
            value={website}
            onChange={(e) => { setWebsite(e.target.value); setSaved(false); }}
            className="w-full border border-brand-silver/30 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
            placeholder="https://"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-silver uppercase tracking-wide mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
            rows={2}
            className="w-full border border-brand-silver/30 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown resize-none"
          />
        </div>
      </div>

      {/* Save */}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending || !name.trim()}
          className="bg-brand-brown text-white text-sm px-5 py-2 rounded hover:bg-brand-brown/90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save Venue'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </div>
  );
}
