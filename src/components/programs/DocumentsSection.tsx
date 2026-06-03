'use client';

import { useState, useRef, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Image, FileSpreadsheet, File, Upload, Trash2, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import type { DbProgramDocument, DocumentCategory } from '@/lib/supabase/queries';
import { DOCUMENT_CATEGORIES } from '@/lib/supabase/queries';
import {
  registerProgramDocument,
  updateProgramDocument,
  deleteProgramDocument,
} from '@/app/(programs)/programs/actions';

// ─── Helpers ──────────────────────────────────────────────

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
].join(',');

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function mimeIcon(mime: string) {
  if (mime === 'application/pdf') return <FileText size={14} className="text-red-400 flex-shrink-0" />;
  if (mime.startsWith('image/')) return <Image size={14} className="text-blue-400 flex-shrink-0" />;
  if (mime.includes('spreadsheet') || mime.includes('excel')) return <FileSpreadsheet size={14} className="text-green-500 flex-shrink-0" />;
  return <File size={14} className="text-brand-silver flex-shrink-0" />;
}

// Guess a reasonable default category from the file name
function guessCategory(fileName: string): DocumentCategory {
  const lower = fileName.toLowerCase();
  if (lower.includes('menu')) return 'Menu';
  if (lower.includes('contract') || lower.includes('agreement')) return 'Contract';
  if (lower.includes('invoice') || lower.includes('inv_')) return 'Invoice';
  if (lower.includes('floor') || lower.includes('layout') || lower.includes('diagram')) return 'Floor Plan';
  if (lower.includes('beo') || lower.includes('banquet')) return 'BEO';
  if (lower.includes('insurance') || lower.includes('cert')) return 'Insurance';
  if (lower.includes('proposal')) return 'Proposal';
  return 'Other';
}

// ─── Document row ─────────────────────────────────────────

