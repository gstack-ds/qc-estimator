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

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new_lead:                 'New Lead',
  proposal_in_progress:     'Proposal in Progress',
  pending_client_review:    'Pending Client Review',
  pending_contract_payment: 'Pending Contract/Payment',
  under_contract:           'Under Contract',
  planning:                 'Planning',
  unresponsive:             'Unresponsive',
  post_event_close_out:     'Post Event Close Out',
  halted:                   'Halted',
  planning_not_started:     'Planning Not Started',
  did_not_book:             'Did Not Book',
  completed:                'Completed',
};

export type LeadStatusGroup = 'all' | 'open' | 'paused' | 'closed';

export const OPEN_STATUSES: LeadStatus[] = [
  'new_lead', 'proposal_in_progress', 'pending_client_review', 'pending_contract_payment',
  'under_contract', 'planning', 'unresponsive', 'post_event_close_out',
];
export const PAUSED_STATUSES: LeadStatus[] = ['halted', 'planning_not_started'];
export const CLOSED_STATUSES: LeadStatus[] = ['did_not_book', 'completed'];
