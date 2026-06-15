#!/usr/bin/env node
/**
 * scripts/render-deck-pdf.ts
 *
 * Generates a REAL PDF through the same HTML → Chromium → page.pdf() path as
 * renderPdf.ts, but using a locally installed Chrome instead of the Vercel
 * Linux binary. Saves to tmp/deck-preview.pdf.
 *
 * Usage:
 *   npx tsx scripts/render-deck-pdf.ts [programId]
 *
 * Finds the same program as preview-deck-html.ts (most included estimates).
 * Uses mcp-server/.env for Supabase credentials.
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', 'mcp-server', '.env') });

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer-core';
import {
  buildDeckContract,
  type RawEstimate,
  type RawSection,
  type RawLineItem,
  type RawProgram,
  type RawLocation,
  type RawCategoryMarkup,
} from '../src/lib/contracts/deckContract';
import { buildDeckHtml, type DeckTheme } from '../src/lib/deck/renderer';
import { defaultNarrative, type NarrativeInput } from '../src/lib/deck/types';

interface TeamHoursTier { revenueThreshold: number; baseHours: number; tierName: string; }

// ─── Chrome paths (Windows) ───────────────────────────────────────────────────

const CHROME_CANDIDATES = [
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.USERPROFILE}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
];

function findChrome(): string {
  for (const p of CHROME_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  throw new Error('Chrome not found. Install Chrome or set CHROME_PATH env var.\nChecked:\n' + CHROME_CANDIDATES.join('\n'));
}

// ─── Supabase ──────────────────────────────────────────────────────────────────

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ─── Logo loading ──────────────────────────────────────────────────────────────

function loadLogoDataUri(filename: string): string | undefined {
  try {
    const p = path.resolve(__dirname, '..', 'public', 'images', filename);
    return `data:image/png;base64,${readFileSync(p).toString('base64')}`;
  } catch { return undefined; }
}

// ─── Data fetching (same as preview-deck-html.ts) ────────────────────────────

async function findBestProgramId(requested?: string): Promise<string> {
  if (requested) return requested;
  const { data, error } = await db.from('estimates').select('program_id').eq('included_in_proposal', true);
  if (error || !data?.length) throw new Error('No included estimates found');
  const counts: Record<string, number> = {};
  for (const r of data) counts[r.program_id] = (counts[r.program_id] ?? 0) + 1;
  const [id, n] = Object.entries(counts).sort(([,a],[,b]) => b-a)[0];
  console.log(`  Program ${id} (${n} included estimates)`);
  return id;
}

async function fetchShared(programId: string) {
  const [p, m, t] = await Promise.all([
    db.from('programs').select('id,name,client_name,guest_count,cc_processing_fee,client_commission,gdp_commission_enabled,gdp_commission_rate,service_charge_default,gratuity_default,admin_fee_default,third_party_commissions,include_travel_in_production_fee,location_id').eq('id', programId).single(),
    db.from('category_markups').select('id,markup_pct'),
    db.from('team_hours_tiers').select('revenue_threshold,base_hours,tier_name').order('revenue_threshold'),
  ]);
  if (p.error) throw new Error(p.error.message);
  const prog = p.data;
  let location: RawLocation = { id:'', name:'', food_tax_rate:0, alcohol_tax_rate:0, general_tax_rate:0 };
  if (prog.location_id) {
    const { data: loc } = await db.from('locations').select('id,name,food_tax_rate,alcohol_tax_rate,general_tax_rate').eq('id', prog.location_id).single();
    if (loc) location = loc;
  }
  return {
    programName: prog.name,
    clientName: prog.client_name ?? null,
    rawProgram: { id: prog.id, guest_count: prog.guest_count, cc_processing_fee: prog.cc_processing_fee, client_commission: prog.client_commission, gdp_commission_enabled: prog.gdp_commission_enabled, gdp_commission_rate: prog.gdp_commission_rate, service_charge_default: prog.service_charge_default, gratuity_default: prog.gratuity_default, admin_fee_default: prog.admin_fee_default, third_party_commissions: prog.third_party_commissions ?? null, include_travel_in_production_fee: prog.include_travel_in_production_fee ?? false } as RawProgram,
    location,
    tiers: (t.data ?? []).map(r => ({ revenueThreshold: r.revenue_threshold, baseHours: r.base_hours, tierName: r.tier_name ?? '' })) as TeamHoursTier[],
    rawMarkups: (m.data ?? []) as RawCategoryMarkup[],
  };
}

async function fetchSlide(estimateId: string, shared: Awaited<ReturnType<typeof fetchShared>>) {
  const [e, sec, li, tr] = await Promise.all([
    db.from('estimates').select('id,program_id,event_id,type,name,fb_minimum,is_venue_taxable,service_charge_override,gratuity_override,admin_fee_override,discount_type,discount_value,tax_exempt,food_tax_override,alcohol_tax_override,general_tax_override,included_in_proposal,include_in_budget,venue_id,venue_space_id').eq('id', estimateId).single(),
    db.from('estimate_sections').select('id,name,tax_bucket,markup_pct,sort_order').eq('estimate_id', estimateId).order('sort_order'),
    db.from('estimate_line_items').select('id,estimate_id,section,section_id,name,label,qty,unit_price,category_id,markup_override,custom_client_unit_price,tax_type,is_revenue_item,notes,thumbnail_url,thumbnail_icon,package_options,selected_package_id,sort_order').eq('estimate_id', estimateId).order('sort_order'),
    db.from('program_travel_items').select('qty,unit_price').eq('program_id', shared.rawProgram.id),
  ]);
  if (e.error) throw new Error(e.error.message);
  const est = e.data;
  let venueName = null, venueCity = null, eventType = null;
  if (est.venue_id) { const { data: v } = await db.from('venues').select('name,city').eq('id', est.venue_id).single(); venueName = v?.name ?? null; venueCity = v?.city ?? null; }
  if (est.event_id) { const { data: ev } = await db.from('events').select('event_type').eq('id', est.event_id).single(); eventType = ev?.event_type ?? null; }
  const travelTotal = (tr.data ?? []).reduce((s: number, it: {qty:number;unit_price:number}) => s + it.qty * it.unit_price, 0);
  const raw: RawEstimate = { id: est.id, program_id: est.program_id, event_id: est.event_id, type: est.type, name: est.name, fb_minimum: est.fb_minimum ?? 0, is_venue_taxable: est.is_venue_taxable ?? false, service_charge_override: est.service_charge_override, gratuity_override: est.gratuity_override, admin_fee_override: est.admin_fee_override, discount_type: est.discount_type, discount_value: est.discount_value ?? 0, tax_exempt: est.tax_exempt ?? false, food_tax_override: est.food_tax_override, alcohol_tax_override: est.alcohol_tax_override, general_tax_override: est.general_tax_override, included_in_proposal: est.included_in_proposal ?? false, include_in_budget: est.include_in_budget ?? false, venue_id: est.venue_id, venue_space_id: est.venue_space_id };
  const contract = buildDeckContract(raw, (sec.data ?? []) as RawSection[], (li.data ?? []) as RawLineItem[], shared.rawProgram, shared.location, shared.tiers as TeamHoursTier[], shared.rawMarkups, travelTotal);
  const narrativeInput: NarrativeInput = { estimateType: est.type, estimateName: est.name, programName: shared.programName, clientName: shared.clientName, venueName, venueCity, eventType, guestCount: shared.rawProgram.guest_count, sectionNames: contract.sections.map(s => s.name) };
  return { contract, narrative: defaultNarrative(narrativeInput) };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const requestedId = process.argv[2];
  console.log('\n📄 QC Deck PDF Generator (local Chrome)\n');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in mcp-server/.env');
  }

  const chromePath = process.env.CHROME_PATH ?? findChrome();
  console.log(`  Chrome: ${chromePath}`);

  const programId = await findBestProgramId(requestedId);
  const shared = await fetchShared(programId);
  console.log(`  Program: "${shared.programName}"`);

  const { data: rows, error } = await db.from('estimates').select('id,name').eq('program_id', programId).eq('included_in_proposal', true).order('sort_order');
  if (error || !rows?.length) throw new Error('No included estimates');

  // Cap at 5 slides for a fast local render — enough to check branding on every block type
  const sample = rows.slice(0, 5);
  console.log(`  Building ${sample.length} of ${rows.length} slides (capped for speed)…`);

  const slides = await Promise.all(sample.map(async r => {
    console.log(`    • ${r.name}`);
    return fetchSlide(r.id, shared);
  }));

  const theme: DeckTheme = {
    logoDataUri:  loadLogoDataUri('logo-secondary.png'),
    badgeDataUri: loadLogoDataUri('logo-badge.png'),
  };
  console.log(`  Logos: cover=${theme.logoDataUri ? '✓' : '✗'}  badge=${theme.badgeDataUri ? '✓' : '✗'}`);

  const html = buildDeckHtml(slides, theme);

  console.log('  Launching Chrome…');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let pdfBuffer: Buffer;
  try {
    const page = await browser.newPage();
    page.on('requestfailed', () => {});
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    console.log('  Rendering PDF…');
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    pdfBuffer = Buffer.from(pdf);
  } finally {
    await browser.close();
  }

  const outDir = path.resolve(__dirname, '..', 'tmp');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'deck-preview.pdf');
  writeFileSync(outPath, pdfBuffer);

  const kb = (pdfBuffer.length / 1024).toFixed(0);
  console.log(`\n✅ Saved ${kb} KB → ${outPath}`);
  console.log('\nTo open:');
  console.log('  ! start tmp\\deck-preview.pdf\n');
}

main().catch(err => { console.error('\n❌', err.message ?? err); process.exit(1); });
