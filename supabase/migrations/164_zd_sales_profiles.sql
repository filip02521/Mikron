-- 164_zd_sales_profiles.sql
-- Profil sprzedaży 12 × 30 dni per towar i zakres (grupa/cecha) — z GET /orders/zd/estimate
-- dla 12 okien. Liczony przy Policz/nocnym przebiegu, gdy brak świeżego profilu zakresu.
-- Kreator: znaczniki „jednorazowy skok” / „rzadka sprzedaż” i opcja wygładzenia.

CREATE TABLE IF NOT EXISTS public.zd_sales_profiles (
  scope_mode text NOT NULL,
  scope_id integer NOT NULL,
  subiekt_tw_id integer NOT NULL,
  -- Sprzedaż (jednostki karty) w 12 oknach 30-dniowych, od najstarszego.
  windows numeric[] NOT NULL,
  -- Ostatni dzień ostatniego okna.
  end_date date NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_mode, scope_id, subiekt_tw_id),
  CONSTRAINT zd_sales_profiles_scope_mode_check CHECK (scope_mode IN ('grupa', 'cecha')),
  CONSTRAINT zd_sales_profiles_windows_len CHECK (cardinality(windows) = 12)
);

CREATE INDEX IF NOT EXISTS zd_sales_profiles_tw_idx
  ON public.zd_sales_profiles (subiekt_tw_id);

ALTER TABLE public.zd_sales_profiles DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_sales_profiles TO ontime_app;
  END IF;
END
$$;
