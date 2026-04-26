-- Line item templates: reusable items users can insert into any estimate

create table if not exists line_item_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category_id uuid references category_markups(id) on delete set null,
  default_unit_price numeric(12,2) not null default 0,
  tax_type    text not null default 'general',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table line_item_templates enable row level security;

-- Authenticated users can read all templates (shared pool)
create policy "authenticated read templates"
  on line_item_templates for select
  to authenticated
  using (true);

-- Users can insert their own templates
create policy "authenticated insert templates"
  on line_item_templates for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Users can delete their own templates
create policy "authenticated delete own templates"
  on line_item_templates for delete
  to authenticated
  using (auth.uid() = created_by);
