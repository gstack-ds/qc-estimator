// Server-free types and constants for program documents.
// Client components import from HERE, not from queries.ts (which pulls in next/headers).

export type DocumentCategory =
  | 'Menu' | 'Contract' | 'Invoice' | 'Floor Plan' | 'BEO'
  | 'Insurance' | 'Proposal' | 'Correspondence' | 'Other';

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'Menu', 'Contract', 'Invoice', 'Floor Plan', 'BEO',
  'Insurance', 'Proposal', 'Correspondence', 'Other',
];

export interface DbProgramDocument {
  id: string;
  program_id: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  category: DocumentCategory;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  url?: string; // signed URL, generated at read time
}
