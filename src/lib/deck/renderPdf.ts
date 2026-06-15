import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import { readFile } from 'fs/promises';
import path from 'path';
import { buildDeckHtml } from './renderer';
import type { DeckTheme } from './renderer';
import type { DeckRenderSlide } from './types';

// Pinned to match @sparticuz/chromium-min@149.0.0 — update both together.
// Verify the release exists at https://github.com/Sparticuz/chromium/releases
const CHROMIUM_PACK_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar';

// Attempt to read a logo from public/images/ as a base64 data URI.
// Fails silently — a missing logo degrades gracefully (onerror hides the <img>).
async function loadLogoDataUri(filename: string): Promise<string | undefined> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'images', filename);
    const buffer = await readFile(filePath);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {
    return undefined;
  }
}

export async function renderPdf(slides: DeckRenderSlide[]): Promise<Buffer> {
  const [logoDataUri, badgeDataUri] = await Promise.all([
    loadLogoDataUri('logo-secondary.png'),
    loadLogoDataUri('logo-badge.png'),
  ]);

  const theme: DeckTheme = { logoDataUri, badgeDataUri };
  const html = buildDeckHtml(slides, theme);

  // Disable GPU/WebGL — not needed for PDF generation, saves memory on Vercel
  chromium.setGraphicsMode = false;

  const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: 'shell',
  });

  try {
    const page = await browser.newPage();

    // Suppress image load errors — missing thumbnails/logos degrade silently
    page.on('requestfailed', () => {});

    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20000 });
    // Wait for network requests (Google Fonts); if they time out, render with fallback fonts
    await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => {});
    // Wait for webfonts to finish loading before generating the PDF
    await page.evaluate(() => document.fonts.ready).catch(() => {});

    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
