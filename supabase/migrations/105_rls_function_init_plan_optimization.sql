-- ============================================================
-- 105: Wrap all no-arg SECURITY DEFINER function calls in RLS
--      policies with (select ...) to force init plan evaluation.
--      Without this, is_admin(), is_operations() etc. are called
--      per-row, causing N profiles lookups per query (N = row count).
--      With (select ...), PostgreSQL evaluates once per statement.
-- ============================================================

-- --- suppliers ---

DROP POLICY IF EXISTS sales_read_suppliers ON suppliers;
CREATE POLICY sales_read_suppliers ON suppliers FOR SELECT USING (
  NOT (select public.is_admin()) AND (select auth.uid()) IS NOT NULL
);

DROP POLICY IF EXISTS zakupy_read_suppliers ON suppliers;
CREATE POLICY zakupy_read_suppliers ON suppliers FOR SELECT USING (
  (select public.is_operations()) AND NOT (select public.is_admin())
);

DROP POLICY IF EXISTS magazyn_read_suppliers ON suppliers;
CREATE POLICY magazyn_read_suppliers ON suppliers
  FOR SELECT TO authenticated USING (
  (select public.is_magazyn()) AND NOT (select public.is_admin())
);

DROP POLICY IF EXISTS suppliers_zeby_read ON suppliers;
CREATE POLICY suppliers_zeby_read ON suppliers
  FOR SELECT TO authenticated USING (
  (select public.can_access_teeth_panel()) AND NOT (select public.is_admin())
);

-- --- supplier_schedules ---

DROP POLICY IF EXISTS sales_read_schedules ON supplier_schedules;
CREATE POLICY sales_read_schedules ON supplier_schedules FOR SELECT USING (
  NOT (select public.is_admin()) AND (select auth.uid()) IS NOT NULL
);

DROP POLICY IF EXISTS zakupy_read_schedules ON supplier_schedules;
CREATE POLICY zakupy_read_schedules ON supplier_schedules FOR SELECT USING (
  (select public.is_operations()) AND NOT (select public.is_admin())
);

-- --- vacations ---

DROP POLICY IF EXISTS zakupy_read_vacations ON vacations;
CREATE POLICY zakupy_read_vacations ON vacations FOR SELECT USING (
  (select public.is_operations()) AND NOT (select public.is_admin())
);

-- --- delivery_stats ---

DROP POLICY IF EXISTS zakupy_read_stats ON delivery_stats;
CREATE POLICY zakupy_read_stats ON delivery_stats FOR SELECT USING (
  (select public.is_operations()) AND NOT (select public.is_admin())
);

-- --- normal_order_history ---

DROP POLICY IF EXISTS zakupy_read_history ON normal_order_history;
CREATE POLICY zakupy_read_history ON normal_order_history FOR SELECT USING (
  (select public.is_operations()) AND NOT (select public.is_admin())
);

-- --- individual_orders ---

DROP POLICY IF EXISTS sales_team_orders_select ON individual_orders;
CREATE POLICY sales_team_orders_select ON individual_orders FOR SELECT
  USING (NOT (select public.is_admin()) AND public.can_read_sales_order(sales_person_id));

DROP POLICY IF EXISTS sales_team_orders_insert ON individual_orders;
CREATE POLICY sales_team_orders_insert ON individual_orders FOR INSERT
  WITH CHECK (NOT (select public.is_admin()) AND public.can_insert_sales_order(sales_person_id));

DROP POLICY IF EXISTS sales_team_orders_update ON individual_orders;
CREATE POLICY sales_team_orders_update ON individual_orders
  FOR UPDATE TO authenticated
  USING (NOT (select public.is_admin()) AND public.can_read_sales_order(sales_person_id))
  WITH CHECK (NOT (select public.is_admin()) AND public.can_insert_sales_order(sales_person_id));

