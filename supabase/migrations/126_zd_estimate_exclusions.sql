-- Wykluczenia produktów ze szacunku ZD (sandbox /zakupy/szacunek).
-- Wspólna lista dla działu zakupów — zapamiętana między sesjami zamówień.

CREATE TABLE IF NOT EXISTS public.zd_estimate_exclusions (
  subiekt_tw_id integer PRIMARY KEY,
  tw_symbol text NULL,
  tw_nazwa text NOT NULL DEFAULT '',
  grt_id integer NULL,
  grt_nazwa text NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT zd_estimate_exclusions_note_len
    CHECK (char_length(note) <= 500),
  CONSTRAINT zd_estimate_exclusions_tw_id_positive
    CHECK (subiekt_tw_id > 0)
);

CREATE INDEX IF NOT EXISTS zd_estimate_exclusions_grt_id_idx
  ON public.zd_estimate_exclusions (grt_id)
  WHERE grt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS zd_estimate_exclusions_symbol_lower_idx
  ON public.zd_estimate_exclusions (lower(trim(coalesce(tw_symbol, ''))));

COMMENT ON TABLE public.zd_estimate_exclusions IS
  'Produkty wykluczone ze szacunku listy do zamówienia ZD — trwałe, współdzielone przez ops.';

ALTER TABLE public.zd_estimate_exclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zd_estimate_exclusions_ops ON public.zd_estimate_exclusions;
CREATE POLICY zd_estimate_exclusions_ops
  ON public.zd_estimate_exclusions
  FOR ALL
  TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_estimate_exclusions TO authenticated;

NOTIFY pgrst, 'reload schema';
