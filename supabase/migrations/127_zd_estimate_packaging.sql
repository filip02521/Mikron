-- Opakowania produktów dla szacunku ZD (/zakupy/szacunek).
-- units_per_package = ile sztuk przychodzi, gdy w ZD wpiszemy „1”.

CREATE TABLE IF NOT EXISTS public.zd_estimate_packaging (
  subiekt_tw_id integer PRIMARY KEY,
  tw_symbol text NULL,
  tw_nazwa text NOT NULL DEFAULT '',
  grt_id integer NULL,
  grt_nazwa text NULL,
  units_per_package integer NOT NULL,
  package_label text NOT NULL DEFAULT 'op.',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT zd_estimate_packaging_units_min
    CHECK (units_per_package >= 2),
  CONSTRAINT zd_estimate_packaging_units_max
    CHECK (units_per_package <= 100000),
  CONSTRAINT zd_estimate_packaging_label_len
    CHECK (char_length(package_label) BETWEEN 1 AND 24),
  CONSTRAINT zd_estimate_packaging_note_len
    CHECK (char_length(note) <= 500),
  CONSTRAINT zd_estimate_packaging_tw_id_positive
    CHECK (subiekt_tw_id > 0)
);

CREATE INDEX IF NOT EXISTS zd_estimate_packaging_grt_id_idx
  ON public.zd_estimate_packaging (grt_id)
  WHERE grt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS zd_estimate_packaging_symbol_lower_idx
  ON public.zd_estimate_packaging (lower(trim(coalesce(tw_symbol, ''))));

COMMENT ON TABLE public.zd_estimate_packaging IS
  'Ile sztuk = 1 jednostka na ZD (np. Falcon op. 10 szt, EVE 100 szt). Trwałe, współdzielone przez ops.';

ALTER TABLE public.zd_estimate_packaging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zd_estimate_packaging_ops ON public.zd_estimate_packaging;
CREATE POLICY zd_estimate_packaging_ops
  ON public.zd_estimate_packaging
  FOR ALL
  TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_estimate_packaging TO authenticated;

NOTIFY pgrst, 'reload schema';
