'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { DbProgramWithLocation, DbLocation } from '@/lib/supabase/queries';
import { createProgram, updateProgram } from '@/app/(programs)/programs/actions';

interface Props {
  program?: DbProgramWithLocation;
  locations: DbLocation[];
  mode: 'create' | 'edit';
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SERVICE_STYLES = ['Family Style', 'Plated', 'Buffet', 'Stations', 'Cocktail Reception'];
const ALCOHOL_TYPES = ['Full Bar', 'Beer & Wine', 'None'];
const SERVICE_CHARGE_OPTS = ['20%', '21.5%', 'None'];
const GRATUITY_OPTS = ['20%', 'None'];
const ADMIN_FEE_OPTS = ['5%', 'None'];

export default function ProgramForm({ program, locations, mode }: Props) {
  const router = useRouter();
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form state — initialized from program or defaults
  const [name, setName] = useState(program?.name ?? '');
  const [clientName, setClientName] = useState(program?.client_name ?? '');
  const [companyName, setCompanyName] = useState(program?.company_name ?? '');
  const [eventDate, setEventDate] = useState(program?.event_date ?? '');
  const [guestCount, setGuestCount] = useState(String(program?.guest_count ?? ''));
  const [serviceStyle, setServiceStyle] = useState(program?.service_style ?? '');
  const [alcoholType, setAlcoholType] = useState(program?.alcohol_type ?? '');
  const [eventTime, setEventTime] = useState(program?.event_time ?? '');
  const [clientHotel, setClientHotel] = useState(program?.client_hotel ?? '');
  const [locationId, setLocationId] = useState(program?.location_id ?? '');
  const [ccFee, setCcFee] = useState(String((program?.cc_processing_fee ?? 0.035) * 100));
  const [clientComm, setClientComm] = useState(String((program?.client_commission ?? 0.05) * 100));
  const [gdpEnabled, setGdpEnabled] = useState(program?.gdp_commission_enabled ?? false);
  const [serviceCharge, setServiceCharge] = useState(program?.service_charge_default ?? '20%');
  const [gratuity, setGratuity] = useState(program?.gratuity_default ?? '20%');
  const [adminFee, setAdminFee] = useState(program?.admin_fee_default ?? '5%');

  const save = useCallback(async (patch: Record<string, unknown>) => {
    setSaveState('saving');
    setSaveError(null);

    if (mode === 'create') {
      // On create, we save everything at once on "Create Program" button click
      return;
    }

    if (!program?.id) return;
    const result = await updateProgram(program.id, patch as Parameters<typeof updateProgram>[1]);
    if (result.error) {
      setSaveState('error');
      setSaveError(result.error);
    } else {
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    }
  }, [mode, program?.id]);

  async function handleCreate() {
    setSaveState('saving');
    const result = await createProgram({
      name: name || 'New Program',
      client_name: clientName || null,
      event_date: eventDate || null,
      guest_count: parseInt(guestCount) || 0,
      service_style: serviceStyle || null,
      alcohol_type: alcoholType || null,
      event_time: eventTime || null,
      company_name: companyName || null,
      client_hotel: clientHotel || null,
      location_id: locationId || null,
      cc_processing_fee: parseFloat(ccFee) / 100 || 0.035,
      client_commission: parseFloat(clientComm) / 100 || 0.05,
      gdp_commission_enabled: gdpEnabled,
      service_charge_default: serviceCharge,
      gratuity_default: gratuity,
      admin_fee_default: adminFee,
    });
    if (result.error || !result.id) {
      setSaveState('error');
      setSaveError(result.error ?? 'Failed to create program');
      return;
    }
    router.push(`/programs/${result.id}`);
  }

  const fieldClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1';
  const sectionClass = 'grid grid-cols-2 gap-4';

  return (
    <div className="space-y-6">
      {/* Save status */}
      {mode === 'edit' && (
        <div className="text-xs text-right">
          {saveState === 'saving' && <span className="text-gray-400">Saving...</span>}
          {saveState === 'saved' && <span className="text-green-600">Saved</span>}
          {saveState === 'error' && <span className="text-red-500">{saveError}</span>}
        </div>
      )}

      {/* Event Details */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Event Details</h3>
        <div className="space-y-3">
          <div className={sectionClass}>
            <div>
              <label className={labelClass}>Program Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => save({ name: name || 'New Program' })}
                className={fieldClass}
                placeholder="e.g., Smith Corp Gala 2026"
              />
            </div>
            <div>
              <label className={labelClass}>Client Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onBlur={() => save({ client_name: clientName || null })}
                className={fieldClass}
                placeholder="Contact person"
              />
            </div>
          </div>
          <div className={sectionClass}>
            <div>
              <label className={labelClass}>Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onBlur={() => save({ company_name: companyName || null })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Client Hotel</label>
              <input
                type="text"
                value={clientHotel}
                onChange={(e) => setClientHotel(e.target.value)}
                onBlur={() => save({ client_hotel: clientHotel || null })}
                className={fieldClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Event Date</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => { setEventDate(e.target.value); save({ event_date: e.target.value || null }); }}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Guest Count</label>
              <input
                type="number"
                min="0"
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
                onBlur={() => save({ guest_count: parseInt(guestCount) || 0 })}
                className={fieldClass}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClass}>Event Time</label>
              <input
                type="text"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                onBlur={() => save({ event_time: eventTime || null })}
                className={fieldClass}
                placeholder="e.g., 6-9"
              />
            </div>
          </div>
          <div className={sectionClass}>
            <div>
              <label className={labelClass}>Service Style</label>
              <select
                value={serviceStyle}
                onChange={(e) => { setServiceStyle(e.target.value); save({ service_style: e.target.value || null }); }}
                className={fieldClass}
              >
                <option value="">— Select —</option>
                {SERVICE_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Alcohol Type</label>
              <select
                value={alcoholType}
                onChange={(e) => { setAlcoholType(e.target.value); save({ alcohol_type: e.target.value || null }); }}
                className={fieldClass}
              >
                <option value="">— Select —</option>
                {ALCOHOL_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Location</label>
            <select
              value={locationId}
              onChange={(e) => { setLocationId(e.target.value); save({ location_id: e.target.value || null }); }}
              className={fieldClass}
            >
              <option value="">— Select location —</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
            {locationId && (() => {
              const loc = locations.find((l) => l.id === locationId);
              if (!loc) return null;
              return (
                <p className="text-xs text-gray-400 mt-1">
                  Food: {(loc.food_tax_rate * 100).toFixed(3)}% · Alcohol: {(loc.alcohol_tax_rate * 100).toFixed(3)}% · General: {(loc.general_tax_rate * 100).toFixed(3)}%
                </p>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Commission Config */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Commission & Fees</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>CC Processing Fee</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={ccFee}
                  onChange={(e) => setCcFee(e.target.value)}
                  onBlur={() => save({ cc_processing_fee: parseFloat(ccFee) / 100 || 0.035 })}
                  className={fieldClass + ' pr-6'}
                />
                <span className="absolute right-2 top-2 text-gray-400 text-sm">%</span>
              </div>
            </div>
            <div>
              <label className={labelClass}>Client Commission</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={clientComm}
                  onChange={(e) => setClientComm(e.target.value)}
                  onBlur={() => save({ client_commission: parseFloat(clientComm) / 100 || 0.05 })}
                  className={fieldClass + ' pr-6'}
                />
                <span className="absolute right-2 top-2 text-gray-400 text-sm">%</span>
              </div>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => { const next = !gdpEnabled; setGdpEnabled(next); save({ gdp_commission_enabled: next }); }}
                  className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${gdpEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-transform ${gdpEnabled ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-gray-700">GDP Commission (6.5%)</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Restaurant Fee Defaults */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Restaurant Fee Defaults</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Service Charge</label>
            <select
              value={serviceCharge}
              onChange={(e) => { setServiceCharge(e.target.value); save({ service_charge_default: e.target.value }); }}
              className={fieldClass}
            >
              {SERVICE_CHARGE_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Gratuity</label>
            <select
              value={gratuity}
              onChange={(e) => { setGratuity(e.target.value); save({ gratuity_default: e.target.value }); }}
              className={fieldClass}
            >
              {GRATUITY_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Admin Fee</label>
            <select
              value={adminFee}
              onChange={(e) => { setAdminFee(e.target.value); save({ admin_fee_default: e.target.value }); }}
              className={fieldClass}
            >
              {ADMIN_FEE_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>

      {mode === 'create' && (
        <button
          onClick={handleCreate}
          disabled={saveState === 'saving' || !name.trim()}
          className="bg-blue-600 text-white text-sm font-medium rounded px-5 py-2.5 hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saveState === 'saving' ? 'Creating...' : 'Create Program'}
        </button>
      )}

      {saveState === 'error' && mode === 'create' && (
        <p className="text-sm text-red-600">{saveError}</p>
      )}
    </div>
  );
}
