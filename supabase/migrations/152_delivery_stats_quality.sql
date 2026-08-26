-- ============================================================
-- 152: Delivery stats quality — first_delivery_at, samples, skips, atomic incr
-- ============================================================

-- First warehouse receipt signal (partial or full)
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS first_delivery_at TIMESTAMPTZ;

COMMENT ON COLUMN individual_orders.first_delivery_at IS
  'Pierwsze przyjęcie (Czesciowo_zrealizowane lub Zrealizowane); nie nadpisywane.';

-- Backfill: terminal / partial z delivery_at
UPDATE individual_orders
SET first_delivery_at = delivery_at
WHERE first_delivery_at IS NULL
  AND delivery_at IS NOT NULL
  AND status IN ('Czesciowo_zrealizowane', 'Zrealizowane');

-- Per-order samples (survive order purge via ON DELETE SET NULL)
CREATE TABLE IF NOT EXISTS delivery_stats_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES individual_orders(id) ON DELETE SET NULL,
  placement_date DATE NOT NULL,
  delivery_date DATE NOT NULL,
  first_delivery_date DATE,
  business_days_full INTEGER NOT NULL CHECK (business_days_full >= 0),
  business_days_first INTEGER CHECK (business_days_first IS NULL OR business_days_first >= 0),
  order_type TEXT NOT NULL CHECK (order_type IN ('Glowne', 'Poboczne')),
  is_teeth BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'receive'
    CHECK (source IN ('receive', 'backfill', 'import')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS delivery_stats_samples_active_order_uidx
  ON delivery_stats_samples (order_id)
  WHERE deleted_at IS NULL AND order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS delivery_stats_samples_supplier_active_idx
  ON delivery_stats_samples (supplier_id, placement_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS delivery_stats_samples_source_idx
  ON delivery_stats_samples (source)
  WHERE deleted_at IS NULL;

ALTER TABLE delivery_stats_samples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_stats_samples_select ON delivery_stats_samples;
CREATE POLICY delivery_stats_samples_select ON delivery_stats_samples FOR SELECT USING (
  (select private.is_admin())
  OR ((select private.is_operations()) AND NOT (select private.is_admin()))
);
DROP POLICY IF EXISTS delivery_stats_samples_admin_insert ON delivery_stats_samples;
CREATE POLICY delivery_stats_samples_admin_insert ON delivery_stats_samples
  FOR INSERT WITH CHECK ((select private.is_admin()));
DROP POLICY IF EXISTS delivery_stats_samples_admin_update ON delivery_stats_samples;
CREATE POLICY delivery_stats_samples_admin_update ON delivery_stats_samples
  FOR UPDATE USING ((select private.is_admin()))
  WITH CHECK ((select private.is_admin()));
DROP POLICY IF EXISTS delivery_stats_samples_admin_delete ON delivery_stats_samples;
CREATE POLICY delivery_stats_samples_admin_delete ON delivery_stats_samples
  FOR DELETE USING ((select private.is_admin()));

-- Skip instrumentation (ops diagnostics)
CREATE TABLE IF NOT EXISTS delivery_stats_skip_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  supplier_id UUID,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_stats_skip_events_created_idx
  ON delivery_stats_skip_events (created_at DESC);

ALTER TABLE delivery_stats_skip_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_stats_skip_events_select ON delivery_stats_skip_events;
CREATE POLICY delivery_stats_skip_events_select ON delivery_stats_skip_events FOR SELECT USING (
  (select private.is_admin())
  OR ((select private.is_operations()) AND NOT (select private.is_admin()))
);
DROP POLICY IF EXISTS delivery_stats_skip_events_admin_insert ON delivery_stats_skip_events;
CREATE POLICY delivery_stats_skip_events_admin_insert ON delivery_stats_skip_events
  FOR INSERT WITH CHECK ((select private.is_admin()));
DROP POLICY IF EXISTS delivery_stats_skip_events_admin_delete ON delivery_stats_skip_events;
CREATE POLICY delivery_stats_skip_events_admin_delete ON delivery_stats_skip_events
  FOR DELETE USING ((select private.is_admin()));

-- Atomic increment (eliminates read-modify-write race)
CREATE OR REPLACE FUNCTION public.increment_delivery_stats(
  p_supplier_id UUID,
  p_delivery_days INTEGER,
  p_order_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_order_type = 'Glowne' THEN
    INSERT INTO delivery_stats (
      supplier_id, main_sum, main_count, main_avg,
      side_sum, side_count, side_avg, updated_at
    ) VALUES (
      p_supplier_id, p_delivery_days, 1, p_delivery_days,
      NULL, NULL, NULL, now()
    )
    ON CONFLICT (supplier_id) DO UPDATE SET
      main_sum = COALESCE(delivery_stats.main_sum, 0) + EXCLUDED.main_sum,
      main_count = COALESCE(delivery_stats.main_count, 0) + 1,
      main_avg = ROUND(
        (COALESCE(delivery_stats.main_sum, 0) + EXCLUDED.main_sum)::numeric
        / (COALESCE(delivery_stats.main_count, 0) + 1)
      ),
      updated_at = now();
  ELSIF p_order_type = 'Poboczne' THEN
    INSERT INTO delivery_stats (
      supplier_id, main_sum, main_count, main_avg,
      side_sum, side_count, side_avg, updated_at
    ) VALUES (
      p_supplier_id, NULL, NULL, NULL,
      p_delivery_days, 1, p_delivery_days, now()
    )
    ON CONFLICT (supplier_id) DO UPDATE SET
      side_sum = COALESCE(delivery_stats.side_sum, 0) + EXCLUDED.side_sum,
      side_count = COALESCE(delivery_stats.side_count, 0) + 1,
      side_avg = ROUND(
        (COALESCE(delivery_stats.side_sum, 0) + EXCLUDED.side_sum)::numeric
        / (COALESCE(delivery_stats.side_count, 0) + 1)
      ),
      updated_at = now();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_delivery_stats(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_delivery_stats(UUID, INTEGER, TEXT) TO service_role;
