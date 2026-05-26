-- Grupy handlowców (np. Sklep, Biuro) — podgląd zespołu i przypisanie osób

CREATE TABLE sales_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sales_groups_name_lower_idx ON sales_groups (lower(trim(name)));

ALTER TABLE sales_people
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES sales_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_people_group_id ON sales_people (group_id)
  WHERE group_id IS NOT NULL;

INSERT INTO sales_groups (name, sort_order)
SELECT 'Sklep', 1
WHERE NOT EXISTS (SELECT 1 FROM sales_groups WHERE lower(trim(name)) = 'sklep');

INSERT INTO sales_groups (name, sort_order)
SELECT 'Biuro', 2
WHERE NOT EXISTS (SELECT 1 FROM sales_groups WHERE lower(trim(name)) = 'biuro');

ALTER TABLE sales_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_groups_select ON sales_groups
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY sales_groups_manage ON sales_groups
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_sales_manager())
  WITH CHECK (public.is_admin() OR public.is_sales_manager());
