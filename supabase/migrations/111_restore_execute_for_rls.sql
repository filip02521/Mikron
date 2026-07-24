-- ============================================================
-- 111: Restore EXECUTE on RLS helper functions for authenticated/anon
--      Migration 106 revoked EXECUTE FROM PUBLIC, which broke RLS
--      policies that reference these functions. RLS policies execute
--      as the calling user, so the user needs EXECUTE permission.
--
--      handle_new_user, guard_profile_role_change, try_acquire_job_lock,
--      and rls_auto_enable remain revoked (not used in RLS policies).
-- ============================================================

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.my_sales_person_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_operations() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_magazyn() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_warehouse_staff() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_sales_manager() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_sales_account() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_sales_rep() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_access_teeth_panel() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_access_department_board() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_access_operations_department(operations_department) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.my_managed_group_ids() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.manager_can_access_sales_person(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_read_sales_order(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_insert_sales_order(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_active_delegate_for(UUID) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
