-- 051_budget_documents.sql
-- Client budget builder (Phase 1): a program-scoped budget composed of lines,
-- each line made of one or more members that derive from real estimates (with override).
-- Display/client-facing artifact — never feeds the pricing engine. Shareable link + client
-- capture come in later phases (separate migrations).

-- ── budget_documents : one client budget per program ─────────────────────────
CREATE TABLE budget_documents (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id   UUID        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  title        TEXT,
  status       TEXT        NOT NULL DEFAULT 'draft',
  disclaimers  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- one budget per program for Phase 1
CREATE UNIQUE INDEX budget_documents_program_id_idx ON budget_documents(program_id);

-- ── budget_lines : one row on the budget ─────────────────────────────────────
-- aggregation: 'sum' (all members add up) | 'select_one' (one member counts)
-- tiered: when true + select_one, members are ranked Low/Mid/High
CREATE TABLE budget_lines (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_document_id  UUID        NOT NULL REFERENCES budget_documents(id) ON DELETE CASCADE,
  event_id            UUID        REFERENCES events(id) ON DELETE SET NULL,
  name                TEXT        NOT NULL DEFAULT '',
  aggregation         TEXT        NOT NULL DEFAULT 'sum' CHECK (aggregation IN ('sum', 'select_one')),
  tiered              BOOLEAN     NOT NULL DEFAULT false,
  is_per_person       BOOLEAN     NOT NULL DEFAULT false,
  guest_count         INTEGER,
  is_optional         BOOLEAN     NOT NULL DEFAULT false,
  is_included         BOOLEAN     NOT NULL DEFAULT true,
  selected_member_id  UUID,       -- which member counts for select_one/tiered (app-managed, no FK)
  notes               TEXT,
  sort_order          INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX budget_lines_doc_idx ON budget_lines(budget_document_id);

-- ── budget_line_members : the flexible estimate→line mapping ──────────────────
-- derived_value = cached estimate client TOTAL; derived_pp = cached per-person rate.
-- override_value (null = use derived) is interpreted per the line's is_per_person flag.
CREATE TABLE budget_line_members (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_line_id     UUID        NOT NULL REFERENCES budget_lines(id) ON DELETE CASCADE,
  source_estimate_id UUID        REFERENCES estimates(id) ON DELETE SET NULL,
  tier               TEXT        CHECK (tier IN ('low', 'mid', 'high')),
  label              TEXT,
  derived_value      NUMERIC(12,2) NOT NULL DEFAULT 0,
  derived_pp         NUMERIC(12,2) NOT NULL DEFAULT 0,
  override_value     NUMERIC(12,2),
  source_removed     BOOLEAN     NOT NULL DEFAULT false,
  rank               INTEGER     NOT NULL DEFAULT 0,
  sort_order         INTEGER     NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX budget_line_members_line_idx ON budget_line_members(budget_line_id);

-- ── RLS : authenticated team can manage (internal tool) ──────────────────────
ALTER TABLE budget_documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_line_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth manage budget_documents"
  ON budget_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth manage budget_lines"
  ON budget_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth manage budget_line_members"
  ON budget_line_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
