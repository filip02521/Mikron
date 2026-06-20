-- RLS sales_people — scoped SELECT zamiast sales_read_sales_people (każdy zalogowany).
-- Aplikacja korzysta z service role; poniższe polityki to druga linia obrony (JWT / PostgREST).

CREATE OR REPLACE FUNCTION public.is_sales_rep()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'sales'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_sales_rep() IS
  'Rola handlowca (bez kierownika) — do polityk RLS sales_people.';

DROP POLICY IF EXISTS sales_read_sales_people ON sales_people;

-- Handlowiec: wyłącznie własna karta (embed przez profiles też przechodzi po id).
CREATE POLICY sales_rep_read_own_sales_person ON sales_people
  FOR SELECT
  TO authenticated
  USING (
    public.is_sales_rep()
    AND id = public.my_sales_person_id()
  );

-- Kierownik: własna karta + handlowcy z przypisanych grup (manager_can_access_sales_person z 069).
CREATE POLICY sales_manager_read_team_sales_people ON sales_people
  FOR SELECT
  TO authenticated
  USING (
    public.is_sales_manager()
    AND public.manager_can_access_sales_person(id)
  );

-- Pozostałe polityki bez zmian:
--   admin_all_sales_people (ALL, admin)
--   zakupy_read_sales (SELECT, is_operations)
--   magazyn_read_sales (SELECT, is_magazyn)
