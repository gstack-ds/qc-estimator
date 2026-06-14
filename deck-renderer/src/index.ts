import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

import express from 'express';
import { renderPdf } from './render';
import type { DeckRenderRequest } from '../../src/lib/deck/types';

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = Number(process.env.RENDERER_PORT ?? 3001);
const SECRET = process.env.RENDERER_SECRET ?? '';

if (!SECRET) {
  console.error('[deck-renderer] RENDERER_SECRET is not set — refusing to start');
  process.exit(1);
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/render', async (req, res) => {
  const authHeader = req.headers['x-renderer-secret'];
  if (authHeader !== SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const body = req.body as DeckRenderRequest;
  if (!body?.slides || !Array.isArray(body.slides) || body.slides.length === 0) {
    res.status(400).json({ error: 'slides array is required' });
    return;
  }

  try {
    const pdfBuffer = await renderPdf(body.slides);
    const pdf = pdfBuffer.toString('base64');
    res.json({ pdf });
  } catch (e) {
    console.error('[deck-renderer] render failed:', e);
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[deck-renderer] listening on 0.0.0.0:${PORT}`);
});
