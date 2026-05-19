-- Rola działu zakupów (operacje bez panelu administracyjnego)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'zakupy';

CREATE OR REPLACE FUNCTION public.is_operations()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'zakupy')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY zakupy_read_suppliers ON suppliers FOR SELECT USING (public.is_operations());
CREATE POLICY zakupy_read_schedules ON supplier_schedules FOR SELECT USING (public.is_operations());
CREATE POLICY zakupy_read_vacations ON vacations FOR SELECT USING (public.is_operations());
CREATE POLICY zakupy_all_individual ON individual_orders FOR ALL USING (public.is_operations());
CREATE POLICY zakupy_read_history ON normal_order_history FOR SELECT USING (public.is_operations());
CREATE POLICY zakupy_read_stats ON delivery_stats FOR SELECT USING (public.is_operations());
CREATE POLICY zakupy_read_sales ON sales_people FOR SELECT USING (public.is_operations());
