// Scanner-specific types. No Next.js / React imports.

export interface ParsedLead {
  client_name?: string | null;
  end_company?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_role?: string | null;
  third_party_company?: string | null;
  third_party_contact?: string | null;
  third_party_comm_notes?: string | null;
  program_name?: string | null;
  program_type?: string | null;
  program_description?: string | null;
  start_date?: string | null;    // ISO date YYYY-MM-DD
  end_date?: string | null;
  rain_date?: string | null;
  num_nights?: number | null;
  guest_count?: number | null;
  city?: string | null;
  state?: string | null;
  hotel?: string | null;
  venue?: string | null;
  region?: string | null;
  lead_source?: string | null;
  source_advisor?: string | null;
  source_coordinator?: string | null;
  source_commission?: number | null;       // decimal e.g. 0.10 = 10%
  third_party_commission?: number | null;
  commission_notes?: string | null;
  billing_notes?: string | null;
  returning_client?: boolean | null;
  special_instructions?: string | null;
}

export interface RawEmailMessage {
  messageId: string;
  emailBody: string;    // plain text
  emailLink: string;    // https://mail.google.com/mail/u/0/#inbox/{messageId}
  subject: string;
  receivedAt: Date;
}

export interface ScanResult {
  batchId: string;
  startedAt: Date;
  emailsFound: number;
  emailsParsed: number;
  leadsCreated: number;
  errors: string[];
}
