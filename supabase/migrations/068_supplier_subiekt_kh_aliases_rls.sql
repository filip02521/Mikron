-- RLS dla mapowania kh_Id Subiekt ↔ dostawca (wcześniej brak polityk).
ALTER TABLE supplier_subiekt_kh_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_subiekt_kh_aliases_admin ON supplier_subiekt_kh_aliases;
CREATE POLICY supplier_subiekt_kh_aliases_admin ON supplier_subiekt_kh_aliases
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS supplier_subiekt_kh_aliases_operations_read ON supplier_subiekt_kh_aliases;
CREATE POLICY supplier_subiekt_kh_aliases_operations_read ON supplier_subiekt_kh_aliases
  FOR SELECT TO authenticated
  USING (public.is_operations());
