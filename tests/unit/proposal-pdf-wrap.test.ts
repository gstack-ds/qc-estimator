// Regression guard for the proposal-PDF section-overflow bug.
//
// Bug: each section block was rendered in a <View wrap={false}>. A long section (e.g. a big
// florals list) taller than one page made @react-pdf collapse the block's layout on the overflow
// page — section header on top of the first row, tax rate on top of the jurisdiction, compressed
// rows. @react-pdf signals this exact condition with:
//   console.warn("Node of type VIEW can't wrap between pages and it's bigger than available page height")
//
// Fix: sections are wrappable (flow across pages); only the header pair and each individual row are
// non-wrappable. This test renders a long single-section proposal and asserts that warning never
// fires — i.e. no section block is forced non-wrappable past a page boundary again.
import { describe, it, expect, vi } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import ProposalDocument from '../../src/components/export/ProposalDocument';
import type { ProposalDocumentProps } from '../../src/components/export/ProposalDocument';
import type { EstimateSummary, Location } from '../../src/types';
import type { LineItemForExport, OrderedSection } from '../../src/lib/utils/export';

const OVERFLOW_WARNING = "can't wrap between pages";

const location = {
  id: 'loc-1',
  name: 'Middleburg, VA',
  foodTaxRate: 0.06,
  alcoholTaxRate: 0.06,
  generalTaxRate: 0.06,
} as unknown as Location;

// Only the fields ProposalDocument reads need to be real; the rest are zeroed.
const summary = {
  foodTax: 0, alcoholTax: 0, equipmentTax: 0, venueTax: 0, productionFeeTax: 0,
  lineItemsSubtotalClient: 10800, productionFee: 0, preTaxTotal: 10800,
  totalClient: 10800, discountAmount: 0,
} as unknown as EstimateSummary;

// One section, many items — guaranteed taller than a single LETTER page.
function makeProps(itemCount: number): ProposalDocumentProps {
  const sectionId = 'florals-1';
  const lineItems: LineItemForExport[] = Array.from({ length: itemCount }, (_, i) => ({
    name: `Velvet Fern 120RD Arrangement #${i + 1}`,
    section: 'Florals',
    sectionId,
    qty: 1,
    unitPrice: 240,
    categoryMarkupPct: 0,
    categoryId: 'decor',
    taxType: 'general',
  }));
  const orderedSections: OrderedSection[] = [{ id: sectionId, name: 'Florals' }];
  return {
    estimateId: 'estimate-1234-abcd',
    estimateName: 'Twilio Decor',
    programName: 'Twilio Offsite',
    clientName: 'Twilio',
    clientCompany: 'Twilio Inc.',
    guestCount: 120,
    summary,
    lineItems,
    orderedSections,
    estimateType: 'decor',
    proposalDate: 'June 29, 2026',
    location,
  };
}

describe('proposal PDF — long sections flow across pages without collapsing', () => {
  it('renders a 45-item single section with no @react-pdf overflow warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // Called as a function (matches the dynamic-import usage), not JSX.
      const buffer = await renderToBuffer(ProposalDocument(makeProps(45)));
      expect(buffer.length).toBeGreaterThan(0);

      const overflowWarned = warnSpy.mock.calls
        .flat()
        .some((arg) => typeof arg === 'string' && arg.includes(OVERFLOW_WARNING));
      expect(overflowWarned).toBe(false);
    } finally {
      warnSpy.mockRestore();
    }
  }, 20000);
});
