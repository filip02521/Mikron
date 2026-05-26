-- Kierownik ↔ grupa (Sklep/Biuro) + log dopasowań dostawcy z Subiekta

CREATE TABLE sales_group_managers (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES sales_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, group_id)
);

CREATE INDEX idx_sales_group_managers_group ON sales_group_managers (group_id);

ALTER TABLE sales_group_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_group_managers_select ON sales_group_managers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY sales_group_managers_manage ON sales_group_managers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE supplier_resolve_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES individual_orders(id) ON DELETE CASCADE,
  result TEXT NOT NULL,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_resolve_log_created ON supplier_resolve_log (created_at DESC);
CREATE INDEX idx_supplier_resolve_log_order ON supplier_resolve_log (order_id);

ALTER TABLE supplier_resolve_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_resolve_log_admin ON supplier_resolve_log
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
