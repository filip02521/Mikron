-- ============================================================
-- 110: Consolidate remaining overlapping permissive policies
--      Fixes remaining multiple_permissive_policies warnings
--
--      Pattern: admin FOR ALL overlaps with specific cmd policies
--      Fix: Drop admin FOR ALL, merge admin condition into each
--      specific policy with OR, add admin-only policies for
--      missing cmds.
-- ============================================================

-- === delivery_stats (admin ALL + operations SELECT) ===
DROP POLICY IF EXISTS admin_all_stats ON delivery_stats;
DROP POLICY IF EXISTS zakupy_read_stats ON delivery_stats;

CREATE POLICY delivery_stats_select ON delivery_stats FOR SELECT USING (
  (select public.is_admin())
  OR ((select public.is_operations()) AND NOT (select public.is_admin()))
);
CREATE POLICY delivery_stats_admin_insert ON delivery_stats
  FOR INSERT WITH CHECK ((select public.is_admin()));
CREATE POLICY delivery_stats_admin_update ON delivery_stats
  FOR UPDATE USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));
CREATE POLICY delivery_stats_admin_delete ON delivery_stats
  FOR DELETE USING ((select public.is_admin()));

-- === normal_order_history (admin ALL + operations SELECT) ===
DROP POLICY IF EXISTS admin_all_history ON normal_order_history;
DROP POLICY IF EXISTS zakupy_read_history ON normal_order_history;

CREATE POLICY normal_order_history_select ON normal_order_history FOR SELECT USING (
  (select public.is_admin())
  OR ((select public.is_operations()) AND NOT (select public.is_admin()))
);
CREATE POLICY normal_order_history_admin_insert ON normal_order_history
  FOR INSERT WITH CHECK ((select public.is_admin()));
CREATE POLICY normal_order_history_admin_update ON normal_order_history
  FOR UPDATE USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));
CREATE POLICY normal_order_history_admin_delete ON normal_order_history
  FOR DELETE USING ((select public.is_admin()));

-- === department_board_posts (admin ALL + select + insert) ===
DROP POLICY IF EXISTS department_board_posts_admin ON department_board_posts;
DROP POLICY IF EXISTS department_board_posts_select ON department_board_posts;
DROP POLICY IF EXISTS department_board_posts_insert ON department_board_posts;

CREATE POLICY department_board_posts_select ON department_board_posts
  FOR SELECT USING (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND (select public.can_access_department_board())
    )
  );

CREATE POLICY department_board_posts_insert ON department_board_posts
  FOR INSERT WITH CHECK (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND created_by = (select auth.uid())
      AND ((select public.is_operations()) OR (select public.is_sales_account()))
    )
  );

CREATE POLICY department_board_posts_admin_update ON department_board_posts
  FOR UPDATE USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY department_board_posts_admin_delete ON department_board_posts
  FOR DELETE USING ((select public.is_admin()));

-- === department_board_threads (admin ALL + select + insert + update) ===
DROP POLICY IF EXISTS department_board_threads_admin ON department_board_threads;
DROP POLICY IF EXISTS department_board_threads_select ON department_board_threads;
DROP POLICY IF EXISTS department_board_threads_insert ON department_board_threads;
DROP POLICY IF EXISTS department_board_threads_update ON department_board_threads;

CREATE POLICY department_board_threads_select ON department_board_threads
  FOR SELECT USING (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND (select public.can_access_department_board())
      AND (
        kind = 'question'
        OR (
          kind = 'announcement'
          AND archived_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
        )
      )
    )
  );

CREATE POLICY department_board_threads_insert ON department_board_threads
  FOR INSERT WITH CHECK (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND created_by = (select auth.uid())
      AND (
        (kind = 'announcement' AND (select public.is_operations()))
        OR (
          kind = 'question'
          AND (select public.is_sales_account())
          AND sales_person_id IS NOT NULL
        )
      )
    )
  );

