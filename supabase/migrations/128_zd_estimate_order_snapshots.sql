-- Snapshoty realnych ZD powiązanych ze szacunkiem (/zakupy/szacunek).
-- Zapis po „Powiąż ZD” — nie przy samym „Policz listę”.

CREATE TABLE IF NOT EXISTS public.zd_estimate_order_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dok_id integer NOT NULL,
  dok_nr_pelny text NOT NULL DEFAULT '',
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  supplier_kh_id integer NULL,
  grt_id integer NULL,
  CONSTRAINT zd_estimate_order_snapshots_dok_id_unique UNIQUE (dok_id),
  CONSTRAINT zd_estimate_order_snapshots_dok_id_positive
    CHECK (dok_id > 0)
);

CREATE INDEX IF NOT EXISTS zd_estimate_order_snapshots_linked_at_idx
  ON public.zd_estimate_order_snapshots (linked_at DESC);

CREATE INDEX IF NOT EXISTS zd_estimate_order_snapshots_grt_id_idx
  ON public.zd_estimate_order_snapshots (grt_id)
  WHERE grt_id IS NOT NULL;

COMMENT ON TABLE public.zd_estimate_order_snapshots IS
  'Nagłówki ZD z Subiekta (:5082) powiązane ze szacunkiem — źródło historii zamówień.';

CREATE TABLE IF NOT EXISTS public.zd_estimate_order_snapshot_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL
    REFERENCES public.zd_estimate_order_snapshots(id) ON DELETE CASCADE,
  tw_id integer NOT NULL,
  tw_symbol text NULL,
  tw_nazwa text NOT NULL DEFAULT '',
  qty numeric NOT NULL,
  cel_at_link numeric NULL,
  delta_at_link numeric NULL,
  CONSTRAINT zd_estimate_order_snapshot_lines_tw_id_positive
    CHECK (tw_id > 0),
  CONSTRAINT zd_estimate_order_snapshot_lines_qty_nonneg
    CHECK (qty >= 0),
  CONSTRAINT zd_estimate_order_snapshot_lines_snapshot_tw_unique
    UNIQUE (snapshot_id, tw_id)
);

CREATE INDEX IF NOT EXISTS zd_estimate_order_snapshot_lines_tw_id_idx
  ON public.zd_estimate_order_snapshot_lines (tw_id);

COMMENT ON TABLE public.zd_estimate_order_snapshot_lines IS
  'Linie ZD z snapshotu — qty w sztukach (jednostki dokumentu × opakowanie przy zapisie).';

ALTER TABLE public.zd_estimate_order_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zd_estimate_order_snapshot_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zd_estimate_order_snapshots_ops
  ON public.zd_estimate_order_snapshots;
CREATE POLICY zd_estimate_order_snapshots_ops
  ON public.zd_estimate_order_snapshots
  FOR ALL
  TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

DROP POLICY IF EXISTS zd_estimate_order_snapshot_lines_ops
  ON public.zd_estimate_order_snapshot_lines;
CREATE POLICY zd_estimate_order_snapshot_lines_ops
  ON public.zd_estimate_order_snapshot_lines
  FOR ALL
  TO authenticated
  USING (public.is_operations())
  WITH CHECK (public.is_operations());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_estimate_order_snapshots
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zd_estimate_order_snapshot_lines
  TO authenticated;

NOTIFY pgrst, 'reload schema';
