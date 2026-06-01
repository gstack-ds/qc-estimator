'use client';

import { useState, useRef } from 'react';
import {
  Bus, Mic2, Lightbulb, Utensils, Wine, Monitor, Speaker, Battery,
  Cable, Flower2, Package, Camera, Music, Truck, Users, Star, Tent, Shirt,
  X, Upload, ImageIcon,
} from 'lucide-react';
import type { LucideIconName } from '@/lib/utils/suggestIcon';
import { uploadLineItemThumbnail } from '@/app/(programs)/programs/[id]/estimates/actions';

export const ICON_MAP: Record<LucideIconName, React.ElementType> = {
  Bus, Mic2, Lightbulb, Utensils, Wine, Monitor, Speaker, Battery,
  Cable, Flower2, Package, Camera, Music, Truck, Users, Star, Tent, Shirt,
};

const ALL_ICONS = Object.entries(ICON_MAP) as [LucideIconName, React.ElementType][];

interface Props {
  lineItemId: string;
  thumbnailUrl?: string | null;
  thumbnailIcon?: string | null;
  suggestedIcon?: LucideIconName;
  onChange: (patch: { thumbnailUrl?: string | null; thumbnailIcon?: string | null }) => void;
}

export function ThumbnailPreview({
  thumbnailUrl,
  thumbnailIcon,
  size = 32,
}: {
  thumbnailUrl?: string | null;
  thumbnailIcon?: string | null;
  size?: number;
}) {
  if (thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbnailUrl}
        alt=""
        style={{ width: size, height: size, objectFit: 'cover', borderRadius: 4 }}
      />
    );
  }
  if (thumbnailIcon && thumbnailIcon in ICON_MAP) {
    const Icon = ICON_MAP[thumbnailIcon as LucideIconName];
    return <Icon size={size * 0.7} className="text-brand-charcoal/40" />;
  }
  return <ImageIcon size={size * 0.7} className="text-brand-cream" />;
}

export default function ThumbnailCell({ lineItemId, thumbnailUrl, thumbnailIcon, suggestedIcon, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const { error, url } = await uploadLineItemThumbnail(lineItemId, base64, file.type);
      setUploading(false);
      if (error) { setUploadError(error); return; }
      onChange({ thumbnailUrl: url, thumbnailIcon: null });
      setOpen(false);
    };
    reader.readAsDataURL(file);
  }

  function handleIconPick(name: LucideIconName) {
    onChange({ thumbnailUrl: null, thumbnailIcon: name });
    setOpen(false);
  }

  function handleRemove() {
    onChange({ thumbnailUrl: null, thumbnailIcon: null });
    setOpen(false);
  }

  const hasThumb = !!(thumbnailUrl || thumbnailIcon);

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-8 h-8 rounded flex items-center justify-center border transition-colors ${
          hasThumb
            ? 'border-brand-cream bg-white hover:border-brand-copper/40'
            : 'border-dashed border-brand-cream/60 hover:border-brand-copper/40 bg-white'
        }`}
        title={hasThumb ? 'Change thumbnail' : 'Add thumbnail'}
      >
        <ThumbnailPreview thumbnailUrl={thumbnailUrl} thumbnailIcon={thumbnailIcon} size={28} />
      </button>

      {open && (
        <div className="absolute left-0 top-9 z-50 bg-white border border-brand-cream rounded-lg shadow-lg p-3 w-52">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-brand-charcoal/60 uppercase tracking-wide">Thumbnail</span>
            <button onClick={() => setOpen(false)} className="text-brand-silver/50 hover:text-brand-charcoal">
              <X size={12} />
            </button>
          </div>

          {/* Upload photo */}
          <label className="flex items-center gap-2 w-full text-xs text-brand-charcoal/70 hover:text-brand-charcoal cursor-pointer py-1.5 px-2 rounded hover:bg-brand-offwhite transition-colors">
            <Upload size={13} />
            {uploading ? 'Uploading…' : 'Upload photo'}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>

          {uploadError && <p className="text-[10px] text-red-500 px-2 py-1">{uploadError}</p>}

          {/* Suggested icon */}
          {suggestedIcon && !hasThumb && (
            <button
              onClick={() => handleIconPick(suggestedIcon)}
              className="flex items-center gap-2 w-full text-xs text-brand-copper hover:text-brand-brown py-1.5 px-2 rounded hover:bg-brand-cream/30 transition-colors"
            >
              {(() => { const I = ICON_MAP[suggestedIcon]; return <I size={13} />; })()}
              Use suggested: {suggestedIcon}
            </button>
          )}

          <div className="border-t border-brand-cream/60 mt-2 pt-2">
            <p className="text-[9px] text-brand-silver/60 uppercase tracking-wide mb-1.5 px-1">Pick icon</p>
            <div className="grid grid-cols-6 gap-1">
              {ALL_ICONS.map(([name, Icon]) => (
                <button
                  key={name}
                  onClick={() => handleIconPick(name)}
                  title={name}
                  className={`p-1 rounded flex items-center justify-center transition-colors ${
                    thumbnailIcon === name
                      ? 'bg-brand-copper/20 text-brand-brown'
                      : 'hover:bg-brand-offwhite text-brand-charcoal/50 hover:text-brand-charcoal'
                  }`}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>

          {hasThumb && (
            <button
              onClick={handleRemove}
              className="flex items-center gap-1 w-full text-xs text-red-400 hover:text-red-600 py-1.5 px-2 rounded hover:bg-red-50 mt-2 transition-colors"
            >
              <X size={11} /> Remove thumbnail
            </button>
          )}
        </div>
      )}
    </div>
  );
}
