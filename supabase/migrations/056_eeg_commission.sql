-- EEG commission (per-estimate, third-party pass-through fee shown as a client-visible line).
-- Mirrors the client-discount columns (023). eeg_enabled = the per-estimate toggle (default OFF, so
-- existing estimates are unchanged); eeg_rate = the editable rate as a decimal (0.10 = 10%, default).
-- DISPLAY/TOTAL only: the commission is computed in the pricing engine on the pre-tax subtotal and
-- added after tax. It does not affect tax, subtotal, or production fee. No backfill needed.
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS eeg_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eeg_rate NUMERIC(6,4) NOT NULL DEFAULT 0.10;
