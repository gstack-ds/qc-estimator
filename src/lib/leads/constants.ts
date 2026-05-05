export type LeadStatus =
  | 'new_lead'
  | 'proposal_in_progress'
  | 'pending_client_review'
  | 'pending_contract_payment'
  | 'under_contract'
  | 'planning'
  | 'unresponsive'
  | 'post_event_close_out'
  | 'halted'
  | 'planning_not_started'
  | 'did_not_book'
  | 'completed';

export type LeadStatusGroup = 'all' | 'open' | 'paused' | 'closed';

export const OPEN_STATUSES: LeadStatus[] = [
  'new_lead', 'proposal_in_progress', 'pending_client_review', 'pending_contract_payment',
  'under_contract', 'planning', 'unresponsive', 'post_event_close_out',
];
export const PAUSED_STATUSES: LeadStatus[] = ['halted', 'planning_not_started'];
export const CLOSED_STATUSES: LeadStatus[] = ['did_not_book', 'completed'];
