ALTER TABLE estimate_attachments
  ADD COLUMN IF NOT EXISTS line_items_populated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS details_populated    BOOLEAN NOT NULL DEFAULT false;
