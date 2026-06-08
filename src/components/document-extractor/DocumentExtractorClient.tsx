'use client';

import { useState, useRef, useCallback } from 'react';

type Model = 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-6' | 'claude-opus-4-8';

interface ExtractedSection {
  title: string;
  content: string;
}

interface ExtractedImage {
  name: string;
  mimeType: string;
  dataUrl: string;
}

const MODEL_OPTIONS: { value: Model; label: string }[] = [
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku (fast, cheap)' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet (recommended)' },
  { value: 'claude-opus-4-8', label: 'Opus (most thorough)' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handle}
      className="text-xs px-2 py-1 rounded border border-brand-silver text-brand-slate hover:bg-brand-silver/20 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function DocumentExtractorClient() {
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<Model>('claude-sonnet-4-6');
  const [dragging, setDragging] = useState(false);

  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [sections, setSections] = useState<ExtractedSection[] | null>(null);

  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [images, setImages] = useState<ExtractedImage[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback((f: File) => {
    const name = f.name.toLowerCase();
    if (!name.endsWith('.pdf') && !name.endsWith('.docx')) {
      setTextError('Only PDF and .docx files are supported.');
      return;
    }
    setFile(f);
    setSections(null);
    setImages(null);
    setTextError(null);
    setImgError(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  }, [acceptFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
  };

  const buildFormData = () => {
    const fd = new FormData();
    fd.append('file', file!);
    return fd;
  };

  const extractText = async () => {
    if (!file) return;
    setTextLoading(true);
    setTextError(null);
    setSections(null);
    try {
      const fd = buildFormData();
      fd.append('model', model);
      const res = await fetch('/api/document-extractor/text', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Extraction failed');
      setSections(json.sections);
    } catch (err) {
      setTextError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setTextLoading(false);
    }
  };

  const extractImages = async () => {
    if (!file) return;
    setImgLoading(true);
    setImgError(null);
    setImages(null);
    try {
      const fd = buildFormData();
      const res = await fetch('/api/document-extractor/images', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Extraction failed');
      setImages(json.images);
    } catch (err) {
      setImgError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setImgLoading(false);
    }
  };

  const downloadImage = (img: ExtractedImage) => {
    const a = document.createElement('a');
    a.href = img.dataUrl;
    a.download = img.name;
    a.click();
  };

  const downloadAllImages = async () => {
    if (!images?.length) return;
    // Dynamic import jszip for the zip-and-download operation
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (const img of images) {
      const base64 = img.dataUrl.split(',')[1];
      zip.file(img.name, base64, { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${file?.name.replace(/\.[^.]+$/, '') ?? 'images'}-extracted.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors select-none ${
          dragging
            ? 'border-brand-copper bg-brand-copper/5'
            : 'border-brand-silver hover:border-brand-slate'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={onFileChange}
        />
        {file ? (
          <div>
            <p className="font-medium text-brand-charcoal">{file.name}</p>
            <p className="text-sm text-brand-slate mt-1">{(file.size / 1024).toFixed(0)} KB — click or drop to replace</p>
          </div>
        ) : (
          <div>
            <p className="text-brand-slate font-medium">Drop a PDF or .docx here</p>
            <p className="text-sm text-brand-slate/70 mt-1">or click to browse</p>
          </div>
        )}
      </div>

      {file && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Model selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-brand-slate whitespace-nowrap">Model:</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as Model)}
              className="text-sm border border-brand-silver rounded px-2 py-1 bg-white text-brand-charcoal"
            >
              {MODEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={extractText}
            disabled={textLoading}
            className="px-4 py-1.5 text-sm font-medium rounded bg-brand-charcoal text-white hover:bg-brand-charcoal/80 disabled:opacity-50 transition-colors"
          >
            {textLoading ? 'Extracting text…' : 'Extract text'}
          </button>

          <button
            onClick={extractImages}
            disabled={imgLoading}
            className="px-4 py-1.5 text-sm font-medium rounded border border-brand-charcoal text-brand-charcoal hover:bg-brand-charcoal/5 disabled:opacity-50 transition-colors"
          >
            {imgLoading ? 'Extracting images…' : 'Extract images'}
          </button>
        </div>
      )}

      {/* Text extraction results */}
      {textError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{textError}</div>
      )}
      {sections && sections.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-brand-charcoal uppercase tracking-wide">Extracted Content</h2>
          {sections.map((sec, i) => (
            <div key={i} className="rounded-lg border border-brand-silver bg-white">
              <div className="flex items-center justify-between px-4 py-2 border-b border-brand-silver/50">
                <span className="font-medium text-sm text-brand-charcoal">{sec.title}</span>
                <CopyButton text={sec.content} />
              </div>
              <pre className="px-4 py-3 text-sm text-brand-slate whitespace-pre-wrap font-sans leading-relaxed">
                {sec.content}
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* Image extraction results */}
      {imgError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{imgError}</div>
      )}
      {images !== null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-charcoal uppercase tracking-wide">
              Extracted Images ({images.length})
            </h2>
            {images.length > 1 && (
              <button
                onClick={downloadAllImages}
                className="text-xs px-3 py-1 rounded border border-brand-charcoal text-brand-charcoal hover:bg-brand-charcoal/5 transition-colors"
              >
                Download all (.zip)
              </button>
            )}
          </div>
          {images.length === 0 ? (
            <p className="text-sm text-brand-slate">No images found in this document.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((img) => (
                <div key={img.name} className="rounded-lg border border-brand-silver bg-white overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="w-full h-36 object-cover"
                  />
                  <div className="px-2 py-1.5 flex items-center justify-between gap-1">
                    <span className="text-xs text-brand-slate truncate" title={img.name}>{img.name}</span>
                    <button
                      onClick={() => downloadImage(img)}
                      className="text-xs px-2 py-0.5 rounded border border-brand-silver text-brand-slate hover:bg-brand-silver/20 transition-colors shrink-0"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
