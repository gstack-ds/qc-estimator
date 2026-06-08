'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DbVenue } from '@/lib/supabase/queries';
import { createVenue, deleteVenue } from '@/app/(programs)/venues/actions';
import { VENDOR_TYPES, type VendorType } from '@/lib/vendors/constants';

interface VendorRow extends DbVenue {
  space_count: number;
  capacity_min: number | null;
  capacity_max: number | null;
  program_count: number;
  file_count: number;
}

interface Props {
  vendors: VendorRow[];
}

const ALL_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

const TYPE_COLORS: Record<VendorType, string> = {
  venue:          'bg-sky-50 text-sky-700 border-sky-200',
  restaurant:     'bg-orange-50 text-orange-700 border-orange-200',
  tour:           'bg-emerald-50 text-emerald-700 border-emerald-200',
  transportation: 'bg-violet-50 text-violet-700 border-violet-200',
  entertainment:  'bg-pink-50 text-pink-700 border-pink-200',
  decor:          'bg-amber-50 text-amber-700 border-amber-200',
};

function TypeBadge({ type }: { type: VendorType | null }) {
  if (!type) return null;
  const label = VENDOR_TYPES.find((t) => t.value === type)?.label ?? type;
  const color = TYPE_COLORS[type] ?? 'bg-brand-cream text-brand-silver border-brand-silver/20';
  return (
    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-medium ${color}`}>
      {label}
    </span>
  );
}

function CopyEmailSigButton({ sig }: { sig: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(sig).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy email signature"
      className="text-xs text-brand-brown hover:text-brand-charcoal border border-brand-copper/30 rounded px-1.5 py-0.5 hover:bg-brand-cream/60 transition-colors whitespace-nowrap"
    >
      {copied ? 'Copied!' : 'Copy sig'}
    </button>
  );
}

export default function VendorsList({ vendors }: Props) {
  const router = useRouter();
  const [activeType, setActiveType] = useState<VendorType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newType, setNewType] = useState<VendorType>('venue');
  const [addError, setAddError] = useState<string | null>(null);
  const [addDupId, setAddDupId] = useState<string | null>(null);
  const [addDupName, setAddDupName] = useState<string | null>(null);
  const [addIsWarning, setAddIsWarning] = useState(false);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: vendors.length };
    for (const v of vendors) {
      counts[v.vendor_type ?? 'venue'] = (counts[v.vendor_type ?? 'venue'] ?? 0) + 1;
    }
    return counts;
  }, [vendors]);

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      if (activeType !== 'all' && (v.vendor_type ?? 'venue') !== activeType) return false;
      if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [vendors, activeType, search]);

  async function handleAdd(skipNameCheck = false) {
    if (!newName.trim()) return;
    setAddError(null);
    setAddDupId(null);
    setAddDupName(null);
    setAddIsWarning(false);
    setIsPending(true);
    const result = await createVenue({
      name: newName.trim(),
      address: newAddress.trim() || null,
      city: newCity || null,
      state: newState || null,
      vendor_type: newType,
      skipNameCheck,
    });
    setIsPending(false);
    if ('id' in result) {
      setShowAddForm(false);
      setNewName(''); setNewAddress(''); setNewCity(''); setNewState(''); setNewType('venue');
      setAddError(null);
      router.push(`/venues/${result.id}`);
    } else {
      setAddError(result.error);
      if (result.existingId) { setAddDupId(result.existingId); setAddDupName(result.existingName ?? null); }
      if (result.isWarning) setAddIsWarning(true);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will unlink any estimates connected to this vendor.`)) return;
    await deleteVenue(id);
    router.refresh();
  }

  return (
    <div>
      {/* Type tabs */}
      <div className="flex flex-wrap gap-1 mb-4">
        <button
          onClick={() => setActiveType('all')}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${activeType === 'all' ? 'bg-brand-charcoal text-white' : 'text-brand-charcoal/60 hover:text-brand-charcoal hover:bg-brand-cream/60'}`}
        >
          All <span className="ml-1 opacity-60">{typeCounts.all}</span>
        </button>
        {VENDOR_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveType(t.value)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${activeType === t.value ? 'bg-brand-charcoal text-white' : 'text-brand-charcoal/60 hover:text-brand-charcoal hover:bg-brand-cream/60'}`}
          >
            {t.label}
            {typeCounts[t.value] ? <span className="ml-1 opacity-60">{typeCounts[t.value]}</span> : null}
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="flex-1 min-w-[180px]">
          <input
            type="text"
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-brand-silver/30 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
          />
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="ml-auto bg-brand-brown text-white text-sm px-4 py-1.5 rounded hover:bg-brand-brown/90 whitespace-nowrap"
        >
          + Add Vendor
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleAdd(false); }}
          className="bg-brand-cream/30 border border-brand-silver/20 rounded-lg p-4 mb-4 space-y-3"
        >
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs text-brand-silver mb-1">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as VendorType)}
                className="border border-brand-silver/30 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
              >
                {VENDOR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-brand-silver mb-1">Name *</label>
              <input
                autoFocus
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="border border-brand-silver/30 rounded px-3 py-1.5 text-sm w-48 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
                placeholder="e.g. The Ballantyne"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-silver mb-1">Address</label>
              <input
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="border border-brand-silver/30 rounded px-3 py-1.5 text-sm w-52 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
                placeholder="123 Main St"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-silver mb-1">City</label>
              <input
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                className="border border-brand-silver/30 rounded px-3 py-1.5 text-sm w-28 bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
                placeholder="Charlotte"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-silver mb-1">State</label>
              <select
                value={newState}
                onChange={(e) => setNewState(e.target.value)}
                className="border border-brand-silver/30 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-brown"
              >
                <option value="">—</option>
                {ALL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending || !newName.trim()}
                className="bg-brand-brown text-white text-sm px-4 py-1.5 rounded hover:bg-brand-brown/90 disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Create & Edit'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setAddError(null); }}
                className="text-sm text-brand-silver hover:text-brand-charcoal px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
          {addError && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 flex flex-wrap items-center gap-2">
              <span>{addError}</span>
              <div className="flex gap-2">
                {addDupId && (
                  <a href={`/venues/${addDupId}`} className="underline font-medium hover:text-amber-900">
                    View {addDupName ?? 'that vendor'}
                  </a>
                )}
                {addIsWarning && (
                  <button type="button" onClick={() => handleAdd(true)} className="underline font-medium hover:text-amber-900">
                    Create anyway
                  </button>
                )}
              </div>
            </div>
          )}
        </form>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-sm text-brand-silver py-12 text-center">
          {vendors.length === 0 ? 'No vendors yet. Add one to get started.' : 'No vendors match your filters.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-silver/20 text-left">
                <th className="pb-2 pr-4 text-xs font-medium text-brand-silver uppercase tracking-wide">Vendor</th>
                <th className="pb-2 pr-4 text-xs font-medium text-brand-silver uppercase tracking-wide">Market / City</th>
                <th className="pb-2 pr-4 text-xs font-medium text-brand-silver uppercase tracking-wide">Contact</th>
                <th className="pb-2 pr-4 text-xs font-medium text-brand-silver uppercase tracking-wide text-right">Programs</th>
                <th className="pb-2 pr-4 text-xs font-medium text-brand-silver uppercase tracking-wide text-right">Files</th>
                <th className="pb-2 pr-4 text-xs font-medium text-brand-silver uppercase tracking-wide text-right">Spaces</th>
                <th className="pb-2 pr-4 text-xs font-medium text-brand-silver uppercase tracking-wide">Last Used</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((vendor) => (
                <tr key={vendor.id} className="border-b border-brand-silver/10 hover:bg-brand-cream/20 group">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link href={`/venues/${vendor.id}`} className="font-medium text-brand-charcoal hover:text-brand-brown">
                        {vendor.name}
                      </Link>
                      <TypeBadge type={vendor.vendor_type as VendorType ?? null} />
                    </div>
                    {vendor.address && (
                      <div className="text-xs text-brand-silver truncate max-w-[220px]">{vendor.address}</div>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-brand-charcoal">
                    {vendor.market
                      ? <span>{vendor.market}{vendor.state ? `, ${vendor.state}` : ''}</span>
                      : [vendor.city, vendor.state].filter(Boolean).join(', ') || '—'
                    }
                  </td>
                  <td className="py-2.5 pr-4 text-brand-charcoal">
                    {vendor.contact_name
                      ? <div>{vendor.contact_name}{vendor.contact_title ? <span className="text-brand-silver ml-1">· {vendor.contact_title}</span> : null}</div>
                      : <span className="text-brand-silver">—</span>
                    }
                  </td>
                  <td className="py-2.5 pr-4 text-right text-brand-charcoal">{vendor.program_count || '—'}</td>
                  <td className="py-2.5 pr-4 text-right text-brand-charcoal">{vendor.file_count || '—'}</td>
                  <td className="py-2.5 pr-4 text-right text-brand-charcoal">{vendor.space_count || '—'}</td>
                  <td className="py-2.5 pr-4 text-brand-silver">{formatDate(vendor.last_used_date)}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      {vendor.email_signature && (
                        <CopyEmailSigButton sig={vendor.email_signature} />
                      )}
                      <button
                        onClick={() => handleDelete(vendor.id, vendor.name)}
                        className="text-xs text-brand-silver hover:text-red-500 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-xs text-brand-silver">
            {filtered.length} of {vendors.length} vendor{vendors.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
