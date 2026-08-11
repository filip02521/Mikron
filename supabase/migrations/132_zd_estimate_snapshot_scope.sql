-- Scope + host for zd_estimate_order_snapshots history filtering.
-- Policz: tylko snapshoty tego samego dostawcy (kh) + zakresu (cecha/grupa) + hosta.

ALTER TABLE public.zd_estimate_order_snapshots
  ADD COLUMN IF NOT EXISTS scope_mode text NULL,
  ADD COLUMN IF NOT EXISTS cecha_id integer NULL,
  ADD COLUMN IF NOT EXISTS host_kind text NOT NULL DEFAULT 'orders_test',
  ADD COLUMN IF NOT EXISTS eligible_for_history boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'zd_estimate_order_snapshots_scope_mode_check'
  ) THEN
    ALTER TABLE public.zd_estimate_order_snapshots
      ADD CONSTRAINT zd_estimate_order_snapshots_scope_mode_check
      CHECK (scope_mode IS NULL OR scope_mode IN ('grupa', 'cecha'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'zd_estimate_order_snapshots_host_kind_check'
  ) THEN
    ALTER TABLE public.zd_estimate_order_snapshots
      ADD CONSTRAINT zd_estimate_order_snapshots_host_kind_check
      CHECK (host_kind IN ('orders_test', 'live'));
  END IF;
END $$;

UPDATE public.zd_estimate_order_snapshots
SET host_kind = 'orders_test'
WHERE host_kind IS NULL OR host_kind = '';

CREATE INDEX IF NOT EXISTS zd_estimate_order_snapshots_host_kh_cecha_linked_idx
  ON public.zd_estimate_order_snapshots (host_kind, supplier_kh_id, cecha_id, linked_at DESC);

CREATE INDEX IF NOT EXISTS zd_estimate_order_snapshots_host_kh_grt_linked_idx
  ON public.zd_estimate_order_snapshots (host_kind, supplier_kh_id, grt_id, linked_at DESC);

COMMENT ON COLUMN public.zd_estimate_order_snapshots.scope_mode IS
  'grupa | cecha — kontekst szacunku przy zapisie; NULL = legacy.';
COMMENT ON COLUMN public.zd_estimate_order_snapshots.cecha_id IS
  'Cecha Subiekta gdy scope_mode=cecha.';
COMMENT ON COLUMN public.zd_estimate_order_snapshots.host_kind IS
  'orders_test (:5082) | live — nie mieszać historii między hostami.';
COMMENT ON COLUMN public.zd_estimate_order_snapshots.eligible_for_history IS
  'false gdy ZD spełnione (status 8) — nie używaj w history_slow / sales_spike.';

NOTIFY pgrst, 'reload schema';
