-- Produkty „tylko na prośbę” w szacunku ZD — poza Do ZD, aż pojawi się aktywna prośba.
-- Wspólna lista dla działu zakupów (nie mylić z suppliers.order_on_demand).

CREATE TABLE IF NOT EXISTS public.zd_estimate_on_request (
  subiekt_tw_id integer PRIMARY KEY,
  tw_symbol text NULL,
  tw_nazwa text NOT NULL DEFAULT '',
  grt_id integer NULL,
  grt_nazwa text NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT zd_estimate_on_request_note_len
    CHECK (char_length(note) <= 500),
  CONSTRAINT zd_estimate_on_request_tw_id_positive
    CHECK (subiekt_tw_id > 0)
);

CREATE INDEX IF NOT EXISTS zd_estimate_on_request_grt_id_idx
  ON public.zd_estimate_on_request (grt_id)
  WHERE grt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS zd_estimate_on_request_symbol_lower_idx
  ON public.zd_estimate_on_request (lower(trim(coalesce(tw_symbol, ''))));

COMMENT ON TABLE public.zd_estimate_on_request IS
  'SKU zamawiane tylko przy aktywnej prośbie handlowca — poza Do ZD bez prośby; qty = tylko prośba.';

ALTER TABLE public.zd_estimate_on_request ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zd_estimate_on_request_ops ON public.zd_estimate_on_request;
CREATE POLICY zd_estimate_on_request_ops
  ON public.zd_estimate_on_request
  FOR ALL
  TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_estimate_on_request TO authenticated;

NOTIFY pgrst, 'reload schema';
