'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { DbProgramWithLocation, DbLocation } from '@/lib/supabase/queries';
import {
  createProgram,
  updateProgram,
  extractProgramBriefFromPath,
  registerProgramAttachment,
  getProgramAttachments,
  deleteProgramAttachment,
  type ExtractedProgramBrief,
  type ProgramAttachmentRecord,
} from '@/app/(programs)/programs/actions';
import { createClient } from '@/lib/supabase/client';

interface Props {
  program?: DbProgramWithLocation;
  locations: DbLocation[];
  mode: 'create' | 'edit';
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface PendingFile {
  key: string;
  file: File;
  storagePath: string;
  extracted: ExtractedProgramBrief | null;
  extracting: boolean;
  extractError: string | null;
}

const SERVICE_STYLES = ['Family Style', 'Plated', 'Buffet', 'Stations', 'Cocktail Reception'];
const ALCOHOL_TYPES = ['Full Bar', 'Beer & Wine', 'None'];

function countExtractedFields(data: ExtractedProgramBrief | null): number {
  if (!data) return 0;
  const fields: (keyof ExtractedProgramBrief)[] = [
    'eventName', 'clientName', 'companyName', 'eventDate', 'guestCount',
    'serviceStyle', 'alcoholType', 'eventStartTime', 'eventEndTime', 'clientHotel', 'locationHint',
  ];
  return fields.filter((f) => data[f] != null && data[f] !== '').length;
}

function calcDuration(start: string, end: string): string {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60;
  const diff = endMins - startMins;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function findLocationMatch(hint: string, locations: DbLocation[]): string | null {
  if (!hint) return null;
  const tokens = hint.toLowerCase().split(/[,\s]+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return null;
  const matches = locations.filter((loc) => {
    const n = loc.name.toLowerCase();
    return tokens.some((t) => n.includes(t));
  });
  return matches.length === 1 ? matches[0].id : null;
}

export default function ProgramForm({ program, locations, mode }: Props) {
  const router = useRouter();
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form state
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

  // PDF attachments — create mode uses pending array, edit mode uses DB records
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [attachments, setAttachments] = useState<ProgramAttachmentRecord[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const briefFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'edit' && program?.id) {
      getProgramAttachments(program.id).then(({ records }) => setAttachments(records));
    }
  }, [mode, program?.id]);

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

  // Drop a new PDF — extract only, don't populate yet
  async function handleBriefFile(file: File) {
    if (file.type !== 'application/pdf') { setUploadError('Only PDF files are supported.'); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadError('File exceeds 10 MB limit.'); return; }
    setUploadError(null);

    if (mode === 'create') {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const ext = file.name.split('.').pop() ?? '';
      const storagePath = `temp/${key}.${ext}`;
      setPendingFiles((prev) => [...prev, { key, file, storagePath, extracted: null, extracting: true, extractError: null }]);

      const supabase = createClient();
      const { error: storageErr } = await supabase.storage
        .from('estimate-attachments')
        .upload(storagePath, file, { contentType: file.type });

      if (storageErr) {
        setPendingFiles((prev) => prev.map((p) =>
          p.key === key ? { ...p, extracting: false, extractError: storageErr.message } : p
        ));
        return;
      }

      const { error, data } = await extractProgramBriefFromPath(storagePath);
      setPendingFiles((prev) => prev.map((p) =>
        p.key === key ? { ...p, extracting: false, extracted: data, extractError: error ?? null } : p
      ));
    } else {
      // Edit mode: upload immediately, show in attachments list
      const key = `uploading-${Date.now()}`;
      setAttachments((prev) => [{
        id: key, program_id: program!.id, file_name: file.name,
        storage_path: '', file_size: file.size, mime_type: file.type,
        created_at: new Date().toISOString(), url: '', extracted_data: null,
      }, ...prev]);

      const ext = file.name.split('.').pop() ?? '';
      const storagePath = `programs/${program!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const supabase = createClient();
      const { error: storageErr } = await supabase.storage
        .from('estimate-attachments')
        .upload(storagePath, file, { contentType: file.type });

      if (storageErr) {
        setAttachments((prev) => prev.filter((a) => a.id !== key));
        setUploadError(storageErr.message);
        return;
      }

      const { error: extractErr, data } = await extractProgramBriefFromPath(storagePath);
      const { record, error: regErr } = await registerProgramAttachment({
        programId: program!.id,
        storagePath,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        extractedData: data ?? null,
      });

      if (regErr || extractErr) {
        setAttachments((prev) => prev.filter((a) => a.id !== key));
        setUploadError(regErr ?? extractErr ?? 'Upload failed');
      } else if (record) {
        setAttachments((prev) => prev.map((a) => a.id === key ? record : a));
      }
    }
  }

  // Apply one PDF's extracted data to form fields, with confirmation if overwriting
  function handlePopulate(data: ExtractedProgramBrief) {
    const overwrites: string[] = [];
    if (data.eventName && name.trim()) overwrites.push('Program Name');
    if (data.clientName && clientName.trim()) overwrites.push('Client Name');
    if (data.companyName && companyName.trim()) overwrites.push('Company Name');
    if (data.eventDate && eventDate) overwrites.push('Event Date');
    if (data.guestCount && guestCount && parseInt(guestCount) > 0) overwrites.push('Guest Count');
    if (data.serviceStyle && SERVICE_STYLES.includes(data.serviceStyle) && serviceStyle) overwrites.push('Service Style');
    if (data.alcoholType && ALCOHOL_TYPES.includes(data.alcoholType) && alcoholType) overwrites.push('Alcohol Type');
    if (data.eventStartTime && eventStartTime) overwrites.push('Start Time');
    if (data.eventEndTime && eventEndTime) overwrites.push('End Time');
    if (data.clientHotel && clientHotel.trim()) overwrites.push('Client Hotel');
    if (data.locationHint && findLocationMatch(data.locationHint, locations) && locationId) overwrites.push('Location');

    if (overwrites.length > 0) {
      const ok = window.confirm(`This will overwrite: ${overwrites.join(', ')}. Continue?`);
      if (!ok) return;
    }

    const patch: Record<string, unknown> = {};
    if (data.eventName) { setName(data.eventName); patch.name = data.eventName; }
    if (data.clientName) { setClientName(data.clientName); patch.client_name = data.clientName; }
    if (data.companyName) { setCompanyName(data.companyName); patch.company_name = data.companyName; }
    if (data.eventDate) { setEventDate(data.eventDate); patch.event_date = data.eventDate; }
    if (data.guestCount && data.guestCount > 0) { setGuestCount(String(data.guestCount)); patch.guest_count = data.guestCount; }
    if (data.serviceStyle && SERVICE_STYLES.includes(data.serviceStyle)) { setServiceStyle(data.serviceStyle); patch.service_style = data.serviceStyle; }
    if (data.alcoholType && ALCOHOL_TYPES.includes(data.alcoholType)) { setAlcoholType(data.alcoholType); patch.alcohol_type = data.alcoholType; }
    if (data.eventStartTime) { setEventStartTime(data.eventStartTime); patch.event_start_time = data.eventStartTime; }
    if (data.eventEndTime) { setEventEndTime(data.eventEndTime); patch.event_end_time = data.eventEndTime; }
    if (data.clientHotel) { setClientHotel(data.clientHotel); patch.client_hotel = data.clientHotel; }
    if (data.locationHint) {
      const matchId = findLocationMatch(data.locationHint, locations);
      if (matchId) { setLocationId(matchId); patch.location_id = matchId; }
    }

    if (mode === 'edit' && Object.keys(patch).length > 0) save(patch);
  }

  async function handleDeleteAttachment(rec: ProgramAttachmentRecord) {
    setDeletingId(rec.id);
    const { error } = await deleteProgramAttachment(rec.id, rec.storage_path);
    if (!error) setAttachments((prev) => prev.filter((a) => a.id !== rec.id));
    setDeletingId(null);
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
    // Register all pending files (already uploaded to Storage during drop)
    await Promise.all(
      pendingFiles.map((pf) => registerProgramAttachment({
        programId: result.id!,
        storagePath: pf.storagePath,
        fileName: pf.file.name,
        fileSize: pf.file.size,
        mimeType: pf.file.type,
        extractedData: pf.extracted ?? null,
      }))
    );
    router.push(`/programs/${result.id}`);
  }

  const fieldClass = 'w-full border border-brand-cream rounded px-3 py-2 text-sm text-brand-charcoal bg-white focus:outline-none focus:ring-2 focus:ring-brand-copper focus:border-brand-brown transition-colors';
  const labelClass = 'block text-xs font-medium text-brand-charcoal/60 tracking-wide mb-1';
  const sectionClass = 'grid grid-cols-2 gap-4';

  // Shared attachment row renderer
  function AttachmentRow({
    fileName, url, fieldCount, extracted, extracting, extractError, onPopulate, onDelete, deleting,
  }: {
    fileName: string; url: string; fieldCount: number;
    extracted: ExtractedProgramBrief | null; extracting: boolean; extractError: string | null;
    onPopulate?: () => void; onDelete: () => void; deleting: boolean;
  }) {
    return (
      <li className="flex items-center gap-2 py-1 border-b border-brand-cream/50 last:border-0">
        <span className="text-brand-silver text-xs w-4 text-center flex-shrink-0">📄</span>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="flex-1 text-xs text-brand-charcoal hover:text-brand-brown truncate" title={fileName}>
            {fileName}
          </a>
        ) : (
          <span className="flex-1 text-xs text-brand-charcoal/60 truncate">{fileName}</span>
        )}
        {extracting && <span className="text-[10px] text-brand-silver italic flex-shrink-0">Extracting…</span>}
        {extractError && <span className="text-[10px] text-red-500 flex-shrink-0">{extractError}</span>}
        {extracted && !extracting && (
          <>
            <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-100 rounded px-1.5 py-0.5 flex-shrink-0 whitespace-nowrap">
              ✓ {fieldCount} fields
            </span>
            {onPopulate && (
              <button
                onClick={onPopulate}
                className="text-[10px] px-2 py-0.5 rounded border border-brand-copper/40 bg-brand-copper/5 hover:bg-brand-copper/10 text-brand-copper transition-colors flex-shrink-0 whitespace-nowrap"
              >
                Populate Fields
              </button>
            )}
          </>
        )}
        <button
          onClick={onDelete}
          disabled={deleting}
          className="text-brand-silver/40 hover:text-red-500 transition-colors flex-shrink-0 disabled:opacity-40"
          title="Remove"
        >
          {deleting ? <span className="text-xs">…</span> : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>
      </li>
    );
  }

  const hasDocs = mode === 'create' ? pendingFiles.length > 0 : attachments.length > 0;

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

      {/* PDF dropzone + document list */}
      <div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleBriefFile(f); }}
          onClick={() => briefFileRef.current?.click()}
          className="border-2 border-dashed rounded-lg px-6 py-7 text-center cursor-pointer border-brand-cream hover:border-brand-copper/50 hover:bg-brand-offwhite/50 transition-colors"
        >
          <p className="text-sm font-medium text-brand-charcoal/70">Upload an event brief, RFP, or client document to auto-fill details.</p>
          <p className="text-xs text-brand-silver mt-1">PDF only · Max 10 MB · Click or drag · Multiple files supported</p>
        </div>
        <input
          ref={briefFileRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBriefFile(f); e.target.value = ''; }}
        />
        {uploadError && <p className="text-xs text-red-500 mt-2">{uploadError}</p>}

        {hasDocs && (
          <ul className="mt-3">
            {mode === 'create' && pendingFiles.map((pf) => (
              <AttachmentRow
                key={pf.key}
                fileName={pf.file.name}
                url=""
                fieldCount={countExtractedFields(pf.extracted)}
                extracted={pf.extracted}
                extracting={pf.extracting}
                extractError={pf.extractError}
                onPopulate={pf.extracted ? () => handlePopulate(pf.extracted!) : undefined}
                onDelete={() => {
                  createClient().storage.from('estimate-attachments').remove([pf.storagePath]);
                  setPendingFiles((prev) => prev.filter((p) => p.key !== pf.key));
                }}
                deleting={false}
              />
            ))}
            {mode === 'edit' && attachments.map((rec) => (
              <AttachmentRow
                key={rec.id}
                fileName={rec.file_name}
                url={rec.url}
                fieldCount={countExtractedFields(rec.extracted_data)}
                extracted={rec.extracted_data}
                extracting={rec.storage_path === ''}
                extractError={null}
                onPopulate={rec.extracted_data ? () => handlePopulate(rec.extracted_data!) : undefined}
                onDelete={() => handleDeleteAttachment(rec)}
                deleting={deletingId === rec.id}
              />
            ))}
          </ul>
        )}
      </div>

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
