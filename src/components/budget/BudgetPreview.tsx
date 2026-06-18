'use client';

// In-app Preview wrapper. Builds the same client-safe BudgetShareContract that the public share
// link stores + renders, then hands it to the shared BudgetDocumentView. So what Alex previews is
// exactly what a client sees on the link (and what the leak test gates).

import type { BudgetLine } from '@/lib/budget/budgetDocument';
import { buildBudgetShareContract } from '@/lib/budget/budgetShareContract';
import BudgetDocumentView from './BudgetDocumentView';
import type { BudgetEventInfo } from './BudgetBuilder';

interface Props {
  programName: string;
  programGuestCount: number;
  events: BudgetEventInfo[];
  lines: BudgetLine[];
  disclaimers: string | null;
}

export default function BudgetPreview({ programName, programGuestCount, events, lines, disclaimers }: Props) {
  const contract = buildBudgetShareContract({
    programName,
    guestCount: programGuestCount,
    events: events.map((e) => ({ id: e.id, name: e.name })),
    lines,
    disclaimers,
  });
  return <BudgetDocumentView contract={contract} />;
}
