-- ============================================================
-- 107: Set search_path on SECURITY DEFINER functions
--      Fixes advisor warning: function_search_path_mutable
--
--      These functions use unqualified table/type names (e.g.
--      FROM profiles, operations_department) that live in public.
--      Without an explicit search_path, a malicious role could
--      create a shadow table in another schema and hijack queries.
--
--      ALTER FUNCTION ... SET search_path is safe:
--      - Does NOT change the function body
--      - Does NOT change permissions
--      - Does NOT change owner
--      - Only affects search_path during function execution
--
--      Functions that already have search_path set are skipped:
--      - guard_profile_role_change (search_path = 'public')
--      - handle_new_user (search_path = 'public')
--      - rls_auto_enable (search_path = 'pg_catalog')
--      - try_acquire_job_lock (search_path = 'public')
-- ============================================================

ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.is_operations() SET search_path = public;
ALTER FUNCTION public.is_magazyn() SET search_path = public;
ALTER FUNCTION public.is_warehouse_staff() SET search_path = public;
ALTER FUNCTION public.is_sales_manager() SET search_path = public;
ALTER FUNCTION public.is_sales_account() SET search_path = public;
ALTER FUNCTION public.is_sales_rep() SET search_path = public;
ALTER FUNCTION public.my_sales_person_id() SET search_path = public;
ALTER FUNCTION public.my_managed_group_ids() SET search_path = public;
ALTER FUNCTION public.manager_can_access_sales_person(UUID) SET search_path = public;
ALTER FUNCTION public.can_read_sales_order(UUID) SET search_path = public;
ALTER FUNCTION public.can_insert_sales_order(UUID) SET search_path = public;
ALTER FUNCTION public.is_active_delegate_for(UUID) SET search_path = public;
ALTER FUNCTION public.can_access_teeth_panel() SET search_path = public;
ALTER FUNCTION public.can_access_department_board() SET search_path = public;
ALTER FUNCTION public.can_access_operations_department(operations_department) SET search_path = public;

NOTIFY pgrst, 'reload schema';
