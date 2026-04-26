'use client';

import { useState, useEffect, useRef } from 'react';
import {
  uploadAttachment,
  getAttachmentsForEstimate,
  deleteAttachment,
  extractAttachmentData,
  type AttachmentRecord,
  type ExtractedData,
} from '@/app/(programs)/programs/[id]/estimates/actions';

interface Props {
  estimateId: string;
  estimateType?: 'venue' | 'av' | 'decor';
  onPopulateLineItems?: (data: ExtractedData) => void;
  onPopulateEstimateDetails?: (data: ExtractedData) => void;
}

type ExtractionStatus =
  | { status: 'idle' }
  | { status: 'extracting' }
  | { status: 'error'; message: string }
  | { status: 'done'; data: ExtractedData };

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildCanvaCopyText(data: ExtractedData): string {
  const lines: string[] = [];
  if (data.menuItems.length > 0) {
    lines.push('MENU ITEMS', '');
    for (const item of data.menuItems) {
      lines.push(item.name);
      if (item.description) lines.push(item.description);
      lines.push(`$${(item.pricePerPerson ?? 0).toFixed(2)} per person`, '');
    }
  }
  if (data.venueFees.length > 0) {
    lines.push('VENUE FEES', '');
    for (const fee of data.venueFees) {
      const val = fee.type === 'percentage' ? `${fee.value ?? 0}%` : `$${(fee.value ?? 0).toFixed(2)}`;
      lines.push(`${fee.name}: ${val}`);
    }
  }
  return lines.join('\n').trim();
}

