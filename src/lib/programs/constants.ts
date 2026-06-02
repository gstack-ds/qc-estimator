export type ProgramStatus = 'active' | 'completed' | 'did_not_book';

export const STATUS_LABELS: Record<ProgramStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  did_not_book: 'Did Not Book',
};

export const PROGRAM_STATUSES: ProgramStatus[] = ['active', 'completed', 'did_not_book'];
