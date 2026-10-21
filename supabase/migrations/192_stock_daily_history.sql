-- 192_stock_daily_history.sql
-- Dzienna historia stanów (zapis w nocnym przebiegu „Braki i zamówienia”, bez osobnego crona).
-- Po co: w dniach braku Subiekt notuje tylko to, co zeszło — sprzedaż w oknie zaniża popyt
-- i cel spada właśnie wtedy, gdy towaru nie ma. Z historią Kreator liczy tempo na dniach ze stanem.
-- Jeden wiersz na towar i dzień obserwacji (rano, przed sprzedażą tego dnia); pierwszy zapis dnia wygrywa.

CREATE TABLE IF NOT EXISTS public.stock_daily_history (
  subiekt_tw_id integer NOT NULL,
  day date NOT NULL,
  -- Sztuki karty Subiekta: stan, rezerwacje, dostępne (stan − rezerwacje, może być ujemne).
  stock_qty numeric NOT NULL DEFAULT 0,
  reserved_qty numeric NOT NULL DEFAULT 0,
  available_qty numeric NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subiekt_tw_id, day)
);

CREATE INDEX IF NOT EXISTS stock_daily_history_day_idx
  ON public.stock_daily_history (day);

ALTER TABLE public.stock_daily_history DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_daily_history TO ontime_app;
  END IF;
END
$$;
