-- Okresy urlopów handlowców (osobno od zastępstw).
-- Pozwala handlowcowi ustawić daty urlopu, które są widoczne w panelu ustawień.

CREATE TABLE sales_vacation_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_person_id UUID NOT NULL REFERENCES sales_people(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  note TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vacation_dates_valid CHECK (end_date >= start_date),
  CONSTRAINT vacation_max_length CHECK (end_date - start_date <= 366)
);

-- Zapobiega nakładającym się urlopom tego samego handlowca
ALTER TABLE sales_vacation_periods
  ADD CONSTRAINT no_overlapping_vacations
  EXCLUDE USING gist (sales_person_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX idx_vacation_periods_sales_person ON sales_vacation_periods (sales_person_id);

ALTER TABLE sales_vacation_periods ENABLE ROW LEVEL SECURITY;

-- Odczyt: własne urlopy + admin + kierownik grupy
CREATE POLICY vacation_periods_select ON sales_vacation_periods
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR sales_person_id IN (
      SELECT sales_person_id FROM profiles WHERE id = auth.uid()
    )
    OR (
      is_sales_manager()
      AND manager_can_access_sales_person(sales_person_id)
    )
  );

-- Zapis: admin lub właściciel konta handlowca lub kierownik grupy
CREATE POLICY vacation_periods_manage ON sales_vacation_periods
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
