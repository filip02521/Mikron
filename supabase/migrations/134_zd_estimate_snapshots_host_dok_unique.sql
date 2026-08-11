-- Snapshoty ZD: unikaty per host (live vs test mogą mieć ten sam dok_id).
-- Wcześniej UNIQUE (dok_id) nadpisywałby wiersz orders_test przy create na live.

ALTER TABLE public.zd_estimate_order_snapshots
  DROP CONSTRAINT IF EXISTS zd_estimate_order_snapshots_dok_id_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'zd_estimate_order_snapshots_host_dok_unique'
  ) THEN
    ALTER TABLE public.zd_estimate_order_snapshots
      ADD CONSTRAINT zd_estimate_order_snapshots_host_dok_unique
      UNIQUE (host_kind, dok_id);
  END IF;
END $$;

COMMENT ON TABLE public.zd_estimate_order_snapshots IS
  'Nagłówki ZD z Subiekta (host ORDERS: live :5080 lub test :5082) powiązane ze szacunkiem — źródło historii. Unikat: (host_kind, dok_id).';

COMMENT ON COLUMN public.zd_estimate_order_snapshots.host_kind IS
  'orders_test (:5082) | live (:5080, aktualna baza) — unikaty i filtry historii per host.';

NOTIFY pgrst, 'reload schema';