export default function AttachmentsPanel({ estimateId, estimateType = 'venue', onPopulateLineItems, onPopulateEstimateDetails }: Props) {
  const [records, setRecords] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [extractionState, setExtractionState] = useState<Record<string, ExtractionStatus>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [detailsToast, setDetailsToast] = useState<{ id: string; msg: string } | null>(null);
  const [populatedLineItems, setPopulatedLineItems] = useState<Set<string>>(new Set());
  const [populatedDetails, setPopulatedDetails] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, [estimateId]);

  async function load() {
    setLoading(true);
    const { records: r, error: e } = await getAttachmentsForEstimate(estimateId);
    setRecords(r);
    if (e) setError(e);
    // Seed extraction state from DB-stored results
    const initial: Record<string, ExtractionStatus> = {};
    for (const rec of r) {
      if (rec.extracted_data) {
        initial[rec.id] = { status: 'done', data: rec.extracted_data };
      }
    }
    setExtractionState(initial);
    setLoading(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('estimateId', estimateId);

    const { error: uploadError, record } = await uploadAttachment(formData);
    setUploading(false);

    if (uploadError) {
      setError(uploadError);
      return;
    }

    if (record) {
      setRecords((prev) => [record, ...prev]);
      if (record.mime_type === 'application/pdf' && record.extracted_data === null) {
        triggerExtraction(record.id);
      }
    }
  }

  async function triggerExtraction(attachmentId: string) {
    setPopulatedLineItems((prev) => { const s = new Set(prev); s.delete(attachmentId); return s; });
    setPopulatedDetails((prev) => { const s = new Set(prev); s.delete(attachmentId); return s; });
    setExtractionState((prev) => ({ ...prev, [attachmentId]: { status: 'extracting' } }));
    const { error: extractErr, data } = await extractAttachmentData(attachmentId, estimateType);
    if (extractErr || !data) {
      setExtractionState((prev) => ({
        ...prev,
        [attachmentId]: { status: 'error', message: extractErr ?? 'Extraction failed' },
      }));
    } else {
      setExtractionState((prev) => ({ ...prev, [attachmentId]: { status: 'done', data } }));
    }
  }

  async function handleDelete(record: AttachmentRecord) {
    setDeletingId(record.id);
    const { error: deleteError } = await deleteAttachment(record.id, record.storage_path);
    if (deleteError) {
      setError(deleteError);
    } else {
      setRecords((prev) => prev.filter((r) => r.id !== record.id));
      setExtractionState((prev) => {
        const next = { ...prev };
        delete next[record.id];
        return next;
      });
      setPopulatedLineItems((prev) => { const s = new Set(prev); s.delete(record.id); return s; });
      setPopulatedDetails((prev) => { const s = new Set(prev); s.delete(record.id); return s; });
    }
    setDeletingId(null);
  }

  function handlePopulateLineItems(attachmentId: string, data: ExtractedData) {
    if (!onPopulateLineItems) return;
    onPopulateLineItems(data);
    setPopulatedLineItems((prev) => new Set([...prev, attachmentId]));
  }

  function handlePopulateDetails(attachmentId: string, data: ExtractedData) {
    if (!onPopulateEstimateDetails) return;
    const fees = data.venueFees;
    let count = 0;
    if (data.venueName) count++;
    if (data.roomSpace) count++;
    if (fees.some((f) => ['f&b', 'food', 'beverage'].some((kw) => f.name.toLowerCase().includes(kw)))) count++;
    if (fees.some((f) => f.name.toLowerCase().includes('service charge'))) count++;
    if (fees.some((f) => f.name.toLowerCase().includes('gratuity'))) count++;
    if (fees.some((f) => f.name.toLowerCase().includes('admin'))) count++;
    onPopulateEstimateDetails(data);
    setPopulatedDetails((prev) => new Set([...prev, attachmentId]));
    const msg = count > 0
      ? `Populated ${count} estimate field${count !== 1 ? 's' : ''}.`
      : 'No estimate fields found in this PDF.';
    setDetailsToast({ id: attachmentId, msg });
    setTimeout(() => setDetailsToast((t) => t?.id === attachmentId ? null : t), 3000);
  }

  async function handleCopyToCanva(attachmentId: string, data: ExtractedData) {
    const text = buildCanvaCopyText(data);
    await navigator.clipboard.writeText(text);
    setCopiedId(attachmentId);
    setTimeout(() => setCopiedId((id) => id === attachmentId ? null : id), 2000);
  }

  const labelClass = 'text-xs font-medium text-brand-charcoal/60 tracking-wide uppercase';

  return (
    <div className="bg-white border border-brand-cream rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <span className={labelClass}>Attachments</span>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs px-2.5 py-1 rounded border border-brand-cream bg-white hover:bg-brand-offwhite text-brand-charcoal/70 hover:text-brand-charcoal transition-colors disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : '+ Upload File'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {loading ? (
        <p className="text-xs text-brand-silver py-2">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-xs text-brand-silver py-2">No attachments yet. Upload a PDF or image.</p>
      ) : (
        <ul className="space-y-3">
          {records.map((rec) => {
            const extraction = extractionState[rec.id] ?? { status: 'idle' };
            const isPdf = rec.mime_type === 'application/pdf';
            return (
              <li key={rec.id} className="border-b border-brand-cream/60 last:border-0 pb-3 last:pb-0">
                {/* File row */}
                <div className="flex items-center gap-2 py-1">
                  <span className="text-brand-silver text-xs w-5 text-center flex-shrink-0">
                    {isPdf ? '📄' : '🖼'}
                  </span>
                  <a
                    href={rec.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-brand-charcoal hover:text-brand-brown truncate"
                    title={rec.file_name}
                  >
                    {rec.file_name}
                  </a>
                  {extraction.status === 'done' && (
                    <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-100 rounded px-1.5 py-0.5 flex-shrink-0 whitespace-nowrap">
                      ✓ AI extracted
                    </span>
                  )}
                  <span className="text-xs text-brand-silver flex-shrink-0 whitespace-nowrap">
                    {formatFileSize(rec.file_size)} · {formatDate(rec.created_at)}
                  </span>
                  <button
                    onClick={() => handleDelete(rec)}
                    disabled={deletingId === rec.id}
                    className="text-brand-silver hover:text-red-500 transition-colors flex-shrink-0 disabled:opacity-40"
                    title="Delete attachment"
                  >
                    {deletingId === rec.id ? (
                      <span className="text-xs">…</span>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Extraction UI — PDFs only */}
                {isPdf && (
                  <div className="mt-1.5 ml-7">
                    {extraction.status === 'extracting' && (
                      <p className="text-xs text-brand-silver italic">Processing with AI…</p>
                    )}

                    {extraction.status === 'error' && (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-red-500">{extraction.message}</p>
                        <button
                          onClick={() => triggerExtraction(rec.id)}
                          className="text-xs text-brand-copper hover:underline"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {extraction.status === 'idle' && (
                      <button
                        onClick={() => triggerExtraction(rec.id)}
                        className="text-xs text-brand-copper hover:underline"
                      >
                        {estimateType === 'av' ? 'Extract AV data' : estimateType === 'decor' ? 'Extract decor data' : 'Extract menu data'}
                      </button>
                    )}

                    {extraction.status === 'done' && (
                      <ExtractionResultPanel
                        attachmentId={rec.id}
                        data={extraction.data}
                        onCopyToCanva={() => handleCopyToCanva(rec.id, extraction.data)}
                        onPopulateLineItems={onPopulateLineItems ? () => handlePopulateLineItems(rec.id, extraction.data) : undefined}
                        onPopulateEstimateDetails={onPopulateEstimateDetails ? () => handlePopulateDetails(rec.id, extraction.data) : undefined}
                        copied={copiedId === rec.id}
                        detailsToast={detailsToast?.id === rec.id ? detailsToast.msg : undefined}
                        lineItemsPopulated={populatedLineItems.has(rec.id)}
                        detailsPopulated={populatedDetails.has(rec.id)}
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface ExtractionResultPanelProps {
  attachmentId: string;
  data: ExtractedData;
  onCopyToCanva: () => void;
  onPopulateLineItems?: () => void;
  onPopulateEstimateDetails?: () => void;
  copied: boolean;
  detailsToast?: string;
  lineItemsPopulated: boolean;
  detailsPopulated: boolean;
}

function ExtractionResultPanel({ data, onCopyToCanva, onPopulateLineItems, onPopulateEstimateDetails, copied, detailsToast, lineItemsPopulated, detailsPopulated }: ExtractionResultPanelProps) {
  const hasItems = data.menuItems.length > 0;
  const hasEquipment = (data.equipmentItems?.length ?? 0) > 0;
  const hasFees = data.venueFees.length > 0;
  const hasEstimateDetails = hasFees || !!data.venueName || !!data.roomSpace;

  if (!hasItems && !hasEquipment && !hasFees && !data.venueName && !data.roomSpace) {
    return <p className="text-xs text-brand-silver">No data found in this PDF.</p>;
  }

  return (
    <div className="space-y-2">
      {/* Action buttons */}
      <div className="flex items-center flex-wrap gap-2">
        <button
          onClick={onCopyToCanva}
          className="text-xs px-2 py-0.5 rounded border border-brand-cream bg-white hover:bg-brand-offwhite text-brand-charcoal/70 hover:text-brand-charcoal transition-colors"
        >
          {copied ? 'Copied!' : 'Copy to Canva'}
        </button>
        {onPopulateLineItems && (hasItems || hasEquipment) && (
          <button
            onClick={lineItemsPopulated ? undefined : onPopulateLineItems}
            disabled={lineItemsPopulated}
            className={lineItemsPopulated
              ? 'text-xs px-2 py-0.5 rounded border border-green-200 bg-green-50 text-green-700 cursor-default'
              : 'text-xs px-2 py-0.5 rounded border border-brand-copper/40 bg-brand-copper/5 hover:bg-brand-copper/10 text-brand-copper transition-colors'
            }
          >
            {lineItemsPopulated ? 'Line Items Added ✓' : 'Populate Line Items'}
          </button>
        )}
        {onPopulateEstimateDetails && hasEstimateDetails && (
          <button
            onClick={detailsPopulated ? undefined : onPopulateEstimateDetails}
            disabled={detailsPopulated}
            className={detailsPopulated
              ? 'text-xs px-2 py-0.5 rounded border border-green-200 bg-green-50 text-green-700 cursor-default'
              : 'text-xs px-2 py-0.5 rounded border border-brand-copper/40 bg-brand-copper/5 hover:bg-brand-copper/10 text-brand-copper transition-colors'
            }
          >
            {detailsPopulated ? 'Details Applied ✓' : 'Populate Estimate Details'}
          </button>
        )}
      </div>
      {detailsToast && (
        <p className="text-xs text-green-700">{detailsToast}</p>
      )}

      {!hasItems && !hasEquipment && (
        <p className="text-xs text-brand-silver italic">No pricing items found in this document.</p>
      )}

      {/* Menu items table */}
      {hasItems && (
        <div className="rounded border border-brand-cream overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-brand-offwhite">
              <tr>
                <th className="text-left px-2 py-1 text-brand-charcoal/60 font-medium">Item</th>
                <th className="text-right px-2 py-1 text-brand-charcoal/60 font-medium w-20">$/person</th>
                <th className="text-left px-2 py-1 text-brand-charcoal/60 font-medium w-20">Type</th>
              </tr>
            </thead>
            <tbody>
              {data.menuItems.map((item, i) => (
                <tr key={i} className="border-t border-brand-cream/60">
                  <td className="px-2 py-1">
                    <span className="font-medium text-brand-charcoal">{item.name}</span>
                    {item.description && (
                      <span className="block text-brand-silver truncate max-w-[200px]" title={item.description}>
                        {item.description}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right text-brand-charcoal tabular-nums">
                    ${(item.pricePerPerson ?? 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-1 text-brand-silver capitalize">
                    {item.category === 'na_beverage' ? 'NA bev' : item.category}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Equipment / AV / Decor items */}
      {hasEquipment && (
        <div className="rounded border border-brand-cream overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-brand-offwhite">
              <tr>
                <th className="text-left px-2 py-1 text-brand-charcoal/60 font-medium">Item</th>
                <th className="text-right px-2 py-1 text-brand-charcoal/60 font-medium w-12">Qty</th>
                <th className="text-right px-2 py-1 text-brand-charcoal/60 font-medium w-20">Unit Price</th>
                <th className="text-left px-2 py-1 text-brand-charcoal/60 font-medium w-20">Section</th>
              </tr>
            </thead>
            <tbody>
              {data.equipmentItems.map((item, i) => (
                <tr key={i} className="border-t border-brand-cream/60">
                  <td className="px-2 py-1">
                    <span className="font-medium text-brand-charcoal">{item.name}</span>
                    {item.description && (
                      <span className="block text-brand-silver truncate max-w-[200px]" title={item.description}>
                        {item.description}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right text-brand-charcoal tabular-nums">{item.qty ?? 1}</td>
                  <td className="px-2 py-1 text-right text-brand-charcoal tabular-nums">${(item.unitPrice ?? 0).toFixed(2)}</td>
                  <td className="px-2 py-1 text-brand-silver capitalize">{item.section.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Venue fees */}
      {hasFees && (
        <div className="rounded border border-brand-cream overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-brand-offwhite">
              <tr>
                <th className="text-left px-2 py-1 text-brand-charcoal/60 font-medium">Venue Fee</th>
                <th className="text-right px-2 py-1 text-brand-charcoal/60 font-medium w-24">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.venueFees.map((fee, i) => (
                <tr key={i} className="border-t border-brand-cream/60">
                  <td className="px-2 py-1 text-brand-charcoal">{fee.name}</td>
                  <td className="px-2 py-1 text-right text-brand-charcoal tabular-nums">
                    {fee.type === 'percentage' ? `${fee.value ?? 0}%` : `$${(fee.value ?? 0).toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