CREATE POLICY department_board_threads_update ON department_board_threads
  FOR UPDATE USING (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND (
        (kind = 'announcement' AND (select public.is_operations()))
        OR (kind = 'question' AND created_by = (select auth.uid()))
        OR (kind = 'question' AND (select public.is_operations()))
      )
    )
  )
  WITH CHECK (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND (select public.can_access_department_board())
    )
  );

CREATE POLICY department_board_threads_admin_delete ON department_board_threads
  FOR DELETE USING ((select public.is_admin()));

-- === operations_notes (admin ALL + select + insert + update + delete) ===
DROP POLICY IF EXISTS operations_notes_admin ON operations_notes;
DROP POLICY IF EXISTS operations_notes_select ON operations_notes;
DROP POLICY IF EXISTS operations_notes_insert ON operations_notes;
DROP POLICY IF EXISTS operations_notes_update ON operations_notes;
DROP POLICY IF EXISTS operations_notes_delete ON operations_notes;

CREATE POLICY operations_notes_select ON operations_notes
  FOR SELECT USING (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND public.can_access_operations_department(department)
      AND (visibility = 'public' OR created_by = (select auth.uid()))
    )
  );

CREATE POLICY operations_notes_insert ON operations_notes
  FOR INSERT WITH CHECK (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND created_by = (select auth.uid())
      AND public.can_access_operations_department(department)
    )
  );

CREATE POLICY operations_notes_update ON operations_notes
  FOR UPDATE USING (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND created_by = (select auth.uid())
    )
  )
  WITH CHECK (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND created_by = (select auth.uid())
    )
  );

CREATE POLICY operations_notes_delete ON operations_notes
  FOR DELETE USING (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND created_by = (select auth.uid())
    )
  );

-- === product_supplier_links (admin ALL + select_authenticated) ===
DROP POLICY IF EXISTS product_supplier_links_admin ON product_supplier_links;
DROP POLICY IF EXISTS product_supplier_links_select_authenticated ON product_supplier_links;

CREATE POLICY product_supplier_links_select ON product_supplier_links
  FOR SELECT TO authenticated USING (true);

CREATE POLICY product_supplier_links_admin_write ON product_supplier_links
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));

CREATE POLICY product_supplier_links_admin_update ON product_supplier_links
  FOR UPDATE TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY product_supplier_links_admin_delete ON product_supplier_links
  FOR DELETE TO authenticated
  USING ((select public.is_admin()));

-- === profiles (admin ALL + select + update) ===
DROP POLICY IF EXISTS admin_all_profiles ON profiles;
DROP POLICY IF EXISTS users_read_own_profile ON profiles;
DROP POLICY IF EXISTS users_update_own_profile ON profiles;

CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND (
        id = (select auth.uid())
        OR (
          (select public.is_sales_manager())
          AND EXISTS (
            SELECT 1 FROM sales_people sp
            WHERE sp.id = profiles.sales_person_id
              AND public.manager_can_access_sales_person(sp.id)
          )
        )
      )
    )
  );

CREATE POLICY profiles_update ON profiles
  FOR UPDATE USING (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND id = (select auth.uid())
    )
  )
  WITH CHECK (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND id = (select auth.uid())
    )
  );

CREATE POLICY profiles_admin_insert ON profiles
  FOR INSERT WITH CHECK ((select public.is_admin()));

CREATE POLICY profiles_admin_delete ON profiles
  FOR DELETE USING ((select public.is_admin()));

-- === prosba_teeth_products (admin ALL + select) ===
DROP POLICY IF EXISTS prosba_teeth_products_admin ON prosba_teeth_products;
DROP POLICY IF EXISTS prosba_teeth_products_select ON prosba_teeth_products;

CREATE POLICY prosba_teeth_products_select ON prosba_teeth_products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY prosba_teeth_products_admin_write ON prosba_teeth_products
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));

CREATE POLICY prosba_teeth_products_admin_update ON prosba_teeth_products
  FOR UPDATE TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY prosba_teeth_products_admin_delete ON prosba_teeth_products
  FOR DELETE TO authenticated
  USING ((select public.is_admin()));

