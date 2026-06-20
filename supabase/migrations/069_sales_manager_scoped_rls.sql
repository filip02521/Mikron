-- Scoped RLS dla kierownika (sales_manager) — druga linia obrony obok warstwy aplikacji.

CREATE OR REPLACE FUNCTION public.my_managed_group_ids()
RETURNS SETOF UUID AS $$
  SELECT group_id
  FROM sales_group_managers
  WHERE profile_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.manager_can_access_sales_person(target_sales_person_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    target_sales_person_id IS NOT NULL
    AND (
      target_sales_person_id = public.my_sales_person_id()
      OR EXISTS (
        SELECT 1
        FROM sales_people sp
        WHERE sp.id = target_sales_person_id
          AND sp.group_id IN (SELECT public.my_managed_group_ids())
      )
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_read_sales_order(order_sales_person_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    public.is_admin()
    OR public.is_operations()
    OR order_sales_person_id = public.my_sales_person_id()
    OR (
      public.is_sales_manager()
      AND public.manager_can_access_sales_person(order_sales_person_id)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_insert_sales_order(order_sales_person_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    public.is_admin()
    OR public.is_operations()
    OR (
      public.is_sales_account()
      AND order_sales_person_id IS NOT NULL
      AND (
        order_sales_person_id = public.my_sales_person_id()
        OR (
          public.is_sales_manager()
          AND public.manager_can_access_sales_person(order_sales_person_id)
        )
      )
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS users_read_own_profile ON profiles;
CREATE POLICY users_read_own_profile ON profiles FOR SELECT USING (
  id = auth.uid()
  OR public.is_admin()
  OR (
    public.is_sales_manager()
    AND EXISTS (
      SELECT 1
      FROM sales_people sp
      WHERE sp.id = profiles.sales_person_id
        AND public.manager_can_access_sales_person(sp.id)
    )
  )
);

DROP POLICY IF EXISTS sales_groups_manage ON sales_groups;

CREATE POLICY sales_groups_admin_manage ON sales_groups
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY sales_groups_manager_update ON sales_groups
  FOR UPDATE
  TO authenticated
  USING (
    public.is_sales_manager()
    AND id IN (SELECT public.my_managed_group_ids())
  )
  WITH CHECK (
    public.is_sales_manager()
    AND id IN (SELECT public.my_managed_group_ids())
  );

DROP POLICY IF EXISTS sales_group_managers_select ON sales_group_managers;
CREATE POLICY sales_group_managers_select ON sales_group_managers
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin());
