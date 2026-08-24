-- ============================================================
-- 151: Naprawa wewnętrznych odwołań public.* w helperach private.*
-- ============================================================
-- Po 150 (ALTER FUNCTION … SET SCHEMA private) ciała funkcji nadal
-- wołały public.is_admin() itd. — te obiekty już nie istnieją w public.
-- Polityki RLS zostały zaktualizowane przez PG; composable helpery — nie.
-- ============================================================

CREATE OR REPLACE FUNCTION private.can_access_department_board()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.is_admin()
    OR private.is_operations()
    OR private.is_sales_account();
$$;

CREATE OR REPLACE FUNCTION private.can_access_operations_department(d operations_department)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.is_admin()
    OR (d = 'zakupy'::operations_department AND private.is_operations())
    OR (d = 'magazyn'::operations_department AND private.is_magazyn());
$$;

CREATE OR REPLACE FUNCTION private.is_warehouse_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.is_operations() OR private.is_magazyn();
$$;

CREATE OR REPLACE FUNCTION private.manager_can_access_sales_person(target_sales_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT
    target_sales_person_id IS NOT NULL
    AND (
      target_sales_person_id = private.my_sales_person_id()
      OR EXISTS (
        SELECT 1
        FROM sales_people sp
        WHERE sp.id = target_sales_person_id
          AND sp.group_id IN (SELECT private.my_managed_group_ids())
      )
    );
$$;

CREATE OR REPLACE FUNCTION private.can_read_sales_order(order_sales_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT
    private.is_admin()
    OR private.is_operations()
    OR order_sales_person_id = private.my_sales_person_id()
    OR (
      private.is_sales_manager()
      AND private.manager_can_access_sales_person(order_sales_person_id)
    )
    OR private.is_active_delegate_for(order_sales_person_id);
$$;

CREATE OR REPLACE FUNCTION private.can_insert_sales_order(order_sales_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT
    private.is_admin()
    OR private.is_operations()
    OR (
      private.is_sales_account()
      AND order_sales_person_id IS NOT NULL
      AND (
        order_sales_person_id = private.my_sales_person_id()
        OR (
          private.is_sales_manager()
          AND private.manager_can_access_sales_person(order_sales_person_id)
        )
        OR private.is_active_delegate_for(order_sales_person_id)
      )
    );
$$;