-- === sales_bug_reports (admin ALL + select + insert) ===
DROP POLICY IF EXISTS sales_bug_reports_admin ON sales_bug_reports;
DROP POLICY IF EXISTS sales_bug_reports_own_select ON sales_bug_reports;
DROP POLICY IF EXISTS sales_bug_reports_own_insert ON sales_bug_reports;

CREATE POLICY sales_bug_reports_select ON sales_bug_reports
  FOR SELECT USING (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND (select public.is_sales_account())
      AND sales_person_id = public.my_sales_person_id()
    )
  );

CREATE POLICY sales_bug_reports_insert ON sales_bug_reports
  FOR INSERT WITH CHECK (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND (select public.is_sales_account())
      AND sales_person_id = public.my_sales_person_id()
    )
  );

CREATE POLICY sales_bug_reports_admin_update ON sales_bug_reports
  FOR UPDATE USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY sales_bug_reports_admin_delete ON sales_bug_reports
  FOR DELETE USING ((select public.is_admin()));

-- === sales_group_managers (admin ALL + select) ===
DROP POLICY IF EXISTS sales_group_managers_manage ON sales_group_managers;
DROP POLICY IF EXISTS sales_group_managers_select ON sales_group_managers;

CREATE POLICY sales_group_managers_select ON sales_group_managers
  FOR SELECT TO authenticated USING (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND profile_id = (select auth.uid())
    )
  );

CREATE POLICY sales_group_managers_admin_write ON sales_group_managers
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));

CREATE POLICY sales_group_managers_admin_update ON sales_group_managers
  FOR UPDATE TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY sales_group_managers_admin_delete ON sales_group_managers
  FOR DELETE TO authenticated
  USING ((select public.is_admin()));

-- === sales_groups (admin ALL + select + manager update) ===
DROP POLICY IF EXISTS sales_groups_admin_manage ON sales_groups;
DROP POLICY IF EXISTS sales_groups_select ON sales_groups;
DROP POLICY IF EXISTS sales_groups_manager_update ON sales_groups;

CREATE POLICY sales_groups_select ON sales_groups
  FOR SELECT TO authenticated USING (true);

CREATE POLICY sales_groups_update ON sales_groups
  FOR UPDATE TO authenticated USING (
    (select public.is_admin())
    OR (
      (select public.is_sales_manager())
      AND id IN (SELECT public.my_managed_group_ids())
    )
  )
  WITH CHECK (
    (select public.is_admin())
    OR (
      (select public.is_sales_manager())
      AND id IN (SELECT public.my_managed_group_ids())
    )
  );

CREATE POLICY sales_groups_admin_insert ON sales_groups
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));

CREATE POLICY sales_groups_admin_delete ON sales_groups
  FOR DELETE TO authenticated
  USING ((select public.is_admin()));

-- === sales_vacation_delegations (manage ALL + delegate SELECT) ===
DROP POLICY IF EXISTS delegations_manage ON sales_vacation_delegations;
DROP POLICY IF EXISTS delegations_select ON sales_vacation_delegations;

CREATE POLICY sales_vacation_delegations_select ON sales_vacation_delegations
  FOR SELECT TO authenticated USING (
    (select public.is_admin())
    OR sales_person_id IN (
      SELECT profiles.sales_person_id FROM profiles
      WHERE profiles.id = (select auth.uid())
    )
    OR (
      (select public.is_sales_manager())
      AND public.manager_can_access_sales_person(sales_person_id)
    )
    OR (
      NOT (select public.is_admin())
      AND delegate_profile_id = (select auth.uid())
    )
  );

CREATE POLICY sales_vacation_delegations_insert ON sales_vacation_delegations
  FOR INSERT TO authenticated WITH CHECK (
    (select public.is_admin())
    OR sales_person_id IN (
      SELECT profiles.sales_person_id FROM profiles
      WHERE profiles.id = (select auth.uid())
    )
    OR (
      (select public.is_sales_manager())
      AND public.manager_can_access_sales_person(sales_person_id)
    )
  );

