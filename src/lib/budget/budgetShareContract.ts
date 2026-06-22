// Server-free CLIENT-SAFE contract for the public budget share link.
//
// This is the leak-proof boundary: the snapshot stored for a public link is ONLY this contract.
// It carries client-facing values exclusively — names, labels, ranges, client prices / per-person
// rates. It does NOT (and structurally cannot) carry cost, markup, margin, commission, vendor
// cost, or internal notes, because the BudgetLine/BudgetMember types it reuses have no such
// fields. The one internal reference that does exist — a member's source estimate id — is
// stripped to null here so no internal identifier reaches the public page.
//
// The same contract is rendered by the in-app Preview (proven clean) and the public route, so
// "what Alex previews" is exactly "what the client sees". A Vitest leak test gates this.

import type { BudgetLine } from './budgetDocument';

export const BUDGET_SHARE_CONTRACT_VERSION = 1;

export interface BudgetShareContract {
  version: number;
  programName: string;
  guestCount: number;
  events: { id: string; name: string }[];
  lines: BudgetLine[];
  disclaimers: string | null;
}

export function buildBudgetShareContract(args: {
  programName: string;
  guestCount: number;
  events: { id: string; name: string }[];
  lines: BudgetLine[];
  disclaimers: string | null;
}): BudgetShareContract {
  return {
    version: BUDGET_SHARE_CONTRACT_VERSION,
    programName: args.programName,
    guestCount: args.guestCount,
    // Keep only id + name — drop event_date/guest_count/etc.
    events: args.events.map((e) => ({ id: e.id, name: e.name })),
    lines: args.lines.map((line) => ({
      ...line,
      // `notes` is internal line commentary — never put it on a public record.
      notes: null,
      // Strip the internal source-estimate reference from every member.
      members: line.members.map((m) => ({ ...m, sourceEstimateId: null })),
    })),
    disclaimers: args.disclaimers,
  };
}
