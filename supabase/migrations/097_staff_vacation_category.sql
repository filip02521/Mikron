-- Dodaje kategorię urlopu: urlop wypoczynkowy, odbiór nadgodzin, na żądanie, chorobowe, osobiste, inne.
-- Pozwala odróżnić typ nieobecności w kalendarzu działu.

ALTER TABLE staff_vacation_periods
  ADD COLUMN category TEXT NOT NULL DEFAULT 'urlop'
  CHECK (category IN ('urlop', 'nadgodziny', 'na_zadanie', 'chorobowe', 'osobiste', 'inne'));
