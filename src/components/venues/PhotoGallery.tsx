'use client';

import { useState, useRef, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Image from 'next/image';
import {
  PHOTO_TAG_OPTIONS,
  type VendorPhoto,
  type PhotoTag,
} from '@/lib/vendors/profileTypes';
import {
  addVendorPhoto,
  updateVendorPhoto,
  deleteVendorPhoto,
  reorderVendorPhotos,
} from '@/app/(programs)/venues/profileActions';

// ── Upload helper ─────────────────────────────────────────────────────────────

async function uploadPhoto(
  file: File,
  vendorId: string,
): Promise<{ file_url: string; storage_path: string } | { error: string }> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${vendorId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('vendor-photos').upload(path, file);
  if (error) return { error: error.message };
  const { data: { publicUrl } } = supabase.storage.from('vendor-photos').getPublicUrl(path);
  return { file_url: publicUrl, storage_path: path };
}

// ── Tag badge ─────────────────────────────────────────────────────────────────

const TAG_COLORS: Record<PhotoTag, string> = {
  space:    'bg-blue-100 text-blue-700',
  food:     'bg-amber-100 text-amber-700',
  ambiance: 'bg-purple-100 text-purple-700',
  other:    'bg-gray-100 text-gray-600',
};

// ── Photo card ────────────────────────────────────────────────────────────────

function PhotoCard({
  photo,
  index,
  total,
  onMove,
  onUpdate,
  onDelete,
}: {
  photo: VendorPhoto;
  index: number;
  total: number;
  onMove: (id: string, dir: 'up' | 'down') => void;
  onUpdate: (id: string, data: { caption?: string | null; tag?: PhotoTag }) => void;
  onDelete: (id: string) => void;
}) {
  const [caption, setCaption] = useState(photo.caption ?? '');
  const [tag, setTag] = useState<PhotoTag>(photo.tag);
  const [confirming, setConfirming] = useState(false);

  function saveCaption() {
    const val = caption.trim() || null;
    if (val !== photo.caption) onUpdate(photo.id, { caption: val });
  }

  function saveTag(t: PhotoTag) {
    setTag(t);
    onUpdate(photo.id, { tag: t });
  }

  return (
    <div className="border border-brand-silver/30 rounded-lg overflow-hidden bg-white">
      <div className="relative aspect-[4/3] bg-gray-100">
        <Image
          src={photo.file_url}
          alt={photo.caption ?? 'Vendor photo'}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
      </div>

      <div className="p-2 space-y-2">
        {/* Caption */}
        <input
          type="text"
          value={caption}
          onChange={e => setCaption(e.target.value)}
          onBlur={saveCaption}
          placeholder="Caption (optional)"
          className="w-full text-xs border border-brand-silver/30 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-charcoal/40"
        />

        {/* Tag */}
        <div className="flex flex-wrap gap-1">
          {PHOTO_TAG_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => saveTag(opt.value)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                tag === opt.value
                  ? `${TAG_COLORS[opt.value]} border-transparent font-medium`
                  : 'border-brand-silver/40 text-brand-silver hover:border-brand-charcoal/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 pt-1">
          <button
            disabled={index === 0}
            onClick={() => onMove(photo.id, 'up')}
            className="text-xs px-2 py-0.5 rounded border border-brand-silver/30 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <button
            disabled={index === total - 1}
            onClick={() => onMove(photo.id, 'down')}
            className="text-xs px-2 py-0.5 rounded border border-brand-silver/30 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
          <div className="flex-1" />
          {confirming ? (
            <>
              <button
                onClick={() => onDelete(photo.id)}
                className="text-xs text-red-600 hover:text-red-800 font-medium"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-xs text-brand-silver hover:text-brand-charcoal"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="text-xs text-brand-silver hover:text-red-600"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) onFiles(files);
  }, [onFiles]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        dragging ? 'border-brand-charcoal bg-gray-50' : 'border-brand-silver/40 hover:border-brand-charcoal/50'
      }`}
    >
      <p className="text-sm text-brand-silver">
        Drop photos here or <span className="text-brand-charcoal font-medium">browse</span>
      </p>
      <p className="text-xs text-brand-silver/70 mt-1">JPEG, PNG, WebP · max 10 MB each</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={e => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  vendorId: string;
  initialPhotos: VendorPhoto[];
}

export default function PhotoGallery({ vendorId, initialPhotos }: Props) {
  const [photos, setPhotos] = useState<VendorPhoto[]>(
    [...initialPhotos].sort((a, b) => a.sort_order - b.sort_order),
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: File[]) {
    setUploading(true);
    setError(null);
    const nextOrder = photos.length > 0 ? Math.max(...photos.map(p => p.sort_order)) + 1 : 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const upload = await uploadPhoto(file, vendorId);
      if ('error' in upload) {
        setError(`Upload failed: ${upload.error}`);
        break;
      }
      const result = await addVendorPhoto(vendorId, {
        file_url: upload.file_url,
        storage_path: upload.storage_path,
        sort_order: nextOrder + i,
      });
      if ('error' in result) {
        setError(`DB insert failed: ${result.error}`);
        break;
      }
      setPhotos(prev => [
        ...prev,
        {
          id: result.id,
          vendor_id: vendorId,
          file_url: upload.file_url,
          storage_path: upload.storage_path,
          caption: null,
          tag: 'other',
          sort_order: nextOrder + i,
          created_at: new Date().toISOString(),
        } satisfies VendorPhoto,
      ]);
    }
    setUploading(false);
  }

  async function handleMove(id: string, dir: 'up' | 'down') {
    const idx = photos.findIndex(p => p.id === id);
    if (idx < 0) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= photos.length) return;

    const next = [...photos];
    const a = next[idx];
    const b = next[swapIdx];
    const tmpOrder = a.sort_order;
    next[idx] = { ...a, sort_order: b.sort_order };
    next[swapIdx] = { ...b, sort_order: tmpOrder };
    next.sort((x, y) => x.sort_order - y.sort_order);
    setPhotos(next);

    await reorderVendorPhotos(vendorId, [
      { id: a.id, sort_order: b.sort_order },
      { id: b.id, sort_order: tmpOrder },
    ]);
  }

  async function handleUpdate(id: string, data: { caption?: string | null; tag?: PhotoTag }) {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    await updateVendorPhoto(id, vendorId, data);
  }

  async function handleDelete(id: string) {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;
    setPhotos(prev => prev.filter(p => p.id !== id));
    await deleteVendorPhoto(id, vendorId, photo.storage_path);
  }

  return (
    <div className="space-y-4">
      <DropZone onFiles={handleFiles} />

      {uploading && (
        <p className="text-xs text-brand-silver animate-pulse">Uploading…</p>
      )}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {photos.length === 0 && !uploading && (
        <p className="text-sm text-brand-silver/60 text-center py-4">No photos yet</p>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map((photo, idx) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              index={idx}
              total={photos.length}
              onMove={handleMove}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
