// Program-level combined proposal PDF — one document covering multiple estimates.
// Import ONLY via dynamic import() inside a client handler (same constraint as ProposalDocument).
// Each estimate renders with the SAME blocks the single-estimate proposal uses (so the page-wrap fix
// and same-name-section-id grouping carry over); a program grand total sums the selected estimates.
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import {
  styles, fmtRound,
  BRAND_CHARCOAL, BRAND_BROWN, BRAND_COPPER, BRAND_CREAM, BRAND_SILVER,
  EstimateLineItemSections, EstimateTotals, TourLogisticsBlock,
} from './ProposalDocument';
import { sanitizeEstimateName } from '@/lib/deck/renderer';
import { computeProgramGrandTotal, estimateTax } from '@/lib/proposals/programProposal';
import type { EstimateProposalPayload } from '@/lib/proposals/programProposal';

export interface ProgramProposalDocumentProps {
  programName: string;
  clientName: string | null;
  clientCompany: string | null;
  proposalDate: string;
  estimates: EstimateProposalPayload[];
  logoSrc?: string;
}

export default function ProgramProposalDocument({
  programName, clientName, clientCompany, proposalDate, estimates, logoSrc,
}: ProgramProposalDocumentProps) {
  const grand = computeProgramGrandTotal(estimates.map((e) => e.summary));

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Program header */}
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

        {/* Program metadata */}
        <View style={styles.meta}>
          <View style={styles.metaLeft}>
            <Text style={styles.metaLabel}>Proposal For</Text>
            <Text style={styles.metaValue}>{clientName ?? programName}</Text>
            {clientCompany ? <Text style={styles.metaValueSm}>{clientCompany}</Text> : null}
            <Text style={[styles.metaValueSm, { marginTop: 6 }]}>{programName}</Text>
            <Text style={styles.cellDim}>{estimates.length} {estimates.length === 1 ? 'estimate' : 'estimates'}</Text>
          </View>
          <View style={styles.metaRight}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValueSm}>{proposalDate}</Text>
            <Text style={[styles.metaLabel, { marginTop: 8 }]}>Program Total</Text>
            <Text style={styles.metaValue}>{fmtRound(grand.total)}</Text>
          </View>
        </View>

        {/* Each estimate as its own section; start a fresh page per estimate (except the first). */}
        {estimates.map((est, index) => (
          <View key={est.estimateId} break={index > 0}>
            <View style={{ marginTop: index > 0 ? 0 : 6, marginBottom: 4, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: BRAND_COPPER }}>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: BRAND_CHARCOAL }}>
                {est.eventName ?? sanitizeEstimateName(est.estimateName)}
              </Text>
              {est.eventName ? (
                <Text style={{ fontSize: 9, color: BRAND_BROWN, marginTop: 2 }}>{sanitizeEstimateName(est.estimateName)}</Text>
              ) : null}
            </View>

            {est.estimateType === 'tour' && <TourLogisticsBlock tourDetails={est.tourDetails} />}

            <EstimateLineItemSections
              lineItems={est.lineItems}
              orderedSections={est.orderedSections}
              location={est.location}
              taxExempt={est.taxExempt}
            />

            <EstimateTotals summary={est.summary} taxExempt={est.taxExempt} guestCount={est.guestCount} totalLabel="Estimate Total" />
          </View>
        ))}

        {/* Program grand total — sum of the selected estimates (each keeps its own tax). */}
        <View wrap={false} style={{ marginTop: 22, borderTopWidth: 1.5, borderTopColor: BRAND_COPPER, paddingTop: 12 }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: BRAND_BROWN, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
            Program Summary
          </Text>
          {grand.subtotal > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal (all estimates)</Text>
              <Text style={styles.totalsValue}>{fmtRound(grand.subtotal)}</Text>
            </View>
          )}
          {grand.productionFee > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Production Fees</Text>
              <Text style={styles.totalsValue}>{fmtRound(grand.productionFee)}</Text>
            </View>
          )}
          {grand.preTaxTotal > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Pre-Tax Total</Text>
              <Text style={styles.totalsValue}>{fmtRound(grand.preTaxTotal)}</Text>
            </View>
          )}
          {grand.tax > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax</Text>
              <Text style={styles.totalsValue}>{fmtRound(grand.tax)}</Text>
            </View>
          )}
          {grand.discountAmount > 0 && (
            <View style={styles.discountRow}>
              <Text style={styles.discountLabel}>Client Discounts</Text>
              <Text style={styles.discountValue}>−{fmtRound(grand.discountAmount)}</Text>
            </View>
          )}
          {grand.eegCommissionAmount > 0 && (
            <View style={styles.discountRow}>
              <Text style={styles.discountLabel}>EEG Commission</Text>
              <Text style={styles.discountValue}>+{fmtRound(grand.eegCommissionAmount)}</Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>Program Total</Text>
            <Text style={styles.grandTotalValue}>{fmtRound(grand.total)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Quill Creative Event Design · (803) 792-9338 · events@qceventdesign.com</Text>
          <Text style={styles.footerText}>{programName}</Text>
        </View>
      </Page>
    </Document>
  );
}

// Re-export for callers/tests that want the per-estimate tax helper alongside the doc.
export { estimateTax };
