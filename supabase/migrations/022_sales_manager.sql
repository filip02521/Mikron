-- Kierownik handlowców: własny panel handlowca + podgląd zespołu + zarządzanie kontami
--
-- Uwaga: przy apply przez Supabase MCP / remote SQL enum musi być w osobnej migracji
-- (np. sales_manager_role_enum, potem sales_manager_rls) — inaczej błąd 55P04.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sales_manager';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_sales_manager()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'sales_manager'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_sales_account()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('sales', 'sales_manager')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_read_sales_order(order_sales_person_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    public.is_admin()
    OR public.is_operations()
    OR public.is_sales_manager()
    OR order_sales_person_id = public.my_sales_person_id();
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
        public.is_sales_manager()
        OR order_sales_person_id = public.my_sales_person_id()
      )
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS sales_own_orders_select ON individual_orders;
CREATE POLICY sales_team_orders_select ON individual_orders FOR SELECT
  USING (public.can_read_sales_order(sales_person_id));

DROP POLICY IF EXISTS sales_own_orders_insert ON individual_orders;
CREATE POLICY sales_team_orders_insert ON individual_orders FOR INSERT
  WITH CHECK (public.can_insert_sales_order(sales_person_id));

DROP POLICY IF EXISTS users_read_own_profile ON profiles;
CREATE POLICY users_read_own_profile ON profiles FOR SELECT USING (
  id = auth.uid() OR public.is_admin() OR public.is_sales_manager()
);
