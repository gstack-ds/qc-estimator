// Pure HTML generation for the deck PDF.
// No Puppeteer here — this function is testable in Vitest without a browser.
// The render-deck API route imports this and wraps it with Puppeteer.
//
// Logo file paths (loaded as base64 by renderPdf.ts):
//   cover  → public/images/logo-secondary.png  (stacked wordmark)
//   header → public/images/logo-badge.png       (oval badge mark)
//
// Font substitution: swap the @import href below to use licensed Dallas/Calgary
// files if they become available as web fonts — all other styling stays the same.

import type { DeckRenderSlide } from './types';
import type { DeckContract } from '../contracts/deckContract';
import type { NarrativeOutput } from './types';

// ─── Theme ────────────────────────────────────────────────────────────────────

export interface DeckTheme {
  /** base64 data URI — stacked "QUILL CREATIVE / EVENT DESIGN" wordmark (cover page) */
  logoDataUri?: string;
  /** base64 data URI — oval badge mark (pricing page header) */
  badgeDataUri?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// ─── Cover page ───────────────────────────────────────────────────────────────

function buildCoverPage(
  contract: DeckContract,
  narrative: NarrativeOutput,
  theme: DeckTheme,
): string {
  // Logo degrades gracefully: onerror hides the img if the data URI is missing/corrupt.
  const logoHtml = theme.logoDataUri
    ? `<img class="cover-logo" src="${theme.logoDataUri}" alt="Quill Creative Event Design" onerror="this.style.display='none'">`
    : `<div class="cover-logo-fallback"></div>`;

  const guestLine =
    contract.programConfig.guestCount > 0
      ? `<div class="cover-meta">${contract.programConfig.guestCount} Guests</div>`
      : '';

  return `
  <div class="page cover-page">
    <div class="cover-top">
      <div class="cover-logo-wrap">${logoHtml}</div>
      <div class="cover-rule"></div>
      <h1 class="cover-headline">${esc(narrative.headline)}</h1>
      ${narrative.intro ? `<p class="cover-intro">${esc(narrative.intro)}</p>` : ''}
      ${narrative.venueSummary ? `<p class="cover-venue">${esc(narrative.venueSummary)}</p>` : ''}
      ${narrative.experienceSummary ? `<p class="cover-experience">${esc(narrative.experienceSummary)}</p>` : ''}
    </div>
    <div class="cover-footer">${guestLine}</div>
  </div>`;
}

// ─── Pricing page ─────────────────────────────────────────────────────────────

function buildPricingPage(
  contract: DeckContract,
  narrative: NarrativeOutput,
  theme: DeckTheme,
): string {
  // INTERNAL DATA GUARDRAIL:
  // Only contract.summary (client-billing), contract.sections, contract.serviceCharge,
  // contract.gratuity, contract.adminFee, contract.programConfig.guestCount, and
  // contract.estimateName are accessed below.
  // contract.margin (qcMargin, trueNetMargin, opExCost, commissions, etc.) is
  // intentionally never referenced — it must never appear in a client-facing PDF.
  const s = contract.summary;

  const badgeHtml = theme.badgeDataUri
    ? `<img class="page-badge" src="${theme.badgeDataUri}" alt="" onerror="this.style.display='none'">`
    : '';

  // Suppress sections with zero line items — never render an empty section header.
  const populatedSections = contract.sections.filter((sec) => sec.lineItems.length > 0);

  const sectionsHtml = populatedSections
    .map((section) => {
      const rowsHtml = section.lineItems
        .map(
          (item) => `
        <tr>
          <td class="item-name">${esc(item.name)}${item.notes ? `<span class="item-notes"> — ${esc(item.notes)}</span>` : ''}</td>
          <td class="item-qty">${item.qty}</td>
          <td class="item-cost">${fmtMoney(item.clientCost)}</td>
        </tr>`,
        )
        .join('');

      return `
      <div class="section">
        <div class="section-header">${esc(section.name)}</div>
        <table class="items-table"><tbody>${rowsHtml}</tbody></table>
      </div>`;
    })
    .join('');

  const totalTax =
    s.foodTax + s.alcoholTax + s.equipmentTax + s.venueTax + s.productionFeeTax;

  const summaryRows = [
    s.serviceChargeClient > 0
      ? `<div class="summary-row"><span>Service Charge (${fmtPct(contract.serviceCharge)})</span><span>${fmtMoney(s.serviceChargeClient)}</span></div>`
      : '',
    s.gratuityClient > 0
      ? `<div class="summary-row"><span>Gratuity (${fmtPct(contract.gratuity)})</span><span>${fmtMoney(s.gratuityClient)}</span></div>`
      : '',
    s.adminFeeClient > 0
      ? `<div class="summary-row"><span>Admin Fee (${fmtPct(contract.adminFee)})</span><span>${fmtMoney(s.adminFeeClient)}</span></div>`
      : '',
    `<div class="summary-row"><span>Production Fee</span><span>${fmtMoney(s.productionFee)}</span></div>`,
    totalTax > 0
      ? `<div class="summary-row tax-row"><span>Tax</span><span>${fmtMoney(totalTax)}</span></div>`
      : '',
    s.discountAmount > 0
      ? `<div class="summary-row discount-row"><span>Discount</span><span>−${fmtMoney(s.discountAmount)}</span></div>`
      : '',
    `<div class="summary-row total-row"><span>Total Investment</span><span data-deck-total="${s.totalClient}">${fmtMoney(s.totalClient)}</span></div>`,
    contract.programConfig.guestCount > 0
      ? `<div class="summary-row pp-row"><span>Per Person</span><span>${fmtMoney(s.pricePerPerson)}</span></div>`
      : '',
  ].join('');

  return `
  <div class="page pricing-page">
    <div class="page-header">
      <div class="page-title">${esc(contract.estimateName)}</div>
      ${badgeHtml}
    </div>
    <div class="page-rule"></div>
    <div class="sections">${sectionsHtml}</div>
    <div class="summary-section">
      <div class="summary-inner">${summaryRows}</div>
    </div>
    ${narrative.closingNote ? `<p class="closing-note">${esc(narrative.closingNote)}</p>` : ''}
  </div>`;
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

// Font substitution: to use licensed Dallas/Calgary, replace the href below with
// a self-hosted @font-face declaration and update --font-serif / --font-sans.
const FONT_LINKS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">`;

const CSS = `
  :root {
    /* QC Event Design brand palette */
    --brown:     #846E60;
    --charcoal:  #464543;
    --taupe:     #C19C81;
    --cream:     #ECDFCE;
    --off-white: #FAF6F3;
    --cool-grey: #A9AEB4;

    /* Typography — swap href in FONT_LINKS to use licensed Dallas / Calgary */
    --font-serif: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
    --font-sans:  'Jost', 'Helvetica Neue', Arial, sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--font-sans);
    color: var(--charcoal);
    background: var(--off-white);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 8.5in;
    min-height: 11in;
    padding: 0.85in 1in;
    page-break-after: always;
    display: flex;
    flex-direction: column;
  }

  /* ── Cover ──────────────────────────────────────────────────────────────── */

  .cover-page {
    background: var(--off-white);
    align-items: center;
    text-align: center;
  }

  .cover-top {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
  }

  .cover-logo-wrap {
    margin-bottom: 0.3in;
  }

  .cover-logo {
    width: 3in;
    max-width: 100%;
    height: auto;
    display: block;
    /* mix-blend-mode: multiply makes white logo backgrounds transparent on light pages */
    mix-blend-mode: multiply;
  }

  .cover-logo-fallback {
    width: 2.4in;
    height: 0.35in;
  }

  .cover-rule {
    width: 0.5in;
    height: 1px;
    background: var(--taupe);
    margin: 0 auto 0.28in;
  }

  .cover-headline {
    font-family: var(--font-serif);
    font-size: 34pt;
    font-weight: 400;
    color: var(--brown);
    line-height: 1.15;
    max-width: 5.4in;
    letter-spacing: 0.01em;
    margin-bottom: 0.22in;
  }

  .cover-intro {
    font-family: var(--font-sans);
    font-size: 10pt;
    font-weight: 300;
    color: var(--charcoal);
    line-height: 1.8;
    max-width: 4.6in;
    margin-bottom: 0.18in;
  }

  .cover-venue {
    font-family: var(--font-serif);
    font-size: 11pt;
    font-weight: 300;
    font-style: italic;
    color: var(--brown);
    margin-bottom: 0.14in;
  }

  .cover-experience {
    font-family: var(--font-sans);
    font-size: 9.5pt;
    font-weight: 300;
    color: var(--cool-grey);
    max-width: 4.4in;
    line-height: 1.65;
  }

  .cover-footer {
    padding-top: 0.35in;
  }

  .cover-meta {
    font-family: var(--font-sans);
    font-size: 8pt;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--cool-grey);
  }

  /* ── Pricing page ───────────────────────────────────────────────────────── */

  .pricing-page {
    background: white;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .page-title {
    font-family: var(--font-serif);
    font-size: 26pt;
    font-weight: 400;
    color: var(--charcoal);
    line-height: 1.1;
    letter-spacing: 0.01em;
  }

  .page-badge {
    width: 0.5in;
    height: auto;
    margin-top: 4pt;
    opacity: 0.65;
    mix-blend-mode: multiply;
  }

  .page-rule {
    height: 1px;
    background: var(--cream);
    margin: 0.1in 0 0.2in;
  }

  /* ── Sections ───────────────────────────────────────────────────────────── */

  .sections {
    flex: 1;
  }

  .section {
    margin-bottom: 0.16in;
  }

  .section-header {
    font-family: var(--font-sans);
    font-size: 7pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.13em;
    color: var(--brown);
    padding-bottom: 3.5pt;
    border-bottom: 1px solid var(--cream);
    margin-bottom: 1pt;
  }

  .items-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-sans);
    font-size: 9pt;
    font-weight: 300;
  }

  .items-table td {
    padding: 3pt 4pt;
    border-bottom: 1px solid #F0EAE0;
    vertical-align: top;
    color: var(--charcoal);
  }

  .item-name  { width: 62%; }
  .item-notes { color: var(--cool-grey); font-size: 8pt; }
  .item-qty   { width: 8%; text-align: center; color: var(--cool-grey); }
  .item-cost  { width: 30%; text-align: right; font-weight: 400; }

  /* ── Summary ────────────────────────────────────────────────────────────── */

  .summary-section {
    margin-top: 0.2in;
    padding-top: 0.14in;
    border-top: 1px solid var(--cream);
  }

  .summary-inner {
    max-width: 3in;
    margin-left: auto;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-sans);
    font-size: 9pt;
    font-weight: 300;
    padding: 2pt 0;
    color: var(--charcoal);
  }

  .tax-row      { color: var(--cool-grey); }
  .discount-row { color: #4a7c59; }

  .total-row {
    font-family: var(--font-serif);
    font-size: 16pt;
    font-weight: 500;
    color: var(--charcoal);
    letter-spacing: 0.01em;
    border-top: 1px solid var(--taupe);
    padding-top: 5pt;
    margin-top: 4pt;
  }

  .pp-row {
    font-family: var(--font-sans);
    font-size: 8pt;
    font-weight: 300;
    color: var(--cool-grey);
    padding-top: 1.5pt;
  }

  .closing-note {
    margin-top: 0.18in;
    font-family: var(--font-serif);
    font-size: 9.5pt;
    font-weight: 300;
    font-style: italic;
    color: var(--cool-grey);
    text-align: center;
  }
`;

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildDeckHtml(slides: DeckRenderSlide[], theme: DeckTheme = {}): string {
  const body = slides
    .map(({ contract, narrative }) =>
      buildCoverPage(contract, narrative, theme) +
      buildPricingPage(contract, narrative, theme),
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${FONT_LINKS}
  <style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}
