'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { DbVenue } from '@/lib/supabase/queries';
import { updateVenue, createMarket, parseEmailSignature } from '@/app/(programs)/venues/actions';
import { VENDOR_TYPES, type VendorType } from '@/lib/vendors/constants';

interface Props {
  venue: DbVenue;
  markets?: string[];
}

const SERVICE_STYLE_OPTIONS = [
  'Plated', 'Buffet', 'Stations', 'Heavy Appetizers', 'Reception', 'Family Style', 'Food Trucks',
];

const ALL_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

export default function VenueForm({ venue, markets: initialMarkets = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(venue.name);
  const [vendorType, setVendorType] = useState<VendorType>((venue.vendor_type as VendorType) ?? 'venue');
  const [address, setAddress] = useState(venue.address ?? '');
  const [city, setCity] = useState(venue.city ?? '');
  const [state, setState] = useState(venue.state ?? '');
  const [zip, setZip] = useState(venue.zip ?? '');
  const [market, setMarket] = useState(venue.market ?? '');
  const [localMarkets, setLocalMarkets] = useState<string[]>(initialMarkets);
  const [showAddMarket, setShowAddMarket] = useState(false);
  const [newMarketName, setNewMarketName] = useState('');
  const [addingMarket, setAddingMarket] = useState(false);
  const [svcCharge, setSvcCharge] = useState(venue.service_charge_default !== null ? (venue.service_charge_default * 100).toFixed(1) : '');
  const [gratuity, setGratuity] = useState(venue.gratuity_default !== null ? (venue.gratuity_default * 100).toFixed(1) : '');
  const [adminFee, setAdminFee] = useState(venue.admin_fee_default !== null ? (venue.admin_fee_default * 100).toFixed(1) : '');
  const [styles, setStyles] = useState<string[]>(venue.service_styles ?? []);
  const [contactName, setContactName] = useState(venue.contact_name ?? '');
  const [contactTitle, setContactTitle] = useState(venue.contact_title ?? '');
  const [contactEmail, setContactEmail] = useState(venue.contact_email ?? '');
  const [contactPhone, setContactPhone] = useState(venue.contact_phone ?? '');
  const [emailSignature, setEmailSignature] = useState(venue.email_signature ?? '');
  const [website, setWebsite] = useState(venue.website ?? '');
  const [parsingSig, setParsingSig] = useState(false);
  const [sigFilledFields, setSigFilledFields] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState(venue.notes ?? '');

  function toggleStyle(style: string) {
    setStyles((prev) => prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]);
    setSaved(false);
  }

  async function handleSignaturePaste(pastedText: string) {
    setParsingSig(true);
    const parsed = await parseEmailSignature(pastedText);
    setParsingSig(false);
    const filled = new Set<string>();
    if (parsed.name && !contactName.trim())   { setContactName(parsed.name);   filled.add('name'); }
    if (parsed.title && !contactTitle.trim()) { setContactTitle(parsed.title); filled.add('title'); }
    if (parsed.email && !contactEmail.trim()) { setContactEmail(parsed.email); filled.add('email'); }
    if (parsed.phone && !contactPhone.trim()) { setContactPhone(parsed.phone); filled.add('phone'); }
    if (parsed.website && !website.trim())    { setWebsite(parsed.website);    filled.add('website'); }
    if (filled.size > 0) setSigFilledFields(filled);
    setSaved(false);
  }

  function clearSigFilled(field: string) {
    setSigFilledFields((prev) => { const next = new Set(prev); next.delete(field); return next; });
  }

  function handleSave() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await updateVenue(venue.id, {
        name: name.trim(),
        vendor_type: vendorType,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state || null,
        zip: zip.trim() || null,
        market: market.trim() || null,
        service_styles: styles,
        contact_name: contactName.trim() || null,
        contact_title: contactTitle.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        email_signature: emailSignature.trim() || null,
        website: website.trim() || null,
        notes: notes.trim() || null,
        service_charge_default: svcCharge ? parseFloat(svcCharge) / 100 : null,
        gratuity_default: gratuity ? parseFloat(gratuity) / 100 : null,
        admin_fee_default: adminFee ? parseFloat(adminFee) / 100 : null,
      });
      if (result.error) { setError(result.error); return; }
      setSaved(true);
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Name + Type */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-brand-silver uppercase tracking-wide mb-1">Name *</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
            className="w-full border border-brand-silver/30 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown font-medium"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-silver uppercase tracking-wide mb-1">Vendor Type</label>
          <select
            value={vendorType}
            onChange={(e) => { setVendorType(e.target.value as VendorType); setSaved(false); }}
            className="w-full border border-brand-silver/30 rounded px-2 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
          >
            {VENDOR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
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
        <div className="grid grid-cols-3 gap-2">
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
          <div>
            <label className="block text-xs font-medium text-brand-silver uppercase tracking-wide mb-1">Market</label>
            {localMarkets.length > 0 ? (
              <>
                <select
                  value={showAddMarket ? '__add_new__' : market}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__add_new__') {
                      setShowAddMarket(true);
                    } else {
                      setShowAddMarket(false);
                      setMarket(val);
                      setSaved(false);
                    }
                  }}
                  className="w-full border border-brand-silver/30 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
                >
                  <option value="">— Select market —</option>
                  {localMarkets.map((m) => <option key={m} value={m}>{m}</option>)}
                  <option value="__add_new__">+ Add new market…</option>
                </select>
                {showAddMarket && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="New market name"
                      value={newMarketName}
                      onChange={(e) => setNewMarketName(e.target.value)}
                      className="flex-1 border border-brand-silver/30 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
                    />
                    <button
                      type="button"
                      disabled={addingMarket || !newMarketName.trim()}
                      onClick={async () => {
                        setAddingMarket(true);
                        const { name: created, error } = await createMarket(newMarketName);
                        setAddingMarket(false);
                        if (!created || error) return;
                        const next = [...localMarkets, created].sort((a, b) => a.localeCompare(b));
                        setLocalMarkets(next);
                        setMarket(created);
                        setShowAddMarket(false);
                        setNewMarketName('');
                        setSaved(false);
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-brand-brown text-white rounded hover:bg-brand-charcoal disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {addingMarket ? 'Adding…' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddMarket(false); setNewMarketName(''); }}
                      className="px-2 py-1.5 text-xs text-brand-silver hover:text-brand-charcoal transition-colors"
                    >
                      ×
                    </button>
                  </div>
                )}
              </>
            ) : (
              <input
                value={market}
                onChange={(e) => { setMarket(e.target.value); setSaved(false); }}
                className="w-full border border-brand-silver/30 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
                placeholder="Charlotte"
              />
            )}
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
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-brand-silver mb-1">
              Name{sigFilledFields.has('name') && <span className="ml-1 text-brand-copper/70">✦ autofilled</span>}
            </label>
            <input
              value={contactName}
              onChange={(e) => { setContactName(e.target.value); clearSigFilled('name'); setSaved(false); }}
              className="w-full border border-brand-silver/30 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-silver mb-1">
              Title{sigFilledFields.has('title') && <span className="ml-1 text-brand-copper/70">✦ autofilled</span>}
            </label>
            <input
              value={contactTitle}
              onChange={(e) => { setContactTitle(e.target.value); clearSigFilled('title'); setSaved(false); }}
              className="w-full border border-brand-silver/30 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
              placeholder="Sales Manager"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-silver mb-1">
              Email{sigFilledFields.has('email') && <span className="ml-1 text-brand-copper/70">✦ autofilled</span>}
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => { setContactEmail(e.target.value); clearSigFilled('email'); setSaved(false); }}
              className="w-full border border-brand-silver/30 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-silver mb-1">
              Phone{sigFilledFields.has('phone') && <span className="ml-1 text-brand-copper/70">✦ autofilled</span>}
            </label>
            <input
              value={contactPhone}
              onChange={(e) => { setContactPhone(e.target.value); clearSigFilled('phone'); setSaved(false); }}
              className="w-full border border-brand-silver/30 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-xs text-brand-silver mb-1">
            Email Signature
            {parsingSig && <span className="ml-2 text-brand-silver/50">parsing…</span>}
          </label>
          <textarea
            value={emailSignature}
            onChange={(e) => { setEmailSignature(e.target.value); setSaved(false); }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text');
              if (text.trim()) handleSignaturePaste(text);
            }}
            rows={3}
            className="w-full border border-brand-silver/30 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown resize-none font-mono"
            placeholder="Paste the vendor's email signature block here for quick copying…"
          />
        </div>
      </div>

      {/* Website + Notes */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-brand-silver uppercase tracking-wide mb-1">
            Website{sigFilledFields.has('website') && <span className="ml-1 text-brand-copper/70 normal-case font-normal">✦ autofilled</span>}
          </label>
          <input
            value={website}
            onChange={(e) => { setWebsite(e.target.value); clearSigFilled('website'); setSaved(false); }}
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

      {/* Fee Defaults */}
      <div>
        <label className="block text-xs font-medium text-brand-silver uppercase tracking-wide mb-2">Fee Defaults</label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-brand-silver mb-1">Service Charge %</label>
            <input
              type="number"
              value={svcCharge}
              onChange={(e) => { setSvcCharge(e.target.value); setSaved(false); }}
              className="w-full border border-brand-silver/30 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
              placeholder="20"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-silver mb-1">Gratuity %</label>
            <input
              type="number"
              value={gratuity}
              onChange={(e) => { setGratuity(e.target.value); setSaved(false); }}
              className="w-full border border-brand-silver/30 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
              placeholder="20"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-silver mb-1">Admin Fee %</label>
            <input
              type="number"
              value={adminFee}
              onChange={(e) => { setAdminFee(e.target.value); setSaved(false); }}
              className="w-full border border-brand-silver/30 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
              placeholder="5"
            />
          </div>
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
          {isPending ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </div>
  );
}
