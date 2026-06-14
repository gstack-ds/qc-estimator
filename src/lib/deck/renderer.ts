// Pure HTML generation for the deck PDF.
// No Puppeteer here — this function is testable in Vitest without a browser.
// The deck-renderer service imports this and wraps it with Puppeteer.

import type { DeckRenderSlide } from './types';
import type { DeckContract } from '../contracts/deckContract';
import type { NarrativeOutput } from './types';

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

function buildSlideHtml(contract: DeckContract, narrative: NarrativeOutput): string {
  const s = contract.summary;

  const sectionsHtml = contract.sections.map((section) => {
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
      <table class="items-table">
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
  }).join('');

  const totalTax = s.foodTax + s.alcoholTax + s.equipmentTax + s.venueTax + s.productionFeeTax;

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
      ? `<div class="summary-row discount-row"><span>Discount</span><span>-${fmtMoney(s.discountAmount)}</span></div>`
      : '',
    `<div class="summary-row total-row"><span>Total</span><span data-deck-total="${s.totalClient}">${fmtMoney(s.totalClient)}</span></div>`,
    contract.programConfig.guestCount > 0
      ? `<div class="summary-row pp-row"><span>Per Person</span><span>${fmtMoney(s.pricePerPerson)}</span></div>`
      : '',
  ].join('');

  return `
  <!-- Cover page -->
  <div class="page cover-page">
    <div class="cover-logo-placeholder"></div>
    <div class="cover-headline">${esc(narrative.headline)}</div>
    <div class="cover-intro">${esc(narrative.intro)}</div>
    ${narrative.venueSummary ? `<div class="cover-venue">${esc(narrative.venueSummary)}</div>` : ''}
    ${narrative.experienceSummary ? `<div class="cover-experience">${esc(narrative.experienceSummary)}</div>` : ''}
    <div class="cover-meta">${contract.programConfig.guestCount} guests</div>
  </div>

  <!-- Pricing page -->
  <div class="page pricing-page">
    <div class="page-title">${esc(contract.estimateName)}</div>
    ${sectionsHtml}
    <div class="summary-section">${summaryRows}</div>
    ${narrative.closingNote ? `<div class="closing-note">${esc(narrative.closingNote)}</div>` : ''}
  </div>`;
}

const CSS = `
  :root {
    --charcoal: #2C2C2C;
    --brown: #8B6A3E;
    --cream: #F5F0E8;
    --silver: #9B9B9B;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; color: var(--charcoal); background: white; }

  .page { width: 8.5in; min-height: 11in; padding: 1in 1.25in; page-break-after: always; display: flex; flex-direction: column; }

  /* Cover */
  .cover-page { background: var(--cream); justify-content: center; align-items: center; text-align: center; gap: 20px; }
  .cover-logo-placeholder { width: 48px; height: 48px; background: var(--charcoal); border-radius: 50%; }
  .cover-headline { font-size: 34px; font-weight: bold; color: var(--charcoal); line-height: 1.2; max-width: 5in; }
  .cover-intro { font-size: 13px; color: #4A4A4A; line-height: 1.7; max-width: 5in; }
  .cover-venue { font-size: 12px; color: var(--silver); font-style: italic; }
  .cover-experience { font-size: 12px; color: var(--silver); max-width: 4.5in; }
  .cover-meta { font-size: 11px; color: var(--silver); text-transform: uppercase; letter-spacing: 0.1em; }

  /* Pricing */
  .pricing-page { gap: 16px; }
  .page-title { font-size: 18px; font-weight: bold; color: var(--charcoal); border-bottom: 2px solid var(--cream); padding-bottom: 8px; }
  .section { margin-top: 12px; }
  .section-header { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: var(--brown); padding: 5px 0; border-bottom: 1px solid var(--cream); margin-bottom: 3px; }
  .items-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .items-table td { padding: 4px 6px; border-bottom: 1px solid #F0EDE6; vertical-align: top; }
  .item-name { width: 60%; }
  .item-notes { color: var(--silver); font-size: 11px; }
  .item-qty { width: 10%; text-align: center; color: var(--silver); }
  .item-cost { width: 30%; text-align: right; }

  /* Summary */
  .summary-section { margin-top: 20px; border-top: 2px solid var(--cream); padding-top: 10px; }
  .summary-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
  .tax-row { color: var(--silver); }
  .discount-row { color: #16a34a; }
  .total-row { font-size: 16px; font-weight: bold; border-top: 2px solid var(--charcoal); padding-top: 8px; margin-top: 4px; }
  .pp-row { font-size: 11px; color: var(--silver); }
  .closing-note { margin-top: auto; padding-top: 24px; font-size: 12px; color: var(--silver); font-style: italic; text-align: center; }
`;

export function buildDeckHtml(slides: DeckRenderSlide[]): string {
  const body = slides
    .map(({ contract, narrative }) => buildSlideHtml(contract, narrative))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}
