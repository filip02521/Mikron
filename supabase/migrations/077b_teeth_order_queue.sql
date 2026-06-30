-- Dział zakupów — Zęby: kolumny, indeks, funkcja i RLS.
-- Uruchom po 077_teeth_order_queue.sql (który dodaje wartość enum).

-- Czy pozycja jest „zęby" (denormalizowane z prosba_teeth_products przy tworzeniu/edycji prośby).
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS is_teeth BOOLEAN NOT NULL DEFAULT false;

-- Kto zamówił zęby (osoba z działu zębów vs główny dział zakupów).
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS teeth_ordered_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS teeth_ordered_at TIMESTAMPTZ NULL;

-- Indeks do szybkiego filtrowania kolejki zębów.
CREATE INDEX IF NOT EXISTS individual_orders_is_teeth_idx
  ON individual_orders (is_teeth) WHERE is_teeth = true;

-- Funkcja sprawdzająca czy użytkownik ma dostęp do panelu zębów.
CREATE OR REPLACE FUNCTION public.can_access_teeth_panel()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'zakupy', 'zakupy_zeby')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS: zakupy_zeby ma dostęp do individual_orders gdzie is_teeth = true (odczyt + zapis).
-- Admin i zakupy mają już własne polisy — ta jest tylko dla zakupy_zeby.
DROP POLICY IF EXISTS individual_orders_zeby_all ON individual_orders;
CREATE POLICY individual_orders_zeby_all ON individual_orders
  FOR ALL TO authenticated
  USING (is_teeth = true AND public.can_access_teeth_panel())
  WITH CHECK (is_teeth = true AND public.can_access_teeth_panel());

-- RLS: zakupy_zeby ma dostęp do dostawców (odczyt).
DROP POLICY IF EXISTS suppliers_zeby_read ON suppliers;
CREATE POLICY suppliers_zeby_read ON suppliers
  FOR SELECT TO authenticated
  USING (public.can_access_teeth_panel());

-- RLS: zakupy_zeby ma dostęp do sales_people (odczyt).
DROP POLICY IF EXISTS sales_people_zeby_read ON sales_people;
CREATE POLICY sales_people_zeby_read ON sales_people
  FOR SELECT TO authenticated
  USING (public.can_access_teeth_panel());
