-- ============================================================
-- 109: Consolidate overlapping permissive RLS policies
--      Fixes advisor warning: multiple_permissive_policies
--
--      When multiple permissive policies exist for the same
--      role+action, PostgreSQL evaluates ALL of them per row.
--      Merging into a single policy with OR enables short-circuit
--      evaluation: init plan conditions (is_admin, is_operations)
--      are evaluated once, and only the matching branch runs.
--
--      Access logic is preserved EXACTLY — every condition from
--      the original policies is present in the merged version.
-- ============================================================

-- ============================================================
-- Pattern A: admin FOR ALL + non-admin FOR ALL (same action)
--   → Merge into single FOR ALL with OR
-- ============================================================

-- --- individual_order_teeth_details (3 FOR ALL policies) ---

DROP POLICY IF EXISTS individual_order_teeth_details_admin_all
  ON individual_order_teeth_details;
DROP POLICY IF EXISTS individual_order_teeth_details_zeby_all
  ON individual_order_teeth_details;
DROP POLICY IF EXISTS individual_order_teeth_details_sales_own
  ON individual_order_teeth_details;

CREATE POLICY individual_order_teeth_details_all
  ON individual_order_teeth_details
  FOR ALL TO authenticated
  USING (
    (select public.is_admin())
    OR (select public.is_operations())
    OR (
      NOT ((select public.is_admin()) OR (select public.is_operations()))
      AND (
        -- zeby panel access
        (
          EXISTS (
            SELECT 1 FROM individual_orders
            WHERE id = individual_order_teeth_details.order_id
              AND is_teeth = true
          )
          AND (select public.can_access_teeth_panel())
        )
        -- sales own access
        OR EXISTS (
          SELECT 1 FROM individual_orders io
          WHERE io.id = individual_order_teeth_details.order_id
            AND public.can_read_sales_order(io.sales_person_id)
        )
      )
    )
  )
  WITH CHECK (
    (select public.is_admin())
    OR (select public.is_operations())
    OR (
      NOT ((select public.is_admin()) OR (select public.is_operations()))
      AND (
        -- zeby panel write
        (
          EXISTS (
            SELECT 1 FROM individual_orders
            WHERE id = individual_order_teeth_details.order_id
              AND is_teeth = true
          )
          AND (select public.can_access_teeth_panel())
        )
        -- sales own write
        OR EXISTS (
          SELECT 1 FROM individual_orders io
          WHERE io.id = individual_order_teeth_details.order_id
            AND io.is_teeth = true
            AND public.can_insert_sales_order(io.sales_person_id)
        )
      )
    )
  );

-- --- sales_notes (admin FOR ALL + own FOR ALL) ---

DROP POLICY IF EXISTS sales_notes_admin ON sales_notes;
DROP POLICY IF EXISTS sales_notes_own ON sales_notes;

CREATE POLICY sales_notes_all ON sales_notes
  FOR ALL
  USING (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND (
        ((select public.is_sales_account()) AND sales_person_id = public.my_sales_person_id())
        OR public.is_active_delegate_for(sales_person_id)
      )
    )
  )
  WITH CHECK (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND (select public.is_sales_account())
      AND sales_person_id = public.my_sales_person_id()
    )
  );

-- --- sales_zk_watches (admin FOR ALL + own FOR ALL) ---

DROP POLICY IF EXISTS sales_zk_watches_admin ON sales_zk_watches;
DROP POLICY IF EXISTS sales_zk_watches_own ON sales_zk_watches;

CREATE POLICY sales_zk_watches_all ON sales_zk_watches
  FOR ALL
  USING (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND (
        ((select public.is_sales_account()) AND sales_person_id = public.my_sales_person_id())
        OR public.is_active_delegate_for(sales_person_id)
      )
    )
  )
  WITH CHECK (
    (select public.is_admin())
    OR (
      NOT (select public.is_admin())
      AND (select public.is_sales_account())
      AND sales_person_id = public.my_sales_person_id()
    )
  );

-- ============================================================
-- Pattern B: admin FOR ALL + non-admin SELECT only
--   → Single SELECT policy (admin OR non-admin condition)
--   → Separate admin-only INSERT/UPDATE/DELETE
-- ============================================================

-- --- vacations (admin FOR ALL + operations SELECT) ---

DROP POLICY IF EXISTS admin_all_vacations ON vacations;
DROP POLICY IF EXISTS zakupy_read_vacations ON vacations;

