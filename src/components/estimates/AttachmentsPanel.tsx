'use client';

import { useState, useEffect, useRef } from 'react';
import {
  uploadAttachment,
  getAttachmentsForEstimate,
  deleteAttachment,
  type AttachmentRecord,
} from '@/app/(programs)/programs/[id]/estimates/actions';

interface Props {
  estimateId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AttachmentsPanel({ estimateId }: Props) {
  const [records, setRecords] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, [estimateId]);

  async function load() {
    setLoading(true);
    const { records: r, error: e } = await getAttachmentsForEstimate(estimateId);
    setRecords(r);
    if (e) setError(e);
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

    if (uploadError) {
      setError(uploadError);
    } else if (record) {
      setRecords((prev) => [record, ...prev]);
    }

    setUploading(false);
  }

  async function handleDelete(record: AttachmentRecord) {
    setDeletingId(record.id);
    const { error: deleteError } = await deleteAttachment(record.id, record.storage_path);
    if (deleteError) {
      setError(deleteError);
    } else {
      setRecords((prev) => prev.filter((r) => r.id !== record.id));
    }
    setDeletingId(null);
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

      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}

      {loading ? (
        <p className="text-xs text-brand-silver py-2">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-xs text-brand-silver py-2">No attachments yet. Upload a PDF or image.</p>
      ) : (
        <ul className="space-y-1">
          {records.map((rec) => (
            <li key={rec.id} className="flex items-center gap-2 py-1.5 border-b border-brand-cream/60 last:border-0">
              <span className="text-brand-silver text-xs w-5 text-center flex-shrink-0">
                {rec.mime_type === 'application/pdf' ? '📄' : '🖼'}
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
