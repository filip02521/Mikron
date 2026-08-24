-- ============================================================
-- 149: Supabase advisor fixes (2026-08-24)
-- ============================================================
-- 1. operations_notes_protect_identity — search_path + brak EXECUTE dla API
-- 2. guard_individual_orders_procurement_flag — trigger-only (bez RPC)
-- 3. RLS helpers — REVOKE EXECUTE dla anon (zostaje authenticated pod polityki)
-- 4. user_admin_modules — initplan + jedna polityka SELECT
-- 5. zd_estimate_ui_sessions — initplan auth.uid()
-- 6. Indeksy brakujących FK (unindexed_foreign_keys)
-- ============================================================

-- 1. Trigger notatek operacyjnych — jawny search_path, bez wywołań RPC
CREATE OR REPLACE FUNCTION public.operations_notes_protect_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.department IS DISTINCT FROM OLD.department
     OR NEW.visibility IS DISTINCT FROM OLD.visibility THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Nie można zmieniać autora, działu ani widoczności notatki.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.operations_notes_protect_identity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operations_notes_protect_identity() FROM anon, authenticated;

COMMENT ON FUNCTION public.operations_notes_protect_identity() IS
  'Blokuje zmianę autora/działu/widoczności notatki (trigger-only, search_path=public).';

-- 2. Trigger flagi zakupów — tylko trigger, nie RPC
REVOKE ALL ON FUNCTION public.guard_individual_orders_procurement_flag() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_individual_orders_procurement_flag() FROM anon, authenticated;

COMMENT ON FUNCTION public.guard_individual_orders_procurement_flag() IS
  'Chroni kolumny procurement_flag przed mutacją przez JWT (trigger-only).';

-- 3. SECURITY DEFINER helpers — anon nie powinien wołać /rpc/* (RLS authenticated zostaje)
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_sales_person_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_operations() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_magazyn() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_warehouse_staff() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_sales_manager() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_sales_account() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_sales_rep() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_teeth_panel() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_department_board() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_operations_department(public.operations_department) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_managed_group_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.manager_can_access_sales_person(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_read_sales_order(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_insert_sales_order(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_active_delegate_for(uuid) FROM anon;

-- 4. user_admin_modules — initplan + merge permissive SELECT policies
DROP POLICY IF EXISTS user_admin_modules_select_own ON public.user_admin_modules;
DROP POLICY IF EXISTS user_admin_modules_admin_manage ON public.user_admin_modules;

CREATE POLICY user_admin_modules_select ON public.user_admin_modules
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

CREATE POLICY user_admin_modules_admin_insert ON public.user_admin_modules
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY user_admin_modules_admin_update ON public.user_admin_modules
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY user_admin_modules_admin_delete ON public.user_admin_modules
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- 5. zd_estimate_ui_sessions — initplan
DROP POLICY IF EXISTS zd_estimate_ui_sessions_owner_all ON public.zd_estimate_ui_sessions;
CREATE POLICY zd_estimate_ui_sessions_owner_all
  ON public.zd_estimate_ui_sessions
  FOR ALL TO authenticated
  USING (owner_user_id = (SELECT auth.uid()))
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

-- 6. Indeksy FK (advisor: unindexed_foreign_keys)
CREATE INDEX IF NOT EXISTS department_board_thread_attachments_created_by_idx
  ON public.department_board_thread_attachments (created_by);

CREATE INDEX IF NOT EXISTS mail_send_log_triggered_by_idx
  ON public.mail_send_log (triggered_by);

CREATE INDEX IF NOT EXISTS zd_estimate_exclusions_created_by_idx
  ON public.zd_estimate_exclusions (created_by);

CREATE INDEX IF NOT EXISTS zd_estimate_on_request_created_by_idx
  ON public.zd_estimate_on_request (created_by);

CREATE INDEX IF NOT EXISTS zd_estimate_order_snapshots_linked_by_idx
  ON public.zd_estimate_order_snapshots (linked_by);

CREATE INDEX IF NOT EXISTS zd_estimate_packaging_created_by_idx
  ON public.zd_estimate_packaging (created_by);

CREATE INDEX IF NOT EXISTS zd_estimate_supplier_scopes_updated_by_idx
  ON public.zd_estimate_supplier_scopes (updated_by);

CREATE INDEX IF NOT EXISTS zd_product_boms_created_by_idx
  ON public.zd_product_boms (created_by);

CREATE INDEX IF NOT EXISTS zd_product_pairs_created_by_idx
  ON public.zd_product_pairs (created_by);

NOTIFY pgrst, 'reload schema';
