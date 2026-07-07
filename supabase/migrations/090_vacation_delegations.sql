-- System zastępstw urlopowych handlowców.
-- Delegat zyskuje dostęp do panelu urlopowanego (odczyt + potwierdzenie odbioru + zamknięcie ZK).

CREATE TABLE sales_vacation_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_person_id UUID NOT NULL REFERENCES sales_people(id) ON DELETE CASCADE,
  delegate_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Zapobiega nakładającym się zakresom delegacji dla tego samego handlowca
ALTER TABLE sales_vacation_delegations
  ADD CONSTRAINT no_overlapping_delegations
  EXCLUDE USING gist (sales_person_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX idx_delegations_delegate ON sales_vacation_delegations (delegate_profile_id);
CREATE INDEX idx_delegations_sales_person ON sales_vacation_delegations (sales_person_id);

ALTER TABLE sales_vacation_delegations ENABLE ROW LEVEL SECURITY;

-- Odczyt: własne delegacje (jako urlopowany lub jako zastępca) + admin + kierownik grupy
CREATE POLICY delegations_select ON sales_vacation_delegations
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR delegate_profile_id = auth.uid()
    OR sales_person_id IN (
      SELECT sales_person_id FROM profiles WHERE id = auth.uid()
    )
    OR (
      is_sales_manager()
      AND manager_can_access_sales_person(sales_person_id)
    )
  );

-- Zapis: admin lub właściciel konta handlowca lub kierownik grupy
CREATE POLICY delegations_manage ON sales_vacation_delegations
  FOR ALL TO authenticated
  USING (
    is_admin()
    OR sales_person_id IN (
      SELECT sales_person_id FROM profiles WHERE id = auth.uid()
    )
    OR (
      is_sales_manager()
      AND manager_can_access_sales_person(sales_person_id)
    )
  )
  WITH CHECK (
    is_admin()
    OR sales_person_id IN (
      SELECT sales_person_id FROM profiles WHERE id = auth.uid()
    )
    OR (
      is_sales_manager()
      AND manager_can_access_sales_person(sales_person_id)
    )
  );

-- Funkcja sprawdzająca czy bieżący użytkownik jest aktywnym zastępcą danego handlowca
CREATE OR REPLACE FUNCTION public.is_active_delegate_for(target_sp_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM sales_vacation_delegations d
    WHERE d.sales_person_id = target_sp_id
      AND d.delegate_profile_id = auth.uid()
      AND CURRENT_DATE BETWEEN d.start_date AND d.end_date
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_active_delegate_for IS
  'Czy bieżący użytkownik jest aktywnym zastępcą danego handlowca (delegacja urlopowa).';

-- Rozszerzenie can_read_sales_order o delegację
CREATE OR REPLACE FUNCTION public.can_read_sales_order(order_sales_person_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    public.is_admin()
    OR public.is_operations()
    OR order_sales_person_id = public.my_sales_person_id()
    OR (
      public.is_sales_manager()
      AND public.manager_can_access_sales_person(order_sales_person_id)
    )
    OR public.is_active_delegate_for(order_sales_person_id);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Rozszerzenie can_insert_sales_order o delegację
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
        OR public.is_active_delegate_for(order_sales_person_id)
      )
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Delegat może odczytać ZK urlopowanego (ale nie modyfikować przez RLS)
DROP POLICY IF EXISTS sales_zk_watches_own ON sales_zk_watches;
CREATE POLICY sales_zk_watches_own ON sales_zk_watches
  FOR ALL
  USING (
    (public.is_sales_account() AND sales_person_id = public.my_sales_person_id())
    OR public.is_active_delegate_for(sales_person_id)
  )
  WITH CHECK (
    public.is_sales_account()
    AND sales_person_id = public.my_sales_person_id()
  );

-- Delegat może odczytać notatki urlopowanego (ale nie modyfikować przez RLS)
DROP POLICY IF EXISTS sales_notes_own ON sales_notes;
CREATE POLICY sales_notes_own ON sales_notes
  FOR ALL
  USING (
    (public.is_sales_account() AND sales_person_id = public.my_sales_person_id())
    OR public.is_active_delegate_for(sales_person_id)
  )
  WITH CHECK (
    public.is_sales_account()
    AND sales_person_id = public.my_sales_person_id()
  );