function DocumentRow({
  doc, programId, onDelete, onUpdate,
}: {
  doc: DbProgramDocument;
  programId: string;
  onDelete: (id: string, storagePath: string) => void;
  onUpdate: (id: string, patch: Partial<{ category: DocumentCategory; notes: string | null }>) => void;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(doc.notes ?? '');
  const [, startTransition] = useTransition();

  function handleCategoryChange(cat: DocumentCategory) {
    onUpdate(doc.id, { category: cat });
    startTransition(async () => { await updateProgramDocument(doc.id, programId, { category: cat }); });
  }

  function handleNotesSave() {
    setEditingNotes(false);
    const trimmed = notes.trim() || null;
    onUpdate(doc.id, { notes: trimmed });
    startTransition(async () => { await updateProgramDocument(doc.id, programId, { notes: trimmed }); });
  }

  const isViewable = doc.mime_type === 'application/pdf' || doc.mime_type.startsWith('image/');

  return (
    <div className="group flex items-start gap-3 py-2.5 px-3 hover:bg-brand-offwhite/60 rounded-lg transition-colors">
      {/* File icon */}
      <div className="mt-0.5">{mimeIcon(doc.mime_type)}</div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {/* File name + open link */}
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-brand-charcoal hover:text-brand-brown transition-colors truncate max-w-[280px]"
            title={doc.file_name}
          >
            {doc.file_name}
          </a>
          {isViewable && (
            <a href={doc.url} target="_blank" rel="noopener noreferrer"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-brand-silver hover:text-brand-brown"
              title="Open in new tab">
              <ExternalLink size={11} />
            </a>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap text-[10px] text-brand-silver">
          <span>{fmtDate(doc.created_at)}</span>
          <span>·</span>
          <span>{fmtSize(doc.file_size)}</span>
          {/* Category dropdown */}
          <select
            value={doc.category}
            onChange={e => handleCategoryChange(e.target.value as DocumentCategory)}
            onClick={e => e.stopPropagation()}
            className="text-[10px] border border-brand-cream rounded px-1.5 py-0.5 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper"
          >
            {DOCUMENT_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        {editingNotes ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={handleNotesSave}
              onKeyDown={e => { if (e.key === 'Enter') handleNotesSave(); if (e.key === 'Escape') setEditingNotes(false); }}
              placeholder="Add a note…"
              className="text-xs border border-brand-cream rounded px-2 py-1 bg-white text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-copper w-64"
            />
          </div>
        ) : (
          <button
            onClick={() => setEditingNotes(true)}
            className={`text-[10px] text-left transition-colors hover:text-brand-brown ${doc.notes ? 'text-brand-charcoal/70' : 'opacity-0 group-hover:opacity-100 text-brand-silver italic'}`}
          >
            {doc.notes || 'Add note…'}
          </button>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(doc.id, doc.storage_path)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-brand-silver hover:text-red-500 p-1 flex-shrink-0 mt-0.5"
        title="Delete document"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── Upload zone ──────────────────────────────────────────

interface UploadZoneProps {
  programId: string;
  onUploaded: (doc: DbProgramDocument) => void;
}

function UploadZone({ programId, onUploaded }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]); // file names in progress
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const uploadFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setErrors(prev => [...prev, `${file.name}: exceeds 25 MB limit`]);
      return;
    }

    const ext = file.name.split('.').pop() ?? '';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `program-documents/${programId}/${Date.now()}_${safeName}`;

    setUploading(prev => [...prev, file.name]);

    // Client-side upload to Supabase Storage
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from('estimate-attachments')
      .upload(storagePath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      setErrors(prev => [...prev, `${file.name}: ${uploadError.message}`]);
      setUploading(prev => prev.filter(n => n !== file.name));
      return;
    }

    // Register in DB
    const category = guessCategory(file.name);
    const { id, error: dbError } = await registerProgramDocument({
      programId,
      storagePath,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      category,
    });

    setUploading(prev => prev.filter(n => n !== file.name));

    if (dbError || !id) {
      setErrors(prev => [...prev, `${file.name}: failed to save record`]);
      return;
    }

    // Get signed URL for immediate display
    const { data: signed } = await supabase.storage
      .from('estimate-attachments')
      .createSignedUrl(storagePath, 3600);

    const newDoc: DbProgramDocument = {
      id,
      program_id: programId,
      file_name: file.name,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      category,
      notes: null,
      uploaded_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      url: signed?.signedUrl ?? '',
    };
    onUploaded(newDoc);
    router.refresh();
  }, [programId, onUploaded, router]);

  async function handleFiles(files: FileList | File[]) {
    setErrors([]);
    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg px-6 py-5 text-center cursor-pointer transition-colors ${
          dragging ? 'border-brand-copper bg-brand-copper/5' : 'border-brand-cream hover:border-brand-copper/50 hover:bg-brand-offwhite/60'
        }`}
      >
        <Upload size={18} className="mx-auto mb-2 text-brand-silver/60" />
        <p className="text-sm text-brand-charcoal/70">
          Drop files here or <span className="text-brand-brown font-medium">browse</span>
        </p>
        <p className="text-xs text-brand-silver mt-0.5">PDF, images, Word, Excel — up to 25 MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Upload progress */}
      {uploading.length > 0 && (
        <div className="space-y-1">
          {uploading.map(name => (
            <div key={name} className="flex items-center gap-2 text-xs text-brand-silver">
              <div className="w-3 h-3 border-2 border-brand-copper border-t-transparent rounded-full animate-spin flex-shrink-0" />
              Uploading {name}…
            </div>
          ))}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-0.5">
          {errors.map((e, i) => (
            <p key={i} className="text-xs text-red-500">{e}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Category group ───────────────────────────────────────

function CategoryGroup({
  category, docs, programId, onDelete, onUpdate,
}: {
  category: string;
  docs: DbProgramDocument[];
  programId: string;
  onDelete: (id: string, storagePath: string) => void;
  onUpdate: (id: string, patch: Partial<{ category: DocumentCategory; notes: string | null }>) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div>
      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex items-center gap-2 w-full text-left px-1 py-1 group"
      >
        {collapsed ? <ChevronRight size={12} className="text-brand-silver" /> : <ChevronDown size={12} className="text-brand-silver" />}
        <span className="text-xs font-semibold text-brand-charcoal/70 uppercase tracking-wide">{category}</span>
        <span className="text-[10px] text-brand-silver ml-1">{docs.length}</span>
      </button>
      {!collapsed && (
        <div className="ml-2">
          {docs.map(doc => (
            <DocumentRow key={doc.id} doc={doc} programId={programId} onDelete={onDelete} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────

interface Props {
  programId: string;
  initialDocs: DbProgramDocument[];
  estimateAttachmentCount?: number;
}

export default function DocumentsSection({ programId, initialDocs, estimateAttachmentCount = 0 }: Props) {
  const [docs, setDocs] = useState<DbProgramDocument[]>(initialDocs);

  function handleUploaded(doc: DbProgramDocument) {
    setDocs(prev => [doc, ...prev]);
  }

  function handleDelete(id: string, storagePath: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    setDocs(prev => prev.filter(d => d.id !== id));
    deleteProgramDocument(id, programId, storagePath);
  }

  function handleUpdate(id: string, patch: Partial<{ category: DocumentCategory; notes: string | null }>) {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  }

  // Group by category in canonical order
  const grouped = DOCUMENT_CATEGORIES
    .map(cat => ({ cat, items: docs.filter(d => d.category === cat) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-brand-charcoal">Program Documents</h3>
          <p className="text-xs text-brand-silver mt-0.5">
            {docs.length} document{docs.length !== 1 ? 's' : ''}
            {estimateAttachmentCount > 0 && (
              <span> · {estimateAttachmentCount} estimate attachment{estimateAttachmentCount !== 1 ? 's' : ''} (see estimates)</span>
            )}
          </p>
        </div>
      </div>

      <UploadZone programId={programId} onUploaded={handleUploaded} />

      {docs.length === 0 && (
        <p className="text-xs text-brand-silver italic px-1">
          No documents yet. Upload menus, contracts, BEOs, floor plans, and other program files.
        </p>
      )}

      {grouped.length > 0 && (
        <div className="space-y-2 divide-y divide-brand-cream/40">
          {grouped.map(({ cat, items }) => (
            <div key={cat} className="pt-2 first:pt-0">
              <CategoryGroup
                category={cat}
                docs={items}
                programId={programId}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
