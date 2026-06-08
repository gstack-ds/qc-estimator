import { describe, it, expect } from 'vitest';
import { extractPDFImages } from '@/lib/documentExtractor/pdfImages';

// Build a synthetic JPEG: FF D8 FF E0 <2048-byte payload> FF D9
function makeJPEG(payloadSize = 4096): Buffer {
  const buf = Buffer.alloc(payloadSize + 6);
  buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF; buf[3] = 0xE0; // SOI + APP0 marker
  // Fill payload with non-magic bytes
  buf.fill(0xAA, 4, 4 + payloadSize);
  buf[4 + payloadSize]     = 0xFF;
  buf[4 + payloadSize + 1] = 0xD9;  // EOI
  return buf;
}

// Build a synthetic PNG: 8-byte signature + IEND chunk
function makePNG(payloadSize = 4096): Buffer {
  const sig  = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const iend = Buffer.from([0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);
  const payload = Buffer.alloc(payloadSize, 0xBB);
  return Buffer.concat([sig, payload, iend]);
}

describe('extractPDFImages', () => {
  it('returns empty array for a buffer with no images', () => {
    const buf = Buffer.alloc(1024, 0x00);
    expect(extractPDFImages(buf)).toHaveLength(0);
  });

  it('extracts a single JPEG', () => {
    const jpeg = makeJPEG(4096);
    const result = extractPDFImages(jpeg);
    expect(result).toHaveLength(1);
    expect(result[0].mimeType).toBe('image/jpeg');
    expect(result[0].name).toBe('image_1.jpg');
    expect(result[0].data.length).toBe(jpeg.length);
  });

  it('extracts a single PNG', () => {
    const png = makePNG(4096);
    const result = extractPDFImages(png);
    expect(result).toHaveLength(1);
    expect(result[0].mimeType).toBe('image/png');
    expect(result[0].name).toBe('image_1.png');
  });

  it('extracts multiple JPEGs embedded in a larger buffer', () => {
    const header  = Buffer.alloc(512, 0x25); // PDF-like header noise
    const jpeg1   = makeJPEG(3000);
    const filler  = Buffer.alloc(256, 0x42);
    const jpeg2   = makeJPEG(5000);
    const trailer = Buffer.alloc(128, 0x25);
    const pdf     = Buffer.concat([header, jpeg1, filler, jpeg2, trailer]);

    const result = extractPDFImages(pdf);
    expect(result).toHaveLength(2);
    expect(result[0].mimeType).toBe('image/jpeg');
    expect(result[1].mimeType).toBe('image/jpeg');
  });

  it('extracts both JPEG and PNG when both are present', () => {
    const jpeg = makeJPEG(4096);
    const png  = makePNG(4096);
    const pdf  = Buffer.concat([jpeg, Buffer.alloc(128, 0x00), png]);

    const result = extractPDFImages(pdf);
    expect(result).toHaveLength(2);
    const types = result.map((r) => r.mimeType);
    expect(types).toContain('image/jpeg');
    expect(types).toContain('image/png');
  });

  it('skips JPEGs smaller than 2 KB', () => {
    // 6 bytes total: SOI + 2-byte payload + EOI — well under MIN_IMAGE_BYTES
    const tiny = Buffer.from([0xFF, 0xD8, 0xFF, 0xAA, 0xFF, 0xD9]);
    expect(extractPDFImages(tiny)).toHaveLength(0);
  });

  it('skips PNGs smaller than 2 KB', () => {
    const tinyPNG = makePNG(10); // 10-byte payload → total 26 bytes
    expect(extractPDFImages(tinyPNG)).toHaveLength(0);
  });

  it('assigns sequential names in document order', () => {
    const jpeg = makeJPEG(4096);
    const png  = makePNG(4096);
    // Put PNG first in document order
    const pdf = Buffer.concat([png, Buffer.alloc(128, 0x00), jpeg]);

    const result = extractPDFImages(pdf);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('image_1.png'); // PNG appears first
    expect(result[1].name).toBe('image_2.jpg');
  });

  it('returns Buffer instances for data', () => {
    const result = extractPDFImages(makeJPEG(4096));
    expect(result[0].data).toBeInstanceOf(Buffer);
  });
});
