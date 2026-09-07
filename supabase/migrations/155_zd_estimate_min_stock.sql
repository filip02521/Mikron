-- Minimum stanów per produkt dla szacunku ZD (/zakupy/szacunek).
-- min_stock_szt = minimalna liczba sztuk fizycznych, do której dobijamy
-- nawet przy braku sprzedaży (cel = max(celTracked, min_stock_szt)).
--
-- Wzorzec: zd_estimate_packaging (klucz: subiekt_tw_id, RLS: ops).

CREATE TABLE IF NOT EXISTS public.zd_estimate_min_stock (
  subiekt_tw_id integer PRIMARY KEY,
  tw_symbol text NULL,
  tw_nazwa text NOT NULL DEFAULT '',
  grt_id integer NULL,
  grt_nazwa text NULL,
  min_stock_szt integer NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT zd_estimate_min_stock_szt_min
    CHECK (min_stock_szt >= 0),
  CONSTRAINT zd_estimate_min_stock_szt_max
    CHECK (min_stock_szt <= 1000000),
  CONSTRAINT zd_estimate_min_stock_note_len
    CHECK (char_length(note) <= 500),
  CONSTRAINT zd_estimate_min_stock_tw_id_positive
    CHECK (subiekt_tw_id > 0)
);

CREATE INDEX IF NOT EXISTS zd_estimate_min_stock_grt_id_idx
  ON public.zd_estimate_min_stock (grt_id)
  WHERE grt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS zd_estimate_min_stock_symbol_lower_idx
  ON public.zd_estimate_min_stock (lower(trim(coalesce(tw_symbol, ''))));

COMMENT ON TABLE public.zd_estimate_min_stock IS
  'Minimum stanów w sztukach fizycznych per produkt — dobija cel ZD nawet przy braku sprzedaży. Trwałe, współdzielone przez ops.';

ALTER TABLE public.zd_estimate_min_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zd_estimate_min_stock_ops ON public.zd_estimate_min_stock;
CREATE POLICY zd_estimate_min_stock_ops
  ON public.zd_estimate_min_stock
  FOR ALL
  TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_estimate_min_stock TO authenticated;

NOTIFY pgrst, 'reload schema';
