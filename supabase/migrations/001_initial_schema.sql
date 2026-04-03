-- QC Estimator — Core Schema
-- Migration: 001_initial_schema

-- ============================================================
-- REFERENCE TABLES (admin-managed)
-- ============================================================

CREATE TABLE locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  food_tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  alcohol_tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  general_tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  effective_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE category_markups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  markup_pct NUMERIC(6,4) NOT NULL DEFAULT 0.50,
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_hours_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  revenue_threshold NUMERIC(12,2) NOT NULL,
  base_hours NUMERIC(6,1) NOT NULL,
  tier_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROGRAM (top-level container, like the Excel workbook)
-- ============================================================

CREATE TABLE programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client_name TEXT,                           -- nullable
  event_date DATE,
  guest_count INT DEFAULT 0,
  service_style TEXT,                         -- e.g., 'Family Style', 'Plated', 'Buffet'
  alcohol_type TEXT,                          -- e.g., 'Full Bar', 'Beer & Wine', 'None'
  event_time TEXT,                            -- e.g., '6-9'
  company_name TEXT,
  program_name TEXT,
  client_hotel TEXT,
  location_id UUID REFERENCES locations(id),
  -- Commission & fee config
  cc_processing_fee NUMERIC(6,4) DEFAULT 0.035,
  client_commission NUMERIC(6,4) DEFAULT 0.05,
  gdp_commission_enabled BOOLEAN DEFAULT FALSE,
  gdp_commission_rate NUMERIC(6,4) DEFAULT 0.065,
  -- Restaurant fee defaults
  service_charge_default TEXT DEFAULT '20%',  -- '20%', '21.5%', 'None'
  gratuity_default TEXT DEFAULT '20%',        -- '20%', 'None'
  admin_fee_default TEXT DEFAULT '5%',        -- '5%', 'None'
  -- Third-party commissions stored as JSONB array
  third_party_commissions JSONB DEFAULT '[]'::jsonb,
  -- Metadata
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ESTIMATES (venue/av/decor — like the Excel tabs)
-- ============================================================

CREATE TYPE estimate_type AS ENUM ('venue', 'av', 'decor');

CREATE TABLE estimates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  type estimate_type NOT NULL DEFAULT 'venue',
  name TEXT NOT NULL,                          -- e.g., 'The Belmond — Ballroom'
  room_space TEXT,
  fb_minimum NUMERIC(12,2) DEFAULT 0,
  is_venue_taxable BOOLEAN DEFAULT TRUE,
  -- Fee overrides (null = use program defaults)
  service_charge_override TEXT,
  gratuity_override TEXT,
  admin_fee_override TEXT,
  -- Budget toggle
  include_in_budget BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  -- Team notes (free-form, like the Excel notes section)
  venue_contact TEXT,
  menu_notes TEXT,
  logistics_notes TEXT,
  additional_notes TEXT,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LINE ITEMS
-- ============================================================

CREATE TYPE tax_type AS ENUM ('food', 'alcohol', 'general', 'none');

CREATE TABLE estimate_line_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  section TEXT NOT NULL,                       -- e.g., 'F&B', 'Equipment & Staffing', 'Venue Fees', 'Non-Taxable Staffing'
  name TEXT NOT NULL,
  qty NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  category_id UUID REFERENCES category_markups(id),
  tax_type tax_type NOT NULL DEFAULT 'general',
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_estimates_program_id ON estimates(program_id);
CREATE INDEX idx_line_items_estimate_id ON estimate_line_items(estimate_id);
CREATE INDEX idx_programs_created_at ON programs(created_at DESC);
CREATE INDEX idx_programs_client_name ON programs(client_name);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_programs_updated_at
  BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_estimates_updated_at
  BEFORE UPDATE ON estimates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_line_items_updated_at
  BEFORE UPDATE ON estimate_line_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_locations_updated_at
  BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_category_markups_updated_at
  BEFORE UPDATE ON category_markups FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_markups ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_hours_tiers ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (small internal team)
CREATE POLICY "Authenticated users can do everything" ON programs
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can do everything" ON estimates
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can do everything" ON estimate_line_items
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can do everything" ON locations
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can do everything" ON category_markups
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can do everything" ON team_hours_tiers
  FOR ALL USING (auth.role() = 'authenticated');
