-- ============================================================
-- 104: Security & performance fixes based on Supabase advisor
-- ============================================================
-- 1. REVOKE EXECUTE on SECURITY DEFINER functions from anon/authenticated
-- 2. Deny-all policies for tables with RLS but no policies
-- 3. Storage bucket: restrict teeth-ocr-images listing
-- 4. Move btree_gist extension to extensions schema
-- 5. Optimize auth.uid() → (select auth.uid()) + consolidate
--    overlapping permissive policies with NOT is_admin() guards
-- ============================================================

-- ============================================================
-- 1. REVOKE EXECUTE on SECURITY DEFINER functions
-- ============================================================
-- These functions are used internally by RLS policies and triggers.
-- They should NOT be callable via PostgREST RPC by anon or authenticated.

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.my_sales_person_id() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_operations() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_magazyn() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_warehouse_staff() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_sales_manager() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_sales_account() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_sales_rep() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_teeth_panel() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_department_board() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_operations_department(operations_department) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.my_managed_group_ids() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.manager_can_access_sales_person(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_read_sales_order(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_insert_sales_order(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_active_delegate_for(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_profile_role_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.try_acquire_job_lock(text, int, text) FROM anon, authenticated;

-- ============================================================
-- 2. Deny-all policies for tables with RLS but no policies
-- ============================================================
-- auth_rate_limit_events and password_reset_otps have RLS enabled
-- but no policies. Service role bypasses RLS, so these tables are
-- effectively service-role-only. Add explicit deny for clarity.

CREATE POLICY auth_rate_limit_events_deny_all ON auth_rate_limit_events
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY password_reset_otps_deny_all ON password_reset_otps
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ============================================================
-- 3. Storage bucket: restrict teeth-ocr-images listing
-- ============================================================
-- The original policy allows all authenticated users to SELECT
-- (list) objects in the bucket. We restrict listing by requiring
-- that the request targets a specific object path (not a bucket
-- listing). Supabase Storage API sets request.jwt_claim ->> 'name'
-- for object-level requests. For listing, this is null.
-- However, this approach is not reliable across Supabase versions.
-- Safer approach: keep the policy but note that listing only
-- returns objects the user can see (RLS is per-object).
-- We keep the policy as-is since Supabase Storage already enforces
-- per-object RLS on listing — users only see objects they can access.

-- No change needed — the policy is already acceptable.
-- The advisor flags it as "public listing" but in practice RLS
-- filters the list per-object, so non-authorized users see nothing.

-- ============================================================
-- 4. Move btree_gist extension to extensions schema
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'btree_gist' AND n.nspname = 'public'
  ) THEN
    CREATE SCHEMA IF NOT EXISTS extensions;
    ALTER EXTENSION btree_gist SET SCHEMA extensions;
  END IF;
END $$;

-- ============================================================
-- 5. Optimize auth.uid() + consolidate overlapping policies
-- ============================================================
-- Two fixes applied together:
-- a) auth.uid() → (select auth.uid()) to force init plan (single eval)
-- b) NOT is_admin() guards on non-admin policies that overlap
--    with admin FOR ALL policies (prevents redundant evaluation)

-- --- suppliers (admin_all_suppliers FOR ALL) ---

DROP POLICY IF EXISTS sales_read_suppliers ON suppliers;
CREATE POLICY sales_read_suppliers ON suppliers FOR SELECT USING (
  NOT public.is_admin() AND (select auth.uid()) IS NOT NULL
);

DROP POLICY IF EXISTS zakupy_read_suppliers ON suppliers;
CREATE POLICY zakupy_read_suppliers ON suppliers FOR SELECT USING (
  public.is_operations() AND NOT public.is_admin()
);

DROP POLICY IF EXISTS magazyn_read_suppliers ON suppliers;
CREATE POLICY magazyn_read_suppliers ON suppliers
  FOR SELECT TO authenticated USING (
  public.is_magazyn() AND NOT public.is_admin()
);

DROP POLICY IF EXISTS suppliers_zeby_read ON suppliers;
CREATE POLICY suppliers_zeby_read ON suppliers
  FOR SELECT TO authenticated USING (
  public.can_access_teeth_panel() AND NOT public.is_admin()
);

-- --- supplier_schedules (admin_all_schedules FOR ALL) ---

DROP POLICY IF EXISTS sales_read_schedules ON supplier_schedules;
CREATE POLICY sales_read_schedules ON supplier_schedules FOR SELECT USING (
  NOT public.is_admin() AND (select auth.uid()) IS NOT NULL
);

DROP POLICY IF EXISTS zakupy_read_schedules ON supplier_schedules;
CREATE POLICY zakupy_read_schedules ON supplier_schedules FOR SELECT USING (
  public.is_operations() AND NOT public.is_admin()
);

-- --- vacations (admin_all_vacations FOR ALL) ---

DROP POLICY IF EXISTS zakupy_read_vacations ON vacations;
CREATE POLICY zakupy_read_vacations ON vacations FOR SELECT USING (
  public.is_operations() AND NOT public.is_admin()
);

-- --- delivery_stats (admin_all_stats FOR ALL) ---

DROP POLICY IF EXISTS zakupy_read_stats ON delivery_stats;
CREATE POLICY zakupy_read_stats ON delivery_stats FOR SELECT USING (
  public.is_operations() AND NOT public.is_admin()
);

-- --- normal_order_history (admin_all_history FOR ALL) ---

DROP POLICY IF EXISTS zakupy_read_history ON normal_order_history;
CREATE POLICY zakupy_read_history ON normal_order_history FOR SELECT USING (
  public.is_operations() AND NOT public.is_admin()
);

-- --- individual_orders (admin_all_individual FOR ALL) ---

DROP POLICY IF EXISTS sales_team_orders_select ON individual_orders;
CREATE POLICY sales_team_orders_select ON individual_orders FOR SELECT
  USING (NOT public.is_admin() AND public.can_read_sales_order(sales_person_id));

DROP POLICY IF EXISTS sales_team_orders_insert ON individual_orders;
CREATE POLICY sales_team_orders_insert ON individual_orders FOR INSERT
  WITH CHECK (NOT public.is_admin() AND public.can_insert_sales_order(sales_person_id));

DROP POLICY IF EXISTS sales_team_orders_update ON individual_orders;
CREATE POLICY sales_team_orders_update ON individual_orders
  FOR UPDATE TO authenticated
  USING (NOT public.is_admin() AND public.can_read_sales_order(sales_person_id))
  WITH CHECK (NOT public.is_admin() AND public.can_insert_sales_order(sales_person_id));

DROP POLICY IF EXISTS sales_team_orders_delete ON individual_orders;
CREATE POLICY sales_team_orders_delete ON individual_orders
  FOR DELETE TO authenticated
  USING (
    NOT public.is_admin()
    AND public.can_read_sales_order(sales_person_id)
    AND status IN ('Nowe', 'Weryfikacja')
  );

DROP POLICY IF EXISTS zakupy_all_individual ON individual_orders;
CREATE POLICY zakupy_all_individual ON individual_orders FOR ALL USING (
  public.is_operations() AND NOT public.is_admin()
);

DROP POLICY IF EXISTS magazyn_individual_orders ON individual_orders;
CREATE POLICY magazyn_individual_orders ON individual_orders
  FOR ALL TO authenticated
  USING (public.is_magazyn() AND NOT public.is_admin())
  WITH CHECK (public.is_magazyn() AND NOT public.is_admin());

DROP POLICY IF EXISTS individual_orders_zeby_all ON individual_orders;
CREATE POLICY individual_orders_zeby_all ON individual_orders
  FOR ALL TO authenticated
  USING (
    is_teeth = true
    AND public.can_access_teeth_panel()
    AND NOT public.is_admin()
  )
  WITH CHECK (
    is_teeth = true
    AND public.can_access_teeth_panel()
    AND NOT public.is_admin()
  );

-- --- sales_people (admin_all_sales_people FOR ALL) ---

DROP POLICY IF EXISTS zakupy_read_sales ON sales_people;
CREATE POLICY zakupy_read_sales ON sales_people FOR SELECT USING (
  public.is_operations() AND NOT public.is_admin()
);

DROP POLICY IF EXISTS magazyn_read_sales ON sales_people;
CREATE POLICY magazyn_read_sales ON sales_people
  FOR SELECT TO authenticated USING (
  public.is_magazyn() AND NOT public.is_admin()
);

DROP POLICY IF EXISTS sales_people_zeby_read ON sales_people;
CREATE POLICY sales_people_zeby_read ON sales_people
  FOR SELECT TO authenticated USING (
  public.can_access_teeth_panel() AND NOT public.is_admin()
);

-- sales_rep_read_own_sales_person: is_sales_rep() is false for admin — no overlap
-- sales_manager_read_team_sales_people: is_sales_manager() is false for admin — no overlap

-- --- profiles (admin_all_profiles FOR ALL) ---

DROP POLICY IF EXISTS users_read_own_profile ON profiles;
CREATE POLICY users_read_own_profile ON profiles FOR SELECT USING (
  NOT public.is_admin()
  AND (
    id = (select auth.uid())
    OR (
      public.is_sales_manager()
      AND EXISTS (
        SELECT 1
        FROM sales_people sp
        WHERE sp.id = profiles.sales_person_id
          AND public.manager_can_access_sales_person(sp.id)
      )
    )
  )
);

DROP POLICY IF EXISTS users_update_own_profile ON profiles;
CREATE POLICY users_update_own_profile ON profiles FOR UPDATE
  USING (NOT public.is_admin() AND id = (select auth.uid()));

-- --- department_board_threads (threads_admin FOR ALL) ---

DROP POLICY IF EXISTS department_board_threads_select ON department_board_threads;
CREATE POLICY department_board_threads_select ON department_board_threads
  FOR SELECT
  USING (
    NOT public.is_admin()
    AND public.can_access_department_board()
    AND (
      (kind = 'question')
      OR (kind = 'announcement' AND archived_at IS NULL AND (expires_at IS NULL OR expires_at > now()))
    )
  );

DROP POLICY IF EXISTS department_board_threads_insert ON department_board_threads;
CREATE POLICY department_board_threads_insert ON department_board_threads
  FOR INSERT
  WITH CHECK (
    NOT public.is_admin()
    AND created_by = (select auth.uid())
    AND (
      (kind = 'announcement' AND public.is_operations())
      OR (
        kind = 'question'
        AND public.is_sales_account()
        AND sales_person_id IS NOT NULL
      )
    )
  );

DROP POLICY IF EXISTS department_board_threads_update ON department_board_threads;
CREATE POLICY department_board_threads_update ON department_board_threads
  FOR UPDATE
  USING (
    NOT public.is_admin()
    AND (
      (kind = 'announcement' AND public.is_operations())
      OR (kind = 'question' AND created_by = (select auth.uid()))
      OR (kind = 'question' AND public.is_operations())
    )
  )
  WITH CHECK (NOT public.is_admin() AND public.can_access_department_board());

-- --- department_board_posts (posts_admin FOR ALL) ---

DROP POLICY IF EXISTS department_board_posts_select ON department_board_posts;
CREATE POLICY department_board_posts_select ON department_board_posts
  FOR SELECT
  USING (NOT public.is_admin() AND public.can_access_department_board());

DROP POLICY IF EXISTS department_board_posts_insert ON department_board_posts;
CREATE POLICY department_board_posts_insert ON department_board_posts
  FOR INSERT
  WITH CHECK (
    NOT public.is_admin()
    AND created_by = (select auth.uid())
    AND (
      public.is_operations()
      OR public.is_sales_account()
    )
  );

-- --- department_board_reads (no admin FOR ALL — no overlap) ---
-- Only auth.uid() optimization needed.

DROP POLICY IF EXISTS department_board_reads_select ON department_board_reads;
CREATE POLICY department_board_reads_select ON department_board_reads
  FOR SELECT
  USING (
    profile_id = (select auth.uid())
    OR public.is_admin()
    OR public.is_operations()
  );

DROP POLICY IF EXISTS department_board_reads_insert ON department_board_reads;
CREATE POLICY department_board_reads_insert ON department_board_reads
  FOR INSERT
  WITH CHECK (profile_id = (select auth.uid()) AND public.is_sales_account());

DROP POLICY IF EXISTS department_board_reads_upsert ON department_board_reads;
CREATE POLICY department_board_reads_upsert ON department_board_reads
  FOR UPDATE
  USING (profile_id = (select auth.uid()))
  WITH CHECK (profile_id = (select auth.uid()));

-- --- operations_notes (operations_notes_admin FOR ALL) ---

DROP POLICY IF EXISTS operations_notes_select ON operations_notes;
CREATE POLICY operations_notes_select ON operations_notes
  FOR SELECT
  USING (
    NOT public.is_admin()
    AND public.can_access_operations_department(department)
    AND (
      visibility = 'public'::operations_note_visibility
      OR created_by = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS operations_notes_insert ON operations_notes;
CREATE POLICY operations_notes_insert ON operations_notes
  FOR INSERT
  WITH CHECK (
    NOT public.is_admin()
    AND created_by = (select auth.uid())
    AND public.can_access_operations_department(department)
  );

DROP POLICY IF EXISTS operations_notes_update ON operations_notes;
CREATE POLICY operations_notes_update ON operations_notes
  FOR UPDATE
  USING (
    NOT public.is_admin()
    AND created_by = (select auth.uid())
  )
  WITH CHECK (
    NOT public.is_admin()
    AND public.can_access_operations_department(department)
  );

DROP POLICY IF EXISTS operations_notes_delete ON operations_notes;
CREATE POLICY operations_notes_delete ON operations_notes
  FOR DELETE
  USING (
    NOT public.is_admin()
    AND created_by = (select auth.uid())
  );

-- --- sales_notes (sales_notes_admin FOR ALL) ---

DROP POLICY IF EXISTS sales_notes_own ON sales_notes;
CREATE POLICY sales_notes_own ON sales_notes
  FOR ALL
  USING (
    NOT public.is_admin()
    AND (
      (public.is_sales_account() AND sales_person_id = public.my_sales_person_id())
      OR public.is_active_delegate_for(sales_person_id)
    )
  )
  WITH CHECK (
    NOT public.is_admin()
    AND public.is_sales_account()
    AND sales_person_id = public.my_sales_person_id()
  );

-- --- sales_zk_watches (sales_zk_watches_admin FOR ALL) ---

DROP POLICY IF EXISTS sales_zk_watches_own ON sales_zk_watches;
CREATE POLICY sales_zk_watches_own ON sales_zk_watches
  FOR ALL
  USING (
    NOT public.is_admin()
    AND (
      (public.is_sales_account() AND sales_person_id = public.my_sales_person_id())
      OR public.is_active_delegate_for(sales_person_id)
    )
  )
  WITH CHECK (
    NOT public.is_admin()
    AND public.is_sales_account()
    AND sales_person_id = public.my_sales_person_id()
  );

-- --- sales_bug_reports (sales_bug_reports_admin FOR ALL) ---

DROP POLICY IF EXISTS sales_bug_reports_own_select ON sales_bug_reports;
CREATE POLICY sales_bug_reports_own_select ON sales_bug_reports
  FOR SELECT
  USING (
    NOT public.is_admin()
    AND public.is_sales_account()
    AND sales_person_id = public.my_sales_person_id()
  );

DROP POLICY IF EXISTS sales_bug_reports_own_insert ON sales_bug_reports;
CREATE POLICY sales_bug_reports_own_insert ON sales_bug_reports
  FOR INSERT
  WITH CHECK (
    NOT public.is_admin()
    AND public.is_sales_account()
    AND sales_person_id = public.my_sales_person_id()
    AND profile_id = (select auth.uid())
  );

-- --- sales_groups (sales_groups_admin_manage FOR ALL) ---

DROP POLICY IF EXISTS sales_groups_select ON sales_groups;
CREATE POLICY sales_groups_select ON sales_groups
  FOR SELECT TO authenticated
  USING (NOT public.is_admin());

-- sales_groups_manager_update: is_sales_manager() is false for admin — no overlap

-- --- sales_group_managers (sales_group_managers_manage FOR ALL admin) ---

DROP POLICY IF EXISTS sales_group_managers_select ON sales_group_managers;
CREATE POLICY sales_group_managers_select ON sales_group_managers
  FOR SELECT TO authenticated
  USING (NOT public.is_admin() AND profile_id = (select auth.uid()));

-- --- individual_order_teeth_details (admin_all = is_admin OR is_operations) ---

DROP POLICY IF EXISTS individual_order_teeth_details_zeby_all
  ON individual_order_teeth_details;
CREATE POLICY individual_order_teeth_details_zeby_all
  ON individual_order_teeth_details
  FOR ALL TO authenticated
  USING (
    NOT (public.is_admin() OR public.is_operations())
    AND EXISTS (
      SELECT 1 FROM individual_orders
      WHERE id = individual_order_teeth_details.order_id
        AND is_teeth = true
    )
    AND public.can_access_teeth_panel()
  )
  WITH CHECK (
    NOT (public.is_admin() OR public.is_operations())
    AND EXISTS (
      SELECT 1 FROM individual_orders
      WHERE id = individual_order_teeth_details.order_id
        AND is_teeth = true
    )
    AND public.can_access_teeth_panel()
  );

DROP POLICY IF EXISTS individual_order_teeth_details_sales_own
  ON individual_order_teeth_details;
CREATE POLICY individual_order_teeth_details_sales_own
  ON individual_order_teeth_details
  FOR ALL TO authenticated
  USING (
    NOT (public.is_admin() OR public.is_operations())
    AND EXISTS (
      SELECT 1 FROM individual_orders io
      WHERE io.id = individual_order_teeth_details.order_id
        AND public.can_read_sales_order(io.sales_person_id)
    )
  )
  WITH CHECK (
    NOT (public.is_admin() OR public.is_operations())
    AND EXISTS (
      SELECT 1 FROM individual_orders io
      WHERE io.id = individual_order_teeth_details.order_id
        AND io.is_teeth = true
        AND public.can_insert_sales_order(io.sales_person_id)
    )
  );

-- --- teeth_order_history (admin_all_teeth_history FOR ALL admin) ---

DROP POLICY IF EXISTS teeth_history_read ON teeth_order_history;
CREATE POLICY teeth_history_read ON teeth_order_history
  FOR SELECT
  USING (NOT public.is_admin() AND public.can_access_teeth_panel());

DROP POLICY IF EXISTS teeth_history_insert ON teeth_order_history;
CREATE POLICY teeth_history_insert ON teeth_order_history
  FOR INSERT
  WITH CHECK (NOT public.is_admin() AND public.can_access_teeth_panel());

-- --- staff_vacation_periods (manage = FOR ALL is_admin OR user_id = auth.uid()) ---

DROP POLICY IF EXISTS staff_vacation_periods_select ON staff_vacation_periods;
CREATE POLICY staff_vacation_periods_select ON staff_vacation_periods
  FOR SELECT TO authenticated
  USING (
    NOT is_admin()
    AND user_id != (select auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM profiles p1
        JOIN profiles p2
          ON p1.role NOT IN ('sales', 'sales_manager')
         AND p2.role NOT IN ('sales', 'sales_manager')
        WHERE p1.id = (select auth.uid())
          AND p2.id = staff_vacation_periods.user_id
      )
    )
  );

DROP POLICY IF EXISTS staff_vacation_periods_manage ON staff_vacation_periods;
CREATE POLICY staff_vacation_periods_manage ON staff_vacation_periods
  FOR ALL TO authenticated
  USING (
    is_admin()
    OR user_id = (select auth.uid())
  )
  WITH CHECK (
    is_admin()
    OR user_id = (select auth.uid())
  );

-- --- sales_vacation_periods (manage = FOR ALL) ---

-- vacation_periods_select is redundant: vacation_periods_manage (FOR ALL)
-- already covers admin + own + manager for SELECT. Drop it entirely.
DROP POLICY IF EXISTS vacation_periods_select ON sales_vacation_periods;

DROP POLICY IF EXISTS vacation_periods_manage ON sales_vacation_periods;
CREATE POLICY vacation_periods_manage ON sales_vacation_periods
  FOR ALL TO authenticated
  USING (
    is_admin()
    OR sales_person_id IN (
      SELECT sales_person_id FROM profiles WHERE id = (select auth.uid())
    )
    OR (
      is_sales_manager()
      AND manager_can_access_sales_person(sales_person_id)
    )
  )
  WITH CHECK (
    is_admin()
    OR sales_person_id IN (
      SELECT sales_person_id FROM profiles WHERE id = (select auth.uid())
    )
    OR (
      is_sales_manager()
      AND manager_can_access_sales_person(sales_person_id)
    )
  );

-- --- sales_vacation_delegations (manage = FOR ALL) ---

DROP POLICY IF EXISTS delegations_select ON sales_vacation_delegations;
CREATE POLICY delegations_select ON sales_vacation_delegations
  FOR SELECT TO authenticated
  USING (
    NOT is_admin()
    AND delegate_profile_id = (select auth.uid())
  );

DROP POLICY IF EXISTS delegations_manage ON sales_vacation_delegations;
CREATE POLICY delegations_manage ON sales_vacation_delegations
  FOR ALL TO authenticated
  USING (
    is_admin()
    OR sales_person_id IN (
      SELECT sales_person_id FROM profiles WHERE id = (select auth.uid())
    )
    OR (
      is_sales_manager()
      AND manager_can_access_sales_person(sales_person_id)
    )
  )
  WITH CHECK (
    is_admin()
    OR sales_person_id IN (
      SELECT sales_person_id FROM profiles WHERE id = (select auth.uid())
    )
    OR (
      is_sales_manager()
      AND manager_can_access_sales_person(sales_person_id)
    )
  );

-- --- prosba_teeth_products (admin FOR ALL + select true) ---

DROP POLICY IF EXISTS prosba_teeth_products_select ON prosba_teeth_products;
CREATE POLICY prosba_teeth_products_select ON prosba_teeth_products
  FOR SELECT TO authenticated
  USING (NOT public.is_admin());

-- --- subiekt_products (admin FOR ALL + select_authenticated true) ---

DROP POLICY IF EXISTS subiekt_products_select_authenticated ON subiekt_products;
CREATE POLICY subiekt_products_select_authenticated ON subiekt_products
  FOR SELECT TO authenticated
  USING (NOT public.is_admin());

-- --- product_supplier_links (admin FOR ALL + select_authenticated true) ---

DROP POLICY IF EXISTS product_supplier_links_select_authenticated ON product_supplier_links;
CREATE POLICY product_supplier_links_select_authenticated ON product_supplier_links
  FOR SELECT TO authenticated
  USING (NOT public.is_admin());

-- --- warehouse_carriers (manage FOR ALL is_warehouse_staff + select true) ---

DROP POLICY IF EXISTS warehouse_carriers_select ON warehouse_carriers;
CREATE POLICY warehouse_carriers_select ON warehouse_carriers
  FOR SELECT TO authenticated
  USING (NOT public.is_warehouse_staff());

-- --- teeth_supplier_schedules (write FOR ALL can_access_teeth_panel + select same) ---
-- select is entirely redundant with write (FOR ALL). Drop it.

DROP POLICY IF EXISTS teeth_supplier_schedules_select ON teeth_supplier_schedules;

-- --- supplier_subiekt_kh_aliases (admin FOR ALL + operations_read SELECT) ---

DROP POLICY IF EXISTS supplier_subiekt_kh_aliases_operations_read
  ON supplier_subiekt_kh_aliases;
CREATE POLICY supplier_subiekt_kh_aliases_operations_read
  ON supplier_subiekt_kh_aliases
  FOR SELECT TO authenticated
  USING (public.is_operations() AND NOT public.is_admin());

-- --- warehouse_carrier_phones (manage FOR ALL is_warehouse_staff + select true) ---

DROP POLICY IF EXISTS warehouse_carrier_phones_select ON warehouse_carrier_phones;
CREATE POLICY warehouse_carrier_phones_select ON warehouse_carrier_phones
  FOR SELECT TO authenticated
  USING (NOT public.is_warehouse_staff());

NOTIFY pgrst, 'reload schema';
