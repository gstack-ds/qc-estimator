-- Budget Plan Entries: per-program budget targets mapped to estimates/events.
-- Supports per_event entries (one estimate) and pooled entries (shared pool).
-- A single program can freely mix both types.

CREATE TYPE budget_entry_type AS ENUM ('per_event', 'pooled');
CREATE TYPE budget_pricing_basis AS ENUM ('per_person', 'flat');

CREATE TABLE budget_plan_entries (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id          UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  entry_type          budget_entry_type NOT NULL DEFAULT 'per_event',
  label               TEXT NOT NULL DEFAULT '',

  -- Optionally linked to one estimate and/or one event
  linked_estimate_id  UUID REFERENCES estimates(id) ON DELETE SET NULL,
  linked_event_id     UUID REFERENCES events(id) ON DELETE SET NULL,

  -- Per-event fields (ignored for pooled)
  pricing_basis       budget_pricing_basis NOT NULL DEFAULT 'per_person',
  value_low           NUMERIC(10,2) NOT NULL DEFAULT 0,  -- single value: low = high
  value_high          NUMERIC(10,2) NOT NULL DEFAULT 0,
  guest_low           INT,   -- null → use program/event guest_count
  guest_high          INT,
  pinned_value        NUMERIC(10,2),  -- team's working point; null → midpoint

  -- Pooled-only fields
  pool_total          NUMERIC(10,2),

  sort_order          INT NOT NULL DEFAULT 0,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER budget_plan_entries_updated_at
  BEFORE UPDATE ON budget_plan_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE budget_plan_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_plan_entries_select"
  ON budget_plan_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "budget_plan_entries_insert"
  ON budget_plan_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "budget_plan_entries_update"
  ON budget_plan_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "budget_plan_entries_delete"
  ON budget_plan_entries FOR DELETE TO authenticated USING (true);
