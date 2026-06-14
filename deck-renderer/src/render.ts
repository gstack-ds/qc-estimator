import puppeteer from 'puppeteer';
import { buildDeckHtml } from '../../src/lib/deck/renderer';
import type { DeckRenderSlide } from '../../src/lib/deck/types';

export async function renderPdf(slides: DeckRenderSlide[]): Promise<Buffer> {
  const html = buildDeckHtml(slides);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30000 });

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
