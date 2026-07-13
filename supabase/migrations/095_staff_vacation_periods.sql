-- Urlopy pracowników działów niewyłącznie handlowych (zakupy, magazyn, itp.).
-- Każdy non-sales widzi urlopy wszystkich non-sales (cross-department).
-- Brak zastępstw — tylko informacja o niedostępności.
-- Uwaga: RLS select zostało zaktualizowane w migracji 096.

CREATE TABLE staff_vacation_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  note TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_vacation_dates_valid CHECK (end_date >= start_date),
  CONSTRAINT staff_vacation_max_length CHECK (end_date - start_date <= 366)
);

-- Zapobiega nakładającym się urlopom tego samego użytkownika
ALTER TABLE staff_vacation_periods
  ADD CONSTRAINT no_overlapping_staff_vacations
  EXCLUDE USING gist (user_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX idx_staff_vacation_periods_user ON staff_vacation_periods (user_id);

ALTER TABLE staff_vacation_periods ENABLE ROW LEVEL SECURITY;

-- Odczyt: własne urlopy + admin + osoby z tą samą rolą (widzą się na wzajem w dziale)
CREATE POLICY staff_vacation_periods_select ON staff_vacation_periods
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR user_id = auth.uid()
    OR (
      -- Ta sama rola = ten sam dział → widzą się na wzajem
      EXISTS (
        SELECT 1 FROM profiles p1
        JOIN profiles p2 ON p1.role = p2.role
        WHERE p1.id = auth.uid()
          AND p2.id = staff_vacation_periods.user_id
          AND p1.role NOT IN ('sales', 'sales_manager')
      )
    )
  );

-- Zapis: admin lub właściciel konta
CREATE POLICY staff_vacation_periods_manage ON staff_vacation_periods
  FOR ALL TO authenticated
  USING (
    is_admin()
    OR user_id = auth.uid()
  )
  WITH CHECK (
    is_admin()
    OR user_id = auth.uid()
  );
