-- Create team_members table
CREATE TABLE team_members (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed
INSERT INTO team_members (first_name, last_name, role) VALUES
  ('Alex',     'Stack',    'founder and creator'),
  ('Lindsey',  'Correa',   'senior event coordinator'),
  ('Lydia',    'Defore',   'lead event coordinator'),
  ('Danielle', 'Rose',     'event operations coordinator'),
  ('Abbie',    'Blair',    'lead event coordinator'),
  ('Khloe',    'Parker',   'event coordinator'),
  ('Jakie',    'Quill',    'event coordinator'),
  ('Sonja',    'Pasko',    'sales coordinator'),
  ('Kelly',    'Saunders', 'on-site coordinator');

-- RLS: authenticated users can read; service role has full access
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_members_select" ON team_members FOR SELECT TO authenticated USING (true);

-- Change leads.assigned_to: drop text column, add integer FK
-- (existing text values are discarded; any already-stored names become NULL)
ALTER TABLE leads DROP COLUMN assigned_to;
ALTER TABLE leads ADD COLUMN assigned_to INTEGER REFERENCES team_members(id) ON DELETE SET NULL;
