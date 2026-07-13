-- RLS fix: każdy non-sales widzi urlopy wszystkich non-sales (nie tylko tej samej roli).
-- Poprzednio: p1.role = p2.role (tylko ten sam dział).
-- Teraz: obaj non-sales → widzą się na wzajem.

DROP POLICY IF EXISTS staff_vacation_periods_select ON staff_vacation_periods;

CREATE POLICY staff_vacation_periods_select ON staff_vacation_periods
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR user_id = auth.uid()
    OR (
      -- Każdy non-sales widzi każdego non-sales
      EXISTS (
        SELECT 1 FROM profiles p1
        JOIN profiles p2
          ON p1.role NOT IN ('sales', 'sales_manager')
         AND p2.role NOT IN ('sales', 'sales_manager')
        WHERE p1.id = auth.uid()
          AND p2.id = staff_vacation_periods.user_id
      )
    )
  );
