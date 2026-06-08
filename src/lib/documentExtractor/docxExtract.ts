import JSZip from 'jszip';

export interface ExtractedDocxImage {
  data: Buffer;
  mimeType: string;
  name: string;
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.bmp':  'image/bmp',
  '.tiff': 'image/tiff',
  '.tif':  'image/tiff',
};

/**
 * Extract embedded images from a .docx buffer.
 * A .docx is a ZIP archive; images live under word/media/.
 */
export async function extractDocxImages(docxBuffer: Buffer): Promise<ExtractedDocxImage[]> {
  const zip = await JSZip.loadAsync(docxBuffer);
  const images: ExtractedDocxImage[] = [];

  for (const [path, file] of Object.entries(zip.files)) {
    if (!path.startsWith('word/media/') || file.dir) continue;
    const dotIdx = path.lastIndexOf('.');
    if (dotIdx === -1) continue;
    const ext = path.slice(dotIdx).toLowerCase();
    if (!(ext in MIME_BY_EXT)) continue;
    const data = Buffer.from(await file.async('arraybuffer'));
    images.push({ data, mimeType: MIME_BY_EXT[ext], name: path.split('/').pop() ?? `image${images.length + 1}${ext}` });
  }

  return images;
}

/**
 * Extract plain text from a .docx buffer by parsing word/document.xml.
 * Preserves paragraph breaks. Good enough for passing to Claude for structuring.
 */
export async function extractDocxText(docxBuffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(docxBuffer);
  const docXml = zip.files['word/document.xml'];
  if (!docXml) return '';

  const xml = await docXml.async('string');

  return xml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br[^>]*>/g, '\n')
    .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
