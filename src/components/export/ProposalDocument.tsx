// Client-facing proposal PDF document — rendered by @react-pdf/renderer
// Import this file ONLY via dynamic import() inside client event handlers to avoid SSR issues.
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { EstimateSummary, Location } from '@/types';
import type { LineItemForExport, OrderedSection } from '@/lib/utils/export';
import { itemClientCost, groupLineItemsBySections } from '@/lib/utils/export';
import type { TourDetails } from '@/lib/tours/types';
import { sanitizeLineItemName, sectionDisplayLabel, sanitizeEstimateName } from '@/lib/deck/renderer';
import { stateAbbrevFromLocation } from '@/lib/utils/locationLabel';

function taxRateForItem(taxType: string, location: Location): number {
  if (taxType === 'food') return location.foodTaxRate;
  if (taxType === 'alcohol') return location.alcoholTaxRate;
  return location.generalTaxRate;
}

const BRAND_CHARCOAL = '#464543';
const BRAND_BROWN = '#846E60';
const BRAND_COPPER = '#C19C81';
const BRAND_CREAM = '#ECDFCE';
const BRAND_SILVER = '#A9AEB4';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: BRAND_CHARCOAL, padding: 48, lineHeight: 1.4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, paddingBottom: 16, borderBottomWidth: 1.5, borderBottomColor: BRAND_CREAM },
  logo: { width: 60, height: 60, marginRight: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
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


export interface ProposalDocumentProps {
  estimateId: string;
  estimateName: string;
  programName: string;
  clientName: string | null | undefined;
  clientCompany: string | null | undefined;
  guestCount: number;
  summary: EstimateSummary;
  lineItems: LineItemForExport[];
  orderedSections?: OrderedSection[];
  estimateType: 'venue' | 'av' | 'decor' | 'tour';
  proposalDate: string;
  taxExempt?: boolean;
  logoSrc?: string;
  location?: Location | null;
  tourDetails?: TourDetails | null;
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
  orderedSections,
  estimateType,
  proposalDate,
  taxExempt = false,
  logoSrc,
  location,
  tourDetails,
}: ProposalDocumentProps) {
  const proposalNumber = estimateId.slice(0, 8).toUpperCase();

  // Group line items by section IDENTITY (not display name), so two sections sharing a name each
  // render as their own block with only their own items — no shared-name double-emit.
  const sectionGroups = groupLineItemsBySections(lineItems, orderedSections);
  const totalTax = summary.foodTax + summary.alcoholTax + summary.equipmentTax + summary.venueTax + summary.productionFeeTax;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {logoSrc && <Image src={logoSrc} style={styles.logo} />}
            <View>
              <Text style={styles.companyName}>Quill Creative Event Design</Text>
              <Text style={styles.companyTagline}>Corporate Event Planning</Text>
            </View>
          </View>
          <View style={styles.contactBlock}>
            <Text style={styles.contactLine}>(803) 792-9338</Text>
            <Text style={styles.contactLine}>events@qceventdesign.com</Text>
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

        {/* Tour logistics block */}
        {estimateType === 'tour' && tourDetails && (
          (() => {
            const hasContent = tourDetails.pickup_address || tourDetails.departure_time ||
              tourDetails.return_time || tourDetails.duration_hours || tourDetails.dropoff_address;
            if (!hasContent) return null;
            const PICKUP_LABELS: Record<string, string> = {
              hotel: 'Hotel pickup', meeting_point: 'Meeting point', airport: 'Airport',
            };
            const pickupLabel = tourDetails.pickup_type ? (PICKUP_LABELS[tourDetails.pickup_type] ?? tourDetails.pickup_type) : null;
            return (
              <View style={{ marginBottom: 16, padding: 10, backgroundColor: '#FDFAF7', borderWidth: 0.75, borderColor: BRAND_CREAM, borderRadius: 4 }}>
                <Text style={{ fontSize: 7.5, color: BRAND_BROWN, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Tour Details</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {tourDetails.pickup_address ? (
                    <View>
                      <Text style={{ fontSize: 7.5, color: BRAND_SILVER, textTransform: 'uppercase', letterSpacing: 0.4 }}>{pickupLabel ?? 'Pickup'}</Text>
                      <Text style={{ fontSize: 9, color: BRAND_CHARCOAL }}>{tourDetails.pickup_address}</Text>
                    </View>
                  ) : null}
                  {(tourDetails.departure_time || tourDetails.return_time) ? (
                    <View>
                      <Text style={{ fontSize: 7.5, color: BRAND_SILVER, textTransform: 'uppercase', letterSpacing: 0.4 }}>Times</Text>
                      <Text style={{ fontSize: 9, color: BRAND_CHARCOAL }}>
                        {[tourDetails.departure_time, tourDetails.return_time].filter(Boolean).join(' → ')}
                        {tourDetails.duration_hours ? ` (${tourDetails.duration_hours} hr)` : ''}
                      </Text>
                    </View>
                  ) : null}
                  {tourDetails.dropoff_address && tourDetails.dropoff_address !== tourDetails.pickup_address ? (
                    <View>
                      <Text style={{ fontSize: 7.5, color: BRAND_SILVER, textTransform: 'uppercase', letterSpacing: 0.4 }}>Drop-off</Text>
                      <Text style={{ fontSize: 9, color: BRAND_CHARCOAL }}>{tourDetails.dropoff_address}</Text>
                    </View>
                  ) : null}
                  {tourDetails.meeting_point_notes ? (
                    <View>
                      <Text style={{ fontSize: 7.5, color: BRAND_SILVER, textTransform: 'uppercase', letterSpacing: 0.4 }}>Meeting Point</Text>
                      <Text style={{ fontSize: 9, color: BRAND_CHARCOAL }}>{tourDetails.meeting_point_notes}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })()
        )}

        {/* Line items by section (grouped by section id) */}
        {sectionGroups.map((group) => {
          const sectionItems = group.items;
          return (
            // Section is wrappable: a long florals section flows across pages instead of
            // colliding. A non-wrappable section taller than a page makes @react-pdf collapse
            // its layout (header-on-row, tax-rate-on-jurisdiction, compressed rows).
            <View key={group.id}>
              {/* Keep the section header + column header together; minPresenceAhead prevents
                  the header from orphaning at the very bottom of a page with no rows under it. */}
              <View wrap={false} minPresenceAhead={60}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>{sectionDisplayLabel(group.name)}</Text>
                </View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.colItem]}>Item</Text>
                  <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
                  <Text style={[styles.tableHeaderCell, styles.colPrice]}>Unit Price</Text>
                  <Text style={[styles.tableHeaderCell, styles.colTax]}>Tax</Text>
                  <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
                </View>
              </View>
              {sectionItems.map((item, idx) => {
                const clientTotal = itemClientCost(item);
                const unitPrice = item.categoryId === 'custom' && item.customClientUnitPrice !== undefined
                  ? item.customClientUnitPrice
                  : item.unitPrice * (1 + item.categoryMarkupPct);
                const taxNone = item.taxType === 'none';
                const taxRatePct = (!taxNone && location)
                  ? parseFloat((taxRateForItem(item.taxType, location) * 100).toFixed(3))
                  : null;
                const taxRateLabel = taxExempt ? 'Exempt' : taxNone ? '—' : taxRatePct != null ? `${taxRatePct}%` : '—';
                // Jurisdiction shows the STATE abbreviation ("VA"), not the city — empty when the
                // location has no recognizable state, so the cell reads just "6%" with no trailing comma.
                const taxPlaceLabel = (!taxExempt && !taxNone && location)
                  ? stateAbbrevFromLocation(location.name)
                  : null;
                return (
                  // Row stays intact (never splits mid-row); rows still break cleanly between each other.
                  // (A single row taller than a full page — e.g. a package item with dozens of
                  // sub-items — would hit the same overflow ceiling, but that's not realistic here.)
                  <View key={idx} wrap={false} style={[styles.row, idx % 2 === 1 ? styles.rowAlt : {}]}>
                    <View style={[styles.colItem, { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 }]}>
                      {item.thumbnailUrl ? (
                        <Image src={item.thumbnailUrl} style={{ width: 18, height: 18, borderRadius: 3, flexShrink: 0 }} />
                      ) : item.thumbnailIcon ? (
                        <View style={{ width: 18, height: 18, borderRadius: 3, backgroundColor: '#E8E0D5', flexShrink: 0 }} />
                      ) : null}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cell}>{sanitizeLineItemName(item.name)}</Text>
                        {(() => {
                          if (!item.packageOptions || !item.selectedPackageId) return null;
                          const pkg = item.packageOptions.options.find((o) => o.id === item.selectedPackageId);
                          if (!pkg) return null;
                          return (
                            <View style={{ marginTop: 2 }}>
                              <Text style={{ fontSize: 8, color: BRAND_BROWN, fontWeight: 'bold' }}>{sanitizeLineItemName(pkg.name)}</Text>
                              {pkg.items.length > 0 && (
                                <Text style={{ fontSize: 7.5, color: BRAND_SILVER, marginTop: 1 }}>
                                  {pkg.items.join(' · ')}
                                </Text>
                              )}
                            </View>
                          );
                        })()}
                      </View>
                    </View>
                    <Text style={[styles.cell, styles.colQty]}>{item.qty}</Text>
                    <Text style={[styles.cell, styles.colPrice]}>{fmt(unitPrice)}</Text>
                    <View style={styles.colTax}>
                      <Text style={styles.cellDim}>{taxRateLabel}</Text>
                      {taxPlaceLabel ? <Text style={{ fontSize: 7.5, color: BRAND_SILVER, textAlign: 'right' }}>{taxPlaceLabel}</Text> : null}
                    </View>
                    <Text style={[styles.cell, styles.colTotal]}>{fmt(clientTotal)}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* Totals block: Subtotal → Production Fee → Pre-Tax Total → Tax → Total */}
        <View style={styles.totalsBlock}>
          {summary.lineItemsSubtotalClient > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{fmtRound(summary.lineItemsSubtotalClient)}</Text>
            </View>
          )}
          {summary.productionFee > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Production Fee</Text>
              <Text style={styles.totalsValue}>{fmtRound(summary.productionFee)}</Text>
            </View>
          )}
          {summary.preTaxTotal > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Pre-Tax Total</Text>
              <Text style={styles.totalsValue}>{fmtRound(summary.preTaxTotal)}</Text>
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
          <Text style={styles.footerText}>Quill Creative Event Design · (803) 792-9338 · events@qceventdesign.com</Text>
          <Text style={styles.footerText}>{sanitizeEstimateName(estimateName)}</Text>
        </View>
      </Page>
    </Document>
  );
}
