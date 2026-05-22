// Client-facing proposal PDF document — rendered by @react-pdf/renderer
// Import this file ONLY via dynamic import() inside client event handlers to avoid SSR issues.
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { EstimateSummary } from '@/types';
import type { LineItemForExport } from '@/lib/utils/export';
import { itemClientCost } from '@/lib/utils/export';

const BRAND_CHARCOAL = '#464543';
const BRAND_BROWN = '#846E60';
const BRAND_COPPER = '#C19C81';
const BRAND_CREAM = '#ECDFCE';
const BRAND_SILVER = '#A9AEB4';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: BRAND_CHARCOAL, padding: 48, lineHeight: 1.4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, paddingBottom: 16, borderBottomWidth: 1.5, borderBottomColor: BRAND_CREAM },
  companyName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: BRAND_CHARCOAL, letterSpacing: 0.5 },
  companyTagline: { fontSize: 8, color: BRAND_BROWN, marginTop: 3, letterSpacing: 0.8, textTransform: 'uppercase' },
  contactBlock: { alignItems: 'flex-end' },
  contactLine: { fontSize: 9, color: BRAND_SILVER, marginTop: 2 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  metaLeft: { flex: 1 },
  metaRight: { alignItems: 'flex-end' },
  metaLabel: { fontSize: 7.5, color: BRAND_SILVER, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  metaValue: { fontSize: 11, color: BRAND_CHARCOAL, fontFamily: 'Helvetica-Bold' },
  metaValueSm: { fontSize: 10, color: BRAND_CHARCOAL },
  sectionHeader: { backgroundColor: BRAND_CREAM, paddingVertical: 5, paddingHorizontal: 8, marginTop: 14, marginBottom: 0, flexDirection: 'row' },
  sectionHeaderText: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: BRAND_BROWN, textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 0.75, borderBottomColor: BRAND_COPPER, paddingBottom: 4, paddingTop: 8, paddingHorizontal: 8 },
  tableHeaderCell: { fontSize: 8, color: BRAND_SILVER, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: '#F0E8DC' },
  rowAlt: { backgroundColor: '#FDFAF7' },
  cell: { fontSize: 9.5, color: BRAND_CHARCOAL },
  cellDim: { fontSize: 9, color: BRAND_SILVER },
  colItem: { flex: 3 },
  colQty: { width: 36, textAlign: 'right' },
  colPrice: { width: 62, textAlign: 'right' },
  colTax: { width: 44, textAlign: 'right' },
  colTotal: { width: 68, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  totalsBlock: { marginTop: 18, borderTopWidth: 1, borderTopColor: BRAND_CREAM, paddingTop: 10 },
  totalsRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 3 },
  totalsLabel: { fontSize: 9.5, color: BRAND_CHARCOAL, width: 160, textAlign: 'right', paddingRight: 12 },
  totalsValue: { fontSize: 9.5, color: BRAND_CHARCOAL, width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  grandTotal: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: BRAND_COPPER },
  grandTotalLabel: { fontSize: 12, color: BRAND_CHARCOAL, fontFamily: 'Helvetica-Bold', width: 160, textAlign: 'right', paddingRight: 12 },
  grandTotalValue: { fontSize: 12, color: BRAND_CHARCOAL, fontFamily: 'Helvetica-Bold', width: 80, textAlign: 'right' },
  discountRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 3 },
  discountLabel: { fontSize: 9.5, color: BRAND_COPPER, width: 160, textAlign: 'right', paddingRight: 12 },
  discountValue: { fontSize: 9.5, color: BRAND_COPPER, width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 32, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: BRAND_CREAM, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: BRAND_SILVER },
});

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtRound(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

const SECTION_LABELS: Record<string, string> = {
  'F&B': 'Food & Beverage',
  'Equipment & Staffing': 'Equipment & Staffing',
  'Venue Fees': 'Venue Fees',
  'Non-Taxable Staffing': 'Non-Taxable Staffing',
  'Florals - Taxable': 'Florals',
  'Florals - Non-Taxable': 'Non-Taxable Florals',
  'Rentals - Seating': 'Seating Rentals',
  'Rentals - Lounge': 'Lounge Rentals',
  'Rentals - Tables': 'Table Rentals',
  'Rentals - Rugs & Accessories': 'Rugs & Accessories',
  'Rentals - Non-Taxable': 'Non-Taxable Rentals',
};

export interface ProposalDocumentProps {
  estimateId: string;
  estimateName: string;
  programName: string;
  clientName: string | null | undefined;
  clientCompany: string | null | undefined;
  guestCount: number;
  summary: EstimateSummary;
  lineItems: LineItemForExport[];
  estimateType: 'venue' | 'av' | 'decor';
  proposalDate: string;
  taxExempt?: boolean;
}

export default function ProposalDocument({
  estimateId,
  estimateName,
  programName,
  clientName,
  clientCompany,
  guestCount,
  summary,
  lineItems,
  proposalDate,
  taxExempt = false,
}: ProposalDocumentProps) {
  const proposalNumber = estimateId.slice(0, 8).toUpperCase();

  // Group items by section, filter out $0 items
  const sections = Array.from(new Set(lineItems.map((li) => li.section)));
  const totalTax = summary.foodTax + summary.alcoholTax + summary.equipmentTax + summary.venueTax;
  const preTaxSubtotal = summary.subtotalClient - totalTax;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>Quill Creative Event Design</Text>
            <Text style={styles.companyTagline}>Corporate Event Planning</Text>
          </View>
          <View style={styles.contactBlock}>
            <Text style={styles.contactLine}>(315) 569-9847</Text>
            <Text style={styles.contactLine}>alex@qceventdesign.com</Text>
          </View>
        </View>

        {/* Proposal metadata */}
        <View style={styles.meta}>
          <View style={styles.metaLeft}>
            <Text style={styles.metaLabel}>Proposal For</Text>
            <Text style={styles.metaValue}>{clientName ?? programName}</Text>
            {clientCompany ? <Text style={styles.metaValueSm}>{clientCompany}</Text> : null}
            <Text style={[styles.metaValueSm, { marginTop: 6 }]}>{programName}</Text>
            {guestCount > 0 ? <Text style={styles.cellDim}>{guestCount} guests</Text> : null}
          </View>
          <View style={styles.metaRight}>
            <Text style={styles.metaLabel}>Proposal Number</Text>
            <Text style={styles.metaValueSm}>{proposalNumber}</Text>
            <Text style={[styles.metaLabel, { marginTop: 8 }]}>Date</Text>
            <Text style={styles.metaValueSm}>{proposalDate}</Text>
            <Text style={[styles.metaLabel, { marginTop: 8 }]}>Proposal Total</Text>
            <Text style={styles.metaValue}>{fmtRound(summary.totalClient)}</Text>
          </View>
        </View>

        {/* Line items by section */}
        {sections.map((section) => {
          const sectionItems = lineItems.filter((li) => li.section === section);
          if (sectionItems.length === 0) return null;
          return (
            <View key={section} wrap={false}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{SECTION_LABELS[section] ?? section}</Text>
              </View>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.colItem]}>Item</Text>
                <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
                <Text style={[styles.tableHeaderCell, styles.colPrice]}>Unit Price</Text>
                <Text style={[styles.tableHeaderCell, styles.colTax]}>Tax</Text>
                <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
              </View>
              {sectionItems.map((item, idx) => {
                const clientTotal = itemClientCost(item);
                const unitPrice = item.categoryId === 'custom' && item.customClientUnitPrice !== undefined
                  ? item.customClientUnitPrice
                  : item.unitPrice * (1 + item.categoryMarkupPct);
                const taxRate = item.taxType === 'none' ? 0 : 0.0725; // display only; exact rates from engine
                const taxColLabel = taxExempt ? 'Exempt' : (item.taxType === 'none' ? '—' : `${(taxRate * 100).toFixed(2)}%`);
                return (
                  <View key={idx} style={[styles.row, idx % 2 === 1 ? styles.rowAlt : {}]}>
                    <Text style={[styles.cell, styles.colItem]}>{item.name}</Text>
                    <Text style={[styles.cell, styles.colQty]}>{item.qty}</Text>
                    <Text style={[styles.cell, styles.colPrice]}>{fmt(unitPrice)}</Text>
                    <Text style={[styles.cellDim, styles.colTax]}>{taxColLabel}</Text>
                    <Text style={[styles.cell, styles.colTotal]}>{fmt(clientTotal)}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* Totals block */}
        <View style={styles.totalsBlock}>
          {preTaxSubtotal > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal (before tax)</Text>
              <Text style={styles.totalsValue}>{fmtRound(preTaxSubtotal)}</Text>
            </View>
          )}
          {taxExempt ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax</Text>
              <Text style={styles.totalsValue}>Tax Exempt</Text>
            </View>
          ) : totalTax > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax</Text>
              <Text style={styles.totalsValue}>{fmtRound(totalTax)}</Text>
            </View>
          )}
          {summary.serviceChargeClient > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Service Charge</Text>
              <Text style={styles.totalsValue}>{fmtRound(summary.serviceChargeClient)}</Text>
            </View>
          )}
          {summary.gratuityClient > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Gratuity</Text>
              <Text style={styles.totalsValue}>{fmtRound(summary.gratuityClient)}</Text>
            </View>
          )}
          {summary.adminFeeClient > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Administrative Fee</Text>
              <Text style={styles.totalsValue}>{fmtRound(summary.adminFeeClient)}</Text>
            </View>
          )}
          {summary.productionFee > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Production Fee</Text>
              <Text style={styles.totalsValue}>{fmtRound(summary.productionFee)}</Text>
            </View>
          )}
          {summary.discountAmount > 0 && (
            <View style={styles.discountRow}>
              <Text style={styles.discountLabel}>Client Discount</Text>
              <Text style={styles.discountValue}>−{fmtRound(summary.discountAmount)}</Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{fmtRound(summary.totalClient)}</Text>
          </View>
          {guestCount > 0 && (
            <View style={[styles.totalsRow, { marginTop: 2 }]}>
              <Text style={[styles.totalsLabel, { color: BRAND_SILVER }]}>Price per person ({guestCount} guests)</Text>
              <Text style={[styles.totalsValue, { color: BRAND_SILVER }]}>{fmtRound(Math.ceil(summary.totalClient / guestCount))}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Quill Creative Event Design · (315) 569-9847 · alex@qceventdesign.com</Text>
          <Text style={styles.footerText}>{estimateName}</Text>
        </View>
      </Page>
    </Document>
  );
}
