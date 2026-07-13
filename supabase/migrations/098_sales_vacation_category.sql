-- Dodaje kategorię urlopu do sales_vacation_periods — spójne ze staff_vacation_periods.

ALTER TABLE sales_vacation_periods
  ADD COLUMN category TEXT NOT NULL DEFAULT 'urlop'
  CHECK (category IN ('urlop', 'nadgodziny', 'na_zadanie', 'chorobowe', 'osobiste', 'inne'));
