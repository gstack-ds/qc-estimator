-- Add extracted_data column to estimate_attachments for Claude API PDF extraction results
ALTER TABLE estimate_attachments
  ADD COLUMN IF NOT EXISTS extracted_data JSONB;
