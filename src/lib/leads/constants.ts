export type LeadStatus =
  | 'tracking_on_hold'
  | 'new_lead'
  | 'proposal_in_progress'
  | 'pending_client_review'
  | 'negotiations'
  | 'pending_contract_payment'
  | 'under_contract'
  | 'post_event_close_out'
  | 'unresponsive'
  | 'halted'
  | 'planning'
  | 'planning_not_started'
  | 'did_not_book'
  | 'completed';

export const STATUS_LABELS: Record<LeadStatus, string> = {
  tracking_on_hold:         'Tracking / On Hold',
  new_lead:                 'New Lead',
  proposal_in_progress:     'Proposal in Progress',
  pending_client_review:    'Pending Client Review',
  negotiations:             'Negotiations',
  pending_contract_payment: 'Pending Signature/Payment',
  under_contract:           'Under Contract',
  post_event_close_out:     'Post Event Close Out',
  unresponsive:             'Unresponsive',
  halted:                   'Halted',
  planning:                 'Planning',
  planning_not_started:     'Planning Not Started',
  did_not_book:             'Did Not Book',
  completed:                'Completed',
};

export type LeadStatusGroup = 'all' | 'open' | 'closed';

export const OPEN_STATUSES: LeadStatus[] = [
  'tracking_on_hold',
  'new_lead',
  'proposal_in_progress',
  'pending_client_review',
  'negotiations',
  'pending_contract_payment',
  'under_contract',
  'post_event_close_out',
  // legacy values — migrated away but kept for safety
  'planning',
  'planning_not_started',
  'halted',
];
export const CLOSED_STATUSES: LeadStatus[] = ['did_not_book', 'completed', 'unresponsive'];
