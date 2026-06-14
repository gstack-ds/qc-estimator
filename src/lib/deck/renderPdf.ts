import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import { buildDeckHtml } from './renderer';
import type { DeckRenderSlide } from './types';

// Pinned to match @sparticuz/chromium-min@149.0.0 — update both together.
// Verify the release exists at https://github.com/Sparticuz/chromium/releases
const CHROMIUM_PACK_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.tar';

export async function renderPdf(slides: DeckRenderSlide[]): Promise<Buffer> {
  const html = buildDeckHtml(slides);

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

    // Suppress image load errors — missing thumbnails degrade silently
    page.on('requestfailed', () => {});

    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20000 });
    // Wait for images to load; if they time out, render with whatever loaded
    await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => {});

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