DROP POLICY IF EXISTS sales_team_orders_delete ON individual_orders;
CREATE POLICY sales_team_orders_delete ON individual_orders
  FOR DELETE TO authenticated
  USING (
    NOT (select public.is_admin())
    AND public.can_read_sales_order(sales_person_id)
    AND status IN ('Nowe', 'Weryfikacja')
  );

DROP POLICY IF EXISTS zakupy_all_individual ON individual_orders;
CREATE POLICY zakupy_all_individual ON individual_orders FOR ALL USING (
  (select public.is_operations()) AND NOT (select public.is_admin())
);

DROP POLICY IF EXISTS magazyn_individual_orders ON individual_orders;
CREATE POLICY magazyn_individual_orders ON individual_orders
  FOR ALL TO authenticated
  USING ((select public.is_magazyn()) AND NOT (select public.is_admin()))
  WITH CHECK ((select public.is_magazyn()) AND NOT (select public.is_admin()));

DROP POLICY IF EXISTS individual_orders_zeby_all ON individual_orders;
CREATE POLICY individual_orders_zeby_all ON individual_orders
  FOR ALL TO authenticated
  USING (
    is_teeth = true
    AND (select public.can_access_teeth_panel())
    AND NOT (select public.is_admin())
  )
  WITH CHECK (
    is_teeth = true
    AND (select public.can_access_teeth_panel())
    AND NOT (select public.is_admin())
  );

-- --- sales_people ---

DROP POLICY IF EXISTS zakupy_read_sales ON sales_people;
CREATE POLICY zakupy_read_sales ON sales_people FOR SELECT USING (
  (select public.is_operations()) AND NOT (select public.is_admin())
);

DROP POLICY IF EXISTS magazyn_read_sales ON sales_people;
CREATE POLICY magazyn_read_sales ON sales_people
  FOR SELECT TO authenticated USING (
  (select public.is_magazyn()) AND NOT (select public.is_admin())
);

DROP POLICY IF EXISTS sales_people_zeby_read ON sales_people;
CREATE POLICY sales_people_zeby_read ON sales_people
  FOR SELECT TO authenticated USING (
  (select public.can_access_teeth_panel()) AND NOT (select public.is_admin())
);

-- --- profiles ---

