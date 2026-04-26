'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { DbProgramWithLocation, DbLocation } from '@/lib/supabase/queries';
import {
  createProgram,
  updateProgram,
  extractProgramBrief,
  uploadProgramAttachment,
  type ExtractedProgramBrief,
} from '@/app/(programs)/programs/actions';

interface Props {
  program?: DbProgramWithLocation;
  locations: DbLocation[];
  mode: 'create' | 'edit';
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SERVICE_STYLES = ['Family Style', 'Plated', 'Buffet', 'Stations', 'Cocktail Reception'];
const ALCOHOL_TYPES = ['Full Bar', 'Beer & Wine', 'None'];

function calcDuration(start: string, end: string): string {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60; // crosses midnight
  const diff = endMins - startMins;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

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
  const [eventStartTime, setEventStartTime] = useState(program?.event_start_time ?? '');
  const [eventEndTime, setEventEndTime] = useState(program?.event_end_time ?? '');
  const [clientHotel, setClientHotel] = useState(program?.client_hotel ?? '');
  const [locationId, setLocationId] = useState(program?.location_id ?? '');
  const [ccFee, setCcFee] = useState(String(parseFloat(((program?.cc_processing_fee ?? 0.035) * 100).toFixed(4))));
  const [clientComm, setClientComm] = useState(String(parseFloat(((program?.client_commission ?? 0.05) * 100).toFixed(4))));
  const [gdpEnabled, setGdpEnabled] = useState(program?.gdp_commission_enabled ?? false);
  const [serviceCharge, setServiceCharge] = useState(String(parseFloat(((program?.service_charge_default ?? 0.20) * 100).toFixed(4))));
  const [gratuity, setGratuity] = useState(String(parseFloat(((program?.gratuity_default ?? 0.20) * 100).toFixed(4))));
  const [adminFee, setAdminFee] = useState(String(parseFloat(((program?.admin_fee_default ?? 0.05) * 100).toFixed(4))));

  // Brief extraction (create mode only)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingExtracted, setPendingExtracted] = useState<ExtractedProgramBrief | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractToast, setExtractToast] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const briefFileRef = useRef<HTMLInputElement>(null);

  const save = useCallback(async (patch: Record<string, unknown>) => {
    if (mode === 'create') return;

    setSaveState('saving');
    setSaveError(null);

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

  async function handleBriefFile(file: File) {
    if (file.type !== 'application/pdf') { setExtractError('Only PDF files are supported.'); return; }
    if (file.size > 10 * 1024 * 1024) { setExtractError('File exceeds 10 MB limit.'); return; }
    setPendingFile(file);
    setExtractError(null);
    setExtracting(true);
    const fd = new FormData();
    fd.append('file', file);
    const { error, data } = await extractProgramBrief(fd);
    setExtracting(false);
    if (error || !data) { setExtractError(error ?? 'Extraction failed.'); return; }
    setPendingExtracted(data);
    let filled = 0;
    if (data.clientName) { setClientName(data.clientName); filled++; }
    if (data.companyName) { setCompanyName(data.companyName); filled++; }
    if (data.eventDate) { setEventDate(data.eventDate); filled++; }
    if (data.guestCount && data.guestCount > 0) { setGuestCount(String(data.guestCount)); filled++; }
    if (data.serviceStyle && SERVICE_STYLES.includes(data.serviceStyle)) { setServiceStyle(data.serviceStyle); filled++; }
    if (data.alcoholType && ALCOHOL_TYPES.includes(data.alcoholType)) { setAlcoholType(data.alcoholType); filled++; }
    if (data.clientHotel) { setClientHotel(data.clientHotel); filled++; }
    const msg = filled > 0
      ? `Extracted ${filled} field${filled !== 1 ? 's' : ''} from document.`
      : 'No matching fields found in document.';
    setExtractToast(msg);
    setTimeout(() => setExtractToast(null), 5000);
  }

  async function handleCreate() {
    setSaveState('saving');
    const result = await createProgram({
      name: name || 'New Program',
      client_name: clientName || null,
      event_date: eventDate || null,
      guest_count: parseInt(guestCount) || 0,
      service_style: serviceStyle || null,
      alcohol_type: alcoholType || null,
      event_time: null,
      event_start_time: eventStartTime || null,
      event_end_time: eventEndTime || null,
      company_name: companyName || null,
      client_hotel: clientHotel || null,
      location_id: locationId || null,
      cc_processing_fee: isNaN(parseFloat(ccFee)) ? 0.035 : parseFloat(ccFee) / 100,
      client_commission: isNaN(parseFloat(clientComm)) ? 0.05 : parseFloat(clientComm) / 100,
      gdp_commission_enabled: gdpEnabled,
      service_charge_default: parseFloat(serviceCharge) / 100 || 0.20,
      gratuity_default: parseFloat(gratuity) / 100 || 0.20,
      admin_fee_default: parseFloat(adminFee) / 100 || 0.05,
    });
    if (result.error || !result.id) {
      setSaveState('error');
      setSaveError(result.error ?? 'Failed to create program');
      return;
    }
    if (pendingFile) {
      const fd = new FormData();
      fd.append('file', pendingFile);
      fd.append('programId', result.id);
      await uploadProgramAttachment(fd, pendingExtracted ?? undefined);
    }
    router.push(`/programs/${result.id}`);
  }

  const fieldClass = 'w-full border border-brand-cream rounded px-3 py-2 text-sm text-brand-charcoal bg-white focus:outline-none focus:ring-2 focus:ring-brand-copper focus:border-brand-brown transition-colors';
  const labelClass = 'block text-xs font-medium text-brand-charcoal/60 tracking-wide mb-1';
  const sectionClass = 'grid grid-cols-2 gap-4';

  return (
    <div className="space-y-6">
      {/* Save status */}
      {mode === 'edit' && (
        <div className="text-xs text-right">
          {saveState === 'saving' && <span className="text-brand-silver">Saving…</span>}
          {saveState === 'saved' && <span className="text-green-600">Saved</span>}
          {saveState === 'error' && <span className="text-red-500">{saveError}</span>}
        </div>
      )}

      {/* PDF brief dropzone — create mode only */}
      {mode === 'create' && (
        <div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleBriefFile(f); }}
            onClick={() => !extracting && briefFileRef.current?.click()}
            className={`border-2 border-dashed rounded-lg px-6 py-7 text-center transition-colors ${extracting ? 'cursor-default border-brand-silver/30 bg-brand-offwhite/30' : 'cursor-pointer border-brand-cream hover:border-brand-copper/50 hover:bg-brand-offwhite/50'}`}
          >
            {extracting ? (
              <p className="text-sm text-brand-silver italic">Extracting details from document…</p>
            ) : pendingFile ? (
              <div>
                <p className="text-sm font-medium text-brand-charcoal/70">{pendingFile.name}</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPendingFile(null); setPendingExtracted(null); }}
                  className="text-xs text-brand-silver hover:text-red-500 mt-1"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-brand-charcoal/70">Upload an event brief, RFP, or client document to auto-fill details.</p>
                <p className="text-xs text-brand-silver mt-1">PDF only · Max 10 MB · Click or drag to upload</p>
              </>
            )}
          </div>
          <input
            ref={briefFileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBriefFile(f); e.target.value = ''; }}
          />
          {extractError && (
            <p className="text-xs text-red-500 mt-2">{extractError}</p>
          )}
          {extractToast && (
            <div className="mt-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              {extractToast}
            </div>
          )}
        </div>
      )}

      {/* Event Details */}
      <div>
        <h3 className="text-xs font-semibold text-brand-brown uppercase tracking-wide mb-3">Event Details</h3>
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
          <div className="grid grid-cols-4 gap-4">
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
              <label className={labelClass}>Start Time</label>
              <input
                type="time"
                value={eventStartTime}
                onChange={(e) => setEventStartTime(e.target.value)}
                onBlur={() => save({ event_start_time: eventStartTime || null })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>End Time</label>
              <input
                type="time"
                value={eventEndTime}
                onChange={(e) => setEventEndTime(e.target.value)}
                onBlur={() => save({ event_end_time: eventEndTime || null })}
                className={fieldClass}
              />
              {eventStartTime && eventEndTime && (
                <p className="text-xs text-brand-silver mt-1">{calcDuration(eventStartTime, eventEndTime)}</p>
              )}
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
                <p className="text-xs text-brand-silver mt-1">
                  Food: {(loc.food_tax_rate * 100).toFixed(3)}% · Alcohol: {(loc.alcohol_tax_rate * 100).toFixed(3)}% · General: {(loc.general_tax_rate * 100).toFixed(3)}%
                </p>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Commission Config */}
      <div>
        <h3 className="text-xs font-semibold text-brand-brown uppercase tracking-wide mb-3">Commission & Fees</h3>
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
                  onBlur={() => { const v = parseFloat(ccFee); save({ cc_processing_fee: isNaN(v) ? 0.035 : v / 100 }); }}
                  className={fieldClass + ' pr-6'}
                />
                <span className="absolute right-2 top-2 text-brand-silver text-sm">%</span>
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
                  onBlur={() => { const v = parseFloat(clientComm); save({ client_commission: isNaN(v) ? 0.05 : v / 100 }); }}
                  className={fieldClass + ' pr-6'}
                />
                <span className="absolute right-2 top-2 text-brand-silver text-sm">%</span>
              </div>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => { const next = !gdpEnabled; setGdpEnabled(next); save({ gdp_commission_enabled: next }); }}
                  className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${gdpEnabled ? 'bg-brand-brown' : 'bg-brand-silver/40'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-transform ${gdpEnabled ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-brand-charcoal/70">GDP Commission (6.5%)</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Restaurant Fee Defaults */}
      <div>
        <h3 className="text-xs font-semibold text-brand-brown uppercase tracking-wide mb-3">Restaurant Fee Defaults</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Service Charge</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(e.target.value)}
                onBlur={() => save({ service_charge_default: parseFloat(serviceCharge) / 100 || 0 })}
                className={fieldClass + ' pr-6'}
                placeholder="20"
              />
              <span className="absolute right-2 top-2 text-brand-silver text-sm">%</span>
            </div>
          </div>
          <div>
            <label className={labelClass}>Gratuity</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={gratuity}
                onChange={(e) => setGratuity(e.target.value)}
                onBlur={() => save({ gratuity_default: parseFloat(gratuity) / 100 || 0 })}
                className={fieldClass + ' pr-6'}
                placeholder="20"
              />
              <span className="absolute right-2 top-2 text-brand-silver text-sm">%</span>
            </div>
          </div>
          <div>
            <label className={labelClass}>Admin Fee</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={adminFee}
                onChange={(e) => setAdminFee(e.target.value)}
                onBlur={() => save({ admin_fee_default: parseFloat(adminFee) / 100 || 0 })}
                className={fieldClass + ' pr-6'}
                placeholder="5"
              />
              <span className="absolute right-2 top-2 text-brand-silver text-sm">%</span>
            </div>
          </div>
        </div>
      </div>

      {mode === 'create' && (
        <button
          onClick={handleCreate}
          disabled={saveState === 'saving' || !name.trim()}
          className="bg-brand-brown text-white text-sm font-medium rounded px-5 py-2.5 hover:bg-brand-charcoal disabled:opacity-50 transition-colors"
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