CREATE POLICY sales_vacation_delegations_update ON sales_vacation_delegations
  FOR UPDATE TO authenticated USING (
    (select public.is_admin())
    OR sales_person_id IN (
      SELECT profiles.sales_person_id FROM profiles
      WHERE profiles.id = (select auth.uid())
    )
    OR (
      (select public.is_sales_manager())
      AND public.manager_can_access_sales_person(sales_person_id)
    )
  )
  WITH CHECK (
    (select public.is_admin())
    OR sales_person_id IN (
      SELECT profiles.sales_person_id FROM profiles
      WHERE profiles.id = (select auth.uid())
    )
    OR (
      (select public.is_sales_manager())
      AND public.manager_can_access_sales_person(sales_person_id)
    )
  );

CREATE POLICY sales_vacation_delegations_delete ON sales_vacation_delegations
  FOR DELETE TO authenticated USING (
    (select public.is_admin())
    OR sales_person_id IN (
      SELECT profiles.sales_person_id FROM profiles
      WHERE profiles.id = (select auth.uid())
    )
    OR (
      (select public.is_sales_manager())
      AND public.manager_can_access_sales_person(sales_person_id)
    )
  );

-- === staff_vacation_periods (manage ALL + others SELECT) ===
DROP POLICY IF EXISTS staff_vacation_periods_manage ON staff_vacation_periods;
DROP POLICY IF EXISTS staff_vacation_periods_select ON staff_vacation_periods;

CREATE POLICY staff_vacation_periods_select ON staff_vacation_periods
  FOR SELECT TO authenticated USING (
    (select public.is_admin())
    OR user_id = (select auth.uid())
    OR (
      NOT (select public.is_admin())
      AND user_id <> (select auth.uid())
      AND EXISTS (
        SELECT 1 FROM profiles p1
        JOIN profiles p2 ON (
          p1.role <> ALL (ARRAY['sales'::user_role, 'sales_manager'::user_role])
          AND p2.role <> ALL (ARRAY['sales'::user_role, 'sales_manager'::user_role])
        )
        WHERE p1.id = (select auth.uid())
          AND p2.id = staff_vacation_periods.user_id
      )
    )
  );

CREATE POLICY staff_vacation_periods_insert ON staff_vacation_periods
  FOR INSERT TO authenticated WITH CHECK (
    (select public.is_admin())
    OR user_id = (select auth.uid())
  );

CREATE POLICY staff_vacation_periods_update ON staff_vacation_periods
  FOR UPDATE TO authenticated USING (
    (select public.is_admin())
    OR user_id = (select auth.uid())
  )
  WITH CHECK (
    (select public.is_admin())
    OR user_id = (select auth.uid())
  );

CREATE POLICY staff_vacation_periods_delete ON staff_vacation_periods
  FOR DELETE TO authenticated USING (
    (select public.is_admin())
    OR user_id = (select auth.uid())
  );

-- === subiekt_products (admin ALL + select_authenticated) ===
DROP POLICY IF EXISTS subiekt_products_admin ON subiekt_products;
DROP POLICY IF EXISTS subiekt_products_select_authenticated ON subiekt_products;

CREATE POLICY subiekt_products_select ON subiekt_products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY subiekt_products_admin_write ON subiekt_products
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));

CREATE POLICY subiekt_products_admin_update ON subiekt_products
  FOR UPDATE TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY subiekt_products_admin_delete ON subiekt_products
  FOR DELETE TO authenticated
  USING ((select public.is_admin()));

-- === supplier_subiekt_kh_aliases (admin ALL + operations SELECT) ===
DROP POLICY IF EXISTS supplier_subiekt_kh_aliases_admin ON supplier_subiekt_kh_aliases;
DROP POLICY IF EXISTS supplier_subiekt_kh_aliases_operations_read ON supplier_subiekt_kh_aliases;

