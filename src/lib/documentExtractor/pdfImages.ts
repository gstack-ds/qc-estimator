export interface ExtractedPDFImage {
  data: Buffer;
  mimeType: 'image/jpeg' | 'image/png';
  name: string;
}

// Skip thumbnails / PDF artifacts smaller than 2 KB
const MIN_IMAGE_BYTES = 2048;

function scanJPEGs(buf: Buffer): Array<{ offset: number; data: Buffer }> {
  const results: Array<{ offset: number; data: Buffer }> = [];
  const startSig = Buffer.from([0xFF, 0xD8, 0xFF]);
  const endSig   = Buffer.from([0xFF, 0xD9]);
  let from = 0;
  while (true) {
    const start = buf.indexOf(startSig, from);
    if (start === -1) break;
    const end = buf.indexOf(endSig, start + 3);
    if (end === -1) break;
    const slice = buf.subarray(start, end + 2);
    if (slice.length >= MIN_IMAGE_BYTES) results.push({ offset: start, data: slice });
    from = end + 2;
  }
  return results;
}

function scanPNGs(buf: Buffer): Array<{ offset: number; data: Buffer }> {
  const results: Array<{ offset: number; data: Buffer }> = [];
  const startSig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const endSig   = Buffer.from([0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);
  let from = 0;
  while (true) {
    const start = buf.indexOf(startSig, from);
    if (start === -1) break;
    const end = buf.indexOf(endSig, start + 8);
    if (end === -1) break;
    const slice = buf.subarray(start, end + 8);
    if (slice.length >= MIN_IMAGE_BYTES) results.push({ offset: start, data: slice });
    from = end + 8;
  }
  return results;
}

/**
 * Extract embedded JPEG and PNG images from a PDF binary buffer.
 * Works by scanning for image-format magic bytes (JPEG: FF D8 FF; PNG: 89 50 4E 47).
 * Best-effort — covers the vast majority of vendor PDFs (DCT/JPEG-compressed images).
 * Returns images sorted by byte offset (document order).
 */
export function extractPDFImages(pdfBuffer: Buffer): ExtractedPDFImage[] {
  const jpegs = scanJPEGs(pdfBuffer).map((r) => ({ ...r, mimeType: 'image/jpeg' as const }));
  const pngs  = scanPNGs(pdfBuffer).map((r) => ({ ...r, mimeType: 'image/png'  as const }));

  return [...jpegs, ...pngs]
    .sort((a, b) => a.offset - b.offset)
    .map((img, i) => ({
      data: img.data,
      mimeType: img.mimeType,
      name: `image_${i + 1}${img.mimeType === 'image/jpeg' ? '.jpg' : '.png'}`,
    }));
}
