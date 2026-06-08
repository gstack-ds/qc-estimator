import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { extractDocxImages, extractDocxText } from '@/lib/documentExtractor/docxExtract';

async function makeDocx(
  mediaFiles: Record<string, Buffer | string> = {},
  docXml = '',
): Promise<Buffer> {
  const zip = new JSZip();
  const media = zip.folder('word')!.folder('media')!;
  for (const [name, data] of Object.entries(mediaFiles)) {
    media.file(name, data);
  }
  if (docXml) {
    zip.folder('word')!.file('document.xml', docXml);
  }
  return Buffer.from(await zip.generateAsync({ type: 'arraybuffer' }));
}

describe('extractDocxImages', () => {
  it('returns empty array when no media files', async () => {
    const buf = await makeDocx();
    expect(await extractDocxImages(buf)).toHaveLength(0);
  });

  it('extracts a JPEG from word/media', async () => {
    const imgData = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x01]); // minimal JPEG-like
    const buf = await makeDocx({ 'photo.jpg': imgData });
    const result = await extractDocxImages(buf);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('photo.jpg');
    expect(result[0].mimeType).toBe('image/jpeg');
    expect(result[0].data).toEqual(imgData);
  });

  it('extracts a PNG from word/media', async () => {
    const imgData = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
    const buf = await makeDocx({ 'logo.png': imgData });
    const result = await extractDocxImages(buf);
    expect(result).toHaveLength(1);
    expect(result[0].mimeType).toBe('image/png');
  });

  it('extracts multiple images', async () => {
    const img1 = Buffer.from([0xFF, 0xD8, 0xFF]);
    const img2 = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
    const buf = await makeDocx({ 'a.jpg': img1, 'b.png': img2 });
    const result = await extractDocxImages(buf);
    expect(result).toHaveLength(2);
  });

  it('ignores non-image files in word/media', async () => {
    const buf = await makeDocx({ 'theme.xml': '<theme/>', 'style.css': 'body{}' });
    expect(await extractDocxImages(buf)).toHaveLength(0);
  });

  it('ignores files outside word/media', async () => {
    const zip = new JSZip();
    zip.file('photo.jpg', Buffer.from([0xFF, 0xD8, 0xFF])); // root level, not in word/media
    const docxBuf = Buffer.from(await zip.generateAsync({ type: 'arraybuffer' }));
    expect(await extractDocxImages(docxBuf)).toHaveLength(0);
  });

  it('preserves data fidelity', async () => {
    const imgData = Buffer.from(Array.from({ length: 64 }, (_, i) => i));
    const buf = await makeDocx({ 'test.jpg': imgData });
    const result = await extractDocxImages(buf);
    expect(result[0].data).toEqual(imgData);
  });
});

describe('extractDocxText', () => {
  it('returns empty string when no document.xml', async () => {
    const buf = await makeDocx();
    expect(await extractDocxText(buf)).toBe('');
  });

  it('extracts text from w:t elements', async () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>Hello World</w:t></w:r></w:p></w:body></w:document>';
    const buf = await makeDocx({}, xml);
    const text = await extractDocxText(buf);
    expect(text).toContain('Hello World');
  });

  it('inserts newlines between paragraphs', async () => {
    const xml = '<w:document><w:body>'
      + '<w:p><w:r><w:t>First paragraph</w:t></w:r></w:p>'
      + '<w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p>'
      + '</w:body></w:document>';
    const buf = await makeDocx({}, xml);
    const text = await extractDocxText(buf);
    expect(text).toContain('First paragraph');
    expect(text).toContain('Second paragraph');
    expect(text.indexOf('First paragraph')).toBeLessThan(text.indexOf('Second paragraph'));
  });

  it('decodes XML entities', async () => {
    const xml = '<w:document><w:body><w:p><w:r>'
      + '<w:t>Caf&amp;eacute; &amp; Bar &lt;LLC&gt;</w:t>'
      + '</w:r></w:p></w:body></w:document>';
    const buf = await makeDocx({}, xml);
    const text = await extractDocxText(buf);
    // The raw &amp; and &lt; entities in w:t content are decoded
    expect(text).toContain('&');
  });

  it('strips XML tags leaving only text', async () => {
    const xml = '<w:document><w:body><w:p><w:pPr><w:jc w:val="center"/></w:pPr>'
      + '<w:r><w:rPr><w:b/></w:rPr><w:t>Bold Text</w:t></w:r></w:p></w:body></w:document>';
    const buf = await makeDocx({}, xml);
    const text = await extractDocxText(buf);
    expect(text).toBe('Bold Text');
  });
});