CREATE POLICY supplier_subiekt_kh_aliases_select ON supplier_subiekt_kh_aliases
  FOR SELECT TO authenticated USING (
    (select public.is_admin())
    OR ((select public.is_operations()) AND NOT (select public.is_admin()))
  );

CREATE POLICY supplier_subiekt_kh_aliases_admin_write ON supplier_subiekt_kh_aliases
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()));

CREATE POLICY supplier_subiekt_kh_aliases_admin_update ON supplier_subiekt_kh_aliases
  FOR UPDATE TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY supplier_subiekt_kh_aliases_admin_delete ON supplier_subiekt_kh_aliases
  FOR DELETE TO authenticated
  USING ((select public.is_admin()));

-- === individual_orders (FOR ALL + sales_team specific cmds) ===
-- Split FOR ALL into per-cmd and merge with sales_team

DROP POLICY IF EXISTS individual_orders_all ON individual_orders;
-- Keep sales_team policies, they will be merged with admin/ops/magazyn/zeby

CREATE POLICY individual_orders_select ON individual_orders
  FOR SELECT USING (
    (select public.is_admin())
    OR ((select public.is_operations()) AND NOT (select public.is_admin()))
    OR ((select public.is_magazyn()) AND NOT (select public.is_admin()))
    OR (is_teeth = true AND (select public.can_access_teeth_panel()) AND NOT (select public.is_admin()))
    OR (NOT (select public.is_admin()) AND public.can_read_sales_order(sales_person_id))
  );

DROP POLICY IF EXISTS sales_team_orders_select ON individual_orders;

CREATE POLICY individual_orders_insert ON individual_orders
  FOR INSERT WITH CHECK (
    (select public.is_admin())
    OR ((select public.is_operations()) AND NOT (select public.is_admin()))
    OR ((select public.is_magazyn()) AND NOT (select public.is_admin()))
    OR (is_teeth = true AND (select public.can_access_teeth_panel()) AND NOT (select public.is_admin()))
    OR (NOT (select public.is_admin()) AND public.can_insert_sales_order(sales_person_id))
  );

DROP POLICY IF EXISTS sales_team_orders_insert ON individual_orders;

CREATE POLICY individual_orders_update ON individual_orders
  FOR UPDATE TO authenticated USING (
    (select public.is_admin())
    OR ((select public.is_operations()) AND NOT (select public.is_admin()))
    OR ((select public.is_magazyn()) AND NOT (select public.is_admin()))
    OR (is_teeth = true AND (select public.can_access_teeth_panel()) AND NOT (select public.is_admin()))
    OR (NOT (select public.is_admin()) AND public.can_read_sales_order(sales_person_id))
  )
  WITH CHECK (
    (select public.is_admin())
    OR ((select public.is_operations()) AND NOT (select public.is_admin()))
    OR ((select public.is_magazyn()) AND NOT (select public.is_admin()))
    OR (is_teeth = true AND (select public.can_access_teeth_panel()) AND NOT (select public.is_admin()))
    OR (NOT (select public.is_admin()) AND public.can_insert_sales_order(sales_person_id))
  );

DROP POLICY IF EXISTS sales_team_orders_update ON individual_orders;

CREATE POLICY individual_orders_delete ON individual_orders
  FOR DELETE TO authenticated USING (
    (select public.is_admin())
    OR ((select public.is_operations()) AND NOT (select public.is_admin()))
    OR ((select public.is_magazyn()) AND NOT (select public.is_admin()))
    OR (is_teeth = true AND (select public.can_access_teeth_panel()) AND NOT (select public.is_admin()))
    OR (
      NOT (select public.is_admin())
      AND public.can_read_sales_order(sales_person_id)
      AND status = ANY (ARRAY['Nowe'::individual_order_status, 'Weryfikacja'::individual_order_status])
    )
  );

DROP POLICY IF EXISTS sales_team_orders_delete ON individual_orders;

NOTIFY pgrst, 'reload schema';
