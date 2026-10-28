-- 200_subiekt_sales_corrections.sql
-- Korekty sprzedaży (KFS, dok_Typ = 6) z Subiekta — API `/orders/zd/estimate` sumuje FS + PA + WZ,
-- a zwrotów nie odejmuje (audyt 28.10.2026: od sierpnia 259 KFS, pojedyncze towary po 20–50 szt).
-- Nocny odczyt dokumentów zapisuje pozycje; silnik odejmuje je od sprzedaży w oknie i w profilu 12 × 30 d.
CREATE TABLE IF NOT EXISTS public.subiekt_sales_corrections (
  dok_id integer NOT NULL,
  subiekt_tw_id integer NOT NULL,
  dok_nr text NULL,
  dok_date date NOT NULL,
  -- Sztuki karty zwrócone (dodatnie), suma pozycji towaru na dokumencie.
  qty numeric NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dok_id, subiekt_tw_id),
  CONSTRAINT subiekt_sales_corrections_qty_nonneg CHECK (qty >= 0)
);

CREATE INDEX IF NOT EXISTS subiekt_sales_corrections_tw_date_idx
  ON public.subiekt_sales_corrections (subiekt_tw_id, dok_date DESC);

ALTER TABLE public.subiekt_sales_corrections DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.subiekt_sales_corrections TO ontime_app;
  END IF;
END
$$;