CREATE POLICY vacations_select ON vacations FOR SELECT USING (
  (select public.is_admin())
  OR ((select public.is_operations()) AND NOT (select public.is_admin()))
);

CREATE POLICY vacations_admin_write ON vacations
  FOR INSERT WITH CHECK ((select public.is_admin()));

CREATE POLICY vacations_admin_update ON vacations
  FOR UPDATE USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY vacations_admin_delete ON vacations
  FOR DELETE USING ((select public.is_admin()));

-- --- teeth_order_history (admin FOR ALL + teeth SELECT + teeth INSERT) ---

DROP POLICY IF EXISTS admin_all_teeth_history ON teeth_order_history;
DROP POLICY IF EXISTS teeth_history_read ON teeth_order_history;
DROP POLICY IF EXISTS teeth_history_insert ON teeth_order_history;

CREATE POLICY teeth_history_select ON teeth_order_history FOR SELECT USING (
  (select public.is_admin())
  OR ((select public.can_access_teeth_panel()) AND NOT (select public.is_admin()))
);

CREATE POLICY teeth_history_insert ON teeth_order_history FOR INSERT WITH CHECK (
  (select public.is_admin())
  OR ((select public.can_access_teeth_panel()) AND NOT (select public.is_admin()))
);

CREATE POLICY teeth_history_admin_update ON teeth_order_history
  FOR UPDATE USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY teeth_history_admin_delete ON teeth_order_history
  FOR DELETE USING ((select public.is_admin()));

-- --- supplier_schedules (admin FOR ALL + sales SELECT + operations SELECT) ---

DROP POLICY IF EXISTS admin_all_schedules ON supplier_schedules;
DROP POLICY IF EXISTS sales_read_schedules ON supplier_schedules;
DROP POLICY IF EXISTS zakupy_read_schedules ON supplier_schedules;

CREATE POLICY supplier_schedules_select ON supplier_schedules FOR SELECT USING (
  (select public.is_admin())
  OR ((select public.is_operations()) AND NOT (select public.is_admin()))
  OR ((select auth.uid()) IS NOT NULL AND NOT (select public.is_admin()))
);

CREATE POLICY supplier_schedules_admin_write ON supplier_schedules
  FOR INSERT WITH CHECK ((select public.is_admin()));

CREATE POLICY supplier_schedules_admin_update ON supplier_schedules
  FOR UPDATE USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY supplier_schedules_admin_delete ON supplier_schedules
  FOR DELETE USING ((select public.is_admin()));

-- --- suppliers (admin FOR ALL + 4 SELECT policies) ---

DROP POLICY IF EXISTS admin_all_suppliers ON suppliers;
DROP POLICY IF EXISTS sales_read_suppliers ON suppliers;
DROP POLICY IF EXISTS zakupy_read_suppliers ON suppliers;
DROP POLICY IF EXISTS magazyn_read_suppliers ON suppliers;
DROP POLICY IF EXISTS suppliers_zeby_read ON suppliers;

CREATE POLICY suppliers_select ON suppliers FOR SELECT USING (
  (select public.is_admin())
  OR ((select public.is_operations()) AND NOT (select public.is_admin()))
  OR ((select public.is_magazyn()) AND NOT (select public.is_admin()))
  OR ((select public.can_access_teeth_panel()) AND NOT (select public.is_admin()))
  OR ((select auth.uid()) IS NOT NULL AND NOT (select public.is_admin()))
);

CREATE POLICY suppliers_admin_write ON suppliers
  FOR INSERT WITH CHECK ((select public.is_admin()));

CREATE POLICY suppliers_admin_update ON suppliers
  FOR UPDATE USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY suppliers_admin_delete ON suppliers
  FOR DELETE USING ((select public.is_admin()));

-- ============================================================
-- Pattern C: warehouse staff FOR ALL + non-staff SELECT
--   → Single SELECT (everyone), separate staff-only write
-- ============================================================

-- --- warehouse_carriers ---

DROP POLICY IF EXISTS warehouse_carriers_manage ON warehouse_carriers;
DROP POLICY IF EXISTS warehouse_carriers_select ON warehouse_carriers;

CREATE POLICY warehouse_carriers_select ON warehouse_carriers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY warehouse_carriers_write ON warehouse_carriers
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_warehouse_staff()));

