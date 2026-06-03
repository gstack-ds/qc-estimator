export type ProgramStatus = 'active' | 'completed' | 'did_not_book';

export const STATUS_LABELS: Record<ProgramStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  did_not_book: 'Did Not Book',
};

export const PROGRAM_STATUSES: ProgramStatus[] = ['active', 'completed', 'did_not_book'];

// Maps 3-value program lifecycle → lead pipeline for terminal back-propagation.
// Returns null for 'active' — the reverse is lossy, so leave the lead's status alone.
export function programStatusToLeadStatus(
  programStatus: ProgramStatus,
): 'completed' | 'did_not_book' | null {
  if (programStatus === 'completed') return 'completed';
  if (programStatus === 'did_not_book') return 'did_not_book';
  return null;
}
