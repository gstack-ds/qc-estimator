-- QC Estimator — Seed Data
-- Extracted from QC_Estimate_Template_2026.xlsx Client Setup tab

-- ============================================================
-- LOCATIONS (22 tax jurisdictions)
-- ============================================================

INSERT INTO locations (name, food_tax_rate, alcohol_tax_rate, general_tax_rate) VALUES
  ('Mecklenburg County NC (Charlotte)', 0.0725, 0.0725, 0.0725),
  ('Wake County NC (Raleigh)', 0.0725, 0.0725, 0.0725),
  ('Durham County NC', 0.0750, 0.0750, 0.0750),
  ('Cabarrus County NC (Concord)', 0.0700, 0.0700, 0.0700),
  ('Buncombe County NC (Asheville)', 0.0700, 0.0700, 0.0700),
  ('Wilson NC', 0.0675, 0.0675, 0.0675),
  ('DC', 0.1000, 0.1025, 0.0600),
  ('Maryland', 0.0600, 0.0900, 0.0600),
  ('Richmond VA', 0.0750, 0.0750, 0.0600),
  ('Leesburg VA', 0.0600, 0.0600, 0.0600),
  ('Atlanta GA', 0.0890, 0.0890, 0.0890),
  ('Cobb County GA', 0.0600, 0.0600, 0.0600),
  ('DeKalb County GA', 0.0800, 0.0800, 0.0800),
  ('Chatham County GA (Savannah)', 0.0700, 0.0700, 0.0700),
  ('Greene County GA (Greensboro)', 0.0800, 0.0800, 0.0800),
  ('Philadelphia PA', 0.0800, 0.0800, 0.0800),
  ('NYC', 0.08875, 0.08875, 0.08875),
  ('Charleston SC', 0.0800, 0.0800, 0.0800),
  ('Union SC', 0.0700, 0.0700, 0.0700),
  ('York SC', 0.0700, 0.0700, 0.0700),
  ('Greenville SC', 0.0600, 0.0600, 0.0600),
  ('New Jersey', 0.06625, 0.06625, 0.06625);

-- ============================================================
-- CATEGORY MARKUPS (11 categories + floor)
-- ============================================================

INSERT INTO category_markups (name, markup_pct, notes, sort_order) VALUES
  ('Catering & F&B', 0.55, 'Floor — clients compare per-head pricing', 1),
  ('Venues & Room Rentals', 0.60, 'Full venue relationship management', 2),
  ('AV & Production', 0.65, 'Technical coordination, hard to price-shop', 3),
  ('Décor & Design', 0.85, 'Custom creative — no comparison exists', 4),
  ('Entertainment', 0.75, 'Talent sourcing, contracts, riders', 5),
  ('Activities & Experiences', 0.75, 'Curation, coordination, permitting', 6),
  ('Transportation', 0.75, 'Route planning, high-liability', 7),
  ('Staffing & Labor', 0.90, 'Recruitment, scheduling, management', 8),
  ('Purchased / Sourced Items', 2.00, 'Small items, disproportionate time (3×)', 9),
  ('Delivery & Logistics', 0.85, 'Timing risk, damage liability', 10),
  ('Tours & Guided Experiences', 0.65, 'Guide sourcing, route design', 11);

-- ============================================================
-- TEAM HOURS TIERS (14 revenue-based tiers)
-- ============================================================

INSERT INTO team_hours_tiers (revenue_threshold, base_hours, tier_name) VALUES
  (0, 5, 'Micro'),
  (5000, 10, 'Micro'),
  (10000, 20, 'Small'),
  (15000, 28, 'Small'),
  (25000, 40, 'Standard'),
  (35000, 50, 'Standard'),
  (50000, 65, 'Complex'),
  (75000, 85, 'Complex'),
  (100000, 110, 'Premium'),
  (125000, 125, 'Premium'),
  (150000, 140, 'Premium'),
  (200000, 170, 'Enterprise'),
  (250000, 190, 'Enterprise'),
  (300000, 210, 'Enterprise');
