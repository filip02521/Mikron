-- ============================================================
-- 106: Properly REVOKE EXECUTE on SECURITY DEFINER functions
--      Migration 104 revoked from anon/authenticated, but the grant
--      is on PUBLIC (which both roles inherit from). Must revoke
--      from PUBLIC to actually prevent RPC execution.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_sales_person_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_operations() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_magazyn() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_warehouse_staff() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_sales_manager() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_sales_account() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_sales_rep() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_teeth_panel() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_department_board() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_operations_department(operations_department) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_managed_group_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_can_access_sales_person(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_read_sales_order(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_insert_sales_order(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_active_delegate_for(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_profile_role_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.try_acquire_job_lock(text, int, text) FROM PUBLIC;

-- rls_auto_enable was missed in 104 — revoke it too
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