DROP POLICY IF EXISTS users_read_own_profile ON profiles;
CREATE POLICY users_read_own_profile ON profiles FOR SELECT USING (
  NOT (select public.is_admin())
  AND (
    id = (select auth.uid())
    OR (
      (select public.is_sales_manager())
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
  USING (NOT (select public.is_admin()) AND id = (select auth.uid()));

-- --- department_board_threads ---

DROP POLICY IF EXISTS department_board_threads_select ON department_board_threads;
CREATE POLICY department_board_threads_select ON department_board_threads
  FOR SELECT
  USING (
    NOT (select public.is_admin())
    AND (select public.can_access_department_board())
    AND (
      (kind = 'question')
      OR (kind = 'announcement' AND archived_at IS NULL AND (expires_at IS NULL OR expires_at > now()))
    )
  );

DROP POLICY IF EXISTS department_board_threads_insert ON department_board_threads;
CREATE POLICY department_board_threads_insert ON department_board_threads
  FOR INSERT
  WITH CHECK (
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
  );

DROP POLICY IF EXISTS department_board_threads_update ON department_board_threads;
CREATE POLICY department_board_threads_update ON department_board_threads
  FOR UPDATE
  USING (
    NOT (select public.is_admin())
    AND (
      (kind = 'announcement' AND (select public.is_operations()))
      OR (kind = 'question' AND created_by = (select auth.uid()))
      OR (kind = 'question' AND (select public.is_operations()))
    )
  )
  WITH CHECK (
    NOT (select public.is_admin())
    AND (select public.can_access_department_board())
  );

-- --- department_board_posts ---

DROP POLICY IF EXISTS department_board_posts_select ON department_board_posts;
CREATE POLICY department_board_posts_select ON department_board_posts
  FOR SELECT
  USING (
    NOT (select public.is_admin())
    AND (select public.can_access_department_board())
  );

DROP POLICY IF EXISTS department_board_posts_insert ON department_board_posts;
CREATE POLICY department_board_posts_insert ON department_board_posts
  FOR INSERT
  WITH CHECK (
    NOT (select public.is_admin())
    AND created_by = (select auth.uid())
    AND (
      (select public.is_operations())
      OR (select public.is_sales_account())
    )
  );

-- --- department_board_reads ---

DROP POLICY IF EXISTS department_board_reads_select ON department_board_reads;
CREATE POLICY department_board_reads_select ON department_board_reads
  FOR SELECT
  USING (
    profile_id = (select auth.uid())
    OR (select public.is_admin())
    OR (select public.is_operations())
  );

DROP POLICY IF EXISTS department_board_reads_insert ON department_board_reads;
CREATE POLICY department_board_reads_insert ON department_board_reads
  FOR INSERT
  WITH CHECK (
    profile_id = (select auth.uid())
    AND (select public.is_sales_account())
  );

DROP POLICY IF EXISTS department_board_reads_upsert ON department_board_reads;
CREATE POLICY department_board_reads_upsert ON department_board_reads
  FOR UPDATE
  USING (profile_id = (select auth.uid()))
  WITH CHECK (profile_id = (select auth.uid()));

-- --- operations_notes ---

DROP POLICY IF EXISTS operations_notes_select ON operations_notes;
CREATE POLICY operations_notes_select ON operations_notes
  FOR SELECT
  USING (
    NOT (select public.is_admin())
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
    NOT (select public.is_admin())
    AND created_by = (select auth.uid())
    AND public.can_access_operations_department(department)
  );

DROP POLICY IF EXISTS operations_notes_update ON operations_notes;
CREATE POLICY operations_notes_update ON operations_notes
  FOR UPDATE
  USING (
    NOT (select public.is_admin())
    AND created_by = (select auth.uid())
  )
  WITH CHECK (
    NOT (select public.is_admin())
    AND public.can_access_operations_department(department)
  );

DROP POLICY IF EXISTS operations_notes_delete ON operations_notes;
CREATE POLICY operations_notes_delete ON operations_notes
  FOR DELETE
  USING (
    NOT (select public.is_admin())
    AND created_by = (select auth.uid())
  );

-- --- sales_notes ---

DROP POLICY IF EXISTS sales_notes_own ON sales_notes;
CREATE POLICY sales_notes_own ON sales_notes
  FOR ALL
  USING (
    NOT (select public.is_admin())
    AND (
      ((select public.is_sales_account()) AND sales_person_id = public.my_sales_person_id())
      OR public.is_active_delegate_for(sales_person_id)
    )
  )
  WITH CHECK (
    NOT (select public.is_admin())
    AND (select public.is_sales_account())
    AND sales_person_id = public.my_sales_person_id()
  );

-- --- sales_zk_watches ---

DROP POLICY IF EXISTS sales_zk_watches_own ON sales_zk_watches;
CREATE POLICY sales_zk_watches_own ON sales_zk_watches
  FOR ALL
  USING (
    NOT (select public.is_admin())
    AND (
      ((select public.is_sales_account()) AND sales_person_id = public.my_sales_person_id())
      OR public.is_active_delegate_for(sales_person_id)
    )
  )
  WITH CHECK (
    NOT (select public.is_admin())
    AND (select public.is_sales_account())
    AND sales_person_id = public.my_sales_person_id()
  );

-- --- sales_bug_reports ---

DROP POLICY IF EXISTS sales_bug_reports_own_select ON sales_bug_reports;
CREATE POLICY sales_bug_reports_own_select ON sales_bug_reports
  FOR SELECT
  USING (
    NOT (select public.is_admin())
    AND (select public.is_sales_account())
    AND sales_person_id = public.my_sales_person_id()
  );

DROP POLICY IF EXISTS sales_bug_reports_own_insert ON sales_bug_reports;
CREATE POLICY sales_bug_reports_own_insert ON sales_bug_reports
  FOR INSERT
  WITH CHECK (
    NOT (select public.is_admin())
    AND (select public.is_sales_account())
    AND sales_person_id = public.my_sales_person_id()
    AND profile_id = (select auth.uid())
  );

-- --- sales_groups ---

DROP POLICY IF EXISTS sales_groups_select ON sales_groups;
CREATE POLICY sales_groups_select ON sales_groups
  FOR SELECT TO authenticated
  USING (NOT (select public.is_admin()));

-- --- sales_group_managers ---

DROP POLICY IF EXISTS sales_group_managers_select ON sales_group_managers;
CREATE POLICY sales_group_managers_select ON sales_group_managers
  FOR SELECT TO authenticated
  USING (
    NOT (select public.is_admin())
    AND profile_id = (select auth.uid())
  );

-- --- individual_order_teeth_details ---

DROP POLICY IF EXISTS individual_order_teeth_details_zeby_all
  ON individual_order_teeth_details;
CREATE POLICY individual_order_teeth_details_zeby_all
  ON individual_order_teeth_details
  FOR ALL TO authenticated
  USING (
    NOT ((select public.is_admin()) OR (select public.is_operations()))
    AND EXISTS (
      SELECT 1 FROM individual_orders
      WHERE id = individual_order_teeth_details.order_id
        AND is_teeth = true
    )
    AND (select public.can_access_teeth_panel())
  )
  WITH CHECK (
    NOT ((select public.is_admin()) OR (select public.is_operations()))
    AND EXISTS (
      SELECT 1 FROM individual_orders
      WHERE id = individual_order_teeth_details.order_id
        AND is_teeth = true
    )
    AND (select public.can_access_teeth_panel())
  );

DROP POLICY IF EXISTS individual_order_teeth_details_sales_own
  ON individual_order_teeth_details;
CREATE POLICY individual_order_teeth_details_sales_own
  ON individual_order_teeth_details
  FOR ALL TO authenticated
  USING (
    NOT ((select public.is_admin()) OR (select public.is_operations()))
    AND EXISTS (
      SELECT 1 FROM individual_orders io
      WHERE io.id = individual_order_teeth_details.order_id
        AND public.can_read_sales_order(io.sales_person_id)
    )
  )
  WITH CHECK (
    NOT ((select public.is_admin()) OR (select public.is_operations()))
    AND EXISTS (
      SELECT 1 FROM individual_orders io
      WHERE io.id = individual_order_teeth_details.order_id
        AND io.is_teeth = true
        AND public.can_insert_sales_order(io.sales_person_id)
    )
  );

-- --- teeth_order_history ---

DROP POLICY IF EXISTS teeth_history_read ON teeth_order_history;
CREATE POLICY teeth_history_read ON teeth_order_history
  FOR SELECT
  USING (
    NOT (select public.is_admin())
    AND (select public.can_access_teeth_panel())
  );

DROP POLICY IF EXISTS teeth_history_insert ON teeth_order_history;
CREATE POLICY teeth_history_insert ON teeth_order_history
  FOR INSERT
  WITH CHECK (
    NOT (select public.is_admin())
    AND (select public.can_access_teeth_panel())
  );

-- --- staff_vacation_periods ---

DROP POLICY IF EXISTS staff_vacation_periods_select ON staff_vacation_periods;
CREATE POLICY staff_vacation_periods_select ON staff_vacation_periods
  FOR SELECT TO authenticated
  USING (
    NOT (select public.is_admin())
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
    (select public.is_admin())
    OR user_id = (select auth.uid())
  )
  WITH CHECK (
    (select public.is_admin())
    OR user_id = (select auth.uid())
  );

-- --- sales_vacation_periods ---

DROP POLICY IF EXISTS vacation_periods_manage ON sales_vacation_periods;
CREATE POLICY vacation_periods_manage ON sales_vacation_periods
  FOR ALL TO authenticated
  USING (
    (select public.is_admin())
    OR sales_person_id IN (
      SELECT sales_person_id FROM profiles WHERE id = (select auth.uid())
    )
    OR (
      (select public.is_sales_manager())
      AND public.manager_can_access_sales_person(sales_person_id)
    )
  )
  WITH CHECK (
    (select public.is_admin())
    OR sales_person_id IN (
      SELECT sales_person_id FROM profiles WHERE id = (select auth.uid())
    )
    OR (
      (select public.is_sales_manager())
      AND public.manager_can_access_sales_person(sales_person_id)
    )
  );

-- --- sales_vacation_delegations ---

DROP POLICY IF EXISTS delegations_select ON sales_vacation_delegations;
CREATE POLICY delegations_select ON sales_vacation_delegations
  FOR SELECT TO authenticated
  USING (
    NOT (select public.is_admin())
    AND delegate_profile_id = (select auth.uid())
  );

DROP POLICY IF EXISTS delegations_manage ON sales_vacation_delegations;
CREATE POLICY delegations_manage ON sales_vacation_delegations
  FOR ALL TO authenticated
  USING (
    (select public.is_admin())
    OR sales_person_id IN (
      SELECT sales_person_id FROM profiles WHERE id = (select auth.uid())
    )
    OR (
      (select public.is_sales_manager())
      AND public.manager_can_access_sales_person(sales_person_id)
    )
  )
  WITH CHECK (
    (select public.is_admin())
    OR sales_person_id IN (
      SELECT sales_person_id FROM profiles WHERE id = (select auth.uid())
    )
    OR (
      (select public.is_sales_manager())
      AND public.manager_can_access_sales_person(sales_person_id)
    )
  );

-- --- prosba_teeth_products ---

DROP POLICY IF EXISTS prosba_teeth_products_select ON prosba_teeth_products;
CREATE POLICY prosba_teeth_products_select ON prosba_teeth_products
  FOR SELECT TO authenticated
  USING (NOT (select public.is_admin()));

-- --- subiekt_products ---

DROP POLICY IF EXISTS subiekt_products_select_authenticated ON subiekt_products;
CREATE POLICY subiekt_products_select_authenticated ON subiekt_products
  FOR SELECT TO authenticated
  USING (NOT (select public.is_admin()));

-- --- product_supplier_links ---

DROP POLICY IF EXISTS product_supplier_links_select_authenticated ON product_supplier_links;
CREATE POLICY product_supplier_links_select_authenticated ON product_supplier_links
  FOR SELECT TO authenticated
  USING (NOT (select public.is_admin()));

-- --- warehouse_carriers ---

DROP POLICY IF EXISTS warehouse_carriers_select ON warehouse_carriers;
CREATE POLICY warehouse_carriers_select ON warehouse_carriers
  FOR SELECT TO authenticated
  USING (NOT (select public.is_warehouse_staff()));

-- --- supplier_subiekt_kh_aliases ---

DROP POLICY IF EXISTS supplier_subiekt_kh_aliases_operations_read
  ON supplier_subiekt_kh_aliases;
CREATE POLICY supplier_subiekt_kh_aliases_operations_read
  ON supplier_subiekt_kh_aliases
  FOR SELECT TO authenticated
  USING (
    (select public.is_operations())
    AND NOT (select public.is_admin())
  );

-- --- warehouse_carrier_phones ---

DROP POLICY IF EXISTS warehouse_carrier_phones_select ON warehouse_carrier_phones;
CREATE POLICY warehouse_carrier_phones_select ON warehouse_carrier_phones
  FOR SELECT TO authenticated
  USING (NOT (select public.is_warehouse_staff()));

NOTIFY pgrst, 'reload schema';
