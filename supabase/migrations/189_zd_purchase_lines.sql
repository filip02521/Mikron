-- 189_zd_purchase_lines.sql
-- Karta produktu w Kreatorze ZD: historia zakupów towaru (wszystkie ZD, także spoza Kreatora).
-- Linie zbiera nocny harvest cen z ZD (stock watch) — ten sam odczyt dokumentu co cena.
CREATE TABLE IF NOT EXISTS public.zd_purchase_lines (
  dok_id integer NOT NULL,
  subiekt_tw_id integer NOT NULL,
  dok_nr text NULL,
  dok_date date NULL,
  kh_id integer NULL,
  -- Jednostki dokumentu ZD (przy opakowaniach: paczki), suma pozycji towaru na ZD.
  qty numeric NOT NULL,
  -- Cena netto za jednostkę dokumentu; NULL gdy pozycja bez ceny.
  price_net numeric NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dok_id, subiekt_tw_id),
  CONSTRAINT zd_purchase_lines_qty_nonneg CHECK (qty >= 0)
);

CREATE INDEX IF NOT EXISTS zd_purchase_lines_tw_date_idx
  ON public.zd_purchase_lines (subiekt_tw_id, dok_date DESC);

ALTER TABLE public.zd_purchase_lines DISABLE ROW LEVEL SECURITY;

-- Jednorazowe ponowne przejście harvestu po wszystkich ZD z indeksu, żeby zebrać linie
-- (ceny upsert tylko gdy dokument nowszy — ponowny odczyt ich nie psuje).
UPDATE public.subiekt_zd_index SET price_harvested_at = NULL WHERE price_harvested_at IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ontime_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_purchase_lines TO ontime_app;
  END IF;
END
$$;