CREATE POLICY warehouse_carriers_update ON warehouse_carriers
  FOR UPDATE TO authenticated
  USING ((select public.is_warehouse_staff()))
  WITH CHECK ((select public.is_warehouse_staff()));

CREATE POLICY warehouse_carriers_delete ON warehouse_carriers
  FOR DELETE TO authenticated
  USING ((select public.is_warehouse_staff()));

-- --- warehouse_carrier_phones ---

DROP POLICY IF EXISTS warehouse_carrier_phones_manage ON warehouse_carrier_phones;
DROP POLICY IF EXISTS warehouse_carrier_phones_select ON warehouse_carrier_phones;

CREATE POLICY warehouse_carrier_phones_select ON warehouse_carrier_phones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY warehouse_carrier_phones_write ON warehouse_carrier_phones
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_warehouse_staff()));

CREATE POLICY warehouse_carrier_phones_update ON warehouse_carrier_phones
  FOR UPDATE TO authenticated
  USING ((select public.is_warehouse_staff()))
  WITH CHECK ((select public.is_warehouse_staff()));

CREATE POLICY warehouse_carrier_phones_delete ON warehouse_carrier_phones
  FOR DELETE TO authenticated
  USING ((select public.is_warehouse_staff()));

-- ============================================================
-- Pattern D: Complex tables with many policies
-- ============================================================

-- --- individual_orders (admin FOR ALL + 6 other policies) ---
-- Merge admin + operations + magazyn + zeby into one FOR ALL,
-- keep sales_team separate (different roles: public vs authenticated,
-- and different logic for INSERT/UPDATE/DELETE vs SELECT).

DROP POLICY IF EXISTS admin_all_individual ON individual_orders;
DROP POLICY IF EXISTS zakupy_all_individual ON individual_orders;
DROP POLICY IF EXISTS magazyn_individual_orders ON individual_orders;
DROP POLICY IF EXISTS individual_orders_zeby_all ON individual_orders;

CREATE POLICY individual_orders_all ON individual_orders
  FOR ALL
  USING (
    (select public.is_admin())
    OR ((select public.is_operations()) AND NOT (select public.is_admin()))
    OR ((select public.is_magazyn()) AND NOT (select public.is_admin()))
    OR (
      is_teeth = true
      AND (select public.can_access_teeth_panel())
      AND NOT (select public.is_admin())
    )
  )
  WITH CHECK (
    (select public.is_admin())
    OR ((select public.is_operations()) AND NOT (select public.is_admin()))
    OR ((select public.is_magazyn()) AND NOT (select public.is_admin()))
    OR (
      is_teeth = true
      AND (select public.can_access_teeth_panel())
      AND NOT (select public.is_admin())
    )
  );

-- sales_team policies remain separate — they use can_read_sales_order
-- which is per-row and sales-specific. No overlap with the merged
-- policy above because is_admin/is_operations/is_magazyn/can_access_teeth_panel
-- are all false for a pure sales account.

-- --- sales_people (admin FOR ALL + 5 SELECT policies) ---

DROP POLICY IF EXISTS admin_all_sales_people ON sales_people;
DROP POLICY IF EXISTS zakupy_read_sales ON sales_people;
DROP POLICY IF EXISTS magazyn_read_sales ON sales_people;
DROP POLICY IF EXISTS sales_people_zeby_read ON sales_people;
DROP POLICY IF EXISTS sales_rep_read_own_sales_person ON sales_people;
DROP POLICY IF EXISTS sales_manager_read_team_sales_people ON sales_people;

CREATE POLICY sales_people_select ON sales_people FOR SELECT USING (
  (select public.is_admin())
  OR ((select public.is_operations()) AND NOT (select public.is_admin()))
  OR ((select public.is_magazyn()) AND NOT (select public.is_admin()))
  OR ((select public.can_access_teeth_panel()) AND NOT (select public.is_admin()))
  OR ((select public.is_sales_rep()) AND id = public.my_sales_person_id())
  OR (
    (select public.is_sales_manager())
    AND public.manager_can_access_sales_person(id)
  )
);

CREATE POLICY sales_people_admin_write ON sales_people
  FOR INSERT WITH CHECK ((select public.is_admin()));

CREATE POLICY sales_people_admin_update ON sales_people
  FOR UPDATE USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

CREATE POLICY sales_people_admin_delete ON sales_people
  FOR DELETE USING ((select public.is_admin()));

NOTIFY pgrst, 'reload schema';
